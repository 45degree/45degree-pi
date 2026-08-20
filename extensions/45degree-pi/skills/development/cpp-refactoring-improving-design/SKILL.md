---
name: cpp-refactoring-improving-design
description: "Refactoring techniques and code smell identification. Use when applying refactorings (extract/inline/move), diagnosing code smells, choosing between inheritance vs delegation, or planning a step-by-step safe restructuring workflow. Covers the full catalog of ~60 refactorings across 12 chapters."
---

<!-- argument-hint: [重构手法名、坏味道名、章节号、或主题] -->

# 重构：改善既有代码的设计（第2版）
**作者**：Martin Fowler（马丁·福勒） | **章节**：12 | **生成**：2026-06-28

## 如何使用

- **无参数** — 下方核心决策规则已加载；需要完整细节时读取对应章节。
- **指定主题** — 询问 `提炼函数`、`神秘命名`、`继承 vs 委托` 等，我会找到并读取相关章节。
- **指定章节** — 询问 `ch06`，我会加载对应章节。
- **浏览** — 问 "有哪些章节？" 查看完整索引。

未被下方"主题索引"覆盖的问题，我会先读取对应章节文件再做回答。

---

## 核心决策规则

| 决策点 | 规则 | 详情 |
|--------|------|------|
| 两顶帽子 | 每次编码前明确：加功能（不改既有代码，只加测试和新功能）还是重构（不加功能，只调结构，不改行为）。 | [ch02](chapters/ch02-principles-of-refactoring.md) |
| 何时重构 | 三次法则：第三次重复时重构。预备性重构：加功能前先调结构（YAGNI：未来不会太难则现在不加）。营地法则：每次触碰代码都让它更干净。 | [ch02](chapters/ch02-principles-of-refactoring.md) |
| 婴儿学步 | 每步尽可能小，每步后运行测试。出错就撤销上一步换更小的步。 | [ch05](chapters/ch05-introducing-the-catalog.md) |
| 代码坏味道 | 识别 24 种坏味道 → 查 [cheatsheet.md](cheatsheet.md) 坏味道→手法映射 → 采用对应重构。关键：注释常被用作"除臭剂"——先重构让注释变多余。 | [ch03](chapters/ch03-bad-smells-in-code.md) |
| 函数提取 | 函数需要注释才能理解 → 提炼函数。函数名不能表明用途 → 改变函数声明。 | [ch06](chapters/ch06-first-set-of-refactorings.md) |
| 条件逻辑 | 同一 switch 多处出现 → 以多态取代条件表达式。嵌套条件 → 卫语句。 | [ch10](chapters/ch10-simplifying-conditional-logic.md) |
| 数据组织 | 数据泥团（删一项其他失去意义）→ 引入参数对象/提炼类。参数超 3-4 个 → 引入参数对象。 | [ch06](chapters/ch06-first-set-of-refactorings.md), [ch09](chapters/ch09-reorganizing-data.md) |
| 继承 vs 委托 | 子类不想继承超类功能 → 以委托取代子类。类一半方法在委托 → 移除中间人。新增变体需改多处 → 拆分模块。 | [ch12](chapters/ch12-dealing-with-inheritance.md), [cheatsheet.md](cheatsheet.md) |
| 性能优化 | 先度量找热点 → 集中优化 → 小步修改/编译/测试/再度量 → 未提升就撤销。不臆测。 | [ch02](chapters/ch02-principles-of-refactoring.md) |
| 重构名录 | 约 60 个手法分 7 组（Ch 6-12）。完整手法列表见 [patterns.md](patterns.md)，坏味道→手法映射见 [cheatsheet.md](cheatsheet.md)。 | [ch05](chapters/ch05-introducing-the-catalog.md) |
| 长期重构 | Branch By Abstraction：引入抽象层兼容新旧接口，逐步迁移调用方，最后替换底层实现。 | [ch02](chapters/ch02-principles-of-refactoring.md) |
| 演进式架构 | 三大基石：自测试代码 + 持续集成 + 重构。先基于当前需求构造，随理解加深通过重构调整。 | [ch02](chapters/ch02-principles-of-refactoring.md) |

## 章节索引

