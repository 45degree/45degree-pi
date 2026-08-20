# Chapter 4: Smart Pointers

## Core Idea
Raw pointers are powerful but error-prone (six fundamental problems); smart pointers (`std::unique_ptr`, `std::shared_ptr`, `std::weak_ptr`) wrap raw pointers to eliminate resource-management mistakes while preserving near-raw-pointer performance.

---

## Chapter Introduction: Why Raw Pointers Are Problematic
1. A raw pointer declaration does not indicate whether it points to a single object or an array.
2. It does not reveal whether you must destroy the pointed-to object (i.e., whether the pointer *owns* the object).
3. If destruction is required, it is unclear whether `delete` or a different mechanism (custom deleter) is needed.
4. If `delete` is the answer, it is unclear whether `delete` or `delete[]` applies — using the wrong form is undefined behavior.
5. Even when the destruction mechanism is known, it is hard to guarantee destruction happens exactly once along every code path (leak if missing, undefined behavior if double-delete).
6. There is no way to tell if a pointer *dangles* (points to already-destroyed memory).

Smart pointers address all six problems. `std::auto_ptr` (C++98, deprecated in C++11) was superseded by `std::unique_ptr`.

---

## Items

### Item 18: Use `std::unique_ptr` for exclusive-ownership resource management

**Rule**: A non-null `std::unique_ptr` always owns the object it points to. It is move-only (copy is disallowed), and destroying the `std::unique_ptr` destroys the owned resource (by default via `delete`).

**When to apply**:
- When a resource has a single clear owner at any time.
- Factory functions that return heap-allocated objects in an inheritance hierarchy — the caller receives exclusive ownership and the object is automatically destroyed when the pointer goes out of scope.
- Ownership-transfer scenarios (moving into containers, data members, etc.).

**Key example**:
```cpp
// Factory returning unique_ptr — caller owns the result
template<typename... Ts>
std::unique_ptr<Investment> makeInvestment(Ts&&... params);

// Custom deleter with stateless lambda (zero size overhead)
auto delInvmt = [](Investment* p) { makeLogEntry(p); delete p; };
std::unique_ptr<Investment, decltype(delInvmt)>
    makeInvestment(Ts&&... params);
```

**Why it matters**:
- Same size and same machine instructions as raw pointers (with default deleter).
- Custom deleters with function pointers add 1-2 words of size; stateful function-object deleters can increase size further — prefer **stateless lambdas** for zero overhead.
- `std::unique_ptr<T>` for single objects; `std::unique_ptr<T[]>` for arrays (prefer `std::array`/`std::vector`/`std::string` over array form).
- Easily and efficiently converts to `std::shared_ptr`, making it the ideal factory return type — the caller can choose exclusive or shared ownership later.

**Key takeaways (from the book)**:
- `std::unique_ptr` is a lightweight, fast, move-only smart pointer for exclusive ownership.
- Default resource destruction uses `delete`; custom deleters are supported. Stateful deleters and function-pointer deleters increase object size.
- Easy to convert a `std::unique_ptr` to `std::shared_ptr`.

---

### Item 19: Use `std::shared_ptr` for shared-ownership resource management

**Rule**: `std::shared_ptr` provides garbage-collection-like automatic lifetime management via reference counting. The last `std::shared_ptr` pointing to an object destroys it. It is *not* the solution for every resource problem, but its cost is reasonable for the convenience it provides.

**When to apply**:
- When multiple entities need to share ownership of a resource, and no single entity can be identified as the sole "owner".
- When you need deterministic destruction timing combined with automatic shared lifetime management.
- Caching scenarios where cached objects may be concurrently in use by multiple callers.

**Key example**:
```cpp
// shared_ptr size: two pointers (object pointer + control-block pointer)
std::shared_ptr<Widget> spw(new Widget, loggingDel);
// Custom deleter type is NOT part of shared_ptr's type
// → different deleters can coexist in the same container
std::vector<std::shared_ptr<Widget>> vpw{ pw1, pw2 };

// Avoid: creating multiple control blocks from the same raw pointer
auto pw = new Widget;                              // BAD
std::shared_ptr<Widget> spw1(pw, loggingDel);      // control block #1
std::shared_ptr<Widget> spw2(pw, loggingDel);      // control block #2 → double-delete!

// Correct: use make_shared or pass new directly
std::shared_ptr<Widget> spw1(new Widget, loggingDel);  // OK
std::shared_ptr<Widget> spw2(spw1);                    // shares control block
```

