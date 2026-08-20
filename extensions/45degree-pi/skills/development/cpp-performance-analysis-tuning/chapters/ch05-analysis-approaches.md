# Chapter 5: Performance Analysis Approaches

## Core Idea

性能分析如同侦探工作——提出假设、设计实验、收集线索、验证结论。本章系统介绍了从底层到高层的六种主要性能分析方法：Code Instrumentation、Tracing、Performance Monitoring Events Counting、Sampling、Roofline Performance Model、Static Performance Analysis 和 Compiler Optimization Reports，以及如何根据场景选择合适的方法。

## Frameworks Introduced

- **Performance Monitoring Counters (PMCs) — Counting Mode**：在程序运行期间统计特定性能事件的总数。由 perf stat 实现，适合快速发现异常。
  - 何时使用：作为基准测试的轻量包装，快速评估 IPC、分支误预测率等宏观指标。
  - 方法：`perf stat -- ./my_program`，观察 anomalies 如低 IPC、高 branch-miss 率。
- **Performance Monitoring Counters — Sampling Mode (EBS)**：利用 PMC 溢出触发中断收集样本，定位热点。perf record/report 是典型工具。
  - 何时使用：需要找到程序中消耗最多 CPU cycles 的热点函数或指令时。
  - 方法：`perf record -F 1000 -- ./a.exe` → `perf report`，可使用硬件事件采样（EBS）获得更低开销（<1%）。
- **Roofline Performance Model**：面向吞吐量的性能模型，将程序性能上限约束在计算天花板（peak FLOPS）和内存天花板（peak bandwidth × arithmetic intensity）之间的最小者。
  - 何时使用：HPC 领域有少量计算密集循环的应用。不适合通用应用如编译器、浏览器、数据库。
  - 方法：计算算术强度（FLOPs/bytes），对照平台理论峰值绘制 roofline chart，寻找到达哪个天花板。

## Key Concepts

- **Code Instrumentation**：在源码中插入额外代码以采集运行时信息。优势是获取详细、特定的程序行为数据；劣势是需要重新编译、带来运行时开销（可高达 2x slowdown）、仅限用户态。
- **Tracing**：依赖预置的 instrumentation（如 strace 跟踪系统调用、Intel PT 跟踪指令），常作为黑盒方法。适合异常探索和精确重建执行流。
- **Multiplexing**：当需要的性能事件数量超过可用 PMC 数量时，工具以时间复用方式轮流测量各组事件。最终计数需按 `time_running / time_enabled` 缩放。适用于稳态负载，对多相位程序可能引入误差。
- **Skid**：采样中断发生时，实际触发事件的指令与中断被处理的指令之间的偏移。在乱序 CPU 中可达数百条指令，是准确定位问题的关键障碍。
- **Arithmetic Intensity**：FLOPs / bytes，Roofline 模型的 X 轴。低算术强度意味着内存带宽受限，高算术强度意味着计算受限。
- **Call Stack Collection**：通过 frame pointers、DWARF、或 LBR 三种方式采集，用于识别热点函数的调用上下文。
- **Dynamic Binary Instrumentation**：在已编译的可执行文件上动态插入分析代码（如 Intel Pin），无需重新编译，但较慢。

## Mental Models

- **性能分析的假设-验证循环**：形成假设 → 设计实验 → 收集数据 → 验证/证伪 → 精炼假设。每一步都是缩小问题空间的过程。
- **数据源分层模型**：软件层（OS、库、应用本身）提供 time、context switches、page faults；硬件层（CPU PMC）提供 cache misses、branch mispredictions 等。两者互补，不存在绝对的优劣。
- **Roofline 的优化指导**：如果程序点低于 scalar single-core 屋顶 → 尝试向量化和多线程（垂直移动）；如果算术强度低 → 改善内存访问模式（向右移动，可能同时向上）。理想目标是让每个循环点触及相应的天花板。
- **Counting vs. Sampling vs. Tracing 的选择三角**：
  - Counting：最快，适合宏观评估和异常检测
  - Sampling：中等开销，适合热点定位
  - Tracing：开销最大，数据最多，适合异常和短时事件分析

## Anti-patterns

- **在 instrumented 版本的代码上做性能基准测试**：instrumentation 代码（尤其是 hot path 上的）可能带来 2x+ slowdown，测量结果不代表原始程序行为。
- **对 5% 的性能波动不做分析**：大优化（2x, 3x）的根因显而易见，但 5% 的变化往往需要系统性的 perf analysis 来揭示。
- **盲目依赖直觉和随机实验**：猜测 loop unrolling、vectorization 等优化是否生效，而不使用 compiler optimization reports 验证，浪费时间和运气。
- **在不稳态负载上使用 multiplexing**：多相位程序在不同时间段表现出不同的性能特征，时间复用缩放会引入盲点和误差。

## Code Examples

