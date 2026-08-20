---
name: cpp-modern-idioms
description: "Modern C++ (C++11/14) idiom selection — which feature to use and when: type deduction and auto, {} vs () initialization, nullptr/using/scoped enum/override/=delete/noexcept/constexpr, smart-pointer ownership (unique_ptr/shared_ptr/weak_ptr, make_ functions, Pimpl), move semantics and perfect forwarding, lambdas, concurrency API. NOT for naming/class-layout/comment style → cpp-codestyle. C++17/20 features out of scope. Performance → cpp-performance-optimization."
---

<!-- argument-hint: [topic, item number, or chapter number] -->

# Modern C++ Best Practices

**Items**: 42 | **Chapters**: 8 | **Generated**: 2026-06-28

## How to Use This Skill

- **Load without args** — core frameworks for reference
- **Specify a topic** — ask about `type deduction`, `smart pointers`, `move semantics`, `lambda`, `concurrency`, etc.
- **Specify an item** — ask for `Item 23` for std::move/std::forward
- **Specify a chapter** — ask for `ch05` for rvalue references and move semantics

---

## Core Frameworks

### Type Deduction Rules
The three cases of template type deduction govern auto, decltype, and perfect forwarding:
1. ParamType is a pointer or reference (not universal ref) — strip reference, pattern-match
2. ParamType is a universal reference — lvalues deduced as lvalue refs, rvalues as non-refs
3. ParamType is neither pointer nor reference — strip ref, strip const/volatile, decay arrays/functions to pointers

auto deduction mirrors template deduction with ONE exception: braced initializers deduce to `std::initializer_list<T>`.

### Modern C++ Idioms
- Prefer `{}` initialization (most vexing parse avoidance) but watch for initializer_list hijacking
- Use `nullptr` instead of 0/NULL
- Use `using` alias declarations instead of `typedef`
- Use scoped enums (`enum class`)
- Declare overriding functions `override`
- Use `= delete` for unwanted functions
- Use `noexcept` where appropriate (move constructors, swap)
- Use `constexpr` aggressively for compile-time computation
- Make const member functions thread-safe (mutable + mutex or atomic)

### Smart Pointer Ownership Model
- `unique_ptr` for exclusive ownership (factory return, Pimpl owner)
- `shared_ptr` for shared ownership (beware control block overhead)
- `weak_ptr` for observing shared_ptrs that may dangle
- Prefer `make_unique`/`make_shared` over `new` (exception safety, efficiency, no type repetition)

### Move Semantics & Perfect Forwarding
- `std::move` is an unconditional cast to rvalue. It doesn't move anything.
- `std::forward` is a conditional cast — casts to rvalue only if the argument was an rvalue.
- Use `std::move` on rvalue refs, `std::forward` on universal refs.
- Universal references: `T&&` where T is deduced (template or auto&&).
- Never overload on universal references — use tag dispatch, SFINAE/`enable_if`, or constrained templates.
- Reference collapsing: `T& &` → `T&`, `T&& &` → `T&`, `T& &&` → `T&`, `T&& &&` → `T&&`.
- Assume move operations are not present, not cheap, not used unless proven otherwise.

### Lambda Expressions
- Avoid default capture modes (`[=]` or `[&]`); be explicit.
- Use init capture `[x = std::move(x)]` for moving into closures (C++14).
- Use `decltype` with `auto&&` in generic lambdas for perfect forwarding.
- Prefer lambdas to `std::bind` (more readable, optimizable by compilers).

### Concurrency
- Prefer `std::async` (task-based) over `std::thread` (thread-based).
- Pass `std::launch::async` to `std::async` when asynchrony is essential.
- Make `std::thread` unjoinable on all paths (join or detach before destruction).
- `std::thread` destructor calls `std::terminate` if joinable.
- Use `std::atomic` for concurrency, `volatile` for special memory.

---

## Chapter Index

| # | Title | Items | Key Topics |
|---|-------|-------|------------|
| [ch01](chapters/ch01-type-deduction.md) | Type Deduction | 1-4 | template deduction (3 cases), auto, decltype, type viewing |
| [ch02](chapters/ch02-auto.md) | auto | 5-6 | AAA style, proxy types, explicit initializer idiom |
| [ch03](chapters/ch03-modern-cpp.md) | Moving to Modern C++ | 7-17 | {} vs (), nullptr, alias, scoped enum, delete, override, noexcept, constexpr, thread-safe const |
| [ch04](chapters/ch04-smart-pointers.md) | Smart Pointers | 18-22 | unique_ptr, shared_ptr, weak_ptr, make functions, Pimpl |
| [ch05](chapters/ch05-rvalue-move-forward.md) | Rvalue Refs & Move Semantics | 23-30 | std::move, std::forward, universal refs, overloading, reference collapsing |
| [ch06](chapters/ch06-lambda.md) | Lambda Expressions | 31-34 | capture modes, init capture, generic lambdas, lambda vs bind |
| [ch07](chapters/ch07-concurrency.md) | Concurrency API | 35-40 | async, threads, futures, atomic, volatile |
| [ch08](chapters/ch08-tweaks.md) | Tweaks | 41-42 | pass by value, emplace vs insert |

## Topic Index

- **auto** → ch01, ch02
- **constexpr** → ch03 (Item 15)
- **decltype** → ch01 (Item 3)
- **emplace** → ch08 (Item 42)
- **forwarding reference** → ch05 (Item 24)
- **initializer_list** → ch03 (Item 7)
- **lambda** → ch06
- **move semantics** → ch05
- **noexcept** → ch03 (Item 14)
- **override** → ch03 (Item 12)
- **perfect forwarding** → ch05 (Item 30)
- **Pimpl** → ch04 (Item 22)
- **reference collapsing** → ch05 (Item 28)
- **scoped enum** → ch03 (Item 10)
- **SFINAE** → ch05 (Item 27)
- **shared_ptr** → ch04 (Item 19, 20)
- **smart pointers** → ch04
- **std::forward** → ch05 (Item 23, 25)
- **std::move** → ch05 (Item 23, 25)
- **std::thread** → ch07
- **template type deduction** → ch01 (Item 1)
- **type deduction** → ch01
- **universal reference** → ch05 (Item 24)
- **unique_ptr** → ch04 (Item 18, 21)
- **weak_ptr** → ch04 (Item 20)

## Supporting Files

- [glossary.md](glossary.md) — All key C++ terms from the 42 items
- [patterns.md](patterns.md) — Modern C++ design patterns and idioms by category
- [cheatsheet.md](cheatsheet.md) — Quick-reference decision rules for all 42 items

## Scope

Covers C++11/14 best practices focused on modern idioms. Does not cover C++17/20 features. All principles apply to C++11 and C++14 standards.
