# 第8章: 搬移特性

## 核心思想
模块化是优秀软件设计的核心所在——**好的模块化让你在修改程序时只需理解程序的一小部分**。为了设计出高度模块化的程序，得保证互相关联的软件要素集中到一块，并确保块与块之间的联系直观易懂。搬移函数和搬移字段是使代码与理解同步演进的核心手段。

## 引入的框架
- **搬移函数（Move Function）**：在类或其他模块之间搬移函数
  - 何时使用：函数频繁引用其他上下文中的元素，而对自身上下文中的元素关心甚少；需要频繁调用别处函数；帮助函数在更广范围有用
  - 如何操作：检查所有引用元素并考虑是否一起搬移→处理多态性→复制到目标上下文并调整→源函数改为委托调用→测试→决定是否内联源函数

- **搬移字段（Move Field）**：将字段从源对象搬移到目标对象
  - 何时使用：某个字段总是和另一条记录的数据一同作为参数传递；修改一条记录总是需要同时更新另一条记录
  - 如何操作：确保源字段已封装→在目标对象创建对应字段→确保源对象能引用目标对象→调整源对象的访问函数使用目标字段→测试→移除源字段

- **搬移语句到函数（Move Statements into Function）**：将函数调用前/后的重复代码合并到函数体内
  - 何时使用：调用某函数时，总有一些相同的代码也需要每次执行
  - 如何操作：提炼函数将重复代码与目标函数打包→调整其他调用点→内联原目标函数→重命名

- **搬移语句到调用者（Move Statements to Callers）**：将函数体内的代码搬移到调用方
  - 何时使用：函数行为在调用点间出现分化——以往共用的行为，如今某些调用点需要不同表现
  - 如何操作：提炼"保留代码"为新函数→对原函数应用内联函数→新函数改回原名

- **以函数调用取代内联代码（Replace Inline Code with Function Call）**：用已有函数替换重复的内联代码
  - 何时使用：内联代码做的事情是某已有函数的重复，且函数名在内联代码语境中协调
  - 如何操作：直接替换为函数调用→测试

- **移动语句（Slide Statements）**：调整语句在函数内部的顺序
  - 何时使用：相关代码散布各处妨碍理解；作为提炼函数等重构的准备工作
  - 如何操作：确定目标位置→检查搬移路径上的代码是否干扰执行次序→剪切粘贴→测试

- **拆分循环（Split Loop）**：将一个做多件事的循环拆成多个只做一件事的循环
  - 何时使用：一个循环做了两件以上不同的事——修改时需要同时理解所有事情
  - 如何操作：复制循环→移除每份循环中的重复计算→测试→考虑对每个循环应用提炼函数

- **以管道取代循环（Replace Loop with Pipeline）**：用集合管道（map/filter/reduce等）替代传统循环
  - 何时使用：迭代处理集合的逻辑用管道写法可读性更强
  - 如何操作：创建独立集合变量→逐步将循环行为替换为管道运算（slice、filter、map）→删除循环

- **移除死代码（Remove Dead Code）**：删除不再被使用的代码
  - 何时使用：代码不再被任何地方调用
  - 如何操作：确认无调用点→删除→测试

## 关键概念
- **上下文环境**：任何函数都需要上下文才能存活。面向对象中类是主要上下文，嵌套函数中外层函数是上下文。搬移函数的本质就是为函数寻找最恰当的上下文
- **搬移的惯性**：决定是否搬移函数越难做，通常说明搬不搬移的重要性越低。"好的做法是先把函数安置到某一个上下文里去，如果不太合适可以再搬"
- **底层函数优先搬移**：搬移一组函数时，从依赖最少的函数入手。如果子函数只被一个函数调用，可以先内联进去，搬移后再重新提炼
- **共享数据的断言保护**：搬移字段到共享对象（如利率字段从每个账户搬到账户类型）时，先添加断言确保数据一致性，让系统运行一段时间验证无误后再删除旧字段
- **语句安全移动的条件**：无副作用代码可随心所欲编排顺序；有副作用时，如果移动后执行次序改变导致相互干扰则不能搬移
- **集合管道（Collection Pipeline）**：用 map、filter 等运算描述集合的迭代过程，每种运算输入和输出都是集合。"只消从头到尾阅读一遍代码，就能弄清对象在管道中间的变换过程"

