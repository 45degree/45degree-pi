# Cheatsheet — Modern C++ Best Practices

> Quick decision reference for 42 modern C++ idioms. Every line helps you decide something.

## Type Deduction (Ch 1)
| Situation | Rule |
|-----------|------|
| Template param is `T&` or `T*` | Deduce T by stripping reference, pattern-match against param type |
| Template param is `T&&` (universal ref) | lvalue → T&, rvalue → T. Preserves const/volatile. |
| Template param is `T` (by value) | Strip ref, strip top-level const/volatile, decay arrays/functions to pointers |
| `auto x = {1,2,3}` | Deduces to `std::initializer_list<int>` (the ONE auto difference from template deduction) |
| Need return type dependent on args | Use `decltype(auto)` — deduces as decltype would, preserves references |
| Need to know deduced type | Use IDE hover, compiler diagnostic via incomplete template, or `typeid(x).name()` (+ Boost.TypeIndex) |

## auto (Ch 2)
| Situation | Rule |
|-----------|------|
| Declaring local variables | Prefer `auto` — avoids uninitialized vars, implicit conversions, type mismatches |
| `auto` deduces proxy type (e.g., `vector<bool>::reference`) | Use `static_cast<T>(expr)` — the explicitly typed initializer idiom |
| `auto sz = v.size()` on 32-bit | `sz` is 32-bit; prefer `auto sz = static_cast<std::size_t>(v.size())` |

## Modern C++ Idioms (Ch 3)
| Idiom | Do This | Avoid That | Why |
|-------|---------|------------|-----|
| Initialization | `Widget w{...}` — braces prevent narrowing, most vexing parse | `Widget w()` — declares a function! | Braces work almost everywhere, but watch initializer_list ctors |
| Null pointer | `nullptr` | `0` or `NULL` | Type-safe, won't get caught in int overloads |
| Type aliases | `using Foo = Bar<T>;` | `typedef Bar<T> Foo;` | Cleaner with templates |
| Enums | `enum class Color { Red, Green };` | `enum Color { Red, Green };` | Scoped, no implicit int conversion |
| Unwanted functions | `= delete` (public) | Private + undefined | Better errors, works for non-member functions too |
| Overriding | `void foo() override;` | `void foo();` (without override) | Compiler catches signature mismatches |
| Iterators (C++14) | `auto it = c.cbegin();` | `const_iterator` directly | C++14 has `cbegin`/`cend` |
| No-throw guarantee | `void swap(...) noexcept;` | Exception-specification comments | Enables optimizations, documents intent |
| Compile-time | `constexpr` everywhere possible | Runtime-only constraints | Moves work to compile time |
| Thread-safe const | `mutable std::mutex` + lock in const methods | Ignore thread safety | Const means logically const, not physically |

## Smart Pointers (Ch 4)
| Situation | Use | Notes |
|-----------|-----|-------|
| Exclusive ownership | `std::unique_ptr<T>` | Default choice; factory return; Pimpl |
| Shared ownership | `std::shared_ptr<T>` | Only when truly shared; has control block overhead |
| Observe without owning | `std::weak_ptr<T>` | For caches, observer patterns, breaking cycles |
| Creating smart pointers | `std::make_unique<T>(args)` / `std::make_shared<T>(args)` | Exception-safe, efficient (one allocation for shared_ptr) |
| Pimpl | `unique_ptr<Impl>` + define dtor/ops in .cpp | Compilation firewall; incomplete type awareness |

## Move Semantics (Ch 5)
| Situation | Rule |
|-----------|------|
| Cast to rvalue unconditionally | `std::move(x)` — doesn't actually move, just casts |
| Forward preserving value category | `std::forward<T>(x)` — casts to rvalue only if T is not an lvalue ref |
| `T&&` where T is deduced | Universal reference. Use `std::forward<T>()`. |
| `T&&` where T is NOT deduced | Rvalue reference. Use `std::move()`. |
| Overloading on universal ref | DON'T. Use tag dispatch, `enable_if`, or constrained templates. |
| Reference collapsing rules | `&` always wins: `T& &`→`T&`, `T&& &`→`T&`, `T& &&`→`T&`, `T&& &&`→`T&&` |
| Can't move cheaply? | Don't assume. Many types (std::array, small-string-optimized) don't benefit. |

## Lambda (Ch 6)
| Situation | Rule |
|-----------|------|
| Default capture `[=]` or `[&]` | AVOID. Captures may dangle (by-ref) or mislead (by-value captures pointer members). |
| Move object into closure | C++14: `[x = std::move(x)]() { ... }` — init capture |
| Perfect-forward in generic lambda | C++14: `[](auto&& x) { return f(std::forward<decltype(x)>(x)); }` |
| Lambda vs std::bind | ALWAYS prefer lambda. More readable, more optimizable. |

## Concurrency (Ch 7)
| Situation | Rule |
|-----------|------|
| Run async work | Use `std::async` (task-based), not `std::thread` (thread-based) |
| Must be truly async | Pass `std::launch::async` to `std::async` (default may defer) |
| `std::thread` must be unjoinable on all paths | `join()` or `detach()` before destruction — else `std::terminate` |
| One-shot event communication | `std::promise<void>` / `std::future<void>` |
| Shared data between threads | `std::atomic<T>` for concurrency; `volatile` only for special memory (memory-mapped I/O) |

## Tweaks (Ch 8)
| Situation | Rule |
|-----------|------|
| Parameter that you'll copy anyway | Pass by value, then `std::move` into storage. Works only for cheap-to-move types. |
| Add element to container | Prefer `emplace_back(args...)` over `push_back(T(args...))` — constructs in place. |
