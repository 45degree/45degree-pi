# 第1章: 重构，第一个示例

## 核心思想
重构不是一次性的大规模改写，而是通过一系列微小、可验证的步骤，在不改变软件可观察行为的前提下逐步改善代码结构。小步前进、频繁测试、频繁提交，是保持代码永远可工作状态的关键。

## 引入的框架
- **Extract Function（提炼函数，106）**：将一块代码抽取成独立函数，以其意图命名。
  - 何时使用：当一段代码可以被独立理解，且其用途可以通过命名说清楚时。
  - 如何操作：检查离开作用域的变量，将只读变量作为参数传入，将被修改的变量作为返回值；创建新函数并替换原调用点。
- **Inline Variable（内联变量，123）**：移除不必要的临时变量，直接用表达式替换。
  - 何时使用：当变量只是简单赋值、不再被修改、且表达式本身足够清晰时。
- **Replace Temp with Query（以查询取代临时变量，178）**：将赋值表达式的右边提炼为函数。
  - 何时使用：当局部变量增加了作用域复杂度、妨碍进一步提炼函数时。
- **Split Loop（拆分循环，227）**：将一个做了多件事的循环拆成多个独立循环。
  - 何时使用：循环内混合了不同关注点的累加或输出逻辑时。
- **Split Phase（拆分阶段，154）**：将处理过程拆分为计算阶段和渲染阶段，通过中转数据结构沟通。
  - 何时使用：同一份数据需要多种输出格式（如文本和HTML）时；或计算逻辑与格式化逻辑纠缠时。
- **Replace Conditional with Polymorphism（以多态取代条件表达式，272）**：为每种类型码创建子类，将条件分支逻辑下移到子类中。
  - 何时使用：多个函数基于同一类型码做分支选择，且未来类型会持续增加时。
- **Replace Constructor with Factory Function（以工厂函数取代构造函数，334）**：将构造函数调用替换为普通工厂函数。
  - 何时使用：需要根据条件返回不同子类实例，而构造函数无法返回子类时。
- **Replace Type Code with Subclasses（以子类取代类型码，362）**：为类型码创建子类继承体系。
  - 何时使用：类型码决定了对象的行为差异时。

## 关键概念
- **重构节奏**：每一步修改后进行编译、测试、提交——小步修改是防止混乱的关键。
- **中转数据结构（Intermediate Data Structure）**：在拆分阶段时，第一阶段产出纯数据结构传给第二阶段，两者不相互调用。
- **不可变数据（Immutable Data）**：重构时尽量保持数据不可变，浅拷贝（Object.assign）是一种实用手段。
- **营地法则**：保证离开时的代码库比来时更健康。
- **性能与重构**：大多数情况下忽略重构引入的微小性能损耗；先完成重构再做性能优化，因为结构良好的代码更容易调优。
- **好的命名**：变量和函数的命名是代码清晰的关键，返回值永远命名为 result 是一种编码风格建议。
- **可变状态是烫手山芋**：重构过程中优先移除可变局部变量，它们会使提炼函数变得更复杂。

## 思维模型
- 当面对一个长函数时，先将注意力集中于识别不同的关注点（如 switch 语句），而非理解全部逻辑。
- 将重构视为"把脑海中的理解转移到代码中"——不是为计算机写代码，而是为未来的阅读者（包括自己）写代码。
- 当需要添加新功能但代码结构不佳时，先重构使其易于添加该特性，再添加特性——先往北开上高速，再往东走。
- 当多个函数依赖于同一套类型进行分支选择时，多态继承方案的价值最高——类型越多，收益越大。

## 反模式
- **复制整个函数来适应新需求**：短期看似简单，但会导致重复代码；计费逻辑变化时需修改多处，容易遗漏。
- **一次性大步重构**：代码在重构过程中有一两天不可用，基本可以确定不是在重构，而是在做结构重调。
- **追求完美的代码而不考虑修改必要性**：如果一段代码能正常工作且不会再被修改，完全不必重构它。

