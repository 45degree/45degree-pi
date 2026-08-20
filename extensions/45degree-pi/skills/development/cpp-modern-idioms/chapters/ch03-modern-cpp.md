# Chapter 3: Moving to Modern C++

## Core Idea
Embrace C++11/14 idioms over C++98 habits: use uniform initialization, `nullptr`, alias declarations, scoped enums, `= delete`, `override`, `const_iterator`, `noexcept`, `constexpr`, thread-safe `const`, and understand special member function generation.

## Items

### Item 7: Distinguish between () and {} when creating objects

**Rule**: Prefer brace initialization `{}` as the default, but understand its quirks -- especially the `std::initializer_list` gotcha.

**When to apply**:
- Use `{}` for uniform initialization everywhere (it prohibits narrowing conversions, avoids the "most vexing parse", and works in all contexts).
- Use `()` only when you need to call a non-`std::initializer_list` constructor on a type that also has an `std::initializer_list` constructor (e.g., `std::vector<int>(10, 20)` vs `std::vector<int>{10, 20}`).

**Key example**:
```cpp
// Brace init prevents narrowing:
double x = 3.14;
// int y{x};            // ERROR: narrowing conversion
int y(x);               // OK (but silently truncates)

// Most vexing parse avoided:
Widget w1();            // declares a function, NOT an object
Widget w2{};            // declares an object

// initializer_list hijack:
std::vector<int> v1(10, 20);   // 10 elements, each value 20
std::vector<int> v2{10, 20};   // 2 elements: 10 and 20
```

**Why it matters**: Uniform brace initialization is the only syntax that works everywhere (member init, lambda capture, return statements). But constructor overload resolution favors `std::initializer_list` constructors so strongly that seemingly innocent `{}` calls can produce surprising results. Know when `()` is the right tool.

---

### Item 8: Prefer nullptr to 0 and NULL

**Rule**: Use `nullptr` wherever you need a null pointer. Never use `0` or `NULL`.

**When to apply**: Always. Every pointer, every smart pointer, every template context.

**Key example**:
```cpp
void f(int);      // three overloads
void f(bool);
void f(void*);

f(0);             // calls f(int) -- surprising!
f(NULL);          // may fail to compile, calls f(int) -- never f(void*)
f(nullptr);       // calls f(void*)  -- correct

// Template context: the killer argument
template<typename FuncType, typename MuxType, typename PtrType>
auto lockAndCall(FuncType func, MuxType& mutex, PtrType ptr)
    -> decltype(func(ptr))
{
    std::lock_guard<MuxType> g(mutex);
    return func(ptr);
}

auto r1 = lockAndCall(f1, f1m, 0);       // ERROR: int is not a pointer type
auto r2 = lockAndCall(f2, f2m, NULL);    // ERROR: integer-ish type
auto r3 = lockAndCall(f3, f3m, nullptr); // OK: std::nullptr_t converts to any pointer
```

**Why it matters**: `0` is `int`, not a pointer. `NULL` is an integer type (often `long`). Template type deduction captures their true type -- not a pointer. `nullptr` has type `std::nullptr_t`, which implicitly converts to any pointer type. This eliminates overload resolution surprises and makes template code work correctly. It also makes code more self-documenting: `auto result = findRecord(...); if (result == nullptr)` clearly signals `result` is a pointer.

---

### Item 9: Prefer alias declarations to typedefs

**Rule**: Use `using` alias declarations instead of `typedef`. They are strictly more powerful (support templates) and often cleaner.

**When to apply**: Always prefer `using X = Y;` over `typedef Y X;`.

**Key example**:
```cpp
// typedef version
typedef void (*FP)(int, const std::string&);           // hard to parse
typedef std::unique_ptr<std::unordered_map<std::string, std::string>> UPtrMapSS;

// alias declaration -- clearer "assignment" syntax
using FP = void (*)(int, const std::string&);
using UPtrMapSS = std::unique_ptr<std::unordered_map<std::string, std::string>>;

// CRITICAL: alias templates (typedef CANNOT do this)
template<typename T>
using MyAllocList = std::list<T, MyAlloc<T>>;          // clean

// typedef requires a hacky struct wrapper:
template<typename T>
struct MyAllocList {
    typedef std::list<T, MyAlloc<T>> type;             // requires ::type and typename
};
MyAllocList<Widget>::type lw;                          // verbose

// Inside templates, alias avoids typename + ::type:
template<typename T>
class Widget {
private:
    MyAllocList<T> list;    // no typename, no ::type -- compiler knows it's a type
};
```

