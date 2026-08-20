---
name: cpp-performance-analysis-tuning
description: "CPU microarchitecture-level C++ performance analysis and tuning: TMA/IPC bottleneck classification, SIMD auto-vectorization diagnostics, assembly throughput (LLVM-MCA), roofline, branchless programming, false sharing, cache-friendly data layout, PGO/AutoFDO/BOLT. Platform split: dynamic PMU/TMA profiling (perf, toplev.py) requires Linux + PMU; static analysis (LLVM-MCA, compiler diagnostics) works on any platform — mark non-Linux results as unverified. Algorithm/data-structure selection, I/O tuning, allocation strategy → cpp-performance-optimization."
---

<!-- argument-hint: [topic, framework name, or chapter number] -->

# Performance Analysis and Tuning on Modern CPUs (Second Edition)
**Author**: Denis Bakhvalov | **Pages**: ~280 | **Chapters**: 14 + 2 Appendices | **Generated**: 2026-07-10

## How to Use This Skill

- **Without arguments** — load core frameworks for reference (TMA, IPC, Roofline, cache hierarchy)
- **With a topic** — ask about `TMA`, `branchless programming`, `cache-friendly data structures`, `vectorization`, `false sharing`; I find and read the relevant chapter
- **With a chapter** — ask for `ch03`; I load that specific chapter
- **Browse** — ask "what chapters do you have?" to see the full index

When you ask about a topic not covered in Core Frameworks below, I will read the relevant chapter file before answering.

---

## ⚠️ 环境门控（前置检查）

本 skill 的核心工具链（`perf`、`toplev.py`、PMU 硬件计数器）依赖 **Linux 内核 + Perf 子系统**。加载本 skill 前，先确认环境：

| 环境 | 可用工具 | 状态 |
|------|---------|------|
| **Linux**（Intel/AMD/ARM） | `perf stat`、`perf record`、`toplev.py`、VTune、uProf | ✅ 全功能可用 |
| **macOS** | 无 `perf`，无 PMU 用户态访问 | ⚠️ 仅理论分析 / 静态分析（LLVM-MCA）可用；动态 profiling 需切换到 Linux |
| **Windows** | VTune（有限），无 `perf`/`toplev` | ⚠️ 仅 VTune 可用；建议切换到 Linux 做完整 TMA 分析 |

**非 Linux 环境的替代路径**：
1. 静态分析不依赖 PMU → LLVM-MCA（`llvm-mca -mcpu=...`）、编译器诊断（`-Rpass=vectorize`）仍可用
2. Roofline 模型可基于厂商规格手册做理论估算（非实测）
3. 如需实测 TMA / cache miss / 分支误预测 → **必须在 Linux 环境运行**，否则停止并告知用户

**加载确认**：如当前环境非 Linux 且用户需要动态性能分析 → 停止，建议用户切换到 Linux 环境。

---

## Core Frameworks & Mental Models

### The Performance Engineering Pipeline
**分析先行，调优在后。** 永远不要凭直觉优化 -- 性能工程分为两个阶段：先测量定位瓶颈 (Ch 2-7)，再基于硬件理解修复 (Ch 8-13)。直觉在现代 CPU 上不可靠：编译器可能已经优化了你的"技巧"，而真正的瓶颈在别处。**Use measurement, not intuition.**

### TMA (Top-down Microarchitecture Analysis)
**CPU 瓶颈诊断的第一工具。** 将程序性能瓶颈归因到四个 Level-1 分类：
- **Frontend Bound** (>20% 关注): 取指/译码阶段无法供给足够 µops -- I-cache miss, ITLB miss, 代码体积过大
- **Backend Bound** (>40% 关注): 执行资源不足 -- Memory Bound (cache miss → Ch 8) 或 Core Bound (依赖链 → Ch 9)
- **Retiring**: µop 正常退休 -- 理想目标，但 spin-wait 和非向量化热点也会显示高 Retiring
- **Bad Speculation** (>10% 关注): 推测错误 -- 分支误预测 → branchless 编程 (Ch 10)

**Use `perf stat --topdown` as the first diagnostic tool for any CPU performance issue.** 然后 `toplev.py -l2 -l3` 深度下钻到具体瓶颈类型，再用 precise event 采样定位源码行。

### IPC = Performance / Frequency
**CPU 性能 = IPC × 频率。** IPC (Instructions Per Cycle) 衡量每周期完成的有效工作，与频率无关。常规优化代码 IPC 在 1.5-3.0 之间；Golden Cove 理论最大值 ~6.0。**Use IPC to judge whether code is CPU-efficient regardless of clock speed.**