**Why it matters**:
- **Performance cost**: (a) `std::shared_ptr` is twice the size of a raw pointer (object pointer + control-block pointer). (b) Control-block memory is dynamically allocated (except with `std::make_shared`). (c) Reference count increments/decrements are atomic → relatively expensive. (d) Control block uses virtual functions for type-erased destruction.
- **Move construction/assignment is cheap** — no reference-count manipulation needed; the source is set to null.
- **`this` pointer problem**: passing `this` to create a `std::shared_ptr` creates a second control block. Fix: inherit from `std::enable_shared_from_this<Widget>` and use `shared_from_this()` instead.
- **Custom deleters do not affect the type** — two `std::shared_ptr<Widget>` objects with different deleters have the same type and can be in the same container.
- **Not suitable for arrays** — no `operator[]`, and derived-to-base conversions open type-system holes.

**Control block creation rules**:
1. `std::make_shared` always creates a control block.
2. Constructing from a `std::unique_ptr` (or `std::auto_ptr`) creates a control block.
3. Constructing from a raw pointer creates a control block. **Never construct multiple `std::shared_ptr`s from the same raw pointer.**

**Key takeaways (from the book)**:
- `std::shared_ptr` provides automatic garbage collection for shared resource management.
- Twice the size of `std::unique_ptr`; overhead from control block and atomic reference counting.
- Default destruction via `delete`; custom deleters supported and do not affect `std::shared_ptr`'s type.
- Avoid creating `std::shared_ptr` from raw pointer *variables*.

---

### Item 20: Use `std::weak_ptr` for `std::shared_ptr`-like pointers that can dangle

**Rule**: `std::weak_ptr` is not a standalone smart pointer — it is an augmentation of `std::shared_ptr`. It does not affect reference counting and cannot be dereferenced or tested for null directly. It tracks whether its associated `std::shared_ptr` has expired (the pointed-to object has been destroyed).

**When to apply**:
- **Caching**: a factory that caches objects — the cache stores `std::weak_ptr`s so cached entries automatically expire when no client still uses the object.
- **Observer pattern**: subjects hold `std::weak_ptr`s to observers, so subjects can detect when an observer has been destroyed.
- **Breaking `std::shared_ptr` cycles**: in non-hierarchical pointer structures (e.g., A ↔ B mutual references), replace one `std::shared_ptr` with `std::weak_ptr` to prevent memory leaks.

**Key example**:
```cpp
auto spw = std::make_shared<Widget>();      // ref count = 1
std::weak_ptr<Widget> wpw(spw);             // ref count still 1
spw = nullptr;                               // Widget destroyed, wpw dangles

// Check-and-access as an atomic operation:
if (std::shared_ptr<Widget> spw1 = wpw.lock()) {  // lock() returns null if expired
    // use *spw1 safely
}
// Alternative: std::shared_ptr<Widget> spw3(wpw); // throws std::bad_weak_ptr if expired

// Caching factory example:
std::shared_ptr<const Widget> fastLoadWidget(WidgetID id) {
    static std::unordered_map<WidgetID, std::weak_ptr<const Widget>> cache;
    auto objPtr = cache[id].lock();
    if (!objPtr) {
        objPtr = loadWidget(id);
        cache[id] = objPtr;
    }
    return objPtr;
}
```

**Why it matters**:
- `std::weak_ptr` is the same size as `std::shared_ptr` and uses the same control block.
- The control block contains a *second* reference count (weak count) tracking how many `std::weak_ptr`s reference it. The control block persists until the last `std::weak_ptr` is destroyed.
- For strictly hierarchical structures (e.g., parent → child with `std::unique_ptr`), a raw pointer from child back to parent is safe — no `std::weak_ptr` needed.

**Key takeaways (from the book)**:
- `std::weak_ptr` models a `std::shared_ptr`-like pointer that can dangle.
- Typical use cases: caching, observer lists, and preventing `std::shared_ptr` cycles.

---

### Item 21: Prefer `std::make_unique` and `std::make_shared` to direct use of `new`

**Rule**: Use `std::make_unique` (C++14, easily backported to C++11) and `std::make_shared` (C++11) instead of raw `new` when constructing smart pointers. The make functions eliminate code duplication, provide exception safety, and (for `std::make_shared`) improve memory efficiency.