| # | 标题 | 关键框架 |
|---|------|----------|
| [ch01](chapters/ch01-refactoring-first-example.md) | 重构，第一个示例 | Extract Function, Split Phase, Replace Conditional with Polymorphism 等 8 个手法端到端演示 |
| [ch02](chapters/ch02-principles-of-refactoring.md) | 重构的原则 | Two Hats, Rule of Three, Camping Rule, Preparatory Refactoring, YAGNI, 性能优化流程 |
| [ch03](chapters/ch03-bad-smells-in-code.md) | 代码的坏味道 | 24 种 Code Smells 完整定义与识别准则 |
| [ch04](chapters/ch04-building-tests.md) | 构筑测试体系 | Test Fixture, Arrange-Act-Assert, Boundary Probing, TDD |
| [ch05](chapters/ch05-introducing-the-catalog.md) | 介绍重构名录 | 名录 5 部分格式、婴儿学步、挑选标准 |
| [ch06](chapters/ch06-first-set-of-refactorings.md) | 第一组重构 | Extract/Inline Function/Variable, Change Function Declaration 等 10 手法 |
| [ch07](chapters/ch07-encapsulation.md) | 封装 | Encapsulate Record/Collection, Extract/Inline Class, Hide Delegate 等 9 手法 |
| [ch08](chapters/ch08-moving-features.md) | 搬移特性 | Move Function/Field, Slide Statements, Split Loop, Replace Loop with Pipeline 等 9 手法 |
| [ch09](chapters/ch09-reorganizing-data.md) | 重新组织数据 | Split Variable, Rename Field, Change Reference/Value 等 5 手法 |
| [ch10](chapters/ch10-simplifying-conditional-logic.md) | 简化条件逻辑 | Decompose Conditional, Guard Clauses, Replace Conditional with Polymorphism 等 6 手法 |
| [ch11](chapters/ch11-refactoring-apis.md) | 重构 API | Separate Query from Modifier, Parameterize Function, Remove Flag Argument 等 10 手法 |
| [ch12](chapters/ch12-dealing-with-inheritance.md) | 处理继承关系 | Pull Up/Down, Replace Type Code with Subclasses, Replace Subclass/Superclass with Delegate 等 11 手法 |

## 主题索引

- **Branch By Abstraction** → ch02
- **Camping Rule（营地法则）** → ch02
- **Code Smells（代码坏味道）** → ch03, cheatsheet
- **Decompose Conditional（分解条件表达式）** → ch10
- **Encapsulate Record（封装记录）** → ch07
- **Extract Function（提炼函数）** → ch06, ch01
- **Guard Clauses（卫语句）** → ch10
- **Hide Delegate（隐藏委托关系）** → ch07
- **Inline Function（内联函数）** → ch06
- **继承 vs 委托** → ch12, cheatsheet
- **Introduce Parameter Object（引入参数对象）** → ch06
- **Move Function（搬移函数）** → ch08
- **性能优化** → ch02
- **Preparatory Refactoring（预备性重构）** → ch02
- **Pull Up Method（函数上移）** → ch12
- **Remove Middle Man（移除中间人）** → ch07
- **Replace Conditional with Polymorphism（以多态取代条件表达式）** → ch10
- **Replace Loop with Pipeline（以管道取代循环）** → ch08
- **Replace Primitive with Object（以对象取代基本类型）** → ch07
- **Replace Subclass with Delegate（以委托取代子类）** → ch12
- **Rule of Three（三次法则）** → ch02
- **Separate Query from Modifier（查询/修改分离）** → ch11
- **Split Phase（拆分阶段）** → ch06
- **TDD / 测试驱动开发** → ch04
- **Temporary Field（临时字段）** → ch03
- **Two Hats（两顶帽子）** → ch02
- **YAGNI** → ch02

## 支持文件

- [glossary.md](glossary.md) — 118 个关键术语（含英文原名与出处章节）
- [patterns.md](patterns.md) — 全部 61 个重构手法，按类别分组，含何时使用/如何操作/权衡
- [cheatsheet.md](cheatsheet.md) — 速查决策表：坏味道→手法映射、阈值、继承 vs 委托矩阵

---

## 范围与限制

本 skill 覆盖《重构：改善既有代码的设计（第2版）》全部 12 章内容。对于书籍范围外的主题（如特定 C++ 实现细节），请结合项目上下文或其他 skill。
