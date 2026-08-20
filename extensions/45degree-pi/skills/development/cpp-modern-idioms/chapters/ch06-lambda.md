# Chapter 6: Lambda Expressions

## Core Idea

Lambdas are the most powerful C++11 feature for creating function objects inline. They supersede `std::bind` in readability, efficiency, and expressiveness. The key challenges are capture semantics (avoiding dangling references), move capture (getting move-only types into closures), perfect forwarding through generic lambdas, and knowing when `std::bind` still has a role.

## Items

### Item 31: Avoid Default Capture Modes
**Rule**: Use explicit capture lists instead of `[&]` or `[=]`.
**When to apply**: Always. Never use default capture modes in non-trivial lambdas.
**Key example**:
```cpp
// DANGEROUS: default by-reference capture
auto f = [&]() { return div(filter, divisor); };
// filter and divisor are captured by reference -- dangling if lambda outlives them

// MISLEADING: default by-value capture
auto g = [=]() { return memberVar + 1; };
// Captures `this` pointer, not memberVar. If `this` is destroyed, disaster.
```
**Why it matters**: Default `[&]` hides dangling reference bugs. Default `[=]` falsely suggests safety -- it still captures `this` by reference, making member access dangerous. Static variables are never captured by lambda; they are accessed directly, which `[=]` obscures. Explicit captures make lifetime dependencies visible.

### Item 32: Use Init Capture to Move Objects into Closures
**Rule**: In C++14, use init capture (`[x = std::move(x)]`). In C++11, emulate with `std::bind`.
**When to apply**: When you need a move-only type (e.g., `std::unique_ptr`, `std::thread`, `std::future`) inside a lambda.
**Key example**:
```cpp
// C++14 init capture (generalized lambda capture)
auto pw = std::make_unique<Widget>();
auto func = [pw = std::move(pw)]() { pw->doSomething(); };

// C++11 emulation via std::bind
auto func11 = std::bind(
    [](const std::unique_ptr<Widget>& pw) { pw->doSomething(); },
    std::make_unique<Widget>()
);
```
**Why it matters**: Lambdas can now own resources, not just borrow them. Init capture also enables: moving objects, creating copies with different names, and binding computation results. The `std::bind` emulation works because `bind` copies (or moves) the bound arguments, and the bound lambda receives them as parameters.

### Item 33: Use decltype on auto&& Parameters to std::forward Them
**Rule**: In generic lambdas, use `decltype(x)` for `std::forward` to preserve value category.
**When to apply**: Whenever you write a C++14 generic lambda with `auto&&` parameters and need to forward them.
**Key example**:
```cpp
// Generic lambda that perfectly forwards
auto forwarder = [](auto&&... params) {
    return f(std::forward<decltype(params)>(params)...);
};

// Single-parameter case
auto timeInvocation = [](auto&& func, auto&&... params) {
    startTimer();
    std::forward<decltype(func)>(func)(
        std::forward<decltype(params)>(params)...
    );
    recordElapsed();
};
```
**Why it matters**: `auto&&` is a universal reference. To forward correctly, the template argument to `std::forward` must encode the value category. For `auto&&`, `decltype(param)` does exactly this -- it yields `T&` for lvalues and `T&&` for rvalues. This is the generic-lambda equivalent of template perfect forwarding.

### Item 34: Prefer Lambdas to std::bind
**Rule**: Use lambdas; reserve `std::bind` only for C++11 move capture emulation and the rare polymorphic function object case.
**When to apply**: Almost always. Only use `std::bind` when a lambda cannot express the intent (C++11 move capture).
**Key example**:
```cpp
// Lambda: clear, readable, inlineable
auto between = [low, high](int x) { return low <= x && x <= high; };

// std::bind: obscure, unreadable, and worse at overload resolution
auto betweenBind = std::bind(
    std::logical_and<bool>(),
    std::bind(std::less_equal<int>(), low, std::placeholders::_1),
    std::bind(std::less_equal<int>(), std::placeholders::_1, high)
);

// Lambda naturally supports short-circuit evaluation
auto bounded = [&]() { return inRange(x) && process(x); };
// std::bind always evaluates all arguments at bind time -- no short-circuit
```
**Why it matters**: Lambdas are more readable, generate faster code (compilers inline them better), handle overloaded function names without casting, and correctly implement short-circuit evaluation. `std::bind` arguments are evaluated at bind time, not call time, which breaks `&&` / `||` semantics and makes delayed evaluation impossible without awkward `std::ref` wrapping.

## Key Takeaways

1. **Never** use `[&]` or `[=]` -- always capture explicitly to document lifetime dependencies.
2. **Init capture** (`[x = expr]`) is the C++14 way to move objects into closures; fall back to `std::bind` in C++11.
3. **Generic lambdas** need `std::forward<decltype(x)>(x)` to preserve value categories through `auto&&` parameters.
4. **Lambdas beat `std::bind`** on every dimension: readability, performance, overload resolution, and short-circuit evaluation. The only remaining use case for `bind` is C++11 move capture emulation.