**Why it matters**: Alias templates (`using ... = ...` with template parameters) are a game-changer. They eliminate the `::type` suffix and `typename` prefix needed with `typedef`-based type traits inside templates. C++14 provides alias `_t` versions of type traits (e.g., `std::remove_const_t<T>`) for exactly this reason.

---

### Item 10: Prefer scoped enums to unscoped enums

**Rule**: Use `enum class` (scoped enums) by default. Resort to unscoped `enum` only when implicit conversion to integer is genuinely needed (e.g., `std::get<>` with tuples).

**When to apply**:
- Default: `enum class Color { black, white, red };`
- Only use unscoped `enum` for `std::tuple` field access, or C-style APIs requiring implicit integer conversion.

**Key example**:
```cpp
// Unscoped: namespace pollution, implicit conversions
enum Color { black, white, red };
auto white = false;         // ERROR: white already declared in this scope
Color c = red;
if (c < 14.5) { ... }       // Compiles! Compares Color enum to double -- nonsense

// Scoped: clean, no implicit conversions
enum class Color { black, white, red };
auto white = false;         // OK: no name conflict
Color c = Color::white;     // must qualify
// if (c < 14.5) { ... }   // ERROR: no implicit conversion
if (static_cast<double>(c) < 14.5) { ... }  // explicit cast required

// Forward declaration: scoped enums can be forward-declared
enum class Status;                  // default underlying type: int
enum class Status : std::uint32_t;  // custom underlying type
void continueProcessing(Status s);  // uses forward-declared enum

// Tuple access: the one place unscoped enums shine
using UserInfo = std::tuple<std::string, std::string, std::size_t>;
enum UserInfoFields { uiName, uiEmail, uiReputation };  // unscoped
auto val = std::get<uiEmail>(uInfo);  // implicit conversion to size_t

// To get similar convenience with scoped enums:
template<typename E>
constexpr auto toUType(E enumerator) noexcept {
    return static_cast<std::underlying_type_t<E>>(enumerator);
}
auto val = std::get<toUType(UserInfoFields::uiEmail)>(uInfo);
```

**Why it matters**: Scoped enums prevent namespace pollution, prohibit dangerous implicit integer conversions, support forward declaration (reducing build dependencies), and allow explicit underlying type specification. The one cost -- verbosity with `std::get` -- can be mitigated with a helper `toUType` function.

---

### Item 11: Prefer deleted functions to private undefined ones

**Rule**: Use `= delete` to suppress functions. It works on any function (member, non-member, template specialization), not just member functions, and catches errors at compile time instead of link time.

**When to apply**: Whenever you want to prevent a function from being called -- copy constructor, assignment operator, unwanted implicit conversions, or template specializations.

**Key example**:
```cpp
// C++98: private + undefined -- link-time error
class basic_ios : public ios_base {
private:
    basic_ios(const basic_ios&);           // not defined
    basic_ios& operator=(const basic_ios&); // not defined
};

// C++11: public + deleted -- compile-time error, better diagnostics
class basic_ios : public ios_base {
public:
    basic_ios(const basic_ios&) = delete;
    basic_ios& operator=(const basic_ios&) = delete;
};

// Non-member functions can be deleted!
bool isLucky(int number);           // original
bool isLucky(char) = delete;        // reject char
bool isLucky(bool) = delete;        // reject bool
bool isLucky(double) = delete;      // reject double and float

isLucky('a');   // ERROR: deleted function
isLucky(true);  // ERROR: deleted function
isLucky(3.5f);  // ERROR: calls deleted double overload (float -> double preferred)

// Template specializations can be deleted!
template<typename T>
void processPointer(T* ptr);

template<>
void processPointer<void>(void*) = delete;
template<>
void processPointer<char>(char*) = delete;
template<>
void processPointer<const void>(const void*) = delete;
template<>
void processPointer<const char>(const char*) = delete;
```

**Why it matters**: `= delete` works at compile time with clear error messages, applies to any function (not just member functions), and can selectively disable template specializations. The C++98 private-undefined trick only catches errors at link time and only works for member functions.

---

### Item 12: Declare overriding functions override

**Rule**: Tag every derived class function that is meant to override a base class virtual function with `override`.

**When to apply**: Always on overriding virtual functions in derived classes.

