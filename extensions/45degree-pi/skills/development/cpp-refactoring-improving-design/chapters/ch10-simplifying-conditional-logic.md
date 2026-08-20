# 第10章: 简化条件逻辑

## 核心思想
程序的复杂度大多来自条件逻辑——不要用代码告诉读者"发生什么"，而是用清晰命名的函数和多态告诉读者"为什么会这样"。

## 引入的框架
- **分解条件表达式（Decompose Conditional）**：复杂的 `if-else` 条件判断和分支代码块混在一起时。
  - 何时使用：条件表达式本身难以理解（如 `!aDate.isBefore(plan.summerStart) && !aDate.isAfter(plan.summerEnd)`），或分支代码块较长。
  - 如何操作：对条件判断和每个分支分别运用提炼函数，使代码变为 `if (summer()) charge = summerCharge(); else charge = regularCharge();`

- **合并条件表达式（Consolidate Conditional Expression）**：一连串条件检查指向相同结果时。
  - 何时使用：多个 `if` 都 `return 0`，且这些检查表达的是同一个逻辑意图。
  - 如何操作：用逻辑或（`||`）合并顺序检查，用逻辑与（`&&`）合并嵌套 `if`，提炼为语义函数如 `isNotEligibleForDisability()`。

- **以卫语句取代嵌套条件表达式（Replace Nested Conditional with Guard Clauses）**：某条分支是异常/边界情况，而非主流程的同等分支。
  - 何时使用：当 `if-else` 中只有一条分支是"正常行为"，其他分支是提前退出的异常情况。
  - 如何操作：将异常条件反转，在开头用 `return` 提前退出，主逻辑平铺在函数末尾。

- **以多态取代条件表达式（Replace Conditional with Polymorphism）**：多个函数中都有基于同一类型码的 `switch` 语句。
  - 何时使用：`plumage()` 和 `airSpeedVelocity()` 等不同操作都根据 `bird.type` 做分支——这是引入多态的最明显征兆。
  - 如何操作：为每种类型码创建子类 → 工厂函数返回正确类型 → 将 `switch` 分支逻辑移入对应子类的覆写方法。

- **引入特例（Introduce Special Case）**：多处代码以相同方式检查和处理同一个特殊值（如 `"unknown"` 或 `null`）。
  - 何时使用：`if (aCustomer === "unknown") customerName = "occupant"` 散布在多处。
  - 如何操作：创建 `UnknownCustomer` 类/字面量，将特例的默认行为封装其中，客户端直接调用 `aCustomer.name` 而无需条件判断。

- **引入断言（Introduce Assertion）**：代码假设某条件始终为真，但该假设未在代码中显式表达。
  - 何时使用：只有当条件"必须为真、绝不应当失败"时才用断言，用于检查程序员错误而非外部数据。
  - 如何操作：在关键假设处插入 `assert(condition)`，只用于交流意图和捕获内部bug。

## 关键概念
- **卫语句（Guard Clause）**：在函数开头检查异常条件并立即返回的语句，表达"这种情况不是本函数核心逻辑所关心的"。
- **特例对象（Special Case Object）**：封装了对某个特殊值（如 null/unknown）的共用行为的对象，使客户端无需做条件判断。
- **Null对象模式（Null Object Pattern）**：特例模式的一种特例——用对象替代 `null`，提供默认的无操作行为。
- **标记参数（Flag Argument）**：字面量形式的布尔型/枚举型参数，用于指示函数执行哪条分支——应被移除而非保留。
- **变体逻辑（Variant Logic）**：基础逻辑之上的特殊处理分支，适合用子类分离——如"中国经验"的评级逻辑与通用评级逻辑。
- **引用透明性（Referential Transparency）**：相同输入始终产生相同输出，无副作用，是函数式编程的核心属性。

## 思维模型
- **将"if-else 两条分支同等重要"的场景与"if 是异常、主流程在 else"的场景分开**：前者用 `if-else`，后者用卫语句——代码结构应反映分支的重要程度差异。
- **将多个检查同一结果的 if 语句视为"同一个问题的多个条件"**：合并它们，让逻辑的意图浮出水面——`isNotEligibleForDisability()` 比三个独立的 `if` 清晰百倍。
- **将基于类型码的 switch 视为"尚未被发现的类型体系"**：每种 case 应当成为一个子类的覆写方法，多态替你分发。
- **将散布各处的特例检查视为"缺失的对象"**：创建一个 `UnknownCustomer` 类，让所有客户端直接调用 `customer.name` 而无需 `if`。

## 反模式
- **盲目用多态替换所有条件逻辑**：大部分条件逻辑只需要基础的 `if/else` 或 `switch/case`，多态是重型武器，只在多个函数都有相同类型分发时才值得使用。
- **滥用断言检查外部输入**：断言只应用于检查程序员的内部错误。外部数据源的校验必须是程序的一等公民。
- **布尔型标记参数隐藏函数调用差异**：`deliveryDate(anOrder, true)` —— 读者无法从调用处得知 `true` 的含义。应拆分为 `rushDeliveryDate(anOrder)`。
- **单一出口原则教条化**：有些程序员坚持"每个函数只有一个出口"。若有清晰的卫语句，"多个出口"可读性远优于深层嵌套。