## 思维模型
- 将搬移函数视为**函数寻找最亲密的伙伴**——函数频繁引用别处上下文中的元素，说明它的"社交圈"不在当前模块，让它"去与那些更亲密的元素相会"
- 将消息调用链视为**委托关系暴露**——客户端通过 `aPerson.department.manager` 获取经理时，暴露出它知道 Department 的职责。隐藏委托就是切断这个知识链
- 将拆分循环视为**单一职责原则在循环上的应用**——每个循环只做一件事，好处是修改时只需理解要修改的行为，而且拆分后更容易用提炼函数进一步优化
- 将移动语句视为**代码的整理归类**——就像整理书桌，取用同一个数据结构的代码应该放在一起，避免夹杂在不相干的代码中间

## 反模式
- **身兼多职的循环**：一次循环做两三件事只为了少循环一次，但修改时必须同时理解所有事情。先重构使结构清晰，再优化性能——"实际情况是，即使处理的数据更多一些，循环本身也很少成为性能瓶颈"
- **保留不再使用的委托函数**：搬移函数后留下只起委托作用的旧函数（中间人），应择机内联
- **注释掉死代码而不是删除**：在版本控制系统普及的时代，无用代码应直接删除。如果日后需要可从版本控制找回

## 代码示例
```cpp
// Before: 拆分循环 —— 一个循环做了两件事（年龄+薪水）
auto youngest = !people.empty() ? people[0].age : std::numeric_limits<int>::max();
auto totalSalary = 0;
for (const auto& p : people) {
    if (p.age < youngest) youngest = p.age;
    totalSalary += p.salary;
}

// After: 拆分→提炼函数→管道重构
auto totalSalary(const std::vector<Person>& people) -> int {
    auto total = 0;
    for (const auto& p : people) total += p.salary;
    return total;
}
auto youngestAge(const std::vector<Person>& people) -> int {
    auto youngest = std::numeric_limits<int>::max();
    for (const auto& p : people) youngest = std::min(youngest, p.age);
    return youngest;
}
```
- **演示了什么**：拆分循环的价值不在于拆分本身，而在于它为进一步优化打开了大门——"拆分循环后，我还会紧接着对拆分得到的循环应用提炼函数（106）"

## 工作示例（DEPTH=study 必须有）
### 搬移函数：将内嵌函数提升到顶层
**场景**：`trackSummary(points)` 函数内嵌了 `calculateDistance()` 用于计算 GPS 轨迹总距离。我们希望 `calculateDistance` 能在其他地方独立使用。

**Before（完整结构）**：
```cpp
auto trackSummary(const std::vector<Point>& points) -> Summary {
    const auto totalTime = calculateTime();
    auto calculateDistance = [&]() -> double {
        auto result = 0.0;
        for (size_t i = 1; i < points.size(); i++) {
            result += distance(points[i-1], points[i]);
        }
        return result;
    };
    auto distance = [](const Point& p1, const Point& p2) -> double { /* ... */ };
    auto radians = [](double degrees) -> double { /* ... */ };
    auto calculateTime = []() -> double { /* ... */ };
    const auto totalDistance = calculateDistance();
    const auto pace = totalTime / 60 / totalDistance;
    return { totalTime, totalDistance, pace };
}
```

**步骤1**：复制函数到顶层，临时命名为 `top_calculateDistance`。发现缺失 `points` 和 `distance`。

**步骤2**：`points` 作为参数传入。`distance` 函数内部只调用了 `radians`，后者无上下文依赖——因此将 `distance` 和 `radians` 一并搬移。
```cpp
auto top_calculateDistance(const std::vector<Point>& points) -> double {
    auto distance = [](const Point& p1, const Point& p2) -> double { /* ... */ };
    auto radians = [](double degrees) -> double { /* ... */ };
    auto result = 0.0;
    for (size_t i = 1; i < points.size(); i++) {
        result += distance(points[i-1], points[i]);
    }
    return result;
}
```

**步骤3**：原函数改为委托调用：`function calculateDistance() { return top_calculateDistance(points); }`

**步骤4**：测试通过后，直接内联委托函数，将 `top_calculateDistance` 改名为 `totalDistance`——同时内联变量 `totalDistance`（因为它与函数名冲突）。

