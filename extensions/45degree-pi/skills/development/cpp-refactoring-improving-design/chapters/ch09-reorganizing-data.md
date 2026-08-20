# 第9章: 重新组织数据

## 核心思想
数据结构是理解程序行为的关键——同一个变量用于多种不同用途是滋生混乱和bug的温床，应确保每个变量只承担一个责任。

## 引入的框架
- **拆分变量（Split Variable）**：当一个变量在函数内被多次赋值（除循环变量和结果收集变量外），说明它承担了多个责任。
  - 何时使用：变量被赋值超过一次，且每次赋值服务于不同目的——例如一个变量先保存初始加速度、后保存复合加速度。
  - 如何操作：在第一次赋值处将变量改名为更具描述性的名称并声明为 `const`，在第二次赋值前将旧变量的引用改为新变量名，在第二次赋值处重新声明变量。

- **字段改名（Rename Field）**：记录/类中的字段名不准确或不清晰地表达含义时。
  - 何时使用：对数据的理解加深后，需要更新字段名以反映其真实含义。
  - 如何操作：先对记录做封装（Encapsulate Record），再在内部逐步修改私有字段名、构造函数参数、再到访问函数。

- **以查询取代派生变量（Replace Derived Variable with Query）**：某个变量可以通过其他数据计算得出，却被手动同步维护。
  - 何时使用：存在 `this._total += delta` 这类手动维护的累计值，而该值可通过源数据即时计算。
  - 如何操作：新建计算函数 → 用断言验证计算函数与原变量等价 → 将读取改为调用计算函数 → 移除死代码。

- **将引用对象改为值对象（Change Reference to Value）**：内部嵌入的对象应作为不可变的值对象，而非可被外部修改的引用对象。
  - 何时使用：你希望对象不可变、可安全传递和复制时；不需要在多个对象间共享修改时。
  - 如何操作：移除所有设值函数 → 将字段值通过构造函数注入 → 实现基于值的相等性判断（equals/hashCode）。

- **将值对象改为引用对象（Change Value to Reference）**：多个数据副本指向同一逻辑实体，且该实体的数据可能被更新。
  - 何时使用：多份订单共享同一个客户信息，客户数据需要变更时避免不一致。
  - 如何操作：创建仓库对象（Repository）→ 构造函数从仓库获取关联对象（而非新建副本）。

## 关键概念
- **结果收集变量（collecting variable）**：累加、字符串拼接、集合添加等用于收集函数运算结果的变量，不应被拆分。
- **循环变量（loop variable）**：随循环变化的变量（如 `for(let i=0;...)` 的 `i`），不应被拆分。
- **值对象（Value Object）**：不可变对象，基于字段值判断相等性，可安全复制和传递。
- **引用对象（Reference Object）**：基于身份（identity）判断相等，多个持有者共享同一实例，修改立即对所有持有者可见。
- **仓库对象（Repository）**：存储和检索共享实体的对象，确保每个实体ID对应唯一实例。
- **派生变量（derived variable）**：可由源数据计算得出的变量，手动维护它是数据重复的来源。
- **基于值的相等性（value-based equality）**：两个对象如果所有字段值相同即视为相等，需覆写 `equals` 和 `hashCode`。
- **不可变性（immutability）**：对象创建后字段不再改变，是消除可变性风险的最强手段。

## 思维模型
- **当一个变量在函数体内被两次赋给不同含义的值时，将其视为两个不同的变量**：每个变量应该只有一个明确的含义，通过 `const` 声明和描述性名称来强化。
- **当派生数据手动同步维护时，将其视为"缓存失效"问题**：直接删除缓存，改为按需计算——计算比记忆更可靠。
- **将值对象视为"可替换的硬币"，将引用对象视为"共享的钥匙"**：硬币可以任意复制和替换，钥匙的改变会影响所有持有者。
- **将仓库对象视为"电话簿"**：通过ID查找实体，确保同一ID始终返回同一实例。

## 反模式
- **对输入参数直接赋值**：混淆了"输入"和"输出返回"两个角色，应用拆分变量分离为 `inputValue`（只读判断）和 `result`（累积输出）。
- **在可变数据结构上维护派生字段**：修改源数据时容易忘记同步更新派生字段，导致数据不一致。应改为计算。
- **在需要共享修改的场景下使用值对象**：一份数据被多处持有，修改无法传播，导致数据不一致。
- **构造函数与全局仓库对象强耦合**：全局对象像强力药物——少用有益，过量是毒药。应将仓库作为参数传入。

