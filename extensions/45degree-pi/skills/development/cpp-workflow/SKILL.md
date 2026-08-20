---
name: cpp-workflow
description: "C++ skill router for multi-domain tasks. Use when a C++ task spans 2+ concerns (e.g. refactoring + performance, architecture + modern idioms) and you need which-skills-to-load guidance. Do NOT load this for single-domain tasks: writing/editing any .cpp/.h/.hpp/.inl → load cpp-codestyle directly; single-concern tasks → load the matching specialized skill directly. cpp-codestyle is mandatory for all C++ code output; every other skill loads on demand only."
---

# C++ Development Workflow

为跨领域 C++ 任务路由到正确的 skill 子集。**单领域任务直接加载对应 skill，无需经过本 workflow。**

## 加载原则

- **`cpp-codestyle` 是写 C++ 的必载基线**：任何写入 .cpp/.h/.hpp/.inl 的操作都须先加载它，不经过路由判断
- **其他 skill 按需加载**：只在任务实际涉及该领域时加载，不做预防性串加载
- **最小集优先**：一次任务只加载实际需要的 skill，用完即止

## Skill 套件

| Skill | 定位 | 何时加载 |
|-------|------|---------|
| `cpp-codestyle` | 代码风格基线 | **任何**写入 .cpp/.h/.hpp/.inl 的操作都须遵循 |
| `cpp-component-methodology` | 物理设计 / 架构 | 模块划分、组件边界、依赖管理、Levelization |
| `cpp-modern-idioms` | 现代 C++ 惯用法 | 类型推导、智能指针、移动语义、lambda、constexpr 等 |
| `cpp-refactoring-improving-design` | 重构改善设计 | 修改既有代码、识别坏味道、应用重构手法 |
| `cpp-performance-optimization` | 应用层性能优化 | 性能分析、热点定位、数据结构选型、分配优化、I/O |
| `cpp-performance-analysis-tuning` | CPU 微架构级调优 | TMA 瓶颈分析、SIMD 向量化、分支预测、false sharing、缓存友好数据结构、PGO/BOLT |

`cpp-codestyle` 是**贯穿性约束**——所有 C++ 代码输出都须通过它。它不是"一个阶段"，而是叠加在其他 skill 之上的基线。

---

## 任务路由

根据用户意图，按顺序加载对应 skill：

### 写新代码

> 必载 codestyle → 其余按实际需要逐个加载

1. **必载** `cpp-codestyle`——所有输出代码都须符合
2. 涉及模块划分 / 物理设计 → 加载 `cpp-component-methodology`
3. 用到智能指针、移动语义、constexpr 等现代特性 → 加载 `cpp-modern-idioms`
4. 性能敏感路径（有明确性能目标或热点） → 加载 `cpp-performance-optimization`

### 修改既有代码

> 必载 codestyle → 诊断后按需加载

1. **必载** `cpp-codestyle`——修改后的代码须保持风格一致
2. 修改幅度大 / 有坏味道 → 加载 `cpp-refactoring-improving-design`（先诊断再动手）
3. 引入现代 C++ 特性 → 加载 `cpp-modern-idioms`
4. 涉及模块拆分/合并、依赖重排 → 加载 `cpp-component-methodology`
5. 有明确性能问题 → 加载 `cpp-performance-optimization`

### 性能优化专项

> 泛性能问题（"慢"、"优化"）→ 应用层优先；明确微架构任务 → 直接 tuning

**应用层 vs 微架构边界**：
- **应用层** (`cpp-performance-optimization`)：算法复杂度、数据结构选型、内存分配、I/O、并发模型——不依赖特定 OS / 硬件工具链
- **微架构级** (`cpp-performance-analysis-tuning`)：TMA、IPC、cache miss 分析、SIMD 向量化、分支预测、assembly throughput、false sharing——动态分析（perf/toplev）依赖 Linux + PMU，静态分析（LLVM-MCA、编译器诊断）不限平台（见该 skill 前置门控）

1. **泛性能问题**（用户只说"慢"/"要快"，未指定分析层次）→ 先加载 `cpp-performance-optimization`，测量优先，数据驱动
2. **明确微架构任务**（TMA / SIMD / PMU / IPC / assembly throughput / false sharing 等关键词）→ 直接加载 `cpp-performance-analysis-tuning`，无需先走应用层
3. 应用层优化时参考 `cpp-modern-idioms`（如 `emplace_back`、`noexcept`、`constexpr` 等）
4. 瓶颈在架构层面 → 加载 `cpp-component-methodology`
5. **应用层穷尽后仍不满足目标** → 加载 `cpp-performance-analysis-tuning`（⚠️ 动态分析需 Linux + PMU，见该 skill 环境门控）

### 架构设计

> component-methodology → codestyle → modern-idioms

1. 先加载 `cpp-component-methodology`，确定组件边界、依赖、Levelization
2. 加载 `cpp-codestyle` 约束命名、头文件组织、命名空间
3. 协议类 / Pimpl 等惯用法 → 加载 `cpp-modern-idioms`

### 代码审查

> 必载 codestyle → 按审查焦点按需加载

- **必载** `cpp-codestyle`：命名、include、类组织、访问器设计是否符合规范
- 焦点是现代化机会 → 加载 `cpp-modern-idioms`（auto、智能指针、constexpr 等）
- 焦点是设计质量 → 加载 `cpp-refactoring-improving-design`（坏味道、过度设计、死代码）

---

## 关键词索引

用户只涉及单一领域时，按关键词直接匹配：

