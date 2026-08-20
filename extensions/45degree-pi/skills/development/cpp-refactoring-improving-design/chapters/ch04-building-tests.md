# 第4章: 构筑测试体系

## 核心思想
自测试代码是重构的前提保障——一套稳固的测试集合能极大提高编程速度，即便不进行重构也是如此。测试的价值不在于"证明程序没有 bug"，而在于让你有信心在修改后不引入额外 bug。

## 引入的框架
- **测试夹具（Test Fixture）**：测试所需的数据和对象等前置条件。
  - 何时使用：每个测试开始前。
  - 如何操作：使用 `beforeEach` 在每个测试前重新构建独立的夹具，避免测试间通过共享状态产生交互。
- **配置-检查-验证（Setup-Exercise-Verify / Arrange-Act-Assert / Given-When-Then）**：测试的标准三阶段模式。
  - 何时使用：编写所有测试时。
  - 如何操作：先配置好测试夹具，然后执行被测试的操作，最后验证结果是否与期望一致。
- **边界条件探测（Boundary Probing）**：将测试推到正常路径之外的边界处。
  - 何时使用：完成正常路径测试后。
  - 如何操作：测试空集合、0 值、负值、空字符串等异常输入；扮演"程序公敌"思考如何破坏代码。
- **为既有代码添加测试的模式**：先随便填一个期望值 → 用程序真实输出替换 → 引入一个错误验证测试会失败 → 恢复错误。
  - 何时使用：为已有正常运行的代码补充测试时。
  - 如何操作：信任当前代码的输出作为期望值，但必须验证测试确实能捕获错误。

## 关键概念
- **自测试代码（Self-Testing Code）**：测试能自动运行、自动验证结果——运行后只显示 "OK"，而非需要人工检查的输出。
- **测试夹具独立性**：每个测试应构建自己独立的夹具——共享夹具会使测试间产生交互，导致测试结果依赖运行次序，这是最难调试的 bug 之一。
- **红条/绿条（Red Bar / Green Bar）**：测试全部通过显示绿色，有失败显示红色——"看到红条时永远不许进行重构"。
- **单元测试（Unit Test）**：测试一小块代码单元，运行足够快速——是自测试代码的支柱，占系统中绝大多数测试。
- **测试驱动开发（TDD / Test-Driven Development）**：先编写（失败的）测试 → 编写代码使测试通过 → 重构保证代码整洁——这个循环每小时应完成多次。
- **测试覆盖率（Test Coverage）**：只能识别未被测试覆盖的代码，不能衡量测试集的质量高低。
- **拆除阶段（Teardown）**：将测试夹具移除以确保不同测试间不产生交互——大多数时候可忽略（框架自动处理），共享夹具时显式声明很重要。

## 思维模型
- 当为既有代码编写测试时，采用"先信后疑"模式：先随便填期望值，用程序真实输出替换，然后故意引入错误验证测试会失败——最后恢复代码。
- 将测试视为 bug 侦测器而非正确性证明——"每当你收到 bug 报告，请先写一个单元测试来暴露这个 bug"，仅当测试通过时才视为 bug 修完。
- 当不确定测试是否足够好时，自问：如果有人在代码里引入了一个缺陷，你有多大的自信它能被测试集揪出来？——这种主观信心就是最好的衡量标准。
- 当考虑边界条件时，主动扮演"程序公敌"——思考如何破坏代码，这种思维能提高生产力和代码健壮性。

## 反模式
- **共享测试夹具**：在 `describe` 块外层定义 `const asia = new Province(...)` 然后多个测试共用——测试间会产生交互，导致测试结果不确定、调试极其困难。应使用 `beforeEach` 每个测试重新构建。
- **追求完美的测试覆盖**：试图测试所有情况的一切组合——边际效用递减，可能因工作量太大而气馁最终什么都写不成。应集中在可能出错的地方。
- **一次性编写所有测试**："编写未臻完善的测试并经常运行，好过对完美测试的无尽等待"。
- **测试所有 public 函数**：测试应该是一种风险驱动的行为——不应测试简单到不可能出错的访问函数。目标是找出现在或未来可能出现的 bug。
- **一个 it 语句中验证过多特性**：如果一个 it 句中有多个断言，第一个验证失败会掩盖后续的错误信息——每个 it 语句最好只有一个验证。