## 代码示例
<!-- 特例对象消除分散的条件判断 -->
```cpp
// Before: 类型码+switch 散布多处
auto plumage(const Bird& bird) -> std::string {
    switch (bird.type) {
        case Type::EuropeanSwallow: return "average";
        case Type::AfricanSwallow: return (bird.numberOfCoconuts > 2) ? "tired" : "average";
        case Type::NorwegianBlueParrot: return (bird.voltage > 100) ? "scorched" : "beautiful";
        default: return "unknown";
    }
}
auto airSpeedVelocity(const Bird& bird) -> int {
    switch (bird.type) { /* 同样的 switch 结构 */ }
}

// After: 多态代替条件逻辑
class Bird { public: virtual auto plumage() const -> std::string { return "unknown"; } };
class EuropeanSwallow : public Bird { public: auto plumage() const -> std::string override { return "average"; } };
class AfricanSwallow : public Bird { public: auto plumage() const -> std::string override { return (numberOfCoconuts > 2) ? "tired" : "average"; } };
```
- **演示了什么**：两个不同操作中出现相同的 `switch(bird.type)` 结构——引入多态后，每个鸟类型的行为集中在自己的子类中，不再需要分支。

## 工作示例（DEPTH=study 必须有）
### 以多态处理变体逻辑：航运评级系统
问题：`rating()` 函数中多处重复检查 "是否有到中国的航程" 和 "船长是否曾去过中国"，"中国因素"的变体逻辑与基础逻辑混在一起。

重构过程：
1. 用函数组合成类（144）将 `voyageRisk`, `captainHistoryRisk`, `voyageProfitFactor` 等函数组合到 `Rating` 类中
2. 创建空子类 `ExperiencedChinaRating extends Rating`
3. 创建工厂函数 `createRating()`——当 `voyage.zone === "china" && hasChinaHistory` 时返回子类实例
4. 将 `captainHistoryRisk` 中的变体逻辑（`result -= 2`）移到子类覆写：`return super.captainHistoryRisk - 2`
5. 将 `voyageProfitFactor` 中的复杂条件提炼为 `voyageAndHistoryLengthFactor` → 在子类覆写 → 进一步拆分为 `historyLengthFactor` 和 `voyageLengthFactor`
6. 最终：`ExperiencedChinaRating.voyageProfitFactor() { return super.voyageProfitFactor + 3; }` ——子类只表达与基类的差异

最终对比：
- **Rating（基础）**：不考虑中国经验的纯评级逻辑，`historyLengthFactor` 阈值是 `> 8`
- **ExperiencedChinaRating（变体）**：`historyLengthFactor` 阈值变为 `> 10`，`voyageProfitFactor` 额外加3分，`captainHistoryRisk` 额外减2分

### 引入特例：UnknownCustomer 消除分散的 null 检查
问题：多处代码以 `aCustomer === "unknown"` 检查，且处理方式一致（名字="occupant"，套餐=basic，欠费=0）。
Before/After 对比：
```cpp
// Before: 条件判断散布
if (aCustomer == "unknown") customerName = "occupant";
else customerName = aCustomer.name;
const auto plan = (aCustomer == "unknown") ? registry.billingPlans.basic : aCustomer.billingPlan;

// After: 特例对象封装行为
class UnknownCustomer {
public:
    auto isUnknown() const -> bool { return true; }
    auto name() const -> std::string { return "occupant"; }
    auto billingPlan() const -> BillingPlan { return registry.billingPlans.basic; }
    auto paymentHistory() const -> NullPaymentHistory { return NullPaymentHistory{}; }
};
// 客户端直接调用：
const auto customerName = aCustomer.name(); // 无需检查
```

## 关键要点
1. 条件表达式本身和每个分支都应提炼为语义清晰的函数——让代码回答"为什么"而非"做什么"
2. 当多个 `if` 返回相同结果时，用 `||` 或 `&&` 合并为单一条件，再提炼为函数
3. 异常/边界情况用卫语句 `return` 提前退出，不要把主流程埋在 `else` 深处
4. 两个以上函数中出现相同 `switch(type)` 结构是多态的最强信号
5. 特例对象（包括 NullObject）是消除重复条件判断的最优雅方案——未来新增特例行为只需修改一个类
6. 断言是交流工具而非错误处理工具——只用于"绝不应失败"的内部假设
7. "对象组合优于类继承"的真实含义是：用继承表达"是什么"（is-a），用委托表达"有什么"（has-a），两者审慎组合优于单独使用

## 关联到
- **Ch 6**：提炼函数（106）——分解条件表达式和合并条件表达式都依赖于此基础重构
- **Ch 7**：函数组合成类（144）、函数组合成变换（149）——为多态重构提供类结构基础
- **Ch 9**：将引用对象改为值对象（252）——特例对象应为不可变的值对象
- **Ch 12**：以子类取代类型码（362）、以委托取代子类（381）——多态和特例模式的底层实现
- **设计模式：State/Strategy**：引入特例常落实为状态模式或策略模式