```shell
# Counting mode: 快速获取性能事件和 IPC
$ perf stat -- ./my_program.exe
10580290629 cycles          # 3.677 GHz
8067576938 instructions      # 0.76 insn per cycle
3005772086 branches          # 1044.472 M/sec
239298395 branch-misses      # 7.96% of all branches

# Sampling mode: 定位热点
$ perf record -F 1000 -- ./x264 -o /dev/null --slow --threads 1 ...
[ perf record: Captured and wrote 1.625 MB perf.data (35035 samples) ]
$ perf report -n --stdio
# Overhead  Samples  Symbol
# ......    .......  ..........................
  7.50%     2620     x264_8_me_search_ref
  7.38%     2577     refine_subpel.lto_priv.0
  6.51%     2281     x264_8_pixel_satd_8x8_internal_avx2
  ...

# Call stack 收集（LBR 方法）
$ perf record --call-graph lbr -- ./a.out
$ perf report -n --stdio --no-children
# Overhead  Samples  Symbol
  99.96%    65217    foo
    |--55.52%--func1 → main → __libc_start_main → _start
    |--33.32%--func2 → main → __libc_start_main → _start
    --11.12%--func3 → main → __libc_start_main → _start

# strace 系统调用追踪
$ strace -tt -T -- git status
17:46:16.798861 execve("/usr/bin/git", ["git", "status"], ...) = 0 <0.000300>

# 源码级热点注释
$ perf annotate x264_8_me_search_ref --stdio
Percent | Source code & Disassembly
  1.43  |  4eb10d: movsx ecx, BYTE PTR [r8+rdx*2]
  0.36  |  4eb112: movsx r12d, BYTE PTR [r8+rdx*2+0x1]
  0.63  |  4eb118: add DWORD PTR [rsp+0x38], ecx

# 编译器优化报告
$ clang -O3 -Rpass-analysis=.* -Rpass=.* -Rpass-missed=.* a.c -c
a.c:5:3: remark: loop not vectorized [-Rpass-missed=loop-vectorize]
a.c:5:3: remark: unrolled loop by a factor of 8 with run-time trip count [-Rpass=loop-unroll]

# Marker API: libpfm4 对特定代码区间做 PMC 计数
$ ./c-ray-f -s 1024x768 -r 2 -i sphfract -o output.ppm
Per-pixel ray tracing stats:
            avg    p90    max
nanoseconds | 4571 | 6139 | 25567
instructions| 71927| 96172| 165608
cycles      | 20474| 27837| 118921
branches    | 5283 | 7061 | 12149
branch-misses| 18  | 35   | 146
```

## Worked Example

**Roofline 分析：矩阵乘法的优化前后对比**（第 5.5 节）

初始代码（Listing 5.4），朴素三重循环矩阵乘法 `C[i][j] += A[i][k] * B[k][j]`：

```c
void matmul(int N, float a[][2048], float b[][2048], float c[][2048]) {
    #pragma omp parallel for
    for(int i = 0; i < N; i++)
        for(int j = 0; j < N; j++)
            for(int k = 0; k < N; k++)
                c[i][j] = c[i][j] + a[i][k] * b[k][j];
}
```

**算术强度计算**：内层循环体 2 FLOPs（一次加法、一次乘法），4 次内存操作各 4 字节 = 16 bytes，算术强度 = 2/16 = 0.125。

**平台参数**（Intel Core i5-8259U）：
- Peak FLOPS (AVX2, 8 核 × 8 floats/cycle × 2 FMA × 3.8 GHz) = 486.4 GFLOPS
- Peak Memory Bandwidth: 2400 MT/s × 2 channels × 8 bytes = 38.4 GiB/s

**优化步骤**：
1. 交换最内两层循环（i, k 互换）使内存访问变成 cache-friendly
2. 启用在最内层循环的自动向量化（AVX2）

**结果**：Intel Advisor 生成的 Roofline chart 显示，"before" 版本位于内存带宽天花板以下，为 memory-bound；"after" 版本沿 roofline 上升到更高性能水平。Roofline 模型在此场景中帮助识别了瓶颈类型、指导了优化方向，并验证了优化效果。

## Key Takeaways

1. **Counting 作为第一步**：`perf stat` 是轻量的基准包装器，快速发现异常（低 IPC、高 branch-miss 率），为后续深入分析缩小范围。
2. **Sampling 是主力方法**：无需重新编译、运行时开销 <2%（EBS <1%），是热点定位的默认选择。结合 call stacks 避免被库函数误导。
3. **Instrumentation 用于特定场景**：当你需要函数调用次数、特定变量的分布等细粒度信息时，手动 instrumentation 提供最佳洞察。但永远不要在 instrumented 版本上做性能测量。
4. **Tracing 用于异常根因分析**：当需要"重现-回放"或分析一段短时间的不响应行为时，tracing（strace、Intel PT）是唯一选择。
5. **Roofline 模型适用于 HPC**：它回答了"程序离硬件极限还有多远"，但不适用于代码结构复杂的通用应用。Intel Advisor 可自动生成 roofline chart。
6. **Compiler Optimization Reports 发现错过的优化**：使用 `-Rpass*` 系列标志检查循环是否被向量化、展开，这是理解编译器决策的最快捷途径。
7. **Marker API 桥接 Instrumentation 和 Counting**：`__itt_task_begin/end`（VTune）、`amdProfileResume/Pause`（uProf）或直接 `libpfm4` 编程，将 PMC 计数精确绑定到感兴趣的函数/代码段上。

## Connects To

- **Ch 4**：本章所有方法都需要用到 Ch4 定义的指标（IPC、MPKI、pipeline slots 等）。
- **Ch 6**：TMA 方法论是 PMC counting 和 sampling 的高级组合应用；LBR 和 PEBS/IBS/SPE 增强了 call stack 和 precise event 采集能力。
- **Ch 7**：介绍 Linux perf、Intel VTune、AMD uProf、Tracy 等具体工具如何实现本章的方法。
- **Ch 11**：Instrumentation 用于 Profile-Guided Optimization (PGO)；Compiler Optimization Reports 帮助发现错过的编译器优化。
- **Ch 8-10**：Roofline 的 memory-bound → 对应 Ch8 Core Bound → Ch9，Bad Speculation → Ch10。