## 代码示例
<!-- 标准的测试夹具配置与边界测试 -->
```cpp
#include <string>
#include <vector>
#include <cassert>

// Province (simplified, for testing purposes)
struct Province {
    struct Producer { std::string name; int cost; int production; };
    std::string name;
    std::vector<Producer> producers;
    int demand;
    int price;
    int shortfall{0};  // calculated: demand - totalProduction
    int profit{0};     // calculated: revenue - costs
};

// Sample test fixture -- factory function
auto sampleProvinceData() -> Province {
    return Province{
        .name = "Asia",
        .producers = {
            {.name = "Byzantium", .cost = 10, .production = 9},
            {.name = "Attalia",   .cost = 12, .production = 10},
            {.name = "Sinope",    .cost = 10, .production = 6},
        },
        .demand = 30,
        .price = 20
    };
}

// Test: province -- happy path tests with isolated fixture
void testProvinceShortfall() {
    auto asia = sampleProvinceData();
    assert(asia.shortfall == 5); // demand(30) - totalProduction(25)
}
void testProvinceProfit() {
    auto asia = sampleProvinceData();
    assert(asia.profit == 230);
}

// Test: no producers -- boundary condition: empty producers
void testNoProducersShortfall() {
    Province noProducers{
        .name = "No producers",
        .producers = {},
        .demand = 30,
        .price = 20
    };
    assert(noProducers.shortfall == 30);
}
void testNoProducersProfit() {
    Province noProducers{
        .name = "No producers",
        .producers = {},
        .demand = 30,
        .price = 20
    };
    assert(noProducers.profit == 0);
}

// Test: zero demand -- boundary condition
void testZeroDemand() {
    auto asia = sampleProvinceData();
    asia.demand = 0;
    assert(asia.shortfall == -25);
    assert(asia.profit == 0);
}

// Test: negative demand -- boundary condition
void testNegativeDemand() {
    auto asia = sampleProvinceData();
    asia.demand = -1;
    assert(asia.shortfall == -26);
    assert(asia.profit == -10);
}
```
- **演示了什么**：通过 `beforeEach` 确保每个测试拥有独立夹具；通过空集合、0 值、负值等边界测试主动寻找潜在 bug；展示"扮演程序公敌"的测试思维。

## 工作示例（DEPTH=study 必须有）
### 为 Province 类的 profit 计算添加测试的完整过程

**被测代码**：`Province` 类的 `profit` getter 牵涉到按成本价排序生产商、贪心分配需求量、计算总收入等复杂逻辑。

**第一步：搭建基础夹具测试**
```cpp
// Test: profit
auto asia = sampleProvinceData();
assert(asia.profit == 230); // initially a random number, replaced with real value after test run
```

**第二步：验证测试确实能发现错误**
在 `profit` 的计算中临时插入 `* 2` 的错误逻辑，确认测试失败：
```
AssertionError: expected 460 to equal 230
```
确认测试有效后，恢复代码。

**第三步：添加修改夹具后的测试**
```cpp
// Test: change production
asia.producers[0].production = 20; // Byzantium from 9 to 20
assert(asia.shortfall == -6);      // demand(30) - newTotal(36)
assert(asia.profit == 292);        // recalculated
```
此处使用 `setup-exercise-verify` 模式：`beforeEach` 完成 setup，`production = 20` 是 exercise，两个 `expect` 是 verify。

**第四步：探测边界条件**
- 测试空生产商集合：缺额 = 需求量，利润 = 0
- 测试零需求量：触发负缺额和零利润的边界
- 测试负需求量：引发关于"负需求是否有意义"的领域思考
- 测试空字符串需求量：发现 `parseInt("")` 产生 `NaN` 的问题

**关键教训**：边界测试不仅发现 bug，更重要的是引发思考——"对于这个业务领域，负需求值有意义吗？设值方法是否应该抛出错误？"这种思考本身就是测试的价值。

## 关键要点
1. 编写测试代码的最好时机是在开始动手编码之前——先写测试就是在问自己"需要实现些什么"，并将注意力集中在接口而非实现。
2. 确保所有测试都完全自动化，让它们检查自己的测试结果——人工检查测试输出是不可持续的。
3. 频繁运行测试：正在处理的代码对应的测试至少每隔几分钟运行一次，每天至少运行一次全部测试。
4. 测试应该是一种风险驱动的行为——集中在可能出错的地方，观察代码中变得复杂的部分。
5. 每当你收到 bug 报告，请先写一个单元测试来暴露这个 bug——仅当测试通过时，才视为 bug 修完。
6. 测试同样可能过犹不及——一个征兆是：相比修改代码，修改测试花费了更多时间，且测试在拖慢你。
7. 一个测试集是否足够好，最好的衡量标准是主观的：如果有人引入了一个缺陷，你有多大自信它能被测试集揪出来？

## 关联到
- **Ch 1**：第1章反复强调"重构的第一步是确保有可靠的测试"——第4章专门展开这一原则。
- **Ch 2**：第2章指出"自测试代码、持续集成、重构"三者存在强协同效应——第4章是"自测试代码"的实操部分。
- **TDD（测试驱动开发）**：第4章简介了 Kent Beck 的 TDD 短循环（失败测试 → 编码通过 → 重构），与本书的重构主题紧密呼应。
- **《修改代码的艺术》（Feathers）**：第2章和第4章都提及——在没有测试的遗留系统上，如何通过接缝插入测试。
