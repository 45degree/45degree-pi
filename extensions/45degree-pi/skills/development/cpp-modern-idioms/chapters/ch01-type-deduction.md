# Chapter 1: Type Deduction

## Core Idea
C++ type deduction - across templates, `auto`, and `decltype` - follows a unified set of rules that every modern C++ developer must understand to write correct, efficient code. Template type deduction is the foundation; `auto` mirrors it with one exception (braced initializers); `decltype` preserves exact types including references.

## Items

### Item 1: Understand template type deduction
**Rule**: Template type deduction for `f(expr)` with `template<typename T> void f(ParamType param)` depends on `ParamType`, which falls into three cases.
**When to apply**: Every time you write or read a function template call, or use `auto` (which mirrors template deduction).
**Key example**:
```cpp
template<typename T>
void f(T&& param);           // universal reference

int x = 27;
f(x);                        // T = int&,  ParamType = int&    (lvalue)
f(27);                       // T = int,   ParamType = int&&   (rvalue)

template<typename T>
void f(T param);             // pass-by-value

const int cx = x;
f(cx);                       // T = int, ParamType = int (const stripped)

template<typename T, std::size_t N>
constexpr std::size_t arraySize(T (&)[N]) noexcept { return N; }   // deduces array size
```
**Why it matters**: Understanding the three cases prevents surprises about whether `const`, references, or array bounds are preserved or stripped. It is the foundation for `auto`, `decltype(auto)`, and perfect forwarding.

### Item 2: Understand auto type deduction
**Rule**: `auto` type deduction is identical to template type deduction, with one exception: braced initializers like `auto x = {1, 2, 3}` deduce to `std::initializer_list<T>`, whereas template deduction would fail.
**When to apply**: Every variable declared with `auto`; `auto` return types (C++14); generic lambdas (C++14).
**Key example**:
```cpp
auto x1 = 27;                // int                       (case 3)
auto x2(27);                 // int                       (case 3)
auto x3 = {27};              // std::initializer_list<int> (the exception!)
auto x4{27};                 // std::initializer_list<int> (the exception!)

auto&& uref1 = x1;           // int&                      (universal ref, case 2)
auto&& uref2 = 27;           // int&&                     (universal ref, case 2)

const char name[] = "abc";
auto arr1 = name;            // const char*               (array decay)
auto& arr2 = name;           // const char (&)[4]         (array reference preserved)

auto createInitList() {
    return {1, 2, 3};        // ERROR! auto return uses template deduction, not auto deduction
}
```
**Why it matters**: The braced-initializer exception is the most common source of bugs with `auto`. In C++14, `auto` return types and generic lambda parameters revert to template deduction rules (no `initializer_list` magic), so braced initializers fail to compile. Also always remember: `auto` strips references and top-level const just like template pass-by-value deduction.

### Item 3: Understand decltype
**Rule**: `decltype(expr)` returns the exact declared type of `expr` without modification - except that `decltype((x))` (parenthesized lvalue expression) returns `T&` instead of `T`.
**When to apply**: When you need the precise type of an expression (especially preserving references); return type forwarding in generic code; `decltype(auto)` for perfect return type deduction.
**Key example**:
```cpp
// C++11 trailing return type
template<typename Container, typename Index>
auto authAndAccess(Container& c, Index i) -> decltype(c[i])
{
    authenticateUser();
    return c[i];
}

// C++14 decltype(auto) - preserves reference-ness
template<typename Container, typename Index>
decltype(auto) authAndAccess(Container&& c, Index i)   // universal reference
{
    authenticateUser();
    return std::forward<Container>(c)[i];
}

// Pitfall: parenthesized return
decltype(auto) f2() {
    int x = 0;
    return (x);              // decltype((x)) = int& -- dangling reference!
}
```
**Why it matters**: Plain `auto` return types strip references (so `c[i]` returning `T&` becomes `T` - an rvalue that cannot be assigned to). `decltype(auto)` preserves the exact type including references, enabling transparent forwarding. The `(x)` pitfall: extra parentheses turn a variable name into an lvalue expression, making `decltype` add a reference - a dangling reference if `x` is local.