### Cache Hierarchy Mental Model
**寄存器 → L1 (ns, 32KB) → L2 (~10ns, ~1MB) → L3 (LLC, ~40ns, 10s MB) → DRAM (~100ns) → 磁盘。** 每级约 10x 容量、10x 延迟。优化原则：
- 利用空间局部性：顺序访问、AoS→SoA 转换、字段重排
- 利用时间局部性：将热数据保持在小缓存层
- 用 MPKI (Misses Per Kilo Instruction) 归一化评估缺失严重性
- **Prefer sequential access patterns -- hardware prefetchers are your friends.**

### Mechanical Sympathy
**了解硬件才能写出高效代码。** 关键硬件机制：
- **OOO (乱序执行)**: CPU 可重排独立指令，但无法打破 RAW 真依赖链。打破长依赖链 → 循环展开、依赖链打断 (Ch 9)
- **SIMD 向量化**: 单指令并行处理多个数据。编译器的 autovectorization 非万能 -- 用 `-Rpass=vectorize` 检查 (Ch 9)
- **SMT (超线程)**: 两个逻辑线程共享物理核资源。会竞争 L1/L2 缓存 -- 关键线程应隔离 (CPU pinning + `isolcpus`)
- **Branch Prediction**: 现代 CPU 静态分支预测 >95%。数据依赖的分支（二分查找）只有 ~50% -- 用 branchless 技术 (Ch 10)

### Roofline Performance Model
**识别瓶颈是计算受限还是内存带宽受限。** 绘制运算强度 (FLOP/byte) vs. 可达性能 (FLOP/s)：
- 在 slope 区域：Memory Bound -- 优化内存访问 (Ch 8)
- 在 flat 区域：Compute Bound -- 优化计算 (Ch 9)
**Use roofline before diving into microarchitecture -- it tells you which half of the problem to fix.**

### The 1% Compound Effect
**不要低估小优化。** SQLite 不是靠一次 50% 的优化成功，而是靠数百次 0.1% 的改进。小优化累积起来才是决定性差异。**Use cumulative micro-optimizations, not one-shot heroics.**

### Active Benchmarking Principle
**"Performance measurements should be considered guilty until proven innocent."** (Ousterhout)
- 永远收集多次采样，可视化分布 (box plot)
- 检查多个指标 (指令数、缓存 miss、分支误预测)，不只是时间
- 对比优化前后生成的机器码
- 没有技术解释的性能数据不可信

---

## Chapter Index

| # | Title | Key Frameworks |
|---|---|---|
| [ch01](chapters/ch01-introduction.md) | Introduction | Active Benchmarking, Mechanical Sympathy, 60,000x Gap |
| [ch02](chapters/ch02-measuring-performance.md) | Measuring Performance | Noise Control, Continuous Benchmarking/CPD, Box Plots, TSC vs. System Timer |
| [ch03](chapters/ch03-cpu-microarchitecture.md) | CPU Microarchitecture | Tomasulo Algorithm, Pipeline Hazards, SIMD, SMT, Cache Hierarchy, TLB, PMU |
| [ch04](chapters/ch04-terminology-metrics.md) | Terminology and Metrics | IPC/CPI, µops, MPKI, Pipeline Slot, Core/Ref Cycles, Memory Latency/Bandwidth |
| [ch05](chapters/ch05-analysis-approaches.md) | Performance Analysis Approaches | Instrumentation, Tracing, Sampling, Roofline Model, Static Analysis (LLVM-MCA), Compiler Reports |
| [ch06](chapters/ch06-cpu-features.md) | CPU Features for Performance Analysis | TMA, LBR/BRBE, PEBS/IBS/SPE, Precise Events, Skid |
| [ch07](chapters/ch07-analysis-tools.md) | Overview of Analysis Tools | VTune, uProf, Linux Perf, Flame Graphs, Tracy, Heaptrack, Continuous Profiling |
| [ch08](chapters/ch08-optimizing-memory-accesses.md) | Optimizing Memory Accesses | Cache-Friendly Data Structures, Huge Pages, Explicit Prefetching, Dynamic Memory Allocation |
| [ch09](chapters/ch09-optimizing-computations.md) | Optimizing Computations | Data Dependencies, Inlining, Loop Optimizations (LICM/Unrolling/Tiling), Vectorization, ISPC |
| [ch10](chapters/ch10-optimizing-branch-prediction.md) | Optimizing Branch Prediction | Branchless Programming (Lookup/Arithmetic/CMOV/SIMD), __builtin_unpredictable |
| [ch11](chapters/ch11-machine-code-layout.md) | Machine Code Layout | Basic Block Placement, Function Splitting, PGO/AutoFDO/BOLT, ITLB Optimization |
| [ch12](chapters/ch12-other-tuning-areas.md) | Other Tuning Areas | CPU Dispatch, ISA Extensions, Memory Order Violations, Misaligned Accesses, Low-Latency Tuning |
| [ch13](chapters/ch13-optimizing-multithreaded.md) | Optimizing Multithreaded Applications | Parallel Efficiency, Cache Coherence (MESI), False Sharing, Coz Causal Profiling, eBPF/GAPP |
| [ch14](chapters/ch14-epilog.md) | Epilog | Key Takeaways Summary |

