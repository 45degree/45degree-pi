# Chapter 9: Optimizing Computations

## Core Idea

Once memory access is optimized, the next target is compute bottlenecks (TMA: CoreBound and Retiring categories). Key techniques include breaking data dependency chains to increase ILP, inlining functions with hot prologues, applying loop transformations, and harnessing SIMD vectorization via autovectorization, intrinsics, or domain-specific languages like ISPC.

## Frameworks Introduced

- **TMA CoreBound / Retiring categories**: CoreBound = stalls in OOO engine not from memory (data dependencies or execution-port contention); Retiring = instructions being retired, but may hide inefficient scalar code.
  - When to use: TMA shows high CoreBound → apply dependency-chain breaking, loop optimizations, or vectorization.
  - How: identify critical path via back-of-envelope latency analysis; check Retiring > 80% as a signal to inspect for missed vectorization.

- **Compiler Optimization Reports** (`-Rpass*` for Clang, `-fopt-info` for GCC):
  - When to use: check if a loop was vectorized, unrolled, or why vectorization failed.
  - How: `clang++ -O3 -march=core-avx2 -Rpass=loop-vectorize -Rpass-missed=loop-vectorize -Rpass-analysis=loop-vectorize`.

- **Intel ISPC (Implicit SPMD Program Compiler)**: C-like language for SIMD parallelism.
  - When to use: autovectorization fails or is unpredictable; hand-written intrinsics are too verbose.
  - How: write `.ispc` files with `export`, `uniform`, `varying`, `foreach`; compile to object files linkable with C++.

- **Highway (portable intrinsics wrapper)**: C++ library providing portable SIMD operations across SSE/AVX/NEON.
  - When to use: need readable, portable vector code with more control than autovectorization but less verbosity than raw intrinsics.
  - How: `#include <hwy/highway.h>`, use `ScalableTag<float>`, `LoadU`, `Add`, `ReduceSum`.

- **Compiler Intrinsics** (`<immintrin.h>` for x86, ARM NEON intrinsics):
  - When to use: compiler fails to generate required assembly and inline assembly is too risky.
  - How: 1:1 mapping to instructions (e.g., `_mm_loadu_ps`, `_mm_add_ps`). Must handle remainder loops and alignment manually.

## Key Concepts

- **Data dependency chain**: sequence of instructions where each depends on the previous; limits ILP and forces sequential execution.
- **Loop-carried dependency**: a dependency spanning multiple iterations (e.g., pointer chasing, RNG state). The critical path determines minimum loop latency.
- **Instruction-Level Parallelism (ILP)**: number of independent instructions executed simultaneously by superscalar OOO cores.
- **Critical path rule**: if an instruction is on the critical path, optimize for **latency**; otherwise optimize for **throughput**.
- **LICM (Loop Invariant Code Motion)**: hoist loop-invariant expressions outside the loop.
- **Loop Strength Reduction (LSR)**: replace expensive operations (multiply) with cheaper ones (addition) via induction variable analysis (SCEV in LLVM).
- **Loop Unrolling**: reduce loop overhead (compare+branch) by executing multiple iterations per jump.
- **Loop Blocking (Tiling)**: partition multi-dimensional iteration space into blocks that fit in private caches (L1/L2).
- **Loop Fusion/Distribution**: combine adjacent loops (better locality) or split large loops (better cache utilization, lower register pressure).
- **Autovectorization**: compiler's automatic transformation of scalar loops into SIMD code; checked by legality, profitability, then transformation.
- **SLP (Superword-Level Parallelism) vectorization**: gluing independent scalar operations within a single loop iteration into vector operations.
- **Tail Call Optimization (TCO)**: reuse current stack frame for recursive tail calls, replacing `call` with `jmp`.
- **`__builtin_prefetch`**: hint to CPU to bring a cache line; used in Ch8 and referenced here for context.

## Mental Models

- **Latency vs throughput rule**: on the critical path → worry about latency; off the critical path → worry about throughput. Use back-of-envelope cycle counting to estimate which dominates.
- **Break-into-parallel-chains technique**: when a single dependency chain limits loop throughput, split state into N independent chains and interleave/unroll to feed the CPU's OOO engine with multiple parallel streams.
- **Vectorization falls into four patterns**: (1) illegal (fixable with `restrict` / `-ffast-math`), (2) not profitable (force with `#pragma` but measure), (3) vectorized but scalar runs (trip count too small), (4) vectorized suboptimally (disable or use intrinsics).
- **Compiler as first resort, intrinsics as last resort**: compilers handle 90% of loop/vectorization cases; manually intervene only when optimization reports confirm failure.

## Anti-patterns

- **Manual loop unrolling for performance**: compilers and the OOO engine ("embedded unroller" in ROB) already do this; manual unrolling bloats code and may hurt I-cache. Only unroll manually to break dependency chains (Listing 9.2).
- **Forcing vectorization when bandwidth-bound**: vectorization increases computation rate but may not help if the CPU is already stalled waiting for memory. Profile first.
- **Blindly using `-ffast-math` across large codebases**: alters behavior for NaN, signed zero, infinity, subnormals. Use scoped pragmas (`#pragma clang fp reassociate(on)`) since Clang 18.
- **Assuming vectorized code always runs**: if loop trip count is small, the scalar remainder loop may execute instead. Check the profiler: if vector code is cold, reduce VF/unroll count.
- **Ignoring the prologue/epilogue overhead**: hot `PUSH`/`POP` hints at inlining opportunity — but verify performance change before adding `always_inline`.

## Code Examples

