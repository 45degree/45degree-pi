# Chapter 5: Rvalue References, Move Semantics, and Perfect Forwarding

## Core Idea

Move semantics make expensive copy operations replaceable with cheaper move operations. Perfect forwarding lets us write function templates that accept arbitrary arguments and forward them to other functions while preserving lvalueness/rvalueness. Rvalue references are the language glue that enables both. But the reality is nuanced: `std::move` doesn't move anything, `std::forward` doesn't forward anything, `type&&` doesn't always mean rvalue reference, and universal references (a term coined by Scott Meyers in this chapter) bridge the gap.

**Critical foundational fact**: A function parameter, even one whose type is an rvalue reference, is always an lvalue. For example, in `void f(Widget&& w);`, `w` is an lvalue. This is essential to understanding why `std::forward` is necessary.

## Items

### Item 23: Understand std::move and std::forward

**Rule**: `std::move` unconditionally casts its argument to an rvalue. `std::forward` conditionally casts its argument to an rvalue - only when the argument was initialized with an rvalue. Neither generates any executable code at runtime.

**When to apply**: Every time you want to enable move semantics (use `std::move`) or perfect-forward an argument (use `std::forward`).

**Key example - std::move implementation (C++11)**:
```cpp
template<typename T>
typename remove_reference<T>::type&&
move(T&& param)
{
    using ReturnType = typename remove_reference<T>::type&&;
    return static_cast<ReturnType>(param);
}
```

**Key example - std::move implementation (C++14, cleaner)**:
```cpp
template<typename T>
decltype(auto) move(T&& param)
{
    using ReturnType = remove_reference_t<T>&&;
    return static_cast<ReturnType>(param);
}
```

**The `remove_reference` is essential**: If `T` happens to be an lvalue reference (e.g., `T = Widget&`), then `T&&` would collapse to `Widget&` (an lvalue reference). `remove_reference` strips the reference, ensuring `&&` is always applied to a non-reference type, guaranteeing an rvalue reference return.

**Critical trap - std::move on const objects**:
```cpp
class Annotation {
public:
    explicit Annotation(const std::string text)  // const param!
        : value(std::move(text))  // does NOT move - it COPIES!
    { ... }
private:
    std::string value;
};
```

