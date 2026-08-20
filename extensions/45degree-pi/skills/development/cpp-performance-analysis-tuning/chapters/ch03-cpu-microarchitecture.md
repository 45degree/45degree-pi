# Chapter 3: CPU Microarchitecture

## Core Idea
CPU microarchitecture details -- pipelining, out-of-order execution, superscalar engines, speculative execution, SIMD, cache hierarchy, and virtual memory -- directly determine how fast a given program runs. Understanding these mechanisms lets you write code that exploits Instruction-Level Parallelism (ILP) and avoids pipeline stalls.

## Frameworks Introduced

- **Tomasulo Algorithm for Dynamic Scheduling**: Out-of-order execution via register renaming, reservation stations, and a reorder buffer (ROB).
  - When to use: all modern OOO CPUs use this; understand its implications for dependency chains and ILP extraction.
  - How: instructions are placed in the ROB in program order, renamed (WAR/WAW eliminated), dispatched to Reservation Stations (RS), executed out of order when operands are ready, then retired in program order.

- **Ideal 5-Stage Pipeline Model (DLX)**: IF -> ID -> EXE -> MEM -> WB as the baseline for understanding pipeline hazards.
  - When to use: reasoning about structural, data, and control hazards in any pipelined CPU.
  - How: throughput = 1 instruction/cycle in steady state; latency = 5 cycles; slowest stage sets the clock frequency.

- **Memory Hierarchy Model (Temporal + Spatial Locality)**: Caches exploit locality to hide DRAM latency.
  - When to use: designing data structures and access patterns for performance.
  - How: pack related data tightly (spatial), reuse hot data (temporal). Average access latency = Hit Time + Miss Rate * Miss Penalty.

- **Speculative Execution + Branch Prediction Framework**: Predict-then-verify; mispredictions flush the pipeline.
  - When to use: analyzing unpredictable branches in hot code.
  - How: BPU + BTB predict next fetch address; speculative results marked in ROB; misprediction flushes and restarts.

## Key Concepts

- **ISA (Instruction Set Architecture)**: The contract between software and hardware defining registers, operations, and memory addressing. Examples: x86-64, Armv8-A, RISC-V.
- **Pipeline Hazard**: A condition that prevents the next instruction in the pipeline from executing in the next clock cycle (structural, data, or control).
- **Register Renaming**: Mapping logical architectural registers (e.g., 16 GPRs) onto a larger pool of physical registers to eliminate false dependencies (WAR, WAW).
- **RAW (Read-After-Write)**: A true dependency that must be preserved; mitigated by data forwarding (bypassing).
- **ROB (Reorder Buffer)**: A circular buffer tracking instruction state; size determines how far OOO hardware can look ahead for scheduling.
- **Issue Width**: The maximum number of instructions a superscalar CPU can dispatch per cycle (typical 6-9 in 2024 CPUs).
- **SIMD (Single Instruction Multiple Data)**: One instruction operates on multiple data elements in parallel using vector registers and lanes.
- **SMT (Simultaneous Multithreading / Hyper-Threading)**: Multiple logical cores share one physical core's execution resources, filling unused issue slots.
- **Cache Line**: The minimum unit of data transfer between cache levels (typically 64 bytes; Apple L2 uses 128 bytes).
- **Set-Associative Cache**: A cache organized into sets where a block maps to a set (via index bits) and can be placed in any way within that set.
- **TLB (Translation Lookaside Buffer)**: A hardware cache for virtual-to-physical page translations, organized as a hierarchy (L1 ITLB / DTLB + L2 STLB).
- **Huge Pages**: Larger page sizes (e.g., 2MB on x86) that reduce TLB pressure by covering more memory per TLB entry.
- **PMU (Performance Monitoring Unit)**: Hardware counters (PMCs) for collecting events like cycles, instructions retired, cache misses, and branch mispredictions.

## Mental Models

- **Pipeline as Assembly Line**: Think of the CPU pipeline like a car factory. Each instruction passes through stages (fetch, decode, execute, memory, write-back). All stages work simultaneously on different instructions. The slowest station sets the throughput.
- **Register Renaming as Alias Resolution**: Think of architectural registers as variable names and physical registers as memory addresses. WAR/WAW hazards are like two variables with the same name that can be renamed to eliminate conflicts, just like `int x = 1; int y = x + 1;` vs `int tmp1 = 1; int y = tmp1 + 1;`.
- **Cache Hierarchy as a Storage Pyramid**: Registers (fastest, smallest) at the top, then L1 (ns, KB), L2, L3 (tens of MB), DRAM (100+ ns, GB), disk. Every level is ~10x larger and ~10x slower. Optimize for L1 hits.
- **Speculative Execution as Betting**: The CPU bets on branch direction. Correct bets (predictions) save cycles; wrong bets (mispredictions) cost a full pipeline flush. The goal is >95% prediction accuracy.

## Anti-patterns

- **Long Dependency Chains in Hot Loops (Loop-Carried Dependencies)**: RAW dependencies survive register renaming and serializes execution. OOO cannot break true dependencies. Restructure to break chains or unroll.
- **Sharing SMT Cores with Uncontrolled "Noisy Neighbors"**: A sibling thread can evict L1/L2 data, compete for execution ports, and cause unpredictable performance. Pin critical threads to dedicated physical cores or isolate SMT siblings.
- **Ignoring Huge Pages for Large Working Sets**: A 10MB data set on 4KB pages requires 2560 TLB entries, far exceeding L1 DTLB (96 entries on Golden Cove). TLB misses add costly page walks. Use 2MB huge pages to cover the same set with 5 entries.
- **Non-Sequential Access Patterns Confusing Hardware Prefetchers**: Hardware prefetchers recognize stride patterns. Random access or pointer-chasing loops cause cache misses and stall the pipeline. Prefer linear access.
- **Operating on Partial Cache Lines (Write Allocate Penalty)**: A partial store to a cache line forces a read-modify-write cycle. Streaming stores or full-line writes avoid this penalty.

