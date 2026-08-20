# Patterns & Techniques

书中所有具体的技术、设计模式和优化方法论。

## TMA Drill-Down 诊断漏斗

**When to use**: 任何 CPU 性能瓶颈分析的起点。

**How**: `perf stat --topdown` → 获取 L1 四分类百分比 → 针对瓶颈类别使用 `toplev.py -l2 -l3` 深度下钻 → 采样 precise event 定位源码 → 修复 → 重复迭代。

**Trade-offs**: TMA 只适用于 CPU 已经充分工作的代码。如果存在算法级问题，TMA 会引导微调低效代码。

---

## Branchless Programming (Branch 消除四法)

**When to use**: TMA 显示 Bad Speculation > 10%，且热点分支难以预测。

**How**:
1. **查表替换**: `array[branch_condition ? 1 : 0]` 将分支转为内存访问（适合值域小、密集的分支）
2. **算术替换**: 用位运算/算术消除分支，如 `a = cond * x + (!cond) * y`
3. **选择替换 (CMOV/CSEL)**: 条件移动指令，适合小函数体
4. **SIMD 多测单支**: 用 SIMD 一次处理多个元素，用单分支代替多分支（适合字符处理）

**Trade-offs**: 总是被正确预测的分支不要消除；大函数体用 selection 会同时执行两条路径；查表引入内存访问可能不如分支快。

---

## Cache-Friendly Data Structures

**When to use**: 缓存缺失（尤其是 L3 miss）是主要瓶颈时。

**How**:
1. **顺序访问**: 首选顺序遍历（利用硬件预取器）
2. **适当容器**: 用 `std::vector` 而非 `std::list`（连续内存 vs. 指针跳转）
3. **数据填充/打包**: 用 `#pragma pack` 或手动对齐减少 padding
4. **字段重排**: 将热字段（频繁访问）和冷字段（很少访问）分开，避免缓存行浪费
5. **结构拆分 (Hot/Cold Splitting)**: 将热字段放在一起，冷字段用指针引用
6. **AoS → SoA 转换**: 结构体数组变为数组结构体，利于 SIMD 和缓存行利用

**Trade-offs**: 重排和拆分增加代码复杂度；需要 profile 确认具体哪些字段是热的。

---

## Loop Optimizations (循环优化金字塔)

**When to use**: 循环是热点且 IPC 低于预期。

**How**（按难度递增）:
1. **Low-level**: 循环不变量外提 (LICM)、循环展开 (Unrolling)、强度削减 (LSR)
2. **Mid-level**: 循环不变量分支外提 (Unswitching)、循环分布/裂变 (Distribution/Fission)
3. **High-level**: 循环交换 (Interchange)、分块/平铺 (Tiling/Blocking)、循环融合 (Fusion)

**Trade-offs**: 展开增加代码大小可能导致 I-cache 压力；分块需要选择合适的块大小（适配 L1/L2 缓存）。

---

## Function Inlining 决策框架

**When to use**: 函数调用开销成为热点时。

**How**:
1. 编译器自动判断：`inline` / `-O2` / LTO 足够处理大多数情况
2. 强制内联热点小函数：`__attribute__((always_inline))`
3. 禁止内联大/冷函数：`__attribute__((noinline))`
4. 验证：检查生成的汇编或使用 `perf` 采样查看函数是否仍在栈中

**Trade-offs**: 内联增加代码体积 (I-cache 压力) 和编译时间，但消除调用开销并提供更多优化机会（如常量折叠）。尾调用优化 (TCO) 是内联的替代方案。

---

## Explicit Memory Prefetching

**When to use**: 硬件预取器无法识别的访问模式（随机访问、链表遍历、树查找）。

**How**: `__builtin_prefetch(addr, rw, locality)` — 在数据实际使用前至少 100-200 个周期插入预取。

**Trade-offs**: 预取太早数据可能在使用前被逐出；预取太晚没有效果；过度预取增加内存带宽压力。

---

## Profile-Guided Optimizations (PGO)

**When to use**: 生产构建的最终优化 pass。

**How**:
1. Clang: `-fprofile-generate` 编译 → 运行代表性 workload → `-fprofile-use` 重新编译
2. GCC: `-fprofile-generate` / `-fprofile-use`
3. AutoFDO: 使用 `perf` 采样代替插桩，降低训练成本
4. BOLT: 采样二进制优化，不依赖编译时 profile

**Trade-offs**: 需要代表性的训练 workload；workload 变化可能导致退化；维护 profile 数据的 CI 成本。

---

## CPU Dispatch / ISA Extension 选择

**When to use**: 同一二进制需要在不同 CPU（不同 ISA 支持级别）上运行。

**How**:
1. 为每个 ISA 级别编译独立函数版本（SSE2/AVX2/AVX512）
2. 运行时用 `__builtin_cpu_supports` / `ifunc` 选择最优版本
3. GCC Function Multiversioning: `__attribute__((target("avx2")))`

**Trade-offs**: 增加二进制大小；维护多个实现版本的成本。

---

## False Sharing 消除

**When to use**: 多线程程序扩展性差，perf 显示高 `l1d.replacement` 或缓存一致性流量。

**How**:
1. 用 `alignas(64)` / `__cacheline_aligned` 将竞争变量对齐到不同缓存行
2. 填充 (padding) 热点结构体使每个线程的数据独占缓存行
3. 用 `perf c2c` 检测 false sharing 的精确位置

**Trade-offs**: 填充浪费内存（每个线程多 64 字节）。

---

## Low-Latency Tuning

**When to use**: HFT、实时系统等对尾延迟敏感的场景。

**How**:
1. `mlockall(MCL_CURRENT | MCL_FUTURE)` — 锁定所有页，避免 minor page faults
2. Cache warming — 预先访问关键数据路径使其驻留在缓存
3. 隔离 CPU 核心 (`isolcpus`) + 线程 pinning (`taskset`)
4. 设置实时调度优先级 (`SCHED_FIFO`)

**Trade-offs**: 锁定过多内存可能导致 OOM 启动失败；核心隔离降低系统整体吞吐量。
