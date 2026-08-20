# Chapter 2: auto

## Core Idea
`auto` deduces variable types from initializers using the same rules as template type deduction (see Ch 1), eliminating uninitialized variables and type-mismatch bugs, but requires the explicitly typed initializer idiom to handle proxy class pitfalls.

## Items

### Item 5: Prefer auto to explicit type declarations

**Rule**: Use `auto` instead of explicit type declarations whenever practical.

**When to apply**: For local variables, loop variables, lambda closures, and anywhere the type can be deduced from the initializer.

**Key example**:
```cpp
// Before: verbose and error-prone
typename std::iterator_traits<It>::value_type currValue = *b;

// After: concise and correct
auto currValue = *b;

// Before: unsigned vs size_type mismatch across platforms
unsigned sz = v.size();        // wrong on 64-bit

// After: always correct
auto sz = v.size();            // std::vector<int>::size_type

// Before: hidden implicit conversion + temporary
for (const std::pair<std::string, int>& p : m) { }  // copies!

// After: efficient, no conversion
for (const auto& p : m) { }

// Auto for closures beats std::function
auto derefLess = [](const auto& p1, const auto& p2) { return *p1 < *p2; };
// vs: std::function<bool(const Widget&, const Widget&)> (larger, slower, may allocate)
```

**Why it matters**:
- **Forces initialization** - `auto x;` is a compile error; no uninitialized variables
- **Avoids type mismatches** - no more `unsigned` for `size_type`, no `std::pair<K,V>` for `std::pair<const K,V>`, no accidental narrowing conversions
- **Handles unutterable types** - lambdas, expression-template intermediates, compiler-only types
- **Cheaper than `std::function`** - no heap allocation, no indirection overhead, no `bad_alloc` risk
- **Enables refactoring** - change a function return type and callers auto-update on recompile
- **Less typing** - shorter code while maintaining type safety

### Item 6: Use the explicitly typed initializer idiom when auto deduces undesired types

**Rule**: When `auto` deduces a proxy class type instead of the underlying type you intended, cast the initializer expression to the desired type.

**When to apply**: Any time an initializer returns an "invisible" proxy class (e.g., `std::vector<bool>::reference`, `std::bitset::reference`, expression-template intermediates) whose lifetime is tied to a temporary.

**Key example**:
```cpp
// DANGEROUS: auto deduces std::vector<bool>::reference (a proxy)
// The reference holds a pointer into a temporary vector that dies at the semicolon
auto highPriority = features(w)[5];    // dangling pointer! UB!

// SAFE: explicitly typed initializer idiom
auto highPriority = static_cast<bool>(features(w)[5]);

// Also communicates deliberate narrowing
auto ep = static_cast<float>(calcEpsilon());  // "I meant to lose precision"
```

**Why it matters**:
- **`std::vector<bool>` is not a proper container** - `operator[]` returns `std::vector<bool>::reference`, a proxy object, not `bool&`
- Proxy objects typically contain a raw pointer into their parent container - dangling after the container dies
- **"Invisible" proxies violate auto's default assumptions** - they are designed for single-statement use, not variable storage
- The idiom is **self-documenting**: `static_cast` signals a deliberate type choice
- How to **detect proxy classes**: read library documentation, inspect header files for unusual `operator[]` return types, watch for unexpected compilation errors or test failures
- Other proxy examples: `std::bitset::reference`, expression-template `Sum<Matrix, Matrix>` from math libraries, smart pointers (though these are "visible" proxies and safe with auto)

## Key Concepts

- **AAA Style (Almost Always Auto)**: A coding style where `auto` is the default for variable declarations. Exceptions require explicit justification - typically readability, proxy types, or deliberate type narrowing.
- **Proxy class problem**: Some classes (`std::vector<bool>::reference`) are designed to simulate references/types they cannot physically provide. `auto` deduces the proxy type, not the simulated type, leading to dangling pointers or unexpected behavior.
- **Explicitly typed initializer idiom**: `auto x = static_cast<T>(expr);` - forces `auto` to deduce `T` instead of `expr`'s natural type. The cast is executed at runtime (via implicit conversion) but constrains the deduced type at compile time.
- **`auto` vs `std::function`**: For closures, `auto` stores the exact lambda type (zero-overhead). `std::function` performs type erasure, may heap-allocate, and adds indirect call overhead. Prefer `auto`.

## Anti-patterns

- Using `auto` with proxy-returning expressions without the explicitly typed initializer idiom
- Using `auto` where explicit types significantly improve readability (use judgment; IDE type hints help)
- Replacing all types unconditionally with `auto` - the decision requires engineering judgment
- Using `std::function` to hold lambda closures when `auto` suffices

## Key Takeaways

1. `auto` forces initialization and eliminates type-mismatch bugs, silent conversions, and platform-dependent type width issues.
2. For lambda closures, `auto` is strictly superior to `std::function` - smaller, faster, no allocation.
3. The proxy class trap (`std::vector<bool>::reference`) is the primary counterexample to "always auto".
4. Use `auto x = static_cast<T>(expr)` to simultaneously leverage auto's benefits and enforce the correct type.
5. Visibility into source code (IDE tooltips, good naming) mitigates readability concerns with `auto`.

## Connects To

- **Ch 1**: `auto` type deduction follows the same rules as template type deduction (template pattern with one exception: brace-init `{...}` always deduces to `std::initializer_list` with `auto`)
- **Ch 3**: `decltype` is often paired with `auto` return types
- **Ch 7**: Braced initializers (`{}`) interact with `auto` - `auto x = {1}` deduces `std::initializer_list<int>`, not `int`