## Code Examples

```txt
; RAW hazard example -- data forwarding
R1 = R0 ADD 1
R2 = R1 ADD 2   ; RAW on R1
```

```txt
; WAR hazard elimination via register renaming
; Before (architectural):       After (physical):
R1 = R0 ADD 1      =>    R101 = R100 ADD 1
R0 = R2 ADD 2      =>    R103 = R102 ADD 2
```

```txt
; WAW hazard elimination via register renaming
; Before (architectural):           After (physical):
R1 = R0 ADD 1            =>    R101 = R100 ADD 1
R2 = R1 SUB R3           =>    R102 = R101 SUB R3  ; RAW preserved
R1 = R0 MUL 3            =>    R104 = R100 MUL 3   ; WAW+WAR eliminated
```

```c
// SIMD vectorization example
double *a, *b, *c;
for (int i = 0; i < N; ++i) {
    c[i] = a[i] + b[i];
}
```

```txt
; Querying PMU version (Linux)
$ cpuid
...
Architecture Performance Monitoring Features (0xa/eax):
    version ID = 0x4 (4)
    number of counters per logical processor = 0x4 (4)
    bit width of counter = 0x30 (48)
...
```

## Worked Example

**Register Renaming on a WAR/WAW Chain with 3 Instructions:**

Given the assembly:
```
R1 = R0 ADD 1     ; I1
R2 = R1 SUB R3    ; I2 -- RAW on R1 (must be preserved)
R1 = R0 MUL 3     ; I3 -- WAW + WAR on R1
```

The original code has all three hazard types:
- I1->I2: RAW on R1 (truly dependent, I2 must read what I1 produces)
- I3: WAW on R1 (I3 writes R1 before I1 writes R1) and WAR on R1 (I3 writes R1 before I2 reads R1)

After register renaming with a large physical register file:
```
R101 = R100 ADD 1    ; I1 -- R1 renamed to R101
R102 = R101 SUB R3   ; I2 -- RAW preserved (reads R101 not R1)
R104 = R100 MUL 3    ; I3 -- R1 renamed to R104 (new destination)
```

- I2 still waits for I1 (RAW preserved -- this is correct)
- I3 can now execute in parallel with I1 (WAR and WAW eliminated)
- The OOO scheduler can reorder I3 ahead of I2 without affecting correctness

From a performance perspective: the MUL (I3) is independent of the ADD (I1) and SUB (I2). Without renaming, I3 would be serialized behind I1 because it writes the same register. With renaming, the CPU can execute I1 and I3 in parallel if execution ports are available, improving ILP.

## Key Takeaways

1. **RAW dependencies are the real limit on ILP** -- WAR and WAW are false dependencies eliminated by register renaming. True dependency chains (RAW) are the bottleneck in OOO execution.
2. **Branch mispredictions are expensive** (10-20+ cycle penalty). Prefer branchless code, use `likely/unlikely` hints, and profile branch prediction rates for hot branches.
3. **SIMD width matters**: 256-bit vectors process 4 doubles per instruction. Use compiler autovectorization or intrinsics; handle loop remainders explicitly.
4. **Cache misses dominate latency**: A 48KB L1 hit is ~4 cycles; a DRAM access is ~100+ ns (~300+ cycles). Design data structures for sequential access and cache-line-sized granularity.
5. **Huge pages reduce TLB misses dramatically**: A single 2MB huge page covers 512 standard 4KB pages. Use `mmap` with `MAP_HUGETLB` or `madvise` with `MADV_HUGETLB` for large working sets.
6. **SMT gives throughput but hurts predictability**: Shared L1/L2 caches and execution ports cause noisy performance. Pin critical threads to dedicated cores when determinism is required.
7. **PMU counters are essential for diagnosis**: Measure L1/L2/L3 misses, branch mispredictions, and TLB misses. The number of counters is limited (<10), so multiplexing may be needed for wide event collection.

## Connects To

- **Ch 2 (Measuring Performance)**: The PMU (PMCs, fixed counters) is the hardware mechanism behind performance measurement tools like `perf`.
- **Ch 4 (Terminology & Metrics)**: Defines CPI, IPC, Uops, cache miss rates, branch mispredict rates -- all directly derived from the microarchitectural concepts in this chapter.
- **Ch 5 (Performance Analysis Approaches)**: Sampling and instrumentation tools use PMCs to identify bottlenecks rooted in microarchitecture.
- **Ch 8 (Memory Optimizations)**: Huge pages, prefetching, and cache-friendly data structures build directly on the memory hierarchy and TLB concepts covered here.
- **Concept: Tomasulo Algorithm vs. Scoreboarding**: Tomasulo wins because it renames registers (eliminating false dependencies), while Scoreboarding preserves WAW/WAR hazards. All modern OOO CPUs use Tomasulo-derived schemes.
- **Concept: 5-Level Paging (57-bit) on x86**: Extends the nested page table concept; used when >256TB of physical memory is needed (128 PB addressable).
