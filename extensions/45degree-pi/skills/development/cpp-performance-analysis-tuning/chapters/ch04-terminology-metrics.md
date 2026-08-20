# Chapter 4: Terminology and Metrics in Performance Analysis

## Core Idea

性能分析领域充斥着专业术语和指标，初学者面对 Linux perf 或 Intel VTune Profiler 的输出时往往难以理解。本章系统性地定义并阐释了最基本的性能指标（retired/executed instructions、IPC/CPI、µops、pipeline slots、core/reference clocks、cache misses、branch mispredictions），并通过实际工作负载的案例分析展示如何解读这些指标。

## Frameworks Introduced

- **IPC (Instructions Per Cycle) / CPI (Cycles Per Instruction)**：两个互逆的基础性能指标。IPC = INST_RETIRED.ANY / CPU_CLK_UNHALTED.THREAD，CPI = 1 / IPC。
  - 何时使用：IPC 是"越高越好"的指标，用于直观比较；CPI 是"越低越好"。本书主要使用 IPC。
  - 使用方法：使用 `perf stat -- ./a.exe` 可直接获取 IPC。注意 IPC 和频率在基准测试意义上是独立的两个度量——提高频率通常不会改变 IPC。
- **MPKI (Misses Per Kilo Instruction)**：将缓存缺失次数归一化到每千条指令的指标，消除指令数量差异带来的干扰。
  - 何时使用：评估缓存层级中各级的缺失严重程度。L1MPKI、L2MPKI、L3MPKI 分别对应 L1/L2/L3 的缺失率。
  - 公式：1000 * MEM_LOAD_RETIRED.LX_MISS / INST_RETIRED.ANY
- **Pipeline Slot**：处理一个 µop 所需的硬件资源单元。4-wide 机器每周期最多分配 4 个 pipeline slots。
  - 何时使用：作为 TMA 方法论的核心度量单位，Frontend Bound 和 Backend Bound 等指标均表示为未利用 pipeline slot 的比例。
- **Memory Latency and Bandwidth**：内存子系统的两个关键性能维度。MLC (Intel Memory Latency Checker) 是 x86 平台上的标准测量工具。
  - 何时使用：分析内存瓶颈时，需同时测量 idle read latency 和 peak bandwidth，并与应用程序的实际需求对比。

## Key Concepts

- **Retired vs. Executed Instructions**：retired 指令是最终提交结果的指令，executed 指令包含推测执行后被丢弃的指令。通常 executed >= retired，但 NOP/move elimination 等例外会导致 retired > executed。
- **µops (Micro-operations)**：x86 CISC 指令译码后拆分为的 RISC 风格微操作。Microfusion（同指令µop融合）和 Macrofusion（跨指令µop融合）节省流水线带宽。
- **Core vs. Reference Cycles**：core cycles 按实际运行频率计数；reference cycles 按基础频率计数，不受动态频率缩放（Turbo Boost）影响。
- **Branch Misprediction**：CPU 错误预测分支方向后需冲刷流水线并恢复状态，典型惩罚为 10-25 个时钟周期。
- **ILP (Instruction-Level Parallelism)**：每周期实际执行的 µop 数量（非理论最大值），Golden Cove 6-wide 架构下 3.67 的 ILP 意味利用率约 2/3。
- **MLP (Memory-Level Parallelism)**：平均并发在途的 L1 miss demand loads，高 MLP 可掩盖内存访问延迟。
- **Pipeline Slot Utilization**：衡量 CPU 流水线资源利用效率的核心指标，处理器宽度限制了最大可达 IPC。

## Mental Models

- **CPI/IPC 与频率的独立性**：IPC 仅取决于处理器微架构设计和应用程序特性，与频率无关。频率决定"cycle 有多快"，IPC 决定"每个 cycle 做多少事"。性能 = IPC × frequency。
- **Cache Miss 的分级诊断模型**：从 L1 → L2 → L3 → DRAM 逐级归因。`mem_load_retired.l1_miss` → `l2_hit/l2_miss` → `l3_miss`，使用 MPKI 归一化后判断各级缺失的严重程度。
- **Aggregate Average 的局限性**：单一平均值可能掩盖相位行为。例如 CloverLeaf 的 IPC 0.2 可能来自两个 IPC 分别为 0.1 和 0.3 的等长阶段。使用 min/max/p95/stdev 及时间序列图表获取更完整的分布信息。
- **Memory Hierarchy 的"铁三角"**：Latency（ns）、Bandwidth（GB/s）、Capacity（MB/GB）。三者相互制约，理解具体平台的这三个参数是评估内存密集程序效率的基础。

## Anti-patterns

- **只看 raw event counts 不看归一化指标**：例如看到 MEM_LOAD_RETIRED.L3_MISS 为十亿就认为缓存缺失严重——如果总加载量是一万亿，则缺失率仅 0.1%。始终使用 MPKI 等归一化指标。
- **混淆 IPC 和频率对性能的影响**：有人误认为提高频率 IPC 也会上升。实际上频率改变 cycle 长度，不改变 IPC。
- **过度依赖 aggregate 指标**：程序可能有多个执行阶段，平均值掩盖了关键行为。需结合时间序列图表分析。