## 代码示例
<!-- 拆分变量：acc变量承担两个责任 -->
```cpp
// Before: acc变量先代表初始加速度，后代表复合加速度
auto distanceTravelled(const Scenario& scenario, double time) -> double {
    auto acc = scenario.primaryForce / scenario.mass;
    // ... uses acc as primary acceleration ...
    acc = (scenario.primaryForce + scenario.secondaryForce) / scenario.mass;
    // ... uses acc as secondary acceleration ...
}

// After: 拆分为两个含义明确的const变量
auto distanceTravelled(const Scenario& scenario, double time) -> double {
    const auto primaryAcceleration = scenario.primaryForce / scenario.mass;
    // ... uses primaryAcceleration ...
    const auto secondaryAcceleration = (scenario.primaryForce + scenario.secondaryForce) / scenario.mass;
    // ... uses secondaryAcceleration ...
}
```
- **演示了什么**：一个变量承载两个不同的物理概念（初始加速度 vs 复合加速度），通过拆分为两个 `const` 变量消除混淆。

## 工作示例（DEPTH=study 必须有）
### 拆分变量：苏格兰布丁运动距离计算
问题：`acc` 变量先保存初始加速度（第一力），后被重新赋值为复合加速度（两力之和）。原始代码：
```cpp
auto acc = scenario.primaryForce / scenario.mass;         // 赋值1: 初始加速度
auto primaryTime = std::min(time, scenario.delay);
result = 0.5 * acc * primaryTime * primaryTime;
// ...
acc = (scenario.primaryForce + scenario.secondaryForce) / scenario.mass; // 赋值2: 复合加速度
result += primaryVelocity * secondaryTime + 0.5 * acc * secondaryTime * secondaryTime;
```
重构步骤：
1. 第一次赋值处命名新变量 `primaryAcceleration`，声明为 `const`
2. 将第二次赋值前的所有 `acc` 引用替换为 `primaryAcceleration`
3. 第二次赋值处命名新变量 `secondaryAcceleration`，声明为 `const`
4. 最终：两个 `const` 变量分别代表初速度和次速度，责任各自清晰

### 以查询取代派生变量：ProductionPlan 累计值
问题：`_production` 字段在 `applyAdjustment` 中手动累加，而累计值可即时计算。
```cpp
// Before: 手动维护 _production
auto production() -> int { return this->_production; }
void applyAdjustment(const Adjustment& anAdjustment) {
    this->_adjustments.push_back(anAdjustment);
    this->_production += anAdjustment.amount; // 手动同步
}
```
重构：先用断言验证计算值与存储值等价，再切换为按需计算，最后移除存储字段。
```cpp
// After: 即时计算，消除数据重复
auto production() const -> int {
    auto sum = 0;
    for (const auto& a : this->_adjustments) sum += a.amount;
    return sum;
}
void applyAdjustment(const Adjustment& anAdjustment) {
    this->_adjustments.push_back(anAdjustment);
    // 不再手动更新 _production
}
```

## 关键要点
1. 变量被赋值超过一次（非循环/收集变量）时，应立即拆分为多个有具体名字的变量，并用 `const` 声明
2. 能计算的值就不要存储——计算永远不会"忘记更新"
3. 善用断言验证重构的正确性：在切换到计算值之前，先断言 `旧值 === 计算值`
4. 值对象应当不可变——移除设值函数并在构造函数中注入所有字段值
5. 当数据需要共享更新时，使用引用对象+仓库模式；当数据安全复制时，使用值对象
6. 字段改名要小步前进：先封装 → 内部改名 → 改构造函数 → 改访问函数，每步测试
7. 全局对象（包括全局仓库）应被视为依赖注入的参数，而非直接引用

## 关联到
- **Ch 4**：构建测试体系——本重构的每一步修改后都要测试，测试是重构的安全网
- **Ch 6**：提炼函数（106）、封装变量（132）——这些基本重构是本数据重构手法的前置步骤
- **Ch 7**：封装记录（162）——字段改名的前置步骤，先封装再改名
- **Value Object 模式**：领域驱动设计中的值对象概念，不可变、基于值判断相等
