# 第6章: 第一组重构

## 核心思想
提炼的关键在于**命名**——将代码的"意图"与"实现"分离。提炼函数、提炼变量、改变函数声明构成了低层级重构的精髓，随后通过函数组合成类或函数组合成变换将小函数组织成更高层级的模块。

## 引入的框架
- **提炼函数（Extract Function）**：将一段代码移入独立函数，以"做什么"来命名（而非"怎样做"）
  - 何时使用：当你需要花时间浏览一段代码才能弄清它到底在干什么时
  - 如何操作：创建新函数→复制代码→处理作用域变量（参数传入、返回值传出）→替换调用点→测试

- **内联函数（Inline Function）**：将函数调用替换为函数本体
  - 何时使用：函数内部代码和函数名称同样清晰易读；或手上有一群组织不甚合理的函数需要重新提炼
  - 如何操作：检查无多态性→找到所有调用点→逐一替换为函数本体→删除函数定义

- **提炼变量（Extract Variable）**：为复杂表达式命名
  - 何时使用：表达式复杂难读，且名字只在当前函数内有意义（若在更宽上下文有意义，优先用提炼函数）
  - 如何操作：确认无副作用→声明不可变变量→赋值表达式结果→用变量取代原表达式→测试

- **内联变量（Inline Variable）**：消除不比表达式本身更有表现力的变量
  - 何时使用：变量名不比表达式本身更具表现力，或变量妨碍了附近代码的重构
  - 如何操作：检查无副作用→确保只赋值一次→逐一替换为右侧表达式→删除变量声明

- **改变函数声明（Change Function Declaration）**：改名或修改参数列表。有两套做法：简单做法和迁移式做法
  - 何时使用：函数名字不能一眼看出用途；参数限制了函数的使用范围或引入了不必要的耦合
  - 简单做法：一次性修改函数声明和所有调用者（适合调用者少或有自动化工具支撑时）
  - 迁移式做法：提炼新函数→逐步迁移调用者→内联旧函数（适合调用者多、多态函数、已发布API等情况）

- **封装变量（Encapsulate Variable）**：以函数形式封装所有对数据的访问
  - 何时使用：可变数据的作用域超出单个函数时——作用域越大封装越重要
  - 如何操作：创建封装函数→逐一修改引用点→限制变量可见性→测试

- **引入参数对象（Introduce Parameter Object）**：把常在一起出现的参数组合成对象
  - 何时使用：多个参数总是成组出现，或需要减少参数列表长度

- **函数组合成类（Combine Functions into Class）**：把函数和它们操作的数据一起组合成类
  - 何时使用：一组函数共享共同的数据上下文

- **函数组合成变换（Combine Functions into Transform）**：将函数组合成变换式（transform），特别适用于处理只读数据
  - 何时使用：需要对同一份数据进行多次不同的计算或派生

- **拆分阶段（Split Phase）**：将处理过程组织成界限分明的阶段
  - 何时使用：模块中的处理逻辑有明显的阶段性分界

## 关键概念
- **意图与实现分离**：提炼函数后，调用者只需看到函数名（意图），不必关心函数体（实现）。这是重构最根本的原则
- **嵌套函数作为过渡**：先提炼为嵌套函数减少作用域问题，后续再用搬移函数（198）搬出
- **以"做什么"命名**：函数名应表达其意图，而非实现方式。起名字的好办法：先写注释描述用途，再把注释变成函数名
- **函数名的长度不重要**：Smalltalk 的 `highlight` 方法名字比实现还长（实现只调用了 `reverse`），但这无关紧要
- **局部变量被赋值时的处理**：最好的选择是返回修改后的值；如果需要返回多个值，考虑用查询取代临时变量（178）和拆分变量（240）
- **迁移式做法（Migration Mechanics）**：提炼新函数→旧函数转发→逐步迁移调用者→内联旧函数→新函数改回原名
- **不可变性是代码防腐剂**：不可变数据不需要封装验证逻辑，可放心复制

## 思维模型
- 将提炼函数视为**给代码加标题**——每提炼一个函数，就像在用函数名给一段代码写下标题，注释往往提示好名字
- 将函数声明视为**软件系统的关节**——好的关节使添加新部件容易，糟糕的关节招致麻烦
- 将封装变量视为**把"重新组织数据"转化为"重新组织函数"**——数据难搬移是因为没有转发机制，函数则可以通过转发间接修改
- 将提炼变量视为**命名表达式**——如果名字只在当前上下文有意义，用变量；如果更宽范围有意义，用函数

## 反模式
- **过早担心性能**：担心短函数造成大量函数调用影响性能。实际上短函数能让编译器优化更良好。应遵循"先重构后优化"的指导方针
- **不敢改函数名**："就算名字有点迷惑人，还是放着别管吧"——这是邪恶混乱魔王的诱惑。一旦发现更好的名字就尽快改
- **一次性修改所有调用者又不测试**：简单做法的缺点是必须同时改所有调用者。如果调用者很多或函数名不唯一，应改用迁移式做法

