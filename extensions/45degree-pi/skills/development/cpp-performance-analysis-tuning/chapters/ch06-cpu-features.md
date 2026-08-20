# Chapter 6: CPU Features for Performance Analysis

## Core Idea

现代 CPU 提供了丰富的硬件性能监控能力，使性能工程师能够直接定位微架构瓶颈而不必依赖直觉。本章深入介绍三大类硬件特性：Top-down Microarchitecture Analysis (TMA)、Branch Recording 机制（Intel LBR / AMD LBR / Arm BRBE）、以及 Hardware-Based Sampling（Intel PEBS / AMD IBS / Arm SPE），并通过跨厂商（Intel、AMD、Arm）的实践案例演示其用法。

## Frameworks Introduced

- **Top-down Microarchitecture Analysis (TMA)**：基于 pipeline slot 利用率将程序瓶颈归入四个 Level-1 分类（Frontend Bound、Backend Bound、Retiring、Bad Speculation），并通过多级 drill-down 定位到具体的微架构问题。
  - 何时使用：任何寻求低层 CPU 瓶颈时都应作为起点。不适合已存在重大高层性能缺陷的代码。
  - 方法：`perf stat --topdown` 获取 L1 分类 → 使用 `toplev.py -l2 -l3` 下行钻取 → sample 对应 precise event 定位源码位置 → 修复后重复迭代。
- **LBR (Last Branch Record) / BRBE (Branch Record Buffer Extension)**：硬件持续在后台记录最近执行的跳转，无需软件干预，开销 <1%。
  - 何时使用：需要收集 call stacks（不依赖 frame pointers/DWARF）、分析热分支的误预测率、测量基本块精确延迟、估算分支结果概率时。
  - 方法：`perf record -b -e cycles -- ./a.exe` 采集 LBR stack；`perf record --call-graph lbr` 仅采集 call stacks。
- **PEBS / IBS / SPE (Precise Event-Based Sampling / Instruction Based Sampling / Statistical Profiling Extension)**：硬件级采样增强，降低采样开销并提供 precise events。
  - 何时使用：需要精确定位导致性能事件的指令（消除 skid）、或分析内存访问的目标地址和延迟时。
  - 方法：`perf record -e cycles:pp -- ./a.exe`（Intel/AMD 的 precise tagging），Arm 使用 `arm_spe_0`。

## Key Concepts

- **TMA Level-1 四大分类**：
  - **Frontend Bound**：指令获取/译码阶段无法提供足够的 µops（如 I-cache miss、TLB miss）。
  - **Backend Bound**：执行资源不足以处理已分发的 µops（如 cache miss、端口竞争）。
  - **Retiring**：正常退休，µops 完成执行。理想情况下应接近 100%，但锁等待、非向量化热点也会显示高 Retiring。
  - **Bad Speculation**：推测错误导致流水线中的工作被丢弃（分支误预测、machine clears）。
- **Pipeline Slot Utilization**：TMA L1/L2 以 pipeline slot 百分比度量，确保四类之和为 100%。L3 起改用 clocks/stalls 域。
- **Skid**：从触发性能事件的指令到采样中断实际捕获的指令之间的偏移。在乱序 CPU 中可达数百条指令。Precise events 通过硬件记录的 EventingIP 消除 skid。
- **Branch Recording 关键字段**：From IP、To IP、Mispredict bit、Cycle Count（Intel LBR 支持）。未取分支不记录。
- **PEBS Record 内容**：通用寄存器、EventingIP、Data Linear Address、Latency Value、TSC 等，可按组（Basic/Memory/GPR/XMM/LBR）选择性记录以降低开销。
- **IBS Dual-Mode**：IBS Fetch（前端：ITLB、I-cache、取指延迟）和 IBS Execute（后端：分支预测、load/store 缓存命中、线性地址、加载延迟）。
- **SPE**：Arm 的单一采样机制，集 IBS 两种能力和额外管道阶段延迟（Issue latency、Translation latency、Execution latency），支持后过滤。

## Mental Models