**When to apply**:
- **Almost always** — prefer make functions by default.
- **Exceptions** (when you cannot or should not use make functions):
  1. Custom deleters — make functions don't support them.
  2. Braced initializer lists — make functions use parentheses, not braces; workaround: `auto init = {10, 20}; make_shared<vector<int>>(init);`
  3. (For `std::shared_ptr` only) Classes with custom `operator new`/`delete` that expect exactly `sizeof(T)` allocations.
  4. (For `std::shared_ptr` only) Very large objects with long-lived `std::weak_ptr`s — memory is not freed until the last weak_ptr is gone because make_shared allocates object and control block together.

**Key example**:
```cpp
// Exception-unsafe (potential leak if computePriority throws after new before shared_ptr ctor):
processWidget(std::shared_ptr<Widget>(new Widget), computePriority());  // LEAK RISK!

// Exception-safe (make_shared and computePriority can execute in either order):
processWidget(std::make_shared<Widget>(), computePriority());           // SAFE

// Efficiency: make_shared does a single allocation (object + control block)
auto spw = std::make_shared<Widget>();  // 1 allocation
std::shared_ptr<Widget> spw2(new Widget);  // 2 allocations

// C++11 polyfill for make_unique:
template<typename T, typename... Ts>
std::unique_ptr<T> make_unique(Ts&&... params) {
    return std::unique_ptr<T>(new T(std::forward<Ts>(params)...));
}
```

**Why it matters**:
- **Code reduction**: avoids repeating the type name.
- **Exception safety**: prevents leaks when a `new` expression and `std::shared_ptr` construction are separated by another expression that may throw.
- **Efficiency** (shared_ptr): single heap allocation for both the object and its control block → smaller code, faster execution, reduced total memory.
- When make functions are not usable and you must use `new`, ensure the `new` result is passed directly to the smart pointer constructor in a single statement, with nothing else in between. For best performance, `std::move` the resulting local `std::shared_ptr` when passing to a by-value parameter.

**Key takeaways (from the book)**:
- Compared to `new`, make functions eliminate code duplication, improve exception safety, and (for `std::make_shared`/`std::allocate_shared`) generate smaller, faster code.
- Situations where make functions are inappropriate: custom deleters, braced initializer forwarding.
- For `std::shared_ptr` only, additional cases against make functions: (1) classes with custom memory management, (2) memory-tight systems with very large objects and `std::weak_ptr`s that outlive the corresponding `std::shared_ptr`s.

---

### Item 22: When using the Pimpl Idiom, define special member functions in the implementation file

**Rule**: When using `std::unique_ptr` with the Pimpl (Pointer to Implementation) idiom, declare the destructor (and move/copy operations) in the header but **define** them in the implementation file — *after* the `Impl` struct is fully defined. The compiler-generated destructor would otherwise attempt to destroy an incomplete type, causing a compilation error. This requirement applies to `std::unique_ptr` but **not** to `std::shared_ptr`.

**When to apply**:
- Whenever you use Pimpl with `std::unique_ptr<Impl>` to reduce compilation dependencies between a class's interface and its implementation.

**Key example**:
```cpp
// ===== widget.h (header) =====
class Widget {
public:
    Widget();
    ~Widget();                            // declaration ONLY

    // Move operations — must also be declared in header, defined in .cpp
    Widget(Widget&& rhs);
    Widget& operator=(Widget&& rhs);

    // Copy operations — hand-written for deep copy
    Widget(const Widget& rhs);
    Widget& operator=(const Widget& rhs);

private:
    struct Impl;                          // incomplete type
    std::unique_ptr<Impl> pImpl;
};

// ===== widget.cpp (implementation) =====
#include "widget.h"
#include "gadget.h"
#include <string>
#include <vector>

struct Widget::Impl {                     // full definition here
    std::string name;
    std::vector<double> data;
    Gadget g1, g2, g3;
};

Widget::Widget() : pImpl(std::make_unique<Impl>()) {}

Widget::~Widget() = default;              // defined AFTER Impl is complete

Widget::Widget(Widget&& rhs) = default;
Widget& Widget::operator=(Widget&& rhs) = default;

Widget::Widget(const Widget& rhs)
    : pImpl(std::make_unique<Impl>(*rhs.pImpl)) {}   // deep copy

Widget& Widget::operator=(const Widget& rhs) {
    *pImpl = *rhs.pImpl;
    return *this;
}
```

