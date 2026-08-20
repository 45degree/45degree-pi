# 术语表 — 重构：改善既有代码的设计（第2版）

**格式**：`**术语** (English Name) — 定义 (Ch N)`

## A-Z

**搬移函数** (Move Function) — 将函数从原有上下文搬移到它最常引用的模块中 (Ch 8)

**搬移语句到调用者** (Move Statements to Callers) — 将函数体内因调用点分化而不再通用的代码搬移到各调用方 (Ch 8)

**搬移语句到函数** (Move Statements into Function) — 将每次调用某函数时重复执行的代码合并到函数体内 (Ch 8)

**搬移字段** (Move Field) — 将字段从源对象搬移到与其关联更紧密的目标对象 (Ch 8)

**保持对象完整** (Preserve Whole Object) — 向函数传递完整对象而非拆散取值后的若干字段 (Ch 11)

**被拒绝的遗赠** (Refused Bequest) — 子类不需要或不想继承超类的函数和数据 (Ch 3)

**标记参数** (Flag Argument) — 调用者以字面量形式传入、用于控制函数内部流程的参数，应被移除 (Ch 10, 11)

**不可变性** (Immutability) — 对象创建后字段不再改变，是可消除可变性风险的防腐手段 (Ch 1, 9)

**仓库对象** (Repository) — 存储和检索共享实体的对象，确保同一ID始终返回同一实例 (Ch 9)

**测试覆盖率** (Test Coverage) — 仅识别未被测试覆盖的代码，不能衡量测试集的质量高低 (Ch 4)

**测试夹具** (Test Fixture) — 测试所需的数据和对象等前置条件，每个测试应独立构建 (Ch 4)

**测试驱动开发** (TDD / Test-Driven Development) — 先编写失败测试 → 编码通过 → 重构的短循环 (Ch 4)

**拆分变量** (Split Variable) — 将承担多个责任的变量拆分为多个具有描述性名称的独立变量 (Ch 9)

**拆分阶段** (Split Phase) — 将处理过程组织成通过中转数据结构沟通的独立阶段 (Ch 1, 6)

**拆分循环** (Split Loop) — 将一个做了多件事的循环拆分为多个只做一件事的循环 (Ch 1, 8)

**重构（名词）** (Refactoring) — 对软件内部结构的一种调整，旨在不改变可观察行为的前提下提高可理解性并降低修改成本 (Ch 2)

**重构名录** (Refactoring Catalog) — 最值得记录的重构手法集合，每条含名称、速写、动机、做法、范例五部分 (Ch 5)

**持续集成** (Continuous Integration / Trunk-Based Development) — 团队成员每天至少向主线集成一次，避免分支差异过大 (Ch 2)

**纯数据类** (Data Class) — 仅有字段和访问函数而无行为的类，应将操作数据的行为搬移进来 (Ch 3)

**发散式变化** (Divergent Change) — 某个模块因不同原因在不同方向上变化，应拆分为独立模块 (Ch 3)

**反向重构** (Inverse Refactoring) — 每个重构逻辑上都存在反向操作 (Ch 5)

**分解条件表达式** (Decompose Conditional) — 将复杂条件判断及每个分支分别提炼为语义清晰的函数 (Ch 10)

**封装变量** (Encapsulate Variable) — 以函数形式封装所有对数据的访问，将搬移数据的任务转化为搬移函数 (Ch 6)

**封装记录** (Encapsulate Record) — 将记录型结构包装成类，隐藏存储细节并提供有意义的访问接口 (Ch 7)

**封装集合** (Encapsulate Collection) — 阻止外部直接修改集合内容，通过add/remove方法控制修改并返回副本 (Ch 7)

**改变函数声明** (Change Function Declaration) — 对函数改名或修改参数列表，有简单做法与迁移式做法两套 (Ch 6)

**工厂函数** (Factory Function) — 替代构造函数的普通函数，可自由命名，可基于参数返回不同子类实例 (Ch 11)

**构造函数本体上移** (Pull Up Constructor Body) — 将多个子类构造函数中的公共赋值逻辑提升到超类 (Ch 12)