## 代码示例
<!-- 重构前：一个混杂计算与格式化的长函数 -->
```cpp
#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <algorithm>
#include <cmath>

struct Performance {
    std::string playID;
    int audience;
};

struct Invoice {
    std::string customer;
    std::vector<Performance> performances;
};

struct Play {
    std::string name;
    std::string type;
};

// Helper: format amount in cents to USD string (e.g., 40000 -> "$400.00")
static std::string formatUSD(int amount) {
    std::ostringstream oss;
    oss << "$" << std::fixed << std::setprecision(2) << (amount / 100.0);
    return oss.str();
}

auto statement(const Invoice& invoice, const std::map<std::string, Play>& plays) -> std::string {
    int totalAmount = 0;
    int volumeCredits = 0;
    std::ostringstream result;
    result << "Statement for " << invoice.customer << "\n";
    for (const auto& perf : invoice.performances) {
        const auto& play = plays.at(perf.playID);
        int thisAmount = 0;
        if (play.type == "tragedy") {
            thisAmount = 40000;
            if (perf.audience > 30) {
                thisAmount += 1000 * (perf.audience - 30);
            }
        } else if (play.type == "comedy") {
            thisAmount = 30000;
            if (perf.audience > 20) {
                thisAmount += 10000 + 500 * (perf.audience - 20);
            }
            thisAmount += 300 * perf.audience;
        } else {
            throw std::runtime_error("unknown type: " + play.type);
        }
        volumeCredits += std::max(perf.audience - 30, 0);
        if (play.type == "comedy")
            volumeCredits += static_cast<int>(std::floor(perf.audience / 5.0));
        result << "  " << play.name << ": " << formatUSD(thisAmount)
               << " (" << perf.audience << " seats)\n";
        totalAmount += thisAmount;
    }
    result << "Amount owed is " << formatUSD(totalAmount) << "\n";
    result << "You earned " << volumeCredits << " credits\n";
    return result.str();
}
```

<!-- 重构后：statement 仅 7 行，计算与格式化完全分离 -->
```cpp
#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <algorithm>
#include <cmath>
#include <memory>

// ========== Data structures (headers) ==========

struct Performance {
    std::string playID;
    int audience;
};

struct Invoice {
    std::string customer;
    std::vector<Performance> performances;
};

struct Play {
    std::string name;
    std::string type;
};

// ========== createStatementData.h ==========

struct EnrichedPerformance {
    std::string playID;
    int audience;
    Play play;
    int amount;
    int volumeCredits;
};

struct StatementData {
    std::string customer;
    std::vector<EnrichedPerformance> performances;
    int totalAmount;
    int totalVolumeCredits;
};

// ========== PerformanceCalculator hierarchy ==========

class PerformanceCalculator {
public:
    PerformanceCalculator(const Performance& aPerformance, const Play& aPlay)
        : performance(aPerformance), play(aPlay) {}

    virtual ~PerformanceCalculator() = default;

    virtual int amount() const {
        throw std::runtime_error("subclass responsibility");
    }

    virtual int volumeCredits() const {
        return std::max(performance.audience - 30, 0);
    }

protected:
    const Performance& performance;
    const Play& play;
};

class TragedyCalculator : public PerformanceCalculator {
public:
    using PerformanceCalculator::PerformanceCalculator;

    int amount() const override {
        int result = 40000;
        if (performance.audience > 30)
            result += 1000 * (performance.audience - 30);
        return result;
    }
};

class ComedyCalculator : public PerformanceCalculator {
public:
    using PerformanceCalculator::PerformanceCalculator;

    int amount() const override {
        int result = 30000;
        if (performance.audience > 20)
            result += 10000 + 500 * (performance.audience - 20);
        result += 300 * performance.audience;
        return result;
    }

    int volumeCredits() const override {
        return PerformanceCalculator::volumeCredits()
            + static_cast<int>(std::floor(performance.audience / 5.0));
    }
};

// ========== Factory function ==========

static std::unique_ptr<PerformanceCalculator> createPerformanceCalculator(
    const Performance& aPerformance, const Play& aPlay) {
    if (aPlay.type == "tragedy")
        return std::make_unique<TragedyCalculator>(aPerformance, aPlay);
    if (aPlay.type == "comedy")
        return std::make_unique<ComedyCalculator>(aPerformance, aPlay);
    throw std::runtime_error("unknown type: " + aPlay.type);
}

// ========== createStatementData -- computation phase ==========

static EnrichedPerformance enrichPerformance(const Performance& aPerformance,
                                              const std::map<std::string, Play>& plays) {
    const auto& play = plays.at(aPerformance.playID);
    auto calc = createPerformanceCalculator(aPerformance, play);
    return EnrichedPerformance{
        aPerformance.playID,
        aPerformance.audience,
        play,
        calc->amount(),
        calc->volumeCredits()
    };
}

static int totalAmount(const StatementData& data) {
    int result = 0;
    for (const auto& perf : data.performances)
        result += perf.amount;
    return result;
}

static int totalVolumeCredits(const StatementData& data) {
    int result = 0;
    for (const auto& perf : data.performances)
        result += perf.volumeCredits;
    return result;
}

auto createStatementData(const Invoice& invoice,
                         const std::map<std::string, Play>& plays) -> StatementData {
    StatementData result;
    result.customer = invoice.customer;
    for (const auto& perf : invoice.performances)
        result.performances.push_back(enrichPerformance(perf, plays));
    result.totalAmount = totalAmount(result);
    result.totalVolumeCredits = totalVolumeCredits(result);
    return result;
}

// ========== Rendering phase (statement.js equivalent) ==========

// Helper: format amount in cents to USD string
static std::string formatUSD(int amount) {
    std::ostringstream oss;
    oss << "$" << std::fixed << std::setprecision(2) << (amount / 100.0);
    return oss.str();
}

// Forward declaration: renderHtml is defined in a separate rendering module
std::string renderHtml(const StatementData& data);

static std::string renderPlainText(const StatementData& data) {
    std::ostringstream result;
    result << "Statement for " << data.customer << "\n";
    for (const auto& perf : data.performances) {
        result << "  " << perf.play.name << ": " << formatUSD(perf.amount)
               << " (" << perf.audience << " seats)\n";
    }
    result << "Amount owed is " << formatUSD(data.totalAmount) << "\n";
    result << "You earned " << data.totalVolumeCredits << " credits\n";
    return result.str();
}

auto statement(const Invoice& invoice, const std::map<std::string, Play>& plays) -> std::string {
    return renderPlainText(createStatementData(invoice, plays));
}

auto htmlStatement(const Invoice& invoice, const std::map<std::string, Play>& plays) -> std::string {
    return renderHtml(createStatementData(invoice, plays));
}
```
- **演示了什么**：从一个 44 行的混杂函数，通过提炼函数 → 拆分阶段 → 引入多态计算器的三步重构，最终实现计算与格式化彻底分离、扩展新剧种只需添加子类的设计。