## Appendix

| [appA](chapters/appA-reducing-measurement-noise.md) | Reducing Measurement Noise | DFS/SMT Control, CPU Pinning, Scaling Governor |
| [appC](chapters/appC-intel-processor-traces.md) | Intel Processor Traces | PT Encoding/Decoding, perf Commands, Timing Packets |

## Topic Index

- **Autovectorization** → ch09
- **Bad Speculation** → ch06, ch10
- **BOLT / Propeller** → ch11
- **Branchless Programming** → ch10
- **Cache Coherence (MESI)** → ch13
- **Cache-Friendly Data Structures** → ch08
- **CMOV / Conditional Selection** → ch10
- **Continuous Benchmarking / CPD** → ch02
- **CPU Dispatch / Function Multiversioning** → ch12
- **CPI / IPC** → ch04
- **Data Dependencies** → ch09
- **DTLB / Huge Pages** → ch03, ch08
- **False Sharing** → ch13
- **Flame Graphs** → ch07
- **Frontend Bound / Backend Bound** → ch06
- **Function Inlining** → ch09
- **Hardware Prefetching (Explicit)** → ch08
- **Hybrid Architectures (P/E-cores)** → ch03
- **IBS (AMD)** → ch06
- **LBR (Last Branch Record)** → ch06
- **LLVM-MCA (Static Analysis)** → ch05
- **Loop Optimizations (Unrolling, Tiling, LICM)** → ch09
- **Low-Latency Tuning** → ch12
- **Measurement Noise Reduction** → ch02, appA
- **Microbenchmarks / DoNotOptimize** → ch02
- **MLC (Memory Latency Checker)** → ch04
- **MLP (Memory-Level Parallelism)** → ch04
- **MPKI (Misses Per Kilo Instruction)** → ch04
- **OOO Execution / Register Renaming** → ch03
- **PEBS (Intel)** → ch06
- **PGO / AutoFDO** → ch11
- **Pipeline Hazards (RAW/WAR/WAW)** → ch03
- **PMU / Performance Counters** → ch03, ch05
- **Roofline Model** → ch05
- **SIMD / Vectorization** → ch03, ch09
- **SMT / Hyperthreading** → ch03, ch13
- **SPE (ARM)** → ch06
- **Speculative Execution** → ch03
- **SVE (Scalable Vector Extension)** → ch03
- **TMA (Top-down Microarchitecture Analysis)** → ch06
- **TSC (Time Stamp Counter)** → ch02
- **VTune Profiler** → ch07

## Supporting Files

- [glossary.md](glossary.md) — 所有关键术语及定义
- [patterns.md](patterns.md) — 所有优化技术和方法论
- [cheatsheet.md](cheatsheet.md) — 决策规则、阈值速查、Tells & Smells、工具匹配表

---

## 完成标准（可检验）

- [ ] **动态分析已确认环境**：如给出 TMA/PMU/cache miss 等动态分析结论，已确认在 Linux + PMU 环境实测；非 Linux 环境不产出动态结论，只做静态分析（LLVM-MCA、编译器诊断）并**标注"未经实测验证"**
- [ ] **结论有数据支撑**：瓶颈分类基于 `perf stat --topdown` / `toplev.py` / `LLVM-MCA` 等工具实测或静态分析输出，非猜测；无数据时只给测量计划
- [ ] **引用已有指标**：若存在前后对比数据，每条调优建议附引用的 IPC / MPKI / TMA 指标对比；无数据则标注"待测量验证"
- [ ] **限于微架构级**：建议限于 pipeline/cache/SIMD/branch/binary-layout——未做通用算法选型（那些转交 `cpp-performance-optimization`）

## Scope & Limits

This skill covers the book content only. Focus: single-socket CPU performance analysis and tuning for C/C++ applications on Intel, AMD, and ARM-based Linux systems. Does NOT cover: distributed systems, GPU/FPGA offloading, I/O and network performance, managed languages (Java/C#), or Windows-specific system tuning. For hands-on implementation in your codebase, combine with project-specific tools.