**Why it matters**:
- **The problem**: The compiler-generated destructor of `Widget` tries to call `delete` on `std::unique_ptr<Impl>::pointer`, which requires `Impl` to be a complete type. In the header, `Impl` is merely forward-declared (incomplete) → `static_assert` fails at compile time.
- **The fix**: Declare the destructor (and move/copy operations) in the header, but define them in the `.cpp` file **after** the full `Impl` definition.
- **Move operations**: Declaring a destructor suppresses compiler-generated move operations (per Item 17). Declare them explicitly and define them with `= default` in the `.cpp` file.
- **Copy operations**: `std::unique_ptr` is move-only, so copy operations must be hand-written (deep-copy the `Impl` object via `*rhs.pImpl`).
- **`std::shared_ptr` is different**: With `std::shared_ptr<Impl>` for Pimpl, **none of these special steps are needed** — the compiler-generated destructor and move operations work correctly even with an incomplete `Impl` type. This is because the deleter type is not part of `std::shared_ptr`'s type (type-erased in the control block). However, `std::unique_ptr` is the semantically correct choice for exclusive-ownership Pimpl.

**Key takeaways (from the book)**:
- Pimpl reduces build times by decoupling class interface from implementation details.
- For `std::unique_ptr<Impl>` pImpl pointers, declare special member functions in the class header but define them in the implementation file. Do this even when the default compiler-generated implementations would suffice.
- The above recommendation applies to `std::unique_ptr` but **not** to `std::shared_ptr`.

---

## Key Concepts

### Control block for `shared_ptr`
A heap-allocated data structure associated with each `std::shared_ptr`-managed object. Contains:
- **Reference count** (strong count): how many `std::shared_ptr`s point to the object.
- **Weak count**: how many `std::weak_ptr`s reference the control block.
- **Custom deleter** (if specified): type-erased via virtual function dispatch.
- **Custom allocator** (if specified).

The control block is created by:
1. `std::make_shared` — always.
2. Constructing `std::shared_ptr` from a `std::unique_ptr`.
3. Constructing `std::shared_ptr` from a raw pointer (danger: multiple blocks if done carelessly).

### `make_shared` efficiency
`std::make_shared` allocates the object and control block in a **single heap allocation**, versus two separate allocations with `new`. Benefits: smaller static code, faster execution, lower total memory footprint. Trade-off: memory is not freed until both the last `std::shared_ptr` **and** the last `std::weak_ptr` are destroyed.

### Pimpl with `unique_ptr`
The Pimpl idiom with `std::unique_ptr` requires special member functions (destructor, move, copy) to be defined in the implementation file because `std::unique_ptr`'s default deleter needs the complete type at the point of instantiation. With `std::shared_ptr`, the deleter is type-erased in the control block, so no special handling is needed — but `std::unique_ptr` is the semantically correct choice for exclusive ownership.

### `enable_shared_from_this`
A CRTP base class that provides `shared_from_this()`, enabling an object to safely create a `std::shared_ptr` pointing to itself without creating a duplicate control block. Requires that at least one `std::shared_ptr` already manages the object before `shared_from_this()` is called. Typically combined with private constructors and a `static` factory method returning `std::shared_ptr`.

---

## Key Takeaways

1. **`std::unique_ptr` is the default smart pointer**: same size and speed as raw pointers; move-only; ideal for factory return types because it easily converts to `std::shared_ptr`.

2. **`std::shared_ptr` for shared ownership**: twice the size of raw pointers; atomic reference counting has a cost; custom deleters don't affect the type (unlike `std::unique_ptr`).

3. **Never create multiple `std::shared_ptr`s from the same raw pointer**: always use `std::make_shared` or pass `new` directly, or copy from an existing `std::shared_ptr`.

4. **`std::weak_ptr` tracks expiration, not ownership**: essential for caches, observer patterns, and breaking `std::shared_ptr` cycles; use `lock()` to atomically check-and-access.

5. **Prefer `std::make_unique` and `std::make_shared` over `new`**: eliminates code duplication, provides exception safety, and (for `make_shared`) improves memory efficiency via single-allocation.

6. **Pimpl + `std::unique_ptr` needs special care**: define destructor, move operations, and copy operations in the implementation file after the `Impl` type is complete. With `std::shared_ptr` this is unnecessary — but `std::unique_ptr` correctly expresses exclusive ownership.
