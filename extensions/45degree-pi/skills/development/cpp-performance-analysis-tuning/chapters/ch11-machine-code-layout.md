# Chapter 11: Machine Code Layout Optimizations

## Core Idea

CPU Frontend（取指与解码）在指令缓存（I-cache）、µop 缓存（DSB）和指令 TLB（ITLB）不足时成为瓶颈。本章系统性地介绍了从基本块级到函数级、再到链接器和后链接工具（BOLT/Propeller）的代码布局优化技术，旨在提高指令缓存的利用率和取指吞吐量。

## Frameworks Introduced

- **TMA Frontend Bound 指标**:
  - When to use: 当 CPU 后端等待指令而前端无法供给时，此指标指示 Frontend 瓶颈。
  - How: 正常值 < 10%，> 20% 值得投入时间优化代码布局。
- **PGO (Profile Guided Optimization) / FDO**:
  - When to use: 大型代码库（百万行级）且 Frontend Bound 较高的应用。
  - How: 三步流程——1) `-fprofile-instr-generate` 编译 instrumented 二进制；2) 使用代表性 workload 运行生成 profile；3) `-fprofile-instr-use` 重新编译。
- **AutoFDO (Sample-based PGO)**:
  - When to use: 无法承受 instrumented 二进制 5–10x 运行时开销的生产环境。
  - How: 使用 Linux perf 收集采样数据，通过 AutoFDO 转换为编译器可用的 profile 格式。
- **BOLT / Propeller (Post-link Optimizers)**:
  - When to use: 需要更激进的代码布局优化（基本块重排、函数拆分/重排），可与 PGO 叠加使用。
  - How: BOLT 反汇编二进制 → 基于 profile 重排 → 重新链接；Propeller 通过链接器输入实现分布式扩展。
- **Huge Pages for Code (2MB pages)**:
  - When to use: ITLB 开销显著（TMA 中 ITLB 指标高）且代码段较大（> 1MB）的应用。
  - How: 链接时 `-Wl,-zcommon-page-size=2097152 -Wl,-zmax-page-size=2097152`，或运行时通过 `hugeedit` / `iodlr` 重映射。

## Key Concepts

- **Basic Block**: 单入口、单出口的指令序列，保证每条指令只执行一次。
- **Fallthrough**: 条件不满足时顺序执行的下一条指令；保持 hot code 连续（fallthrough）可减少 taken branch 数量。
- **Taken Branch Cost**: 取指单元按对齐块取指，taken branch 导致跳转后的 fetch block 字节被浪费，降低有效取指吞吐量。
- **DSB (Decode Stream Buffer / µop-cache)**: 缓存已解码的 µop，避免重复解码；其命中率依赖于代码布局。
- **ITLB (Instruction TLB)**: 缓存指令页的虚拟-物理地址翻译；大代码段分散时容易发生 ITLB miss。
- **Code Footprint**: 程序执行期间实际触及的指令字节数，不等于二进制大小。
- **HFSort / CDSort**: 基于 profile 的函数重排序算法，Meta 将其用于大规模分布式服务获得 ~2% 加速。
- **LTO (Link-Time Optimization)**: 链接时优化，跨编译单元内联和精简，减小 hot region 体积。

## Mental Models

- **Think of code layout as the "data layout of instructions"**: 就像数据缓存需要局部性一样，指令缓存也需要 hot code 紧密排列。
- **Use `[[likely]]` / `[[unlikely]]` as a hint, not a command**: 编译器据此调整分支排放（invert condition + fallthrough hot path）并影响内联决策。
- **Use PGO/BOLT when manual function reordering is impractical**: 对于百万行级代码，手动调整布局不可行；PGO/BOLT 是唯一实际的选择。
- **Think of ITLB misses as "insufficient page-level granularity for hot code"**: 当 hot code 分散分布在多个 4KB 页面上时，将代码映射到 2MB 大页可减少 TLB 压力。

## Anti-patterns

- **盲目使用 `-mllvm -align-all-blocks=N` 全局对齐**: 这会为翻译单元中所有函数插入 NOP，增加代码体积、损害 I-cache 利用率。应使用 `[[clang::code_align(N)]]` 精确控制热循环。
- **在 PGO 中使用非代表性 workload**: 编译器"盲目"信任 profile，非典型输入会导致对典型场景的性能退化。可以使用多组 profile 合并。
- **对小型应用使用大页**: 代码段仅几 KB 时，使用 2MB 大页浪费内存资源，且无实际收益。
- **对 compute-bound 应用期望 PGO 带来大幅提升**: PGO 主要优化 Frontend 瓶颈；计算密集型应用（如科学计算）可能无收益。