## 工作示例（DEPTH=study 必须有）
### 重构三阶段实录

**阶段一：分解为嵌套函数**（示例：处理 volumeCredits 累加变量）

面对一个在循环中累加的 volumeCredits 局部变量，采用了 4 个小步骤：

1. **Split Loop（227）**：将 volumeCredits 的累加从混合循环中分离到独立循环
2. **Slide Statements（223）**：将 `let volumeCredits = 0` 声明挪到新循环紧邻之前
3. **Extract Function（106）**：提炼出 `totalVolumeCredits()` 函数，内部循环累加
4. **Inline Variable（123）**：内联 `totalVolumeCredits()` 的调用，消除中间变量

每步之后编译、测试、提交。当测试失败且无法立即定位时，回滚到最后一次可工作提交，以更小步子重做。

**阶段二：拆分计算与格式化（Split Phase）**

创建空的 `statementData = {}` 作为中转对象 → 逐字段搬移 `customer`、`performances` → 为 `performances` 调用 `map(enrichPerformance)` 预先计算 `play`、`amount`、`volumeCredits` → 将 `totalAmount` 和 `totalVolumeCredits` 的计算搬入第一阶段 → 最终 `statement` 变为 `return renderPlainText(createStatementData(invoice, plays))`。

**阶段三：按类型重组计算**

创建 `PerformanceCalculator` 类 → 将 `amountFor` 和 `volumeCreditsFor` 搬移为类方法 → 用 `createPerformanceCalculator` 工厂函数根据 `play.type` 返回 `TragedyCalculator` 或 `ComedyCalculator` → 将超类的 `amount` 改为抛 `'subclass responsibility'` 异常 → 喜剧积分计算通过 `super.volumeCredits` 复用通用逻辑。

## 关键要点
1. 重构的第一步永远是：确保即将修改的代码拥有一组可靠的、可自检验的测试。
2. 小步修改，每次修改后立即运行测试——这是防止混乱的关键，也是重构过程的精髓。
3. 好代码的检验标准是：人们是否能轻而易举地修改它。
4. 如果重构引入了性能损耗，先完成重构，再做性能优化——结构良好的代码调优容易得多。
5. 好的命名并非唾手可得；先用当下能想到的最好的名字，想到更好的就毫不犹豫换掉。
6. 需求的变化使重构变得必要——如果代码永不需要修改，就不必重构。
7. "事不过三，三则重构"：第一次直接做，第二次产生反感但还是做，第三次就应该重构。

## 关联到
- **Ch 4**：第1章反复强调"重构前先有测试"，第4章专门论述如何构筑自测试体系。
- **Ch 2**："两顶帽子"（添加功能 vs 重构）的思维模型在第1章的操作中全程体现。
- **Ch 3**：代码坏味道中的 Long Function、Repeated Switches、Primitive Obsession 在本章示例中全部出现并被解决。
- **TDD（测试驱动开发）**：第1章的"编译、测试、提交"循环正是 TDD 红-绿-重构循环中"重构"环节的实践。