**Key example**:
```cpp
class Base {
public:
    virtual void mf1() const;
    virtual void mf2(int x);
    virtual void mf3() &;          // lvalue reference qualifier (C++11)
    virtual void mf4() const;
};

// WITHOUT override -- silently creates NEW functions, doesn't override!
class Derived : public Base {
public:
    virtual void mf1();                // missing const -- NOT an override
    virtual void mf2(unsigned int x);  // wrong param type -- NOT an override
    virtual void mf3() &&;             // wrong ref qualifier -- NOT an override
    void mf4() const;                  // Base::mf4 is not virtual -- NOT an override
};

// WITH override -- compiler catches all errors
class Derived : public Base {
public:
    virtual void mf1() const override;
    virtual void mf2(int x) override;
    virtual void mf3() & override;
    void mf4() const override;         // ERROR: Base::mf4 is not virtual!
};
```

**Why it matters**: Overriding has strict requirements (same name, same parameter types, same constness, same reference qualifiers, compatible return types). A single mistake silently creates a new function rather than overriding. `override` makes the compiler verify the override intent, catching errors at compile time. It also documents intent and helps assess the impact of changing base class signatures.

---

### Item 13: Prefer const_iterators to iterators

**Rule**: Use `const_iterator` (and `cbegin`/`cend`) whenever you only read through the iterator.

**When to apply**: In any loop or algorithm where you don't modify the container elements through the iterator.

**Key example**:
```cpp
// C++98: painfully difficult to get const_iterator from non-const container
std::vector<int> values;
std::vector<int>::const_iterator ci =
    std::find(static_cast<std::vector<int>::const_iterator>(values.begin()),
              static_cast<std::vector<int>::const_iterator>(values.end()), 1983);
values.insert(static_cast<std::vector<int>::iterator>(ci), 1998);  // may not compile
// insert/erase only accepted iterator, not const_iterator!

// C++11: trivial -- cbegin/cend everywhere
std::vector<int> values;
auto it = std::find(values.cbegin(), values.cend(), 1983);
values.insert(it, 1998);  // C++11 insert/erase accept const_iterator!
```

**Why it matters**: In C++98, `const_iterator` was practically unusable: there was no simple way to get one from a non-const container, and STL insertion/erasure locations required `iterator`, not `const_iterator`. C++11 fixes both with `cbegin`/`cend` member functions and `const_iterator`-accepting insertion/erasure. Using `const_iterator` expresses "read-only" intent and enforces it at compile time.

---

### Item 14: Declare functions noexcept if they won't emit exceptions

**Rule**: Declare functions `noexcept` when you are certain they won't throw exceptions (and won't call functions that might). This is both an interface contract and a performance optimization.