**Breaking dependency chains (RNG, Listing 9.1 → 9.2)**:
```cpp
// Original: single RNG state creates 6-cycle loop-carried dependency
XorShift32 rng(seed);
for (int i = 0; i < STEPS; i++)
    for (auto &p : particles) {
        uint32_t angle = rng.gen();
        // ... compute motion
    }

// Optimized: two RNGs, two independent chains, 2x speedup
XorShift32 rng1(seed1), rng2(seed2);
for (int i = 0; i < STEPS; i++)
    for (int j = 0; j + 1 < particles.size(); j += 2) {
        uint32_t angle1 = rng1.gen();
        uint32_t angle2 = rng2.gen();
        // process particle[j] and particle[j+1] independently
    }
```

**Function inlining hint**:
```cpp
[[gnu::always_inline]] int foo() {
    // function body
}
```

**LICM (Loop Invariant Code Motion)**:
```cpp
// Before                    // After
for (int i = 0; i < N; i++) for (int i = 0; i < N; i++) {
    for (int j = 0; j < N; j++) auto temp = c[i];
        a[j] = b[j] * c[i];     for (int j = 0; j < N; j++)
}                                   a[j] = b[j] * temp;
                                }
```

**Loop Unswitching**:
```cpp
// Before
for (i = 0; i < N; i++) {
    a[i] += b[i];
    if (c) b[i] = 0;
}
// After
if (c) for (i = 0; i < N; i++) { a[i] += b[i]; b[i] = 0; }
else   for (i = 0; i < N; i++) { a[i] += b[i]; }
```

**Loop Blocking (Tiling)**:
```cpp
// Linear traversal (poor cache reuse)
for (int i = 0; i < N; i++)
    for (int j = 0; j < N; j++)
        a[i][j] += b[j][i];   // column-major on b

// 8×8 tiled traversal (better L1 reuse)
for (int ii = 0; ii < N; ii += 8)
    for (int jj = 0; jj < N; jj += 8)
        for (int i = ii; i < ii + 8; i++)
            for (int j = jj; j < jj + 8; j++)
                a[i][j] += b[j][i];
```

**Compiler array sum with `-ffast-math`**:
```cpp
// Without -ffast-math: not vectorized (non-associative FP)
float calcSum(float* a, unsigned N) {
    float sum = 0.0f;
    for (unsigned i = 0; i < N; i++) sum += a[i];
    return sum;
}
// With `-ffast-math`: vectorized (vectorization width: 4, interleaved count: 2)
```

**ISPC version**:
```c
export uniform float calcSum(const uniform float array[], uniform ptrdiff_t count) {
    varying float sum = 0;
    foreach (i = 0 ... count)
        sum += array[i];
    return reduce_add(sum);
}
```

**Highway (portable intrinsics wrapper)**:
```cpp
#include <hwy/highway.h>
float calcSum(const float* HWY_RESTRICT array, size_t count) {
    const ScalableTag<float> d;
    auto sum = Zero(d);
    size_t i = 0;
    for (; i + Lanes(d) <= count; i += Lanes(d))
        sum = Add(sum, LoadU(d, array + i));
    return ReduceSum(d, sum);
}
```

## Worked Example

**Random Particle Motion — Breaking Dependency Chains (Section 9.1)**:

A 2D particle simulation uses a custom XorShift32 RNG with a 6-cycle loop-carried dependency (3 `eor` + `lsl` pairs). All other computation (sine/cosine approximation, velocity updates) is off the critical path. The original code runs at 6 cycles/iteration minimum, with IPC 4.0.

The author introduces a **second RNG instance** and manually unrolls the loop by 2, so even and odd particles use independent RNG states. This breaks the single dependency chain into two parallel chains. On Apple M1, runtime drops from 19ms to 10ms (near 2x speedup), IPC rises to 7.1. Cache misses and branch mispredictions remain negligible, confirming the bottleneck was indeed the dependency chain.

**Key insight**: modern CPUs are wide enough to run multiple dependency chains in parallel. For M1, 2 chains saturate the hardware; for future wider CPUs, more chains may help.

## Key Takeaways

1. Identify the critical dependency chain in hot loops — that chain determines minimum iteration latency. Use back-of-envelope latency estimates to assess limits.
2. Break long dependency chains by duplicating state (multiple RNGs, multiple accumulators) and interleaving work. This feeds the OOO engine with independent work.
3. Use compiler optimization reports (`-Rpass*`, `-fopt-info`) as the primary tool to discover vectorization failures; address them with `restrict`, `#pragma`, or `-ffast-math` (scoped).
4. Loop blocking (tiling) is the go-to transformation for GEMM-like algorithms that repeatedly access multi-dimensional arrays with mixed traversal patterns.
5. For compute-bound code where autovectorization fails, prefer ISPC or Highway over raw intrinsics — they offer better readability, portability, and often match hand-tuned performance.
6. Function inlining pays off when prologue/epilogue is hot (many `PUSH`/`POP` instructions), but always measure before adding `always_inline`.
7. Retiring > 80% does not guarantee efficiency — it may hide scalar code that should be vectorized.

## Connects To

- **Ch3 (OOO execution, SIMD, pipeline)**: foundational understanding of ILP, execution ports, and vector ISA.
- **Ch6 (TMA)**: CoreBound and Retiring categories are the triggers for this chapter.
- **Ch8 (Memory optimization)**: clear memory bottlenecks first; then apply compute optimizations.
- **Ch10 (Branch Prediction)**: BadSpeculation is another TMA category that can limit ILP.
- **Ch11 (Machine Code Layout)**: FrontendBound category affects how quickly instructions are delivered to execution.
- **Ch12 (low-latency)**: register-pressure management, critical-path analysis in latency-sensitive code.