- **TMA 的 drill-down 诊断漏斗**：从 L1 四分类（一次 perf stat）→ L2（Memory Bound / Core Bound）→ L3（DRAM_Bound / L1_Bound / L2_Bound 等）→ precise event 采样定位源码行。每级减少备选范围，直达根因。
- **Branch Recording 的"降维"思路**：基本块中除最后一条分支外的指令都是保证执行的。因此只跟踪分支即可重建控制流。LBR 是采样子集，PT 是全量 trace。
- **Precise Events 的"现场保留"机制**：传统采样像警察到达犯罪现场时证据已被破坏（skid），precise events 相当于硬件自动拍下了案发时的快照（EventingIP），确保归因准确。
- **Retiring 高 ≠ 性能好**：TMA 只关注 CPU 是否饱和执行指令，不关心指令质量。spin-wait 锁、非向量化标量循环同样显示高 Retiring。需结合其他分析判断。

## Anti-patterns

- **在不适合的代码上使用 TMA**：存在明显算法缺陷或高层面性能问题的代码，TMA 会引导你微调低效代码，浪费精力。先确保"值得优化的代码"。
- **忽略环境因素**：如果不预热文件系统缓存就运行 TMA，很可能显示 Memory Bound，而预热后该结论不再成立。
- **使用 aggregate 数据的 TMA 分析多相位负载**：如果工作负载各阶段性能特征差异显著，multiplexing 和汇总会掩盖真实瓶颈。此时应使用单次 drill-down 或间隔输出。
- **仅依赖热点列表进行调优**：在需要"榨取最后一点性能"时，热点列表不提供瓶颈类型信息。必须使用 TMA 等更结构化的方法论。

## Code Examples

```shell
# TMA Level-1（perf stat topdown）
$ perf stat -- ./benchmark.exe
TopdownL1 (cpu_core)  # 53.4 % tma_backend_bound
                       #  0.2 % tma_bad_speculation
                       # 13.8 % tma_frontend_bound
                       # 32.5 % tma_retiring

# TMA Level-2 / Level-3（pmu-tools toplev）
$ ~/pmu-tools/toplev.py --core S0-C0 -l2 -v --no-desc taskset -c 0 ./benchmark.exe
S0-C0 Backend_Bound:          53.39 % Slots
S0-C0 Backend_Bound.Memory_Bound: 44.59 % Slots   <==
S0-C0 Backend_Bound.Core_Bound:    8.80 % Slots

$ ~/pmu-tools/toplev.py --core S0-C0 -l3 -v --no-desc taskset -c 0 ./benchmark.exe
S0-C0-T0 BE_Bound.Mem_Bound.DRAM_Bound: 47.11 % Stalls  <==

# TMA Step 2: 采样 precise event 定位源码
$ perf record -e cpu/event=0xd1,umask=0x20,name=MEM_LOAD_RETIRED.L3_MISS/ppp -- ./benchmark.exe
$ perf report -n --stdio
# Samples: 33K of event 'MEM_LOAD_RETIRED.L3_MISS'
# Overhead  Samples  Symbol
  99.95%    33811    benchmark.exe [.] foo

# LBR: 采集完整分支栈
$ perf record -b -e cycles -- ./benchmark.exe
$ perf script -F brstack &> dump.txt
0x4edaf9/0x4edab0/P/-/-/29  # From/To/Predicted/Cycles
0x4edabd/0x4edad0/P/-/-/2
0x4edadd/0x4edb00/M/-/-/4   # M = mispredicted

# LBR: 误预测率分析
$ perf record -e cycles -b -- ./7zip.exe b
$ perf report -n --sort symbol_from,symbol_to -F +mispredict,srcline_from,srcline_to --stdio
# Overhead  Samples  Mis  FromLine  ToLine    SourceSym
  46.12%    303391   N    dec.c:36  dec.c:40  LzmaDec
   6.33%     41665   Y    dec.c:36  dec.c:40  LzmaDec

# LBR: 基本块延迟分布
$ perf record -e cycles -b -- ./7zip.exe b
$ perf report -n --sort symbol_from,symbol_to -F +cycles,srcline_from,srcline_to --stdio
# Overhead  Samples  BBCycles  FromSrcLine  ToSrcLine
  2.82%     18581    1         dec.c:325    dec.c:326
  2.40%     15815    4         dec.c:174    dec.c:174
  1.43%      9392   10         7zCrc.c:15   7zCrc.c:17

# PEBS precise event
$ perf record -e cycles:pp -- ./a.exe

# IBS Fetch / Execute sampling (AMD)
$ perf record -a -e ibs_fetch/l3missonly=0/ -- benchmark.exe
$ perf record -a -e ibs_op/cnt_ctl=0/ -- benchmark.exe

# SPE sampling (Arm)
$ perf record -e arm_spe_0/ts_enable=1/ -- test_program
$ perf report --stdio
```