**When to apply**:
- Move constructors and move assignment operators should almost always be `noexcept`.
- `swap` functions should be `noexcept`.
- Destructors are implicitly `noexcept` (don't override this lightly).
- Simple getters, arithmetic helpers, and leaf functions that perform no allocations.
- Do NOT use `noexcept` casually -- violating it triggers `std::terminate`.

**Key example**:
```cpp
// noexcept move constructor: critical for std::vector performance
class Widget {
public:
    Widget(Widget&& rhs) noexcept              // MOST IMPORTANT noexcept
        : name(std::move(rhs.name)), data(std::move(rhs.data)) {}
private:
    std::string name;
    std::vector<int> data;
};

// Why it matters for vector:
// std::vector<T>::push_back may relocate elements. During relocation,
// it must decide: move or copy? If T's move constructor is noexcept,
// vector will move (fast). Otherwise, vector copies (safe but slow).

// Wide contract noexcept:
int square(int x) noexcept { return x * x; }  // never throws

// Conditional noexcept:
template<typename T>
void swap(T& a, T& b) noexcept(noexcept(a.swap(b))) {  // noexcept if T::swap is noexcept
    a.swap(b);
}
```

**Why it matters**: `noexcept` enables key optimizations. `std::vector` grows by moving elements only if the move constructor is `noexcept`; otherwise it falls back to copying. Move operations on standard containers are `noexcept`-dependent. Additionally, `noexcept` allows the compiler to generate better code by eliminating stack unwinding machinery. It's part of the function's interface: callers can rely on it for exception safety guarantees.

---

### Item 15: Use constexpr whenever possible

**Rule**: Declare variables and functions `constexpr` when their values can be determined at compile time. This shifts computation from runtime to compile time and enables usage in contexts requiring compile-time constants.

**When to apply**:
- Variables: when the value is known at compile time (literals, constexpr function results).
- Functions: when the function can produce results at compile time given compile-time arguments. Write simple, pure functions that operate on literal types.
- Objects: `constexpr` constructors enable user-defined literal types usable at compile time.

**Key example**:
```cpp
// constexpr variables: guaranteed compile-time evaluation
constexpr int max_size = 1024;
int arr[max_size];               // OK: max_size is a compile-time constant

// constexpr function: can be called at compile time OR runtime
constexpr int pow(int base, int exp) noexcept {
    int result = 1;
    for (int i = 0; i < exp; ++i) result *= base;
    return result;
}
constexpr int val = pow(3, 4);   // computed at compile time -> 81
int runtime_val = pow(3, x);     // computed at runtime when x is not constexpr

// constexpr constructor: user-defined literal type
class Point {
public:
    constexpr Point(double x = 0, double y = 0) noexcept : x_(x), y_(y) {}
    constexpr double x() const noexcept { return x_; }
    constexpr double y() const noexcept { return y_; }
    constexpr Point midpoint(const Point& other) const noexcept {
        return Point((x_ + other.x_) / 2, (y_ + other.y_) / 2);
    }
private:
    double x_, y_;
};
constexpr Point p1(1.0, 2.0);
constexpr Point p2(3.0, 4.0);
constexpr Point mid = p1.midpoint(p2);  // all computed at compile time

// C++14: more relaxed restrictions
constexpr int factorial(int n) {    // no need for single-return style
    int result = 1;
    for (int i = 2; i <= n; ++i) result *= i;
    return result;
}
```

**Why it matters**: `constexpr` is an interface that says "this can be evaluated at compile time." It enables objects and functions to be used where only compile-time constants are allowed (array bounds, template arguments, `static_assert`). C++11 had strict single-return requirements; C++14 relaxed them significantly (local variables, loops, multiple returns). The more code you mark `constexpr`, the more work shifts to compile time, potentially improving runtime performance. Unlike `const`, `constexpr` guarantees compile-time evaluation when all arguments are compile-time constants.

---

### Item 16: Make const member functions thread safe

**Rule**: If a `const` member function may be called from multiple threads, ensure its `const` logical operation is thread-safe. Use `mutable std::mutex` or `std::atomic` for internal mutable state.

**When to apply**:
- When a `const` member function modifies `mutable` data members (caching, statistics, lazy evaluation).
- When the class may be used in a multithreaded context.
- Default position: if a class has mutable state accessed by `const` functions, make it thread-safe.

**Key example**:
```cpp
class Polynomial {
public:
    // const function that caches roots internally
    RootsType roots() const {
        if (!rootsAreValid) {
            // ... expensive computation to calculate roots ...
            rootVals = /* computed roots */;
            rootsAreValid = true;
        }
        return rootVals;
    }

private:
    mutable bool rootsAreValid{ false };    // mutable: can change in const functions
    mutable RootsType rootVals{};
};

// PROBLEM: If two threads call roots() simultaneously:
// Thread A checks rootsAreValid -> false -> starts computing roots
// Thread B checks rootsAreValid -> false -> also starts computing roots
// Race condition, potential data corruption

// SOLUTION 1: std::mutex
class Polynomial {
public:
    RootsType roots() const {
        std::lock_guard<std::mutex> l(m);     // lock for thread safety
        if (!rootsAreValid) {
            rootVals = /* compute */;
            rootsAreValid = true;
        }
        return rootVals;
    }
private:
    mutable std::mutex m;
    mutable bool rootsAreValid{ false };
    mutable RootsType rootVals{};
};

// SOLUTION 2: std::atomic (for simple counters/booleans)
class Point {
public:
    double distanceFromOrigin() const noexcept {
        ++callCount;                    // atomic increment, thread-safe
        return std::sqrt(x_ * x_ + y_ * y_);
    }
private:
    mutable std::atomic<unsigned> callCount{ 0 };
    double x_, y_;
};
```

**Why it matters**: `const` member functions logically shouldn't change the observable state of an object, but they may need to change internal `mutable` state (caching, metrics, lazy initialization). In multithreaded programs, two threads calling the same `const` function simultaneously creates a data race on the mutable members -- undefined behavior. Making `const` functions thread-safe is a correctness requirement, not an optimization. Use `std::mutex` when protecting non-trivial state transitions; use `std::atomic` for simple counters.

---

### Item 17: Understand special member function generation

**Rule**: Know the rules for when the compiler generates (or suppresses) the default constructor, destructor, copy constructor, copy assignment, move constructor, and move assignment operator. Use `= default` to explicitly request generation.

**When to apply**: Always be aware of these rules when designing classes. Use `= default` when you want compiler-generated versions despite declaring other special members. Use `= delete` to suppress generation.

**Key example**:
```cpp
// Generated special member functions (the "Big Six"):
// 1. Default constructor     (generated only if NO other constructor declared)
// 2. Destructor              (generated unless user-declared, implicitly noexcept)
// 3. Copy constructor        (generated if no move operations declared)
// 4. Copy assignment         (generated if no move operations declared)
// 5. Move constructor        (generated if NO: destructor, copy op, move op declared)
// 6. Move assignment         (generated if NO: destructor, copy op, move op declared)

// Rule: Move operations are generated only if all three are missing:
//        destructor, copy constructor, copy assignment.

// Example: declaring a destructor suppresses move generation
class Widget {
public:
    ~Widget() { /* custom cleanup */ }    // user-declared destructor
    // Move constructor: NOT generated (destructor declared)
    // Move assignment:  NOT generated (destructor declared)
    // Copy constructor: generated (deprecated in C++11, but still generated)
    // Copy assignment:  generated (deprecated in C++11, but still generated)
};

Widget w1, w2;
Widget w3(std::move(w1));     // calls COPY constructor, not move! (silent pessimization)
w2 = std::move(w3);           // calls COPY assignment, not move!

// Fix with = default:
class Widget {
public:
    Widget() = default;
    ~Widget() = default;                 // explicitly defaulted
    Widget(const Widget&) = default;     // explicitly defaulted
    Widget& operator=(const Widget&) = default;
    Widget(Widget&&) = default;          // now generated because user-declared
    Widget& operator=(Widget&&) = default;
};

// The "Rule of Five" (or "Rule of Zero"):
// If you declare any of: destructor, copy op, move op
// you should explicitly declare all five (or = default them).
// Better: follow the "Rule of Zero" -- design classes so they
// need none of these (rely on member types to handle resources).

// Member-wise generation:
// Generated move ops perform member-wise moves.
// If a member's move throws, the generated move is NOT noexcept.
```

**Why it matters**: The generation rules can silently change your code's behavior. The key gotcha: declaring a destructor (or copy operations) suppresses move generation, causing expensive copies where moves were expected. This is why `std::vector` reallocation can degrade to copying. The "Rule of Zero" is the ideal: use types like `std::string`, `std::vector`, `std::unique_ptr` as members, and the compiler-generated special members do the right thing automatically.

## Key Takeaways

1. **Default to brace initialization `{}`** -- it works everywhere, prevents narrowing, and avoids the most vexing parse. But watch out: `std::initializer_list` constructors hog `{}` calls.
2. **Always use `nullptr`** -- it's not an integer type, so overload resolution and template deduction work correctly. `0` and `NULL` are integers, not pointers.
3. **Prefer `using` over `typedef`** -- alias declarations support templates (alias templates), eliminating the `::type` suffix and `typename` prefix boilerplate.
4. **Use `enum class` by default** -- scoped enums prevent namespace pollution, block implicit integer conversions, and support forward declaration for faster builds.
5. **Replace private-undefined with `= delete`** -- compile-time errors beat link-time errors; works on any function, including non-members and template specializations.
6. **Mark all overriding functions `override`** -- the compiler verifies your intent, catching subtle signature mismatches that would silently create new functions instead of overriding.
7. **Use `const_iterator` with `cbegin`/`cend`** -- C++11 makes `const_iterator` easy to obtain and use; prefer it whenever you only read through an iterator.
8. **Declare `noexcept` where appropriate** -- especially move constructors and `swap`; it enables critical optimizations in standard containers and improves code generation.
9. **Use `constexpr` wherever possible** -- shifts computation to compile time, enables compile-time constant contexts; C++14 relaxes restrictions significantly.
10. **Make `const` member functions thread-safe** -- protect `mutable` state with `std::mutex` or `std::atomic`; a data race on internal state is undefined behavior even in `const` functions.
11. **Know the special member function generation rules** -- declaring any of destructor/copy/move can silently suppress generation of others (especially moves). Use `= default` explicitly when needed, and prefer the "Rule of Zero" by composing from types that manage their own resources.