**过大的类** (Large Class) — 单个类做了太多事，应通过提炼类、提炼超类等分解 (Ch 3)

**过长参数列表** (Long Parameter List) — 参数过多令人迷惑，应通过引入参数对象、以查询取代参数等缩短 (Ch 3)

**过长函数** (Long Function) — 函数的关键不在于长度而在于语义距离，需要注释说明的代码应提炼为函数 (Ch 3)

**过长的消息链** (Message Chains) — 一连串取值函数调用暴露了委托链，应隐藏委托关系 (Ch 3)

**函数参数化** (Parameterize Function) — 将两个仅字面量值不同的函数合并为带参数的单一函数 (Ch 11)

**函数上移** (Pull Up Method) — 将多个子类中相同或可参数化为相同的函数提升到超类 (Ch 12)

**函数下移** (Push Down Method) — 将超类中仅与少数子类相关的函数下移到需要它的子类 (Ch 12)

**函数组合成变换** (Combine Functions into Transform) — 将一组计算派生数据的函数组合成变换式 (Ch 6)

**函数组合成类** (Combine Functions into Class) — 将一组共享共同数据上下文的函数组合成类 (Ch 6)

**合并条件表达式** (Consolidate Conditional Expression) — 将一连串指向相同结果的条件检查合并为单一条件再提炼为函数 (Ch 10)

**红条/绿条** (Red Bar / Green Bar) — 测试全通过显示绿色，有失败显示红色；看到红条永远不许重构 (Ch 4)

**基本类型偏执** (Primitive Obsession) — 用基本类型表示有业务含义的概念（钱、电话号码），应以对象取代 (Ch 3)

**将查询函数和修改函数分离** (Separate Query from Modifier) — 将有返回值且有副作用的函数拆分为纯查询和纯修改两个函数 (Ch 11)

**将引用对象改为值对象** (Change Reference to Value) — 将可被外部修改的内嵌对象改为不可变的值对象 (Ch 9)

**将值对象改为引用对象** (Change Value to Reference) — 将多份数据副本统一为共享的单一引用对象实例 (Ch 9)

**结构调整** (Restructuring) — 对代码库进行的各种形式的重新组织或清理，重构是其特定子集 (Ch 2)

**夸夸其谈通用性** (Speculative Generality) — 为"总有一天会需要"而添加的钩子和特殊情况，用不上只会挡路 (Ch 3)

**类型码** (Type Code) — 用枚举/字符串/数字字段区分对象行为类别，应在适当时机替换为子类多态 (Ch 12)

**两顶帽子** (Two Hats) — Kent Beck提出的比喻：开发时在"添加功能"和"重构"两个状态间切换 (Ch 1, 2)

**临时字段** (Temporary Field) — 类的某个字段仅为特定情况而设，应提炼到独立类中 (Ch 3)

**命令-查询分离** (Command-Query Separation / CQS) — 任何有返回值的函数都不应有可见副作用 (Ch 7, 11)

**命令对象** (Command Object) — 封装一次函数调用的对象，支持撤销、参数设置等高级特性 (Ch 11)

**内联变量** (Inline Variable) — 移除不比表达式本身更有表现力的临时变量 (Ch 1, 6)

**内联函数** (Inline Function) — 将函数调用替换为函数本体，消除不必要的间接层 (Ch 6)

**内联类** (Inline Class) — 将不再承担足够责任的类合并到最频繁使用它的类中 (Ch 7)

**内幕交易** (Insider Trading) — 模块之间私下交换过多数据，应搬移函数和字段减少耦合 (Ch 3)

**可变数据** (Mutable Data) — 可被修改的数据是bug的主要来源，应尽量分离有副作用的代码 (Ch 3)

**全局数据** (Global Data) — 从任意角落都可修改的数据，首要防御手段是封装变量 (Ch 3)

**三次法则** (Rule of Three) — 事不过三，三则重构：第一次直接做，第二次仍做，第三次必须重构 (Ch 2)

**设计耐久性假说** (Design Stamina Hypothesis) — 通过改善内部设计可增加软件耐久性，更长时间保持开发速度 (Ch 2)