## Worked Example

**TMA 完整工作流：减少缓存缺失**（第 6.1.1 节）

**问题**：一个微基准测试，分配 200MB 数组，循环 100M 次，每次在数组中随机索引读取一个值。运行在 Intel Core i5-8259U (Skylake) 上。

**Step 1 — 识别瓶颈**：
- `perf stat --topdown` 显示 53.4% backend_bound
- `toplev.py -l2` 显示 Memory_Bound 44.59% Slots
- `toplev.py -l3` 显示 DRAM_Bound 47.11% Stalls

手动确认：`perf stat -e cycles,cycle_activity.stalls_l3_miss`，约 60% cycles 在等 L3 miss。

**Step 2 — 定位代码位置**：
- 采样 MEM_LOAD_RETIRED.L3_MISS precise event：99.95% 样本在函数 foo
- `perf annotate` 显示所有 L3 miss 标记在单条指令 `mov rax,QWORD PTR [rdi+rsi*1]`

Assembly 代码显示 foo 函数开头有大量 NOP（模拟 dummy work），创造了一个时间窗口——可以在 dummy work 期间发起 prefetch。

**Step 3 — 修复问题**：
```c
// 在 main 循环中添加显式 prefetch
for (int i = 0; i < 100000000; i++) {
    int random_int = distribution(generator);
    __builtin_prefetch (a + random_int, 0, 1);  // 新增
    foo(a, random_int);
}
```
- 执行时间从 8.5s 降至 6.5s
- CYCLE_ACTIVITY.STALLS_L3_MISS 从 19 billion 降至 2 billion

**迭代**：修复后将进入 Retiring 瓶颈，需继续 TMA 流程。第二部分各章（Ch8 Memory Bound, Ch9 Core Bound, Ch10 Bad Speculation, Ch11 Frontend Bound）对应 TMA 的各级分类，可作为后续检查清单。

## Key Takeaways

1. **TMA 是低层调优的默认起点**：但不要在明显有高层缺陷的代码上使用；确保环境预热后再分析。
2. **LBR 是获取 call stack 的最低开销方式**：无需 frame pointers 或 DWARF 调试信息，且支持同时记录误预测和 cycle count。
3. **Precise events 消除 skid 混淆**：在 Intel 上用 `:pp` 后缀标记事件，在 TMA Step 2 中定位源码行时必须使用。
4. **Intel PEBS、AMD IBS、Arm SPE 各有侧重但目标相同**：降低采样开销 + 提供精确归因 + 支持内存访问分析（数据地址、延迟、缓存层级来源）。
5. **TMA 的 Retiring 注意陷阱**：100% Retiring 不意味性能最优——低质量指令（spin-wait、非向量化）同样能填满流水线。
6. **LBR Cycle Count 提供基本块级别的精确时序**：可用于构建延迟分布图、识别 L3 vs DRAM 延迟的"双峰"模式，指导内存预取优化。
7. **跨平台 TMA 支持成熟度不同**：Intel 最完善（深至 L4），AMD Zen4 支持 L1/L2，Arm Neoverse V1+ 支持 Topdown L1 + uarch metrics。使用前确认平台能力。

## Connects To

- **Ch 4**：TMA 的 pipeline slot 概念来自第 4 章，pipeline slot 是 L1/L2 度量的基础域。
- **Ch 5**：PMC counting 和 sampling 是 TMA 的两大支柱（counting 计算指标、sampling 定位代码）。PEBS/IBS/SPE 增强了 EBS 的能力。
- **Ch 8 (Memory Bound)**：具体处理 TMA 中 Memory_Bound 分类的优化技术。
- **Ch 9 (Core Bound)**：具体处理 TMA 中 Core_Bound 分类（Divider、Ports_Util）。
- **Ch 10 (Bad Speculation)**：具体处理 TMA 中 Bad_Speculation 分类（分支误预测、machine clears）。
- **Ch 11 (Frontend Bound)**：具体处理 TMA 中 Frontend_Bound 分类（代码布局、TLB、I-cache）。
- **Ch 13**：PEBS/IBS/SPE 的 Data Address Profiling 是检测 True/False Sharing 的基础（`perf c2c`）。
- **Appendix C (Intel PT)**：Intel PT 是比 LBR 更全的 tracing 方案，可重建完整执行流。