**最终结果**：
```cpp
auto trackSummary(const std::vector<Point>& points) -> Summary {
    const auto totalTime = calculateTime();
    const auto pace = totalTime / 60 / totalDistance(points);
    return { totalTime, totalDistance(points), pace };
}
auto totalDistance(const std::vector<Point>& points) -> double { /* ... */ }
auto distance(const Point& p1, const Point& p2) -> double { /* ... */ }
auto radians(double degrees) -> double { /* ... */ }
auto calculateTime() -> double { /* ... */ }
```

- **演示了什么**：搬移函数时需要仔细追踪被调用函数对上下文的依赖——`distance` 只依赖 `radians` 而不依赖 `points`，两者应一同搬移。静态检查和测试在每一步验证搬移的安全性

### 以管道取代循环：CSV 数据清洗与筛选
**场景**：从 CSV 文件筛选印度办公室数据。

**Before**：
```cpp
auto acquireData(const std::string& input) -> std::vector<Record> {
    const auto lines = split(input, "\n");
    auto firstLine = true;
    std::vector<Record> result;
    for (const auto& line : lines) {
        if (firstLine) { firstLine = false; continue; }
        if (trim(line) == "") continue;
        const auto record = split(line, ",");
        if (trim(record[1]) == "India") {
            result.push_back({trim(record[0]), trim(record[2])});
        }
    }
    return result;
}
```

**逐步管道化**：
1. `const loopItems = lines.slice(1)` —— 取代 firstLine 跳过逻辑（同时删除控制变量）
2. `.filter(line => line.trim() !== "")` —— 取代空行过滤
3. `.map(line => line.split(","))` —— 取代 split 操作
4. `.filter(record => record[1].trim() === "India")` —— 印度办公室筛选
5. `.map(record => ({city: record[0].trim(), phone: record[2].trim()}))` —— 结果映射

**After**：
```cpp
auto acquireData(const std::string& input) -> std::vector<Record> {
    const auto lines = split(input, "\n");
    std::vector<Record> result;
    // .slice(1) — skip header line
    for (size_t i = 1; i < lines.size(); i++) {
        const auto& line = lines[i];
        if (trim(line) == "") continue;              // .filter(line => line.trim() != "")
        const auto fields = split(line, ",");         // .map(line => line.split(","))
        if (trim(fields[1]) != "India") continue;     // .filter(fields => fields[1].trim() === "India")
        result.push_back({trim(fields[0]), trim(fields[2])}); // .map(fields => ({city, phone}))
    }
    return result;
}
```

- **演示了什么**：管道重构的关键技巧——始终小步前进：一次只替换循环中的一个行为为管道运算，每次修改后运行测试。每一步都保持代码可工作状态

## 关键要点
1. 搬移函数时先搬移依赖最少的函数——如果子函数只被一个函数调用，可以先内联，搬移后重新提炼
2. 搬移字段到共享对象时，先添加断言验证数据一致性，让系统运行一段时间确保无误后再删除旧字段
3. 拆分循环的真正价值不在于拆分本身，而在于为提炼函数、以管道取代循环等后续重构打开大门
4. 管道重构始终小步前进——每次只用一种管道运算替代循环中的一个行为，每次都运行测试
5. 删除死代码，不要注释掉——版本控制系统是最好的安全网。无用代码增加理解软件的思维负担
6. 移动语句是许多重构的"准备工作"——相关代码聚集后才能顺利应用提炼函数

## 关联到
- **Ch 6（第一组重构）**：提炼函数（106）、内联函数（115）、改变函数声明（124）在本章被频繁组合使用——搬移语句到函数时先提炼后内联再改名
- **Ch 7（封装）**：提炼类（182）和内联类（186）内部大量调用搬移函数（198）和搬移字段（207）。封装变量（132）是搬移字段的前提
- **Ch 9（重新组织数据）**：拆分循环（227）之后常接着用替换算法（195）改进单个循环
- **集合管道（Collection Pipeline）**：以管道取代循环（231）的核心技术，与函数式编程中的 map/filter/reduce 思想一脉相承
- **命令与查询分离（Command-Query Separation）**：有返回值的函数无副作用——这是安全移动语句的重要判断依据
