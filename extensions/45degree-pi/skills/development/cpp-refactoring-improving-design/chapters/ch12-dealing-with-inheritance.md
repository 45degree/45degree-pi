# 第12章: 处理继承关系

## 核心思想
继承是强有力的复用机制，但它只能用一次且引入紧密耦合——应在演化中大胆使用继承表达共性，遇到限制时果断转向委托。

## 引入的框架
- **函数上移（Pull Up Method）**：多个子类中有相同或可通过参数化变得相同的函数。
  - 何时使用：`Employee.annualCost()` 和 `Department.totalAnnualCost()` 都返回 `monthlyCost * 12`。
  - 如何操作：统一函数签名 → 复制到超类 → 逐个删除子类中的函数。建议在超类添加陷阱函数 `throw new SubclassResponsibilityError()`。

- **字段上移（Pull Up Field）**：多个子类中声明了相同字段。
  - 何时使用：`Salesman._name` 和 `Engineer._name` 是重复的数据声明。
  - 如何操作：先统一字段名 → 在超类声明字段 → 删除子类字段。

- **构造函数本体上移（Pull Up Constructor Body）**：多个子类的构造函数中有公共赋值逻辑。
  - 何时使用：`Employee` 和 `Department` 构造函数都执行 `this._name = name`。
  - 如何操作：将公共语句移到 `super()` 调用后 → 将公共语句提至超类构造函数并传入参数。

- **函数下移（Push Down Method）**：超类中某函数只与一个（或少数）子类相关。
  - 何时使用：`quota` 只在 `Salesman` 中有意义，`Engineer` 不需要。
  - 如何操作：复制到需要它的子类 → 删除超类中的 → 从不需要的子类中删除。

- **字段下移（Push Down Field）**：超类中某字段只被少数子类使用。
  - 何时使用：同上，针对字段。

- **以子类取代类型码（Replace Type Code with Subclasses）**：类用类型码字段区分不同行为。
  - 何时使用：`Employee` 有 `type` 字段（`"engineer"`, `"manager"`, `"salesman"`），多个函数根据 `type` 做 `switch`。
  - 如何操作：自封装类型码 → 为每个类型码创建子类 → 工厂函数中根据类型码分发 → 用函数下移和以多态取代条件表达式处理依赖类型码的函数。

- **移除子类（Remove Subclass）**：子类已失去价值，其差异可简单用一个字段表达。
  - 何时使用：`Male` 和 `Female` 子类仅覆写了 `genderCode` 返回值。
  - 如何操作：工厂函数封装创建 → 添加类型字段 → 修改类型判断为检查字段 → 删除子类。

- **提炼超类（Extract Superclass）**：两个类有相似行为但没有共享超类。
  - 何时使用：`Employee` 和 `Department` 都有 `name`、`monthlyCost`、`annualCost` 概念。
  - 如何操作：创建空超类 `Party` → 让两个类继承 → 用字段上移和函数上移搬移共同元素。

- **折叠继承体系（Collapse Hierarchy）**：超类和子类已无实质差异。
  - 何时使用：子类几乎不增加任何行为，或超类几乎被掏空。
  - 如何操作：将所有元素搬到要保留的类中 → 调整引用 → 删除空类。

- **以委托取代子类（Replace Subclass with Delegate）**：子类需要被移除——可能是因为继承只能用一次，需要为另一个变化维度腾出继承空间。
  - 何时使用：`Booking` 有 `PremiumBooking` 子类，但现在还需要 `WildBird` / `CaptiveBird` 子类来建模"野生/家养"维度。
  - 如何操作：创建委托类 → 将子类行为搬到委托类 → 在超类添加委托字段和分发逻辑 → 删除子类。

- **以委托取代超类（Replace Superclass with Delegate）**：超类的接口对子类不完全适用。
  - 何时使用：`Stack extends List` —— 列表的大部分操作（如 `insertAt`）对栈无意义。
  - 如何操作：在"子类"中创建指向"超类"实例的字段 → 为所有需要的函数创建转发函数 → 移除继承关系。