## 代码示例
```cpp
// Before: 提炼函数（Extract Function）—— 无局部变量
void print_owing(const Invoice& invoice) {
    print_banner();
    auto outstanding = calculate_outstanding();
    // print details
    std::cout << std::format("name: {}", invoice.customer) << std::endl;
    std::cout << std::format("amount: {}", outstanding) << std::endl;
}

// After: 意图一目了然
void print_owing(const Invoice& invoice) {
    print_banner();
    auto outstanding = calculate_outstanding();

    auto print_details = [&](double outstanding) {
        std::cout << std::format("name: {}", invoice.customer) << std::endl;
        std::cout << std::format("amount: {}", outstanding) << std::endl;
    };

    print_details(outstanding);
}
```
- **演示了什么**：提炼函数的核心价值——将"打印详情"这一意图与具体实现（console.log）分离

## 工作示例（DEPTH=study 必须有）
### 提炼函数：处理局部变量被赋值的情况
**场景**：`printOwing` 函数中 `outstanding` 变量先声明为 0，然后在 for 循环中被累加赋值，最终在函数后面部分被使用。

**Before（关键部分）**：
```cpp
void print_owing(Invoice& invoice) {
    auto outstanding = 0.0;
    print_banner();
    for (const auto& o : invoice.orders) { outstanding += o.amount; }
    record_due_date(invoice);
    print_details(invoice, outstanding);
}
```

**步骤1**：将变量声明移到使用处之前
```cpp
print_banner();
auto outstanding = 0.0;
for (const auto& o : invoice.orders) { outstanding += o.amount; }
```

**步骤2**：复制代码到目标函数，声明在函数内，返回修改后的值
```cpp
auto calculate_outstanding(const Invoice& invoice) -> double {
    auto outstanding = 0.0;
    for (const auto& o : invoice.orders) { outstanding += o.amount; }
    return outstanding;
}
```

**步骤3**：源函数中用新函数的返回值给原变量赋值
```cpp
auto outstanding = calculate_outstanding(invoice);
```

**步骤4**：收工清理——用 `const` 声明，返回值改名为 `result`（编码风格）
```cpp
const auto outstanding = calculate_outstanding(invoice);
// calculate_outstanding 内部: auto result = 0.0; ... return result;
```

**决策点**：如果需要返回多个值怎么办？最好的选择是挑选另一块代码来提炼——"我比较喜欢让每个函数都只返回一个值"。如果确实需要返回多个值，可以构造并返回一个记录对象。但通常更好的办法是用以查询取代临时变量（178）和拆分变量（240）重新处理局部变量。

### 改变函数声明：迁移式做法——把参数改为属性
**场景**：函数 `inNewEngland(aCustomer)` 接受顾客对象，但实际只用到 `aCustomer.address.state`。

**过程**：
1. 提炼变量：`const stateCode = aCustomer.address.state;`
2. 提炼函数创建新版本：`xxNEWinNewEngland(stateCode)`
3. 内联变量回旧函数：`return xxNEWinNewEngland(aCustomer.address.state);`
4. 内联旧函数到各调用处：`c => xxNEWinNewEngland(c.address.state)`
5. 将新函数改回原名：最终调用变为 `c => inNewEngland(c.address.state)`，函数签名变为 `function inNewEngland(stateCode)`
- **演示了什么**：迁移式做法如何在不破坏现有调用者的前提下，将"依赖顾客对象"的函数逐步改为"仅依赖州代码"——去除了不必要的模块耦合

## 关键要点
1. 提炼的关键在于命名——函数名应传达意图而非实现，"先写注释再变成函数名"是起好名字的实用技巧
2. 局部变量被赋值时，最好的处理是让新函数返回修改后的值；如果变量太多，先用拆分变量（240）或用查询取代临时变量（178）简化
3. 对于可变数据且作用域超出单个函数，始终封装——其价值远超"隐藏字段"这个层面，提供了"数据变化的观测点"
4. 改变函数声明有两套做法：简单做法（一次性改完）和迁移式做法（提炼→转发→逐步迁移→内联）。遇到多态函数、大量调用者、已发布API时用迁移式
5. 封装变量将"搬移数据"转化为"搬移函数"——因为函数可以设置转发（旧函数调用新函数），而数据没有这样的转发机制

## 关联到
- **Ch 7（封装）**：本章的封装变量（132）为第7章的所有封装手法奠定了基础——封装记录（162）、封装集合（170）、以对象取代基本类型（174）都依赖于此
- **Ch 8（搬移特性）**：提炼出的嵌套函数最终需要用搬移函数（198）搬移出去；搬移字段也用到了封装变量
- **Ch 9（重新组织数据）**：提炼函数时遇到的局部变量问题，需要用拆分变量（240）和以查询取代派生变量（248）来解决