### Item 4: Know how to view deduced types
**Rule**: Use three approaches to inspect deduced types - IDE hover, compiler diagnostics via incomplete template instantiation, and Boost.TypeIndex for runtime. Never rely on `std::type_info::name()` alone, as it strips references and cv-qualifiers.
**When to apply**: When debugging type deduction issues; verifying `auto`, `decltype(auto)`, or template deduction results.
**How**:
```cpp
// 1. Compiler diagnostics: incomplete template trick
template<typename T>
class TD;                    // declared but not defined

TD<decltype(x)> xType;       // error: 'TD<int> xType' has incomplete type
TD<decltype(y)> yType;       // error: 'TD<const int *> yType' has incomplete type

// 2. Runtime: Boost.TypeIndex (preserves const, volatile, references)
#include <boost/type_index.hpp>

template<typename T>
void f(const T& param)
{
    using boost::typeindex::type_id_with_cvr;
    std::cout << "T = "     << type_id_with_cvr<T>().pretty_name() << '\n';
    std::cout << "param = " << type_id_with_cvr<decltype(param)>().pretty_name() << '\n';
}
// Output (GNU/Clang):  T = Widget const*
//                      param = Widget const* const&
```

## Key Concepts
- **ParamType categories (3 cases)**:
  1. **Reference or Pointer (non-universal)**: Strip reference from `expr`, then pattern-match against `ParamType` to determine `T`. `const` on `expr` becomes part of `T`.
  2. **Universal Reference (`T&&`)**: If `expr` is lvalue → `T` = `T&`, `ParamType` = `T&`. If `expr` is rvalue → normal (case 1) rules apply. This is the only case where `T` is deduced as a reference.
  3. **Pass-by-value (neither pointer nor reference)**: Strip reference and top-level `const`/`volatile` from `expr`. The copy's mutability is independent of the original's constness.
- **auto vs template deduction difference**: `auto x = {1, 2, 3}` deduces `std::initializer_list<int>`. Template `f({1, 2, 3})` with `f(T param)` fails to deduce. C++14 `auto` return types and generic lambda parameters use *template* deduction rules (no braced-init-list magic).
- **decltype(auto)**: Deduces type using `decltype` rules rather than `auto`/template rules. Preserves references and cv-qualifiers exactly. Essential for perfect-returning forwarding functions.
- **Universal references in type deduction**: `T&&` where `T` is a deduced template parameter. Lvalues cause `T` to be deduced as an lvalue reference (reference collapsing: `T& &&` → `T&`). Rvalues cause `T` to be deduced as a non-reference (yielding `T&&`).
- **Array/Function decay**: Arrays decay to pointers in pass-by-value or pass-by-pointer, but *not* when passed by reference (`T&` preserves array type including size). Functions similarly decay to function pointers unless passed by reference.

## Anti-patterns
- Assuming `auto` always deduces the "obvious" type - braced initializers silently produce `std::initializer_list`
- Using `auto` as a function return type in C++14 and expecting reference semantics (use `decltype(auto)` instead)
- Returning `(x)` instead of `x` with `decltype(auto)` - the extra parentheses add a reference, potentially creating a dangling reference to a local variable
- Relying on `std::type_info::name()` for type debugging - it strips references and cv-qualifiers (pass-by-value semantics)
- Using `auto` with proxy types (e.g., `std::vector<bool>::operator[]` returning a proxy) without understanding Item 6

## Key Takeaways
1. Template type deduction has exactly three cases determined by `ParamType`: reference/pointer, universal reference, or pass-by-value
2. `auto` type deduction = template type deduction, except braced initializers → `std::initializer_list<T>`
3. `decltype` yields the exact declared type; `decltype((x))` on a parenthesized lvalue adds `&`
4. `decltype(auto)` in C++14 preserves references/cv-qualifiers - use it for perfect return type forwarding
5. Arrays/functions decay to pointers unless passed by reference (which preserves full type including size)
6. `std::type_info::name()` is unreliable for debugging - prefer `boost::typeindex::type_id_with_cvr` or the incomplete-template compiler diagnostic trick
7. The pass-by-value deduction rule strips top-level `const` and `volatile` from the deduced type (the copy is independent)

## Connects To
- **Ch 2 (auto)**: Items 5-6 build on auto type deduction, covering when `auto` deduces undesired types (proxies, invisible proxies) and explicit typing with `auto`
- **Ch 5 (Rvalue References)**: Universal reference deduction (Item 24) ties directly to perfect forwarding (Item 25) and `std::forward`
- **Ch 3 (Modern C++)**: `decltype(auto)` and trailing return types appear in modern API design patterns
- **Ch 4 (Smart Pointers)**: Type deduction principles apply when using `auto` with smart pointer factory functions