## 关键概念
- **陷阱函数（Trap Function）**：在超类中放置一个抛出 `SubclassResponsibilityError` 的函数，向未来子类开发者传达"你必须覆写这个方法"。
- **针对差异编程（Programming-by-Difference）**：子类只描述与超类的差异，避免重复并清晰表达变化。
- **类型码（Type Code）**：用枚举/字符串/数字字段区分对象行为类别——需在适当时机替换为子类多态。
- **委托（Delegate/Composition）**：将行为委派给另一个对象——比继承更灵活但需编写转发函数。
- **直接继承 vs 间接继承**：直接继承 = `Employee` 的子类 `Engineer`；间接继承 = `Employee` 包含 `EmployeeType` 对象，从后者创建子类。
- **子类未履行职责错误（SubclassResponsibilityError）**：源自 Smalltalk 的模式，超类声明抽象方法，子类必须实现。

## 思维模型
- **将继承视为"一张只能打一次的牌"**：行为可能因多个维度而异（品种 vs 野生/家养），但继承只能表达一个维度——需要用委托处理其他维度。
- **将多余子类视为"可折叠的字段"**：`Male` / `Female` 子类的差异只需一个 `genderCode` 字段即可表达——不值得为其维护整个子类。
- **将继承体系的上下调整视为"重力"**：共同元素下沉到超类，个性元素上浮到子类——Pull Up / Push Down 是持续平衡的过程。
- **将"类型码 + switch"视为"尚未出生的子类"**：每种 case 对应一个子类，多态是 switch 的最终形态。

## 反模式
- **继承不合适的超类以复用代码**：`Stack extends List` 是经典错误——栈不需要列表的大部分操作，"复用"不应绑架接口设计。
- **类型与实例名不符实（Type-Instance Homonym）**：`Scroll extends CatalogItem` 混淆了"实物卷轴"与"目录条目"——它们是不同概念。
- **在超类中检查子类类型**：`if (this instanceof NorwegianBlueParrotDelegate)` 是显式类型检查的坏味道。
- **为应对未来需求预设子类**：子类存在就有认知成本——如果构想的场景从未实现，子类就是废代码。

## 代码示例
<!-- 以委托取代子类：Bird 继承体系转为委托 -->
```cpp
// Before: 继承表达"品种"差异——占用了唯一的继承维度
class Bird { public: virtual auto airSpeedVelocity() const -> int { return 0; } };
class EuropeanSwallow : public Bird { public: auto airSpeedVelocity() const -> int override { return 35; } };
class AfricanSwallow : public Bird { public: auto airSpeedVelocity() const -> int override { return 40 - 2 * _numberOfCoconuts; } };

// After: 委托表达品种差异——腾出继承用于"野生/家养"
class Bird {
public:
    Bird(const Data& data) { _speciesDelegate = selectSpeciesDelegate(data); }
    auto airSpeedVelocity() const -> int { return _speciesDelegate.airSpeedVelocity(); }
private:
    // _speciesDelegate: initialized in constructor via selectSpeciesDelegate
};
class EuropeanSwallowDelegate { public: auto airSpeedVelocity() const -> int { return 35; } };
class AfricanSwallowDelegate { public: auto airSpeedVelocity() const -> int { return 40 - 2 * _numberOfCoconuts; } };
```
- **演示了什么**：继承只能表达一个变化维度——用委托替换品种继承后，Bird 类可重新被继承来表达"野生/家养"维度。

## 工作示例（DEPTH=study 必须有）
### 以委托取代子类：演出预订系统
问题：`Booking` 有 `PremiumBooking` 子类处理高级票，但未来需要动态切换预订级别，且可能需要用继承表达其他维度的差异。