**神秘命名** (Mysterious Name) — 函数、模块、变量或类的名字不能清晰表明其功能和用法 (Ch 3)

**数据泥团** (Data Clumps) — 相同的三四项数据总是绑在一起出现，应为它们创建独立对象 (Ch 3)

**提炼变量** (Extract Variable) — 为复杂表达式命名使其意图一目了然 (Ch 6)

**提炼超类** (Extract Superclass) — 从两个有相似行为但无共享超类的类中提取公共超类 (Ch 12)

**提炼函数** (Extract Function) — 将一段代码抽取为以意图命名的独立函数，实现意图与实现分离 (Ch 1, 6)

**提炼类** (Extract Class) — 将类中部分责任分离到新类，遵循单一职责 (Ch 7)

**替换算法** (Substitute Algorithm) — 用更清晰的方式取代整个函数体中已有的算法 (Ch 7)

**为既有代码添加测试的模式** — 先随便填期望值 → 用真实输出替换 → 引入错误验证测试会失败 → 恢复 (Ch 4)

**委托** (Delegate / Composition) — 将行为委派给另一个对象，比继承更灵活但需编写转发函数 (Ch 12)

**卫语句** (Guard Clause) — 在函数开头检查异常条件并立即返回的语句，表达"非核心逻辑所关心" (Ch 10)

**霰弹式修改** (Shotgun Surgery) — 每次变化需要在许多不同类内做许多小修改，应集中逻辑到同一模块 (Ch 3)

**循环语句** (Loops) — 传统循环可用管道操作（map/filter/reduce）取代 (Ch 3, 8)

**演进式架构** (Evolutionary Architecture) — 先基于当前需求构造软件，随理解加深通过重构调整架构 (Ch 2)

**移除标记参数** (Remove Flag Argument) — 将根据布尔/枚举型参数执行不同分支的函数拆分为多个具名函数 (Ch 11)

**移除设值函数** (Remove Setting Method) — 对象创建后某字段不应再被修改，通过构造函数注入取代设值函数 (Ch 11)

**移除死代码** (Remove Dead Code) — 删除不再被任何地方使用的代码，依靠版本控制找回 (Ch 8)

**移除中间人** (Remove Middle Man) — 当服务类变成纯粹转发层时，让客户端直接访问受托类 (Ch 7)

**移除子类** (Remove Subclass) — 当子类差异仅为一个简单字段值时，折叠子类回超类 (Ch 12)

**移动语句** (Slide Statements) — 调整语句在函数内部的顺序，使相关代码聚集为后续重构做准备 (Ch 8)

**已发布接口** (Published Interface) — 接口的使用者与声明者彼此独立，声明者无权修改使用者代码 (Ch 2)

**以参数取代查询** (Replace Query with Parameter) — 将函数内部引用的全局对象改为参数传入，获得引用透明性 (Ch 11)

**以查询取代参数** (Replace Parameter with Query) — 函数可以从自身获取的参数何必让调用者传入 (Ch 11)

**以查询取代临时变量** (Replace Temp with Query) — 将仅计算一次且不再修改的临时变量替换为函数调用 (Ch 1, 7)

**以查询取代派生变量** (Replace Derived Variable with Query) — 可由源数据计算得出的变量不应手动同步维护 (Ch 9)

**以对象取代基本类型** (Replace Primitive with Object) — 为简单数据值创建专门的类，承载业务行为 (Ch 7)

**以多态取代条件表达式** (Replace Conditional with Polymorphism) — 为每种类型码创建子类，将条件分支逻辑下移到子类中 (Ch 1, 10)

**以工厂函数取代构造函数** (Replace Constructor with Factory Function) — 用可自由命名、可返回子类的普通函数替代构造函数 (Ch 1, 11)

**以管道取代循环** (Replace Loop with Pipeline) — 用集合管道（map/filter/reduce）替代传统循环 (Ch 8)

**以函数调用取代内联代码** (Replace Inline Code with Function Call) — 用已有函数替换重复的内联代码 (Ch 8)

