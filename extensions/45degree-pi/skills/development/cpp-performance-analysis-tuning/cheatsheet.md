# Cheatsheet — Decision Rules & Quick Reference

## 性能瓶颈分类决策

| 现象 | 根因 | 检查方法 |
|---|---|---|
| IPC 低，频率正常 | 后端瓶颈（Cache Miss / Core Bound） | `perf stat` → TMA Backend Bound > 40% |
| IPC 低，频率也低 | 前段瓶颈（I-cache / ITLB miss） | TMA Frontend Bound > 20% |
| IPC 正常，但整体慢 | Bad Speculation 或低频率 | TMA Bad Speculation > 10% → 分支问题 |
| 多线程扩展性差 | False Sharing / 缓存一致性 / 任务调度 | `perf c2c` + Coz 因果分析 |

## TMA L1 快速诊断规则

| 指标 | 正常范围 | 报警阈值 | 行动 |
|---|---|---|---|
| **Retiring** | > 50% | < 30% | 检查是否为 spin-wait 或非向量化热点 |
| **Bad Speculation** | 5–10% | > 10% | 查看分支预测 → Ch 10 branchless 技术 |
| **Frontend Bound** | < 15% | > 20% | 减少代码体积 / 优化 I-cache → Ch 11 代码布局 |
| **Backend Bound** | < 30% | > 40% | 分别检查 Memory Bound / Core Bound → Ch 8, 9 |

## Memory Bound 下钻

| 子类别 | 意味 | 优化方向 |
|---|---|---|
| L1 Bound | 大量数据在 L1 miss | 数据预取 / 减少工作集 |
| L2 Bound | L2 缓存不够 | 分块 (Tiling) / 缓存友好重排 |
| L3 Bound | LLC 竞争 | 减少多核共享数据 / 数据压缩 |
| DRAM Bound | 内存带宽瓶颈 | 软件预取 / 流存储 / 压缩数据 |
| DTLB Overhead | TLB 缺失 | Huge Pages (2MB) → Ch 8 |

## 分支预测决策

| 分支类型 | 预测率 | 优化 |
|---|---|---|
| 无条件跳转 | 100%（无需预测） | 无需优化 |
| 循环回边分支 | > 99% | 无需优化 |
| if-else 前向分支（错误检查）| ~95%+ | 通常无需优化 |
| 数据依赖分支（二分查找、排序）| ~50% | → branchless 编程 (Ch 10) |
| 间接调用 (virtual/function pointer) | 变化大 | 去虚化或 PGO |

**规则**: 当 `perf stat` 的 `branch-misses` / `branches` > 2-3% 时考虑优化。

## 循环优化决策树

```
循环是热点？
├─ 是 → IPC 接近理论最大值？
│   ├─ 是 → 已充分优化，转向其他瓶颈
│   └─ 否 → 依赖链长？
│       ├─ 是 → 展开 / 打破依赖链
│       └─ 否 → 缓存缺失？
│           ├─ 是 → 分块 (Tiling) / 交换 (Interchange)
│           └─ 否 → 向量化未生效？
│               ├─ 是 → `-Rpass=vectorize` 检查
│               └─ 否 → 检查分支预测
└─ 否 → 不用浪费时间，找真正的热点
```

## 关键阈值速查

| 指标 | 阈值 | 含义 |
|---|---|---|
| `instructions` / `cycles` (IPC) | Golden Cove 理论 6.0 | 理想值；常规代码 1.5-3.0 正常 |
| L1 MPKI | > 10 | L1 缺失严重 |
| L2 MPKI | > 3 | L2 缺失严重 |
| L3 MPKI | > 0.5 | L3 miss 可能致 DRAM 瓶颈 |
| TLB MPKI | > 0.1 | 考虑 Huge Pages |
| branch-misses / branches | > 2% | 分支预测可能有问题 |
| DT LB miss / inst | > 0.01 | 数据 TLB 瓶颈 |
| avg load latency | > 30 cycles | 在 L2/L3 或 DRAM 中停滞 |

## Tells & Smells

- **IPC < 1.0 且频率正常** → 几乎必定是 Memory Bound
- **高 IPC 但 Retiring < 30%** → spin-wait 锁或无用指令
- **同一段代码在不同运行时间变化 > 5%** → 噪声（检查 DFS / SMT / 缓存状态）
- **加线程后性能不增反降** → False Sharing 或缓存颠簸
- **`__builtin_prefetch` 反而慢了** → 预取太早/太多/访问模式硬件预取器已处理好
- **`-ffast-math` 使代码快 2x** → 代码原本因 IEEE 754 严格性被阻止向量化
- **PGO 构建比普通构建慢** → training workload 不代表生产环境

## 工具匹配

| 你想做的事 | 工具 |
|---|---|
| 快速了解 CPU 瓶颈类型 | `perf stat --topdown` |
| 深度 TMA 分析 | `pmu-tools/toplev.py -l3` |
| 找热点函数 | `perf record` / Flame Graphs |
| 看缓存命中率 | `perf stat -e cache-misses,cache-references` |
| 精确指令级归因 | VTune / `perf record -e cycles:pp` |
| 找 False Sharing | `perf c2c` |
| 分析多线程可扩展性 | Coz (causal profiling) |
| 对比两种实现 | Hyperfine 微基准 + box plot |
| 静态分析指令吞吐量 | LLVM-MCA / UICA |
| 内存延迟/带宽测量 | Intel MLC |