`std::move(text)` produces a `const std::string&&` rvalue. The move constructor takes `std::string&&` (non-const). A const rvalue cannot bind to a non-const rvalue reference, but it CAN bind to `const std::string&` (the copy constructor's parameter). So the copy constructor is silently invoked. **Lesson**: Do not declare objects `const` if you intend to move from them. Moving from a const object silently degrades to copying.

**std::forward use case**:
```cpp
void process(const Widget& lvalArg);   // process lvalues
void process(Widget&& rvalArg);        // process rvalues

template<typename T>
void logAndProcess(T&& param)          // universal reference
{
    auto now = std::chrono::system_clock::now();
    makeLogEntry("Calling 'process'", now);
    process(std::forward<T>(param));
}
```

Without `std::forward`, `param` (which is always an lvalue within the function) would always call `process`'s lvalue overload. `std::forward<T>(param)` casts `param` to an rvalue only if `param` was initialized with an rvalue, preserving the original value category.

**Why not just use std::forward everywhere?** Technically you could, but `std::move` is simpler and conveys intent. Compare:
```cpp
// With std::move - simple, clear intent:
Widget(Widget&& rhs) : s(std::move(rhs.s)) { ++moveCtorCalls; }

// With std::forward - verbose, requires template arg, error-prone:
Widget(Widget&& rhs) : s(std::forward<std::string>(rhs.s)) { ++moveCtorCalls; }
```

`std::move` requires only the argument. `std::forward` requires both the argument AND a template type argument. Using `std::move` signals an unconditional rvalue cast (for move operations), while `std::forward` signals a conditional cast (for forwarding while preserving value category).

**Things to Remember**:
- `std::move` performs an unconditional cast to rvalue. By itself, it moves nothing.
- `std::forward` casts to rvalue only if the argument was bound to an rvalue.
- Both `std::move` and `std::forward` do nothing at runtime.

---

### Item 24: Distinguish universal references from rvalue references

**Rule**: `T&&` has two meanings: (1) rvalue reference (binds only to rvalues), (2) universal reference (binds to anything - both lvalues and rvalues). Whether it's a universal reference depends on whether **type deduction** occurs AND the form is **exactly `T&&`** (no `const`, no extra qualifiers).

**When to apply**: Every time you see `T&&` in code, classify it correctly to understand whether it accepts only rvalues or anything.

**Key examples**:
```cpp
void f(Widget&& param);         // rvalue reference (no type deduction)
Widget&& var1 = Widget();       // rvalue reference (no type deduction)
auto&& var2 = var1;             // universal reference (auto type deduction!)

template<typename T>
void f(std::vector<T>&& param); // rvalue reference (not exactly T&&)

template<typename T>
void f(T&& param);              // universal reference (type deduction + T&& form)
```

**Two contexts for universal references**:

1. Function template parameters:
```cpp
template<typename T>
void f(T&& param);  // param is a universal reference
```

2. `auto` declarations:
```cpp
auto&& var2 = var1;  // var2 is a universal reference
```

Both involve **type deduction**. Without type deduction, `T&&` is always an rvalue reference:
```cpp
void f(Widget&& param);          // no type deduction => rvalue reference
Widget&& var1 = Widget();        // no type deduction => rvalue reference
```

**The initializer determines behavior**: A universal reference becomes an lvalue reference if initialized with an lvalue, and an rvalue reference if initialized with an rvalue:
```cpp
template<typename T>
void f(T&& param);      // param is a universal reference

Widget w;
f(w);                   // lvalue passed: param's type = Widget&  (lvalue ref)
f(std::move(w));        // rvalue passed: param's type = Widget&& (rvalue ref)
```

**The form MUST be exactly `T&&`** - any deviation breaks it:
```cpp
template<typename T>
void f(const T&& param);        // const qualifier => rvalue reference, NOT universal

template<typename T>
void f(std::vector<T>&& param); // not T&& form => rvalue reference
```

**Critical gotcha - `push_back` vs `emplace_back` in vector**:
```cpp
template<class T, class Allocator = allocator<T>>
class vector {
public:
    void push_back(T&& x);          // rvalue reference! No type deduction
                                     // T is fixed when vector is instantiated

    template <class... Args>
    void emplace_back(Args&&... args); // universal references!
                                       // Args is deduced per call
};
```

When you write `std::vector<Widget> v;`, `push_back` becomes `void push_back(Widget&& x)` - a plain rvalue reference. But `emplace_back` deduces `Args` independently per call, making `Args&&...` universal references.

**auto universal references in C++14 lambdas**:
```cpp
auto timeFuncInvocation =
    [](auto&& func, auto&&... params)  // universal references
    {
        // start timer;
        std::forward<decltype(func)>(func)(
            std::forward<decltype(params)>(params)...
        );
        // stop timer and record elapsed time;
    };
```

`func` is a universal reference that can bind to any callable (lvalue or rvalue). `params` is a universal reference parameter pack.

**Things to Remember**:
- If a function template parameter has the form `T&&` with a deduced type `T`, or if an object is declared `auto&&`, the parameter/object is a universal reference.
- If the declaration is not exactly `type&&`, or if type deduction does not occur, `type&&` denotes an rvalue reference.
- Universal references are rvalue references when initialized with rvalues; they are lvalue references when initialized with lvalues.

---

### Item 25: Use std::move on rvalue references, std::forward on universal references

**Rule**: Apply `std::move` to rvalue reference parameters (which always bind to rvalues at the call site). Apply `std::forward` to universal reference parameters (which may bind to either lvalues or rvalues).

**When to apply**: In every function that takes rvalue reference or universal reference parameters, before forwarding such parameters to other functions.

**Key example**:
```cpp
class Widget {
public:
    Widget(Widget&& rhs)                     // rhs is rvalue reference
        : name(std::move(rhs.name)),         // use std::move
          p(std::move(rhs.p))
    { }

    template<typename T>
    void setName(T&& newName)                // newName is universal reference
    {
        name = std::forward<T>(newName);     // use std::forward
    }
};
```

**Why this matters**: Rvalue reference parameters are guaranteed to bind to rvalues, so unconditionally casting to rvalue with `std::move` is correct. Universal references may bind to lvalues, so you must conditionally preserve the value category with `std::forward`.

**Do NOT apply `std::move` to a universal reference in the last use** unless you specifically want to move from lvalues (which would be confusing and dangerous). Prefer `std::forward` for universal references.

**Multiple uses of `std::forward` on the same universal reference**: The last use should be the forwarding use. Earlier uses should work with the lvalue form (since the parameter is an lvalue).

**C++14 note**: If a function returns by value and the return expression is a local rvalue reference or universal reference, apply `std::move` or `std::forward` to enable move semantics on return. This is one case where `std::move` on a universal reference at the return point is acceptable (for rvalue calls, the parameter was already an rvalue anyway; for lvalue calls, you still get a copy unless you use a conditional approach).

**Things to Remember**:
- Apply `std::move` to rvalue references and `std::forward` to universal references the last time each is used.
- Do the same for rvalue references and universal references being returned from functions that return by value.
- Never apply `std::move` or `std::forward` to local variables that are candidates for the Return Value Optimization (RVO) - let the compiler optimize naturally.

---

### Item 26: Avoid overloading on universal references

**Rule**: Functions taking universal references are the greediest functions in C++. They can match almost any argument type, causing overload resolution surprises where universal-reference overloads are preferred over more specific overloads.

**When to apply**: When designing an overload set that includes a universal reference parameter, consider alternatives before committing.

**Key example - the problem**:
```cpp
std::multiset<std::string> names;

void logAndAdd(const std::string& name)  // overload for lvalues
{
    names.insert(name);
}

template<typename T>
void logAndAdd(T&& name)                 // overload for universal refs
{
    names.insert(std::forward<T>(name));
}

std::string petName("Darla");
logAndAdd(petName);                      // calls lvalue overload (exact match)
logAndAdd(std::string("Persephone"));    // calls T&& overload (better match than const&)
logAndAdd("Patty Dog");                  // calls T&& overload! Creates std::string from const char*
```

**The surprise - perfect forwarding constructors**:
```cpp
class Person {
public:
    template<typename T>
    explicit Person(T&& n)              // perfect forwarding ctor
        : name(std::forward<T>(n)) { }

    Person(const Person& rhs);          // copy ctor (compiler-generated)
    Person(Person&& rhs);               // move ctor (compiler-generated)
};

Person p("Nancy");
auto cloneOfP(p);  // ERROR or calls forwarding ctor instead of copy ctor!
                   // Because forwarding ctor with T = Person& is a better match
                   // than copy ctor (which requires const qualification)
```

Non-const lvalues passed to the Person constructor match the forwarding constructor (deducing `T = Person&`) more closely than the copy constructor (which requires an implicit `const` conversion). This is the **perfect forwarding constructor problem**.

**Things to Remember**:
- Overloading on universal references almost always leads to the universal reference overload being called more often than expected.
- Perfect forwarding constructors are especially problematic because they typically hijack copy and move operations from non-const objects.

---

### Item 27: Familiarize yourself with alternatives to overloading on universal references

**Rule**: Instead of overloading universal reference templates with other functions, use techniques like: (1) abandoning overloading by giving functions different names, (2) passing by `const T&`, (3) passing by value, (4) using tag dispatch, or (5) constraining templates with `std::enable_if`.

**When to apply**: Anytime you're tempted to overload a function that takes universal references.

**Key approaches**:

1. **Abandon overloading - use different names**:
```cpp
void logAndAdd(const std::string& name);   // for lvalues
template<typename T>
void logAndAddName(T&& name);              // different name for forwarding version
```

2. **Pass by const T& (no universal reference)**:
Revert to C++98 style, accepting only lvalues. Lose efficiency for rvalue arguments but avoid all overload resolution problems.

3. **Pass by value**:
```cpp
void logAndAdd(std::string name)           // by value, use move/copy idiom
{
    names.insert(std::move(name));
}
```
Unconditionally copies or moves depending on argument value category. Less efficient for lvalue+move chains but simple and safe.

4. **Tag dispatch**:
```cpp
template<typename T>
void logAndAdd(T&& name)
{
    logAndAddImpl(std::forward<T>(name),
                  std::is_integral<std::remove_reference_t<T>>());
}
```
Delegates to type-specific implementations via tag types, avoiding overload ambiguity.

5. **Constrain templates with enable_if** (most powerful):
```cpp
template<typename T, typename = std::enable_if_t<
    !std::is_same<Person, std::decay_t<T>>::value
>>
explicit Person(T&& n);
```
Prevents the universal reference overload from being considered when `T` is `Person`, restoring correct copy/move constructor behavior.

**Things to Remember**:
- Alternatives include: separate function names, pass by lvalue-reference-to-const, pass by value, tag dispatch, and template constraints via `std::enable_if`.
- `std::enable_if` is the most powerful tool, typically used to disable universal reference overloads when the deduced type doesn't match a set of criteria.
- Universal reference parameters often have efficiency advantages, but the usability disadvantages of overload resolution problems mean constrained templates are generally preferred.

---

### Item 28: Understand reference collapsing

**Rule**: C++ forbids references to references, but compilers can generate them in certain contexts (template instantiation, `auto`, `decltype`, `typedef`). When this happens, **reference collapsing** rules apply: if either reference is an lvalue reference, the result is an lvalue reference; otherwise (both are rvalue references), the result is an rvalue reference.

**When to apply**: Understanding template instantiation with universal references, `auto&&`, `decltype(auto)`, and `typedef`/alias templates.

**The four collapsing rules**:
```
T&  &   -> T&    (lvalue ref + lvalue ref  = lvalue ref)
T&  &&  -> T&    (lvalue ref + rvalue ref  = lvalue ref)
T&& &   -> T&    (rvalue ref + lvalue ref  = lvalue ref)
T&& &&  -> T&&   (rvalue ref + rvalue ref  = rvalue ref)
```

**How universal references work**: When you call `f(w)` with lvalue `w`:
- `T` is deduced as `Widget&`
- `T&&` becomes `Widget& &&`
- Reference collapsing yields `Widget&`

When you call `f(std::move(w))` with rvalue:
- `T` is deduced as `Widget`
- `T&&` becomes `Widget&&`
- No collapsing needed (already an rvalue reference)

**Where reference collapsing occurs**:
1. Template instantiation (the most common context)
2. `auto` type deduction with `auto&&`
3. `typedef`/alias declarations with nested references
4. `decltype` expressions

**How std::forward works**: `std::forward<T>` encodes this information. When `T = Widget&`, `std::forward` returns `Widget&` (lvalue). When `T = Widget`, `std::forward` returns `Widget&&` (rvalue). Reference collapsing makes this work.

**Things to Remember**:
- Reference collapsing occurs in four contexts: template instantiation, `auto` type generation, `typedef`/alias declarations, and `decltype`.
- When the compiler generates a reference to a reference, reference collapsing dictates that a single reference results. If either of the original references is an lvalue reference, the result is an lvalue reference. Otherwise, it's an rvalue reference.
- Universal references are rvalue references only when type deduction distinguishes lvalues from rvalues and reference collapsing is applied.

---

### Item 29: Assume that move operations are not present, not cheap, not used

**Rule**: When writing generic/template code, assume: (1) the types you operate on may not support move operations, (2) even if they do, move may not be cheaper than copy, (3) move operations may not be used even when available (due to the code path taken).

**When to apply**: In generic code (templates, standard library implementations) where you cannot know the characteristics of the types you're working with.

**Key scenarios where move isn't cheaper**:
- `std::array` (and other fixed-size containers stored inline): moving requires moving each element, same cost as copying when elements are scalar.
- `std::string` with SSO (Small String Optimization): short strings are stored inline, so moving copies the inline buffer just like copy.
- Types without move support: C++98 legacy types with only copy operations.

**Key scenarios where move isn't used**:
- Operations on `const` objects: `const` rvalues bind to copy constructors, not move constructors (as demonstrated in Item 23).
- Missing `noexcept`: Some standard library code (e.g., `std::vector::push_back` with strong exception guarantee) will copy instead of move if the move constructor is not `noexcept`.

**Casting pessimism aside - when CAN you assume move is beneficial?**
- When you know the concrete types involved (not generic code)
- When the types are known to support move (e.g., standard library containers)
- When you have profiled and confirmed move is cheaper

**Things to Remember**:
- Assume that move operations are not present, not cheap, and not used.
- In code with known types or known move support, you can rely on move semantics; but in generic code, be conservative.
- Move operations on `std::array` and small-string-optimized `std::string` are never cheaper than copy.

---

### Item 30: Familiarize yourself with perfect forwarding failure cases

**Rule**: Perfect forwarding fails when the type deduced for the forwarding function's universal reference parameter differs from the type deduced for the same argument passed directly to the target function. There are several well-defined failure cases.

**When to apply**: When debugging forwarding function templates that don't work as expected.

**Failure case 1 - Braced initializers**:
```cpp
void f(const std::vector<int>& v);

template<typename T>
void fwd(T&& param) { f(std::forward<T>(param)); }

f({1, 2, 3});      // OK: compiler deduces initializer_list
fwd({1, 2, 3});    // ERROR: braced initializer is a non-deduced context for templates
```
The solution: use `auto` to force deduction first:
```cpp
auto il = {1, 2, 3};
fwd(il);  // OK
```

**Failure case 2 - 0 or NULL as null pointers**:
```cpp
void f(int* p);
fwd(0);    // deduces T = int, passes int 0 instead of null pointer
fwd(NULL); // same problem - deduces integral type
```
Use `nullptr` instead.

**Failure case 3 - Declaration-only integral `static const` data members**:
```cpp
class Widget {
public:
    static const std::size_t MinVals = 28;  // declaration only, no definition
};
fwd(Widget::MinVals);  // may fail to link: reference to MinVals requires definition
```
These members don't need definitions unless their address is taken; forwarding creates a reference, which requires the definition. Provide an out-of-line definition.

**Failure case 4 - Overloaded function names and template names**:
```cpp
void f(int (*pf)(int));

int processVal(int value);
int processVal(int value, int priority);

fwd(processVal);  // ERROR: which processVal? Overloaded name not deducible
```
Cast to the desired function pointer type first:
```cpp
using ProcessFuncType = int(*)(int);
fwd(static_cast<ProcessFuncType>(processVal));  // OK
```

**Failure case 5 - Bitfields**:
```cpp
struct IPv4Header {
    std::uint32_t version:4;  // bitfield
};
void f(std::size_t sz);
fwd(h.version);  // ERROR: cannot bind non-const reference to bitfield
```
C++ forbids binding non-const references to bitfields. Copy the bitfield value first:
```cpp
auto length = static_cast<std::uint16_t>(h.totalLength);
fwd(length);  // OK
```

**Things to Remember**:
- Perfect forwarding fails when template type deduction fails or when it deduces the "wrong" type.
- The five key failure cases are: braced initializers, 0/NULL as null pointers, declaration-only integral `static const` members, overloaded function/template names, and bitfields.

---

## Quick Reference - Decision Flowchart

1. **See `T&&` in code?** → Is type deduction happening AND is it exactly `T&&` form? → YES: Universal reference (use `std::forward`). NO: Rvalue reference (use `std::move`).

2. **Writing a function with rvalue reference param?** → Apply `std::move` on last use.

3. **Writing a function with universal reference param?** → Apply `std::forward<T>` on last use. Don't overload it with other functions unless constrained with `enable_if`.

4. **Writing generic code with move operations?** → Assume move is not present, not cheap, not used.

5. **Perfect forwarding not working?** → Check: braced init list? `0`/`NULL`? `static const` without definition? Overloaded name? Bitfield?

## Common Mistakes

- **`std::move` on const objects**: Silently invokes copy, not move. Never make objects const if you plan to move from them.
- **`std::move` on universal references**: Dangerous - will move from lvalues. Use `std::forward` instead.
- **Overloading universal reference functions**: The universal reference overload hijacks calls intended for other overloads. Use `enable_if` or other alternatives.
- **`std::move` on return values eligible for RVO**: Prevents the compiler from applying Return Value Optimization. Let the compiler optimize naturally.
- **Assuming `type&&` in templates is always an rvalue reference**: It depends on type deduction and exact form.