**以函数取代命令** (Replace Command with Function) — 命令对象过于复杂时，将其简化为普通函数 (Ch 11)

**以命令取代函数** (Replace Function with Command) — 复杂函数局部变量阻碍提炼时，将其变为命令对象 (Ch 11)

**以委托取代超类** (Replace Superclass with Delegate) — 当超类接口对子类不完全适用时，用委托取代继承 (Ch 12)

**以委托取代子类** (Replace Subclass with Delegate) — 需要为另一个变化维度腾出继承空间时，将子类改为委托 (Ch 12)

**以卫语句取代嵌套条件表达式** (Replace Nested Conditional with Guard Clauses) — 对异常/边界情况用卫语句提前退出，主流程平铺 (Ch 10)

**以子类取代类型码** (Replace Type Code with Subclasses) — 为类型码创建子类继承体系，用多态消去switch (Ch 1, 12)

**依恋情结** (Feature Envy) — 一个函数跟另一个模块的数据交流远胜于自己所在模块，应搬移 (Ch 3)

**异曲同工的类** (Alternative Classes with Different Interfaces) — 两个类功能相似但接口不一致，应统一接口 (Ch 3)

**引入参数对象** (Introduce Parameter Object) — 把常在一起出现的参数组合成对象 (Ch 6)

**引入断言** (Introduce Assertion) — 在关键假设处插入断言以交流意图，只用于"绝不应失败"的内部条件 (Ch 10)

**引入特例** (Introduce Special Case) — 为特殊值创建特例对象封装其默认行为，消除客户端条件判断 (Ch 10)

**隐藏委托关系** (Hide Delegate) — 在服务对象上放置委托函数，避免客户端通过链式调用暴露底层结构 (Ch 7)

**营地法则** (Camping Rule) — 离开时让营地比来时更干净，每次触碰代码都让它变好一点点 (Ch 1, 2)

**婴儿学步** (Baby Steps) — 每一步尽可能小，每步之后测试，情况越复杂步子越小 (Ch 5)

**预备性重构** (Preparatory Refactoring) — 在添加新功能前先重构，使新功能更容易添加 (Ch 2)

**针对差异编程** (Programming-by-Difference) — 子类只描述与超类的差异，避免重复并清晰表达变化 (Ch 12)

**值对象** (Value Object) — 不可变对象，基于字段值判断相等性，可安全复制和传递 (Ch 9)

**中转数据结构** (Intermediate Data Structure) — Split Phase中第一阶段产出的纯数据对象，传递给第二阶段使用 (Ch 1)

**中间人** (Middle Man) — 类的一半接口都委托给其他类，过度运用了封装应移除 (Ch 3, 7)

**重复的switch** (Repeated Switches) — 同样的switch逻辑在多处反复出现，应以多态取代 (Ch 1, 3)

**重复代码** (Duplicated Code) — 同一代码结构出现在多处，合而为一后程序会更好 (Ch 3)

**注释** (Comments) — 本身不是坏味道，但常被用作掩盖糟糕代码的"除臭剂" (Ch 3)

**字段改名** (Rename Field) — 在对数据加深理解后更新字段名以反映其真实含义 (Ch 9)

**字段上移** (Pull Up Field) — 将多个子类中声明的相同字段提升到超类 (Ch 12)

**字段下移** (Push Down Field) — 将超类中仅被少数子类使用的字段下移到需要的子类 (Ch 12)

**自测试代码** (Self-Testing Code) — 能自动运行并自动验证结果的测试代码，是重构的前提保障 (Ch 4)

**折叠继承体系** (Collapse Hierarchy) — 当超类和子类已无实质差异时，将所有元素合并到一个类中 (Ch 12)

**Branch By Abstraction** — 引入抽象层同时兼容新旧接口，逐步迁移调用方后再替换底层实现 (Ch 2)

**Null对象模式** (Null Object Pattern) — 用对象替代null，提供默认的无操作行为，消除null检查 (Ch 10)

**YAGNI** (You Aren't Going to Need It) — 不预先添加用不到的灵活性机制，除非未来重构会很困难 (Ch 2)
