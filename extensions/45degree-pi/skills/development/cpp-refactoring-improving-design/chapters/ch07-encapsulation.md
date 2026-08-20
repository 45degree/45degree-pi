# 第7章: 封装

## 核心思想
分解模块时最重要的标准，就是**识别出那些模块应该对外界隐藏的小秘密**。数据结构和类是实现封装的最大实体，但封装的思想也延伸至隐藏委托关系、替换算法等层面——封装带来"变化隔离"这一根本好处。

## 引入的框架
- **封装记录（Encapsulate Record）**：将记录型结构包装成类，隐藏存储细节并提供有意义的访问接口
  - 何时使用：可变数据用记录结构表示时；记录结构在程序中广泛传递时；需要区分"存储的数据"和"计算得到的数据"时
  - 如何操作：先用封装变量（132）→创建类包装记录→逐步替换读写点为类方法→移除原始记录访问函数→展开字段到对象

- **封装集合（Encapsulate Collection）**：阻止外部直接修改集合内容
  - 何时使用：类持有集合字段且取值函数直接返回集合本身，导致客户端可以绕过类修改集合内容
  - 如何操作：添加 add/remove 方法→替换直接修改点为方法调用→取值函数返回副本或只读代理→移除设值函数或使其复制赋值

- **以对象取代基本类型（Replace Primitive with Object）**：为简单数据值创建专门的类
  - 何时使用：对某个数据的操作不再仅限于打印或简单比较——需要格式化、验证、比较等行为时
  - 如何操作：封装变量→创建简单值类（含构造函数和toString）→修改访问函数使用新类→逐步为类添加业务行为

- **以查询取代临时变量（Replace Temp with Query）**：将临时变量替换为函数调用
  - 何时使用：分解冗长函数时，临时变量只被计算一次且之后不再修改
  - 如何操作：确保变量只读且无副作用→提炼赋值表达式为函数→内联变量→测试

- **提炼类（Extract Class）**：将类中部分责任分离到新类
  - 何时使用：类变得过分复杂、某些数据与函数总是一起出现、子类化只影响类的部分特性
  - 如何操作：决定如何分解责任→创建新类→建立旧类到新类的引用→用搬移字段（207）和搬移函数（198）逐一搬移

- **内联类（Inline Class）**：将不再承担足够责任的类合并到最频繁使用它的类中
  - 何时使用：类因之前重构移走了责任而萎缩；或想重新安排两个类的职责时先用内联合并再用提炼分离
  - 如何操作：在目标类创建对应的委托函数→修改客户端调用目标类→搬移源类的函数与数据→删除源类

- **隐藏委托关系（Hide Delegate）**：在服务对象上放置委托函数，隐藏客户端通过服务对象再访问受托类的依赖链
  - 何时使用：客户端通过服务对象的字段取得另一个对象再调用其函数——即 `aPerson.department.manager` 这样的链式调用
  - 如何操作：在服务对象端建立委托函数→调整客户端只调用服务对象→如果不再需要，移除对受托类的访问函数

- **移除中间人（Remove Middle Man）**：当服务类变成了纯粹的转发层（中间人味道），让客户端直接访问受托类
  - 何时使用：受托类不断增加特性，导致服务端需要不断添加简单委托函数
  - 如何操作：暴露受托对象→让客户端转为连续访问函数调用→删除委托方法

- **替换算法（Substitute Algorithm）**：用更清晰的方式取代整个算法
  - 何时使用：发现更简单的解决方案；程序库提供了与自定义代码重复的功能
  - 如何操作：确保算法已抽取到独立函数→准备测试固定行为→准备替代算法→比对新旧结果

## 关键概念
- **记录结构与对象的区别**：记录直观存储关联数据，但强制区分"存储数据"与"计算数据"。对象可隐藏结构细节，只暴露有意义的方法
- **可变数据 vs 不可变数据**：可变数据偏好用对象封装（可控制修改点），不可变数据可简单用记录（复制字段重命名即可）
- **集合封装的三层境界**：（1）只封装字段引用（不够）→（2）提供 add/remove 方法→（3）取值函数返回副本
- **自封装字段（Self-Encapsulate Field）**：即便在类内部也通过访问函数使用字段。作者认为通常过度——如果类大到需要自封装，应该先拆分类
- **小封装值的演化路径**：起初只是一个简单包装 → 日后添加业务逻辑有地可去 → "许多经验丰富的开发者认为这是工具箱里最实用的重构手法之一"
- **命令与查询分离（Command-Query Separation）**：有返回值的函数不存在副作用，这让判断代码能否安全移动变得简单

## 思维模型
- 将类视为**隐藏信息的容器**——类本身就是为隐藏内部细节而生的，封装记录、封装集合都是朝这个方向进一步推进
- 将封装集合视为**所有权转移**——集合内容不再属于客户端，而是属于持有它的类。add/remove 方法是唯一的修改通道
- 将以对象取代基本类型视为**给数据加壳**——数据值就像裸的种子，给它包一层类的外壳后，业务逻辑就有了附着点，能慢慢成长为有价值的工具
- 将隐藏委托关系视为**降低模块间的"知道程度"**——封装意味着每个模块都应尽可能少了解系统的其他部分。一旦委托关系变化，只影响服务对象而不会波及所有客户端