| 领域 | 关键词 | 加载 |
|------|--------|------|
| **代码风格** | naming, include, namespace, class organization, accessor, error handling, comment, pragma once, m_ prefix, snake_case | `cpp-codestyle` |
| **架构/物理设计** | component, package, levelization, dependency, physical design, UOR, aggregate, cohesion, factoring, insulation, encapsulation | `cpp-component-methodology` |
| **现代惯用法** | auto, smart pointer, unique_ptr, shared_ptr, weak_ptr, move semantics, std::move, std::forward, lambda, constexpr, noexcept, override, nullptr, enum class, type deduction, decltype, perfect forwarding | `cpp-modern-idioms` |
| **重构** | refactor, code smell, bad smell, improve design, extract function, extract class, rename, simplify, dead code, YAGNI | `cpp-refactoring-improving-design` |
| **性能** | optimize, slow, fast, profile, benchmark, allocation, memory, cache, hot spot, loop, string, container, I/O, allocator, reserve, inline | `cpp-performance-optimization` |
| **CPU 微架构调优** | TMA, IPC, SIMD, vectorize, vectorization, branch prediction, branchless, false sharing, cache coherence, cache miss, roofline, PGO, BOLT, PEBS, LBR, PMU, prefetch, MESI, pipeline stall, frontend bound, backend bound, MLC, MPKI, OOO, microarchitecture, micro-architecture | `cpp-performance-analysis-tuning` |

---

## 交叉连接

当任务同时涉及多个领域时，参考以下交叉点确保 skill 间决策一致：

### 风格 × 架构
- 组件/包命名 → codestyle PascalCase + methodology 命名空间约定
- 头文件组织 → codestyle `#pragma once` / include 规则 + methodology 物理依赖原则
- 类内分组 → codestyle 逻辑分组 + methodology 绝缘层/封装层设计

### 风格 × 重构
- 重构后代码必须符合 codestyle 全部规范
- 提炼函数 → codestyle 函数定义规则（inline 外置）+ refactoring 提炼手法
- 重命名 → codestyle 命名规范（snake_case / PascalCase / m_ 前缀）

### 风格 × 惯用法
- `auto` 使用 → modern-idioms 何时用 `auto` × codestyle 可读性约束
- 访问器设计 → modern-idioms `[[nodiscard]]` × codestyle 命名规则（`query_` vs 直接名称）
- 错误处理 → modern-idioms `std::optional` / exceptions × codestyle 选择矩阵

### 风格 × 性能
- 成员变量 → codestyle Occam's Razor（不要滥加成员）× performance 缓存策略（`m_cached_xxx` + dirty flag）
- 函数定义 → codestyle inline/out-of-class 规则 × performance inline 决策

### 架构 × 重构
- 组件拆分/合并 → methodology 聚合层次 × refactoring 提炼类/内联类
- 依赖重排 → methodology Levelization × refactoring 搬移函数/搬移字段

### 架构 × 惯用法
- 协议类（Protocol Class）→ methodology 绝缘层 × modern-idioms `override` / `= default` / `= delete`
- Pimpl → methodology 封装 × modern-idioms `unique_ptr` 所有权
- 包命名 → methodology 命名约定 × modern-idioms 别名声明

### 架构 × 性能
- Levelization 减少链接时间，包结构决定部署单元
- 物理互操作性 → methodology 物理依赖 × performance 避免跨组件重分配

### 惯用法 × 重构
- 重构时引入现代惯用法：原始指针 → `unique_ptr`/`shared_ptr`，`new/delete` → `make_unique`/`make_shared`
- 条件逻辑 → modern-idioms `std::variant` / `std::optional` × refactoring 以多态取代条件

### 惯用法 × 性能
- `make_shared` 减少分配次数，`emplace_back` 避免临时对象
- `noexcept` 启用 vector 移动优化，`constexpr` 将计算移至编译期
- 智能指针选择 → 所有权语义 vs 内存开销

### 重构 × 性能
- 重构可能改变 cache locality → 注意 performance 影响
- 提炼循环体 → refactoring 提炼函数 × performance 函数调用开销权衡

### 性能（应用层） × CPU 微架构
- 应用层优化做完后仍不满足目标 → 加载 `cpp-performance-analysis-tuning` 进入微架构级分析
- 内存分配优化 (应用层) → 减少 allocator 调用 × 微架构 cache miss / TLB miss 分析
- 数据结构选型 (应用层) → 缓存友好性验证 (微架构)

### 惯用法 × CPU 微架构
- `noexcept` → 启用 STL 移动优化 → 减少内存带宽占用
- `constexpr` → 编译期计算替代运行时 → 减少 Frontend/Backend 压力
- `emplace_back` → 原地构造避免副本 → 减少 cache pollution

### 架构 × CPU 微架构
- 组件拆分粒度影响指令缓存 (I-cache) 和函数调用开销 → ITLB / Frontend Bound 分析
- 跨组件传递频率影响数据缓存 (D-cache) 局部性 → Backend Bound / Memory Bound 分析
- Levelization 影响链接时布局 → PGO/BOLT 二进制重排收益评估

---

## 完成标准（可检验）

本 workflow 的输出应满足以下可检验条件：

- [ ] **codestyle 已加载**：如果任务涉及写入任何 .cpp/.h/.hpp/.inl 文件，`cpp-codestyle` 已被加载
- [ ] **最小加载集**：已加载的每个 skill 都有明确的触发理由，无预防性串加载
- [ ] **性能边界正确**：如涉及性能优化，已按触发词区分——泛性能问题走应用层优先，明确微架构任务（TMA/SIMD/PMU/IPC/assembly throughput/false sharing）直达 `cpp-performance-analysis-tuning`
- [ ] **环境门控**：如路由到 `cpp-performance-analysis-tuning` 的**动态分析**（perf/toplev/PMU 计数器），已确认 Linux + PMU 可用；非 Linux 环境只做静态分析（LLVM-MCA、编译器诊断）并**明确标注"未经实测验证"**，同时给出可在 Linux 复现的验证路径