重构过程（焦点函数 `hasTalkback`）：
```cpp
// Step 1: 创建委托类并建立关联
class PremiumBookingDelegate {
public:
    PremiumBookingDelegate(Booking* hostBooking, const Extras& extras)
        : _host(hostBooking), _extras(extras) {}
private:
    Booking* _host;
    Extras _extras;
};
// Step 2: 搬移子类行为到委托类
class PremiumBookingDelegate {
public:
    auto hasTalkback() const -> bool { return _host->_show.hasOwnProperty("talkback"); }
};
// Step 3: 超类添加分发逻辑
class Booking {
public:
    auto hasTalkback() const -> bool {
        return (_premiumDelegate)
            ? _premiumDelegate.hasTalkback()
            : _show.hasOwnProperty("talkback") && !isPeakDay;
    }
};
```
处理 `basePrice` 时遇到子类调用了 `super.basePrice`，采用提炼 `_privateBasePrice` 方法解决递归问题：
```cpp
// 子类原来的 basePrice 调用了 super.basePrice
// 方案：提炼"基本价格计算"为 _privateBasePrice
class Booking {
public:
    auto basePrice() const -> double {
        return (_premiumDelegate)
            ? _premiumDelegate.basePrice()
            : _privateBasePrice();
    }
    auto _privateBasePrice() const -> double {
        auto result = this->_show.price;
        if (this->isPeakDay) result += std::round(result * 0.15);
        return result;
    }
};
class PremiumBookingDelegate {
public:
    auto basePrice() const -> double {
        return std::round(this->_host->_privateBasePrice() + this->_extras.premiumFee);
    }
};
```

### 以委托取代超类：Scroll 与 CatalogItem
问题：`Scroll extends CatalogItem` 混淆了实物与目录条目——Scroll 不是 CatalogItem 的子类型。

重构过程：
1. 在 Scroll 中创建 `_catalogItem` 字段指向新 CatalogItem 实例
2. 为 `id`, `title`, `hasTag` 创建转发函数
3. 移除继承关系
4. 进一步改造：将多个指向同一条目的 Scroll 共享一个 CatalogItem 实例（值对象→引用对象），通过仓库对象查找。

### 提炼超类：Employee 和 Department 共享 Party
```cpp
// Before: 两个独立的类有相同的概念
class Employee { public: auto name() const -> std::string; auto annualCost() const -> double; };
class Department { public: auto name() const -> std::string; auto totalAnnualCost() const -> double; };

// 重构：创建 Party 超类
class Party {
public:
    Party(const std::string& name) : _name(name) {}
    auto name() const -> std::string { return _name; }
    virtual auto annualCost() const -> double { return monthlyCost() * 12; } // 上移
    virtual auto monthlyCost() const -> double = 0; // 子类必须实现
private:
    std::string _name;
};
class Employee : public Party { /* 仅保留 id, monthlyCost */ };
class Department : public Party { /* 仅保留 staff */ };
```

## 关键要点
1. 重复代码在子类中出现时，先统一再上移到超类——函数参数化常是上移的前置步骤
2. 超类中放置 `throw new SubclassResponsibilityError()` 的陷阱函数，向未来开发者传达"必须覆写"
3. 类型码字段 + switch 语句 = 多态重构的信号——先自封装类型码，再逐个创建子类
4. 子类差异仅为一个字段值时，用移除子类折叠回超类
5. 继承只能用一次——当行为需要按多个维度变化时，用委托处理多余的维度
6. "对象组合优于类继承"不是说永远不用继承，而是审慎组合使用两者
7. 以委托取代（子类/超类）的终态往往也是一个继承体系——只是范围更收拢，表达更精确
8. 重构继承关系时要小步前进：先封装工厂函数 → 搬移行为 → 调整分发逻辑 → 删除旧结构

## 关联到
- **Ch 6**：提炼函数（106）、改变函数声明（124）、变量改名（137）——统一函数名前和提炼共同逻辑的基础
- **Ch 7**：搬移函数（198）、搬移字段（207）——将行为搬到正确类中的基础操作
- **Ch 9**：将值对象改为引用对象（256）——以委托取代超类后，常需将共享数据改为引用对象
- **Ch 10**：以多态取代条件表达式（272）——以子类取代类型码后的自然下一步
- **Ch 11**：以工厂函数取代构造函数（334）——管理子类创建逻辑的标准手段
- **设计模式：State / Strategy**——以委托取代子类常落实为这两种模式