## 反模式
- **只封装字段引用而不封装字段内容**：对于集合字段，`get courses() {return this._courses;}` 允许客户端直接 push 修改内容，类全然不知
- **过度隐藏导致中间人臭味**：每当事关受托类的新特性就要在服务端添加转发函数，服务类完全变成转发层——此时应移除中间人
- **未先分解算法就替换**：替换巨大复杂算法非常困难，"只有先将它分解为较简单的小型函数，我才能很有把握地进行算法替换"

## 代码示例
```cpp
// Before: 以对象取代基本类型 —— Priority 是字符串
auto high_priority_count = std::count_if(orders.begin(), orders.end(),
    [](const auto& o) {
        return o.priority == "high" || o.priority == "rush";
    });

// After: Priority 成为值对象，承载比较行为
auto high_priority_count = std::count_if(orders.begin(), orders.end(),
    [](const auto& o) {
        return o.priority.higher_than(Priority("normal"));
    });
```
- **演示了什么**：一个简单的字符串字段，经过封装（优先级类可以校验合法值、提供比较方法、实现equals），变成了承载领域逻辑的值对象

## 工作示例（DEPTH=study 必须有）
### 封装记录：从裸 JavaScript 对象到类
**场景**：程序全文使用常量 `const organization = {name: "Acme Gooseberries", country: "GB"};`

**步骤1**：先用封装变量（132），但取一个又丑又长、容易搜索的名字（因为不打算让它活太久）
```cpp
auto get_raw_data_of_organization() -> Organization& { return organization; }
// 客户端变为: result += std::format("{}", get_raw_data_of_organization().name);
```

**步骤2**：创建类包装记录，暂时保留原始数据访问
```cpp
struct RawData { std::string name; std::string country; };

class Organization {
public:
    explicit Organization(RawData data) : _data(std::move(data)) {}
    RawData _data;  // 暂时公开以便过渡
};

auto organization = Organization(RawData{"Acme Gooseberries", "GB"});
auto get_raw_data_of_organization() -> RawData& { return organization._data; }
auto get_organization() -> Organization& { return organization; }
```

**步骤3**：逐步替换读写点——更新点用设值函数，读取点用取值函数
```cpp
// class Organization:
void set_name(const std::string& a_string) { _data.name = a_string; }
auto name() const -> const std::string& { return _data.name; }
// 客户端变为: get_organization().set_name(new_name); 和 get_organization().name()
```

**步骤4**：删除丑陋的 `getRawDataOfOrganization`，展开 `_data` 字段到对象
```cpp
class Organization {
public:
    explicit Organization(const RawData& data)
        : _name(data.name), _country(data.country) {}

    auto name() const -> const std::string& { return _name; }
    void set_name(const std::string& a_string) { _name = a_string; }
    // ...country 同理
private:
    std::string _name;
    std::string _country;
};
```

**步骤5（嵌套记录的特殊处理）**：对深层嵌套数据（如 JSON 数据），处理读取点有三种策略：
  - **(A)** 为每个字段创建访问函数——提供清晰的 API 列表，但代码量剧增
  - **(B)** 返回深复制副本——简单，但大结构性能代价高，且客户端期望修改反映到原数据的困惑
  - **(C)** 返回只读代理或递归冻结——阻止意外修改，JavaScript 实现较麻烦
  - **作者建议**：合理混用。对更新操作必须凸显并集中。对读取操作，如果字段不多则创建访问函数；如果结构大且更新点少，返回副本也可接受

### 提炼类：将电话号码相关行为从 Person 类分离
**过程**：Person 类混杂了 `officeAreaCode`、`officeNumber` 等电话相关字段，将它们搬移到新类 `TelephoneNumber` → 字段搬移完成后，`"办公室电话"不该有"办公室"概念`，因此重命名为 `areaCode` 和 `number` → `get telephoneNumber()` 改为 `toString()` → 考虑将新类暴露给更多客户端，将其改造为值对象

- **演示了什么**：提炼类不仅仅是搬移代码，更关键的是**责任分离后的命名调整**——`officeAreaCode` 从属于 Person 时有意义，移到 TelephoneNumber 后应为 `areaCode`

## 关键要点
1. 封装可变数据是重构的基石——将"搬移数据"的困难任务转化为"搬移函数"的相对简单任务
2. 对象优于记录（对可变数据而言）：对象隐藏存储细节、控制修改点、支持渐进式字段改名
3. 封装集合时必须**同时封装字段内容和字段引用**：取值函数返回副本，修改通过 add/remove 方法
4. 提炼类之前先问自己："如果搬移某些字段和函数，其他字段和函数是否因此变得无意义？"
5. 隐藏委托关系降低了模块间的耦合度，但过度隐藏会导致中间人臭味——两者之间没有绝对标准，随代码演化不断调整
6. 以对象取代基本类型的价值常被新手低估："这些小小的封装值开始可能价值甚微，但只要悉心照料，它们很快便能成长为有用的工具"

## 关联到
- **Ch 6（第一组重构）**：封装变量（132）是本章所有封装手法的基础第一步。改变函数声明（124）在以对象取代基本类型中用于重命名访问函数
- **Ch 8（搬移特性）**：提炼类（182）和内联类（186）内部大量使用了搬移函数（198）和搬移字段（207）
- **Ch 9（重新组织数据）**：将引用对象改为值对象（252）和将值对象改为引用对象（256）常在本章的封装过程末尾被调用
- **迪米特法则（Law of Demeter）**：隐藏委托关系（189）和移除中间人（192）是迪米特法则在重构实践中的具体表达。作者评价：如果这法则叫"偶尔有用的迪米特建议"，如今能少很多烦恼
