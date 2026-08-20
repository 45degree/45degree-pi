# 第11章: 重构API

## 核心思想
好的API将查询和修改清晰分离、保持对象完整、消除标记参数、追求不可变性——API的设计是关于"责任分配"的持续权衡，而不是一次性决策。

## 引入的框架
- **将查询函数和修改函数分离（Separate Query from Modifier）**：函数既有返回值又有可见副作用。
  - 何时使用：函数做了一件事（如查找恶棍）并返回了值，同时执行了副作用（拉响警报）。
  - 如何操作：复制函数 → 去掉副作用 → 重命名为查询形式（如 `findMiscreant`）→ 调用处改为"先查后改"。

- **函数参数化（Parameterize Function）**：两个函数逻辑几乎相同，仅字面量值不同。
  - 何时使用：`tenPercentRaise` 和 `fivePercentRaise` 仅因子不同；`bottomBand` / `middleBand` / `topBand` 仅上下界不同。
  - 如何操作：选择一个函数 → 用改变函数声明添加参数 → 调整函数体 → 逐个替换其他相似函数的调用处。

- **移除标记参数（Remove Flag Argument）**：函数根据布尔型/枚举型参数执行不同分支。
  - 何时使用：`deliveryDate(anOrder, true)` —— 调用者无法从调用处得知 `true` 的含义。
  - 如何操作：用分解条件表达式拆分出 `rushDeliveryDate()` 和 `regularDeliveryDate()` 两个明确函数 → 替换调用处 → 删除原函数。

- **保持对象完整（Preserve Whole Object）**：调用者从记录中取出几个值传给函数，而非传递整个记录。
  - 何时使用：`aPlan.withinRange(aRoom.daysTempRange.low, aRoom.daysTempRange.high)` —— 温度范围被拆散了。
  - 如何操作：新建函数接受完整对象 → 调用处改为传整个对象 → 内联旧函数。

- **以查询取代参数（Replace Parameter with Query）**：函数可以从自身获取的参数何必让调用者传入。
  - 何时使用：`discountedPrice(basePrice, this.discountLevel)` —— `discountLevel` 可通过 `this.discountLevel` 自行获取。
  - 如何操作：函数体内改为自行调用获取该值 → 移除参数。适用于函数具有引用透明性时。

- **以参数取代查询（Replace Query with Parameter）**：函数内部引用了全局对象或想要解耦的元素。
  - 何时使用：`targetTemperature` 引用全局 `thermostat` 对象，导致测试困难。
  - 如何操作：将查询提炼为变量 → 提炼新函数接收该值为参数 → 内联回调用处。代价是调用者变复杂，收获是引用透明性。

- **移除设值函数（Remove Setting Method）**：对象创建后某字段不应再被修改，却暴露了设值函数。
  - 何时使用：`id` 字段创建后永远不变，但 `set id(arg)` 误导调用者。
  - 如何操作：将字段值通过构造函数注入 → 外部调用改为构造时传入 → 内联消去设值函数。

- **以工厂函数取代构造函数（Replace Constructor with Factory Function）**：构造函数有局限性——名称固定、无法基于参数返回子类实例、需 `new` 关键字。
  - 何时使用：需要根据参数返回不同子类；或类型码字面量（如 `'E'`）应在函数名中体现。
  - 如何操作：创建 `createEmployee(name, typeCode)` / `createEngineer(name)` 包装函数 → 替换所有 `new` 调用。

- **以命令取代函数（Replace Function with Command）**：复杂函数需要拆解，但局部变量阻碍提炼。
  - 何时使用：长函数中有大量局部变量和复杂控制流，无法简单提炼子函数。
  - 如何操作：将函数变为 `class Scorer { execute() {...} }`，所有局部变量变为字段，各步骤提炼为方法。

- **以函数取代命令（Replace Command with Function）**：命令对象过于复杂，实际只需一个简单函数。
  - 何时使用：命令对象只是简单计算，不需要生命周期管理、撤销等高级能力。
  - 如何操作：提炼出执行函数 → 内联命令对象中的支持方法 → 将构造参数移到执行函数参数 → 移除命令类。

## 关键概念
- **命令-查询分离原则（Command-Query Separation, CQS）**：任何有返回值的函数都不应有可见副作用。
- **标记参数（Flag Argument）**：调用者以字面量形式传入的、用于控制函数内部流程的参数——它是坏味道。
- **引用透明性（Referential Transparency）**：相同输入始终返回相同输出，不依赖任何可变的外部状态。
- **创建脚本（Creation Script）**：通过构造函数 + 一系列设值函数调用来构造对象的模式——应替换为一次构造函数调用。
- **命令对象（Command Object）**：封装了一次函数调用的对象，支持撤销、参数设置、生命周期管理等高级特性。
- **工厂函数（Factory Function）**：替代构造函数的普通函数，可自由命名，可返回子类或代理对象。

## 思维模型
- **将有返回值+副作用的函数视为"说谎者"**：它声称是一个计算，却在暗地里改变了世界——用 Separate Query from Modifier 揭穿它。
- **将标记参数视为"被压扁的两个函数"**：`deliveryDate(order, true)` 和 `deliveryDate(order, false)` 本质是两个不同的操作，只是共用一个函数名——拆开它们。
- **将被拆散的参数视为"碎纸片"**：从完整对象中取出几个值传递，破坏了信息的完整性——保持对象完整，让被调函数自己去取所需数据。
- **将"参数 vs 查询"的选择视为"责任分配"博弈**：参数化让调用者承担责任但获得引用透明性，查询化让函数自给自足但引入依赖——没有永远正确的答案。