## Code Examples

```shell
# 收集 retired 指令数
$ perf stat -e instructions -- ./a.exe
2173414 instructions              # 0.80 insn per cycle

# 收集 µop 各级计数
$ perf stat -e uops_issued.any,uops_executed.thread,uops_retired.slots -- ./a.exe
2856278 uops_issued.any
2720241 uops_executed.thread
2557884 uops_retired.slots

# 区分 core cycles 和 reference cycles
$ perf stat -e cycles,ref-cycles -- ./a.exe
43340884632 cycles               # 3.97 GHz
37028245322 ref-cycles            # 3.39 GHz

# L1/L2 缓存缺失逐级归因
$ perf stat -e mem_load_retired.l1_miss,mem_load_retired.l2_hit,mem_load_retired.l2_miss -- a.exe
19521 mem_load_retired.l1_miss
12360 mem_load_retired.l2_hit
7188 mem_load_retired.l2_miss

# 分支预测统计
$ perf stat -e branches,branch-misses -- a.exe
358209 branches
14026 branch-misses              # 3.92% of all branches
```

## Worked Example

**四项工业基准测试的性能指标分析**（第 4.11 节）：

在以下平台上运行四项基准测试：Intel Core i7-1260P (4P+8E, 18MB L3), 16GB DDR4@2400 MT/s, Ubuntu 22.04, Clang-15 `-O3 -march=core-avx2`。

使用 `toplev.py -m --global --no-desc -v -- <app>` 收集指标，得到以下关键发现：

| 基准 | P-core IPC | L3MPKI | Load Miss Lat (clk) | DRAM BW (GB/s) | 初步结论 |
|------|-----------|--------|--------------------|----------------|---------|
| Blender 3.4 | 1.40 | 0.04 | 12.92 | 1.58 | FP compute bound |
| Stockfish 15 | 1.80 | 0.14 | 10.37 | 1.42 | 整数计算 + 分支误预测密集 |
| Clang 15 self-build | 0.64 | 0.56 | 76.7 | 10.67 | 代码庞大、TLB 压力高、函数调用频繁 |
| CloverLeaf | 0.20 | 3.43 | 253.89 | 24.57 | 内存带宽饱和 |

**分析方法**：
1. 首先对比 IPC，CloverLeaf 的 0.20 显著最低，提示严重瓶颈。
2. 查看 L*MPKI 和 Load Miss Latency，CloverLeaf 的 L3MPKI 为 3.43、Load Miss Lat 高达 253.89 cycles。
3. DRAM BW Use 24.57 GB/s 接近平台峰值 33.7 GB/s，确认所有核竞争内存总线导致 stall。
4. 关注否定性指标：Br. Misp. Ratio 仅 1%、TLB MPKI 低，排除分支预测和 TLB 为主要瓶颈。
5. 最终结论：CloverLeaf 受限于内存带宽，需优化数据局部性或使用更好的内存子系统。

## Key Takeaways

1. **从 IPC 开始**：IPC 是评估 CPU 微架构利用率的最直接指标，也是所有进一步分析的起点。
2. **MPKI 是归一化利器**：1000 * MEM_LOAD_RETIRED.LX_MISS / INST_RETIRED.ANY 消除指令数量差异的影响。
3. **Core/Reference cycles 分离**：core cycles 反映实际频率下的周期数，ref-cycles 固定于基础频率，用于跨频率场景的比较。
4. **µop fusion 节省流水线带宽**：Microfusion（同指令合并）和 Macrofusion（跨指令合并，如 DEC+JNZ）在译码到退休各阶段节省 ROB 条目。
5. **Pipeline slot 是 TMA 的基石**：Frontend Bound、Backend Bound 等高级指标均基于 pipeline slot 利用率。
6. **记忆平台的 Memory Hierarchy 参数**：L1/L2/L3 延迟和带宽是评估程序内存效率的基准。在不同平台间比较时尤为重要。
7. **指标回答"是什么"，不回答"为什么"**：性能指标建立理解心智模型，但最终需要通过采样等工具定位源码中的具体根因。

## Connects To

- **Ch 5**：本章的指标（CPI/IPC、MPKI、pipeline slots）是第五章所有分析方法的度量基础。
- **Ch 6**：Pipeline slot 是 TMA 方法论的核心度量单位，L1MPKI/L2MPKI/L3MPKI 是 TMA 下行分析的关键输入。
- **Roofline Model**：本章测量的 peak FLOPS 和 peak memory bandwidth 是 Roofline 模型的两条"天花板"。
- **Ch 8-11**：第二部分各章按 TMA 分类组织（Memory Bound、Core Bound、Bad Speculation、Frontend Bound），指标直接对应这些瓶类型的识别。