## Code Examples

```cpp
// Basic block placement: [[unlikely]] hint (C++20)
// hot path
if (cond) [[unlikely]]
    coldFunc();
// hot path again
```

```c
// Pre-C++20 equivalent using __builtin_expect
#define LIKELY(EXPR)   __builtin_expect((bool)(EXPR), true)
#define UNLIKELY(EXPR) __builtin_expect((bool)(EXPR), false)
if (UNLIKELY(cond))
    coldFunc();
```

```cpp
// Loop alignment using Clang attribute
void benchmark_func(int* a) {
    [[clang::code_align(64)]]
    for (int i = 0; i < 32; ++i)
        a[i] += 1;
}
```

```c
// Function splitting: outline cold code
void foo(bool cond1, bool cond2) {
    // hot path
    if (cond1) { cold1(); }  // cold1() is noinline
    // hot path
    if (cond2) { cold2(); }  // cold2() is noinline
}
void cold1() __attribute__((noinline)) { /* cold code */ }
void cold2() __attribute__((noinline)) { /* cold code */ }
```

```shell
# Function reordering with LLD linker
$ clang -ffunction-sections -c *.c
$ ld.lld --symbol-ordering-file=order.txt *.o
```

```shell
# PGO workflow with Clang
$ clang -fprofile-instr-generate -o prog.prof tool.cpp
$ ./prog.prof < representative_input > /dev/null
$ llvm-profdata merge -output=code.profdata default.profraw
$ clang -fprofile-instr-use=code.profdata -o prog.opt tool.cpp
```

```shell
# Remap code section to huge pages
$ hugeedit --text /path/to/clang++
# or at runtime with LD_PRELOAD
$ LD_PRELOAD=/usr/lib64/liblppreload.so clang++ a.cpp
```

## Worked Example

**场景**: Clang 编译器编译大型 C++ 项目。`.text` 段 67 MB，但 non-cold code footprint 仅约 5 MB，分散在 6614 个 4KB 页面上（page utilization 仅 19%），Frontend Bound 高达 52.3%。

**分析工具**:
1. `perf-tools` 测量 code footprint（需 Intel LBR 支持）
2. `llvm-bolt-heatmap` 生成代码热力图
3. TMA 进一步下钻 `ICache_Misses`、`ITLB_Misses`、DSB coverage

**推荐优化方案**:
- 使用 PGO（instrumented 或 AutoFDO）改善函数内联和基本块布局
- 使用 BOLT 进行函数拆分 + 函数重排序 + hot code 大页映射（`-hugify`）
- 配合 LTO 减少跨模块冗余代码

**预期收益**: 典型 PGO 加速 10–30%；BOLT 叠加可额外获得 5–10%。

## Key Takeaways

1. **Frontend Bound > 20% 时值得优化代码布局**；I-cache / ITLB miss 是大型应用的主要性能杀手。
2. **基本块级优化**（保持 fallthrough、热循环对齐）通常由编译器自动完成，可以通过 `[[likely]]` / `[[clang::code_align]]` 进一步引导。
3. **函数拆分（Function Splitting）** 将冷代码从热路径中移除，改善 I-cache/µop-cache 利用率。
4. **函数重排序（Function Reordering）** 将热函数紧凑排列，减少缓存行碎片；链接器脚本或 LLD 的 `--symbol-ordering-file` 可手动控制。
5. **PGO 是大型代码库最实用的代码布局优化手段**，但需要维护代表性 profile 并处理 profile 过期问题。
6. **BOLT / Propeller 可在 PGO 基础上额外提升**，它们利用硬件采样信息进行二进制级改写（如分支到 CMOV 的转换需知分支误预测率）。
7. **2MB 大页可将 ITLB miss 减少高达 50%**，但只对代码段 > 1MB 的应用有价值。

## Connects To

- **Ch 10 Optimizing Branch Prediction**: PGO 和 BOLT 通过减少 taken branch 和提高 fallthrough 率间接改善分支预测。
- **Ch 3.8.1 µop-cache (DSB)**: 代码布局直接影响 µop-cache 的命中率。
- **Ch 3.7.1 TLB**: ITLB 的工作原理和 huge pages 对 TLB pressure 的缓解机制。
- **Ch 6.1 TMA**: Frontend Bound 是 TMA 顶层指标之一，引导代码布局优化方向。