## 反模式
- **函数既返回数据又修改状态**：违反 CQS 原则，让调用者难以推理函数行为。应分离为纯查询函数和副作用函数。
- **保留布尔型标记参数**：`bookConcert(customer, true)` 比 `premiumBookConcert(customer)` 表达能力弱得多。
- **拆散对象再传递**：`aPlan.withinRange(low, high)` 不如 `aPlan.withinRange(aRoom.daysTempRange)` ——后者更能应对变化（新增字段无需改参数列表）。
- **构造函数中直接使用 `new` 的类型码字面量**：`new Employee(name, 'E')` 应替换为 `createEngineer(name)`。
- **滥用命令对象**：95% 的情况下普通函数足够——只有当需要拆解极复杂函数或需要撤销、队列执行等能力时才用命令模式。

## 代码示例
<!-- 移除标记参数：从隐蔽分支到显式函数 -->
```cpp
// Before: true/false 无法从调用处理解意图
aShipment.deliveryDate = deliveryDate(anOrder, true);
aShipment.deliveryDate = deliveryDate(anOrder, false);

// After: 两个明确函数，意图自文档化
aShipment.deliveryDate = rushDeliveryDate(anOrder);
aShipment.deliveryDate = regularDeliveryDate(anOrder);
```
- **演示了什么**：标记参数（布尔 `isRush`）隐藏了函数调用的差异——拆分为两个具名函数后，代码意图一目了然。

## 工作示例（DEPTH=study 必须有）
### 将查询与修改分离：恶棍警报系统
```cpp
// Before: 一个函数既查找恶棍又拉响警报
auto alertForMiscreant(const std::vector<std::string>& people) -> std::string {
    for (const auto& p : people) {
        if (p == "Don") { setOffAlarms(); return "Don"; }
        if (p == "John") { setOffAlarms(); return "John"; }
    }
    return "";
}
const auto found = alertForMiscreant(people); // 副作用和查询混在一起

// After: 查询和修改分离
auto findMiscreant(const std::vector<std::string>& people) -> std::string { /* 纯查询，无副作用 */ }
void alertForMiscreant(const std::vector<std::string>& people) {
    if (findMiscreant(people) != "") setOffAlarms(); // 复用查询函数
}
const auto found = findMiscreant(people); // 可安全多次调用
alertForMiscreant(people);           // 需要时显式调用
```

### 以命令取代函数：保险评分系统
问题：`score()` 函数中有多个局部变量（`result`, `healthLevel`, `highMedicalRiskFlag`, `certificationGrade`），阻碍提炼子函数。

重构过程：
1. 创建空类 `Scorer`，用搬移函数将 `score` 变为 `Scorer.execute()`
2. 逐个将参数移到构造函数：`new Scorer(candidate, medicalExam, scoringGuide)`
3. 逐个将局部变量变为字段：`this._result`, `this._healthLevel`, `this._highMedicalRiskFlag`, `this._certificationGrade`
4. 提炼子方法：`scoreSmoking() { if (this._medicalExam.isSmoker) { this._healthLevel += 10; ... } }`

最终效果：`execute()` 方法变为清晰的步骤序列，每个步骤是独立可测试的方法。

### 以参数取代查询：温控系统解耦
```cpp
// Before: targetTemperature 依赖全局 thermostat
auto targetTemperature() const -> double {
    if (thermostat.selectedTemperature > this->_max) return this->_max;
    else if (thermostat.selectedTemperature < this->_min) return this->_min;
    else return thermostat.selectedTemperature;
}

// After: 参数化，去除对 thermostat 的依赖
auto targetTemperature(double selectedTemperature) const -> double {
    if (selectedTemperature > this->_max) return this->_max;
    else if (selectedTemperature < this->_min) return this->_min;
    else return selectedTemperature;
}
// 调用方承担提供参数的责任，但函数获得了引用透明性
```

## 关键要点
1. 任何有返回值的函数都不应有副作用——这是 API 设计的黄金法则
2. 布尔型参数是坏味道——拆分为两个命名明确的函数
3. 传递整个对象比拆散传递更能应对变化
4. 函数参数列表应总结函数的可变性——参数越少越好，但不要因此隐藏必要的依赖
5. 追求不可变性——移除设值函数，让字段在构造后不再变化
6. 工厂函数比构造函数更灵活——可以自由命名，可以根据条件返回子类实例
7. 命令模式是重型武器，仅当函数太复杂无法简单提炼时才使用
8. "以查询取代参数"和"以参数取代查询"是对称的权衡——决定"谁负责获取数据"

## 关联到
- **Ch 6**：提炼函数（106）、改变函数声明（124）、封装变量（132）——本章所有重构的基础构建块
- **Ch 7**：搬移函数（198）——将新建函数搬移到合适的上下文中
- **Ch 9**：将引用对象改为值对象（252）——与移除设值函数协同，构建不可变对象
- **CQS（Command-Query Separation）**：Bertrand Meyer 提出的设计原则，查询与命令应分离
- **设计模式：Command 模式**：以命令取代函数/以函数取代命令背后的模式
