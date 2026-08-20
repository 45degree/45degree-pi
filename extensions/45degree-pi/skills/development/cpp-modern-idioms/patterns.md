# Modern C++ Design Patterns & Idioms

## Type Deduction

### Template Type Deduction (3 Cases)
- **When to use**: Every function template call; foundation for `auto`, `decltype(auto)`, perfect forwarding.
- **How**: Deduction depends on `ParamType`:
  1. **Ref/Pointer (non-universal)**: Strip ref from expr, pattern-match; const becomes part of `T`.
  2. **Universal Ref (`T&&`)**: Lvalue → `T = T&`; Rvalue → normal. Only case `T` deduced as reference.
  3. **Pass-by-value**: Strip ref + top-level const/volatile; arrays/functions decay to pointers.
- **Trade-offs**: Arrays preserve size only via reference. Foundation for all type deduction in C++.

### auto Deduction
- **When to use**: Variable declarations, return types (C++14), generic lambda params (C++14).
- **How**: Mirrors template deduction with one exception: `auto x = {1,2,3}` deduces `std::initializer_list<T>`. C++14 `auto` return types and generic lambda params use *template* rules (no braced-init-list magic).
- **Trade-offs**: Forces initialization, avoids type mismatches, handles unutterable types (lambdas). Pitfall: proxy types like `std::vector<bool>::reference` — use explicitly typed initializer idiom: `auto x = static_cast<bool>(expr)`.

### decltype(auto)
- **When to use**: Perfect return type forwarding; preserving references and cv-qualifiers.
- **How**: Uses `decltype` rules (not `auto`/template). `decltype((x))` with parenthesized lvalue adds `&` — dangling reference risk with locals.
- **Trade-offs**: Preserves references that plain `auto` strips. Beware `return (x);`.

### Type Viewing
- **When to use**: Debugging type deduction.
- **How**: (1) Incomplete template: `TD<decltype(x)> xType;` — compiler error reveals type. (2) `boost::typeindex::type_id_with_cvr<T>().pretty_name()` — runtime, preserves cv+refs.
- **Trade-offs**: `std::type_info::name()` strips refs/cv — unreliable.

---

## Smart Pointers

### Exclusive Ownership (unique_ptr)
- **When to use**: Single clear owner; factory return types; Pimpl owner.
- **How**: Move-only; default deleter uses `delete`; custom deleter via template arg. Same size/speed as raw pointer with stateless deleter. Converts easily to `shared_ptr`.
- **Trade-offs**: Function-pointer deleters add 1-2 words; stateful deleters increase size — prefer stateless lambdas. `T[]` form exists but prefer `vector`/`array`.

### Shared Ownership (shared_ptr)
- **When to use**: Multiple entities sharing ownership; no single owner identifiable.
- **How**: Reference-counted; control block stores strong/weak counts, deleter, allocator. Custom deleter type-erased (different deleters = same type). `make_shared` allocates object + control block together.
- **Trade-offs**: Twice raw pointer size; atomic refcount expensive. Move is cheap. Never construct multiple `shared_ptr`s from same raw pointer. Use `enable_shared_from_this` for `this` pointer safety.

### Weak Observation (weak_ptr)
- **When to use**: Caching that auto-expires; observer pattern; breaking `shared_ptr` cycles in non-hierarchical graphs.
- **How**: Augments `shared_ptr`; doesn't affect refcount; `lock()` atomically checks-and-accesses; `expired()` checks dangle state. Same size as `shared_ptr`, shares control block.
- **Trade-offs**: Control block persists until last `weak_ptr` destroyed (delays memory reclamation). Not needed for strictly hierarchical structures (use raw parent-back-pointer).

### Factory Return Pattern
- **When to use**: Factory functions returning heap-allocated objects, especially in inheritance hierarchies.
- **How**: Return `std::unique_ptr<T>` from factory. Caller can keep exclusive ownership or convert to `shared_ptr`.
- **Trade-offs**: Maximizes caller flexibility. Use `make_unique` for exception safety and no type repetition.

### Pimpl with unique_ptr
- **When to use**: Reduce compilation dependencies; hide implementation details.
- **How**: Forward-declare `Impl` in header; `unique_ptr<Impl>` member. Declare destructor + move/copy in header, **define** in `.cpp` after `Impl` complete. `= default` in `.cpp` for dtor/move; hand-write copy.
- **Trade-offs**: `shared_ptr<Impl>` needs none of these steps but `unique_ptr` correctly expresses exclusive ownership. More boilerplate, semantically correct.

---

## Move Semantics

### std::move Cast
- **When to use**: On rvalue reference params; at last use of objects to move from.
- **How**: `static_cast<T&&>(x)` — unconditional cast, no runtime code. Must `remove_reference` to guarantee rvalue-ref return.
- **Trade-offs**: Moving from `const` silently copies (const rvalue binds to `const T&` copy ctor). Never declare objects `const` if moving from them.

### std::forward Cast
- **When to use**: On universal reference params to preserve value category when forwarding.
- **How**: Conditional cast — casts to rvalue only if original argument was rvalue. Requires template type arg encoding value category. No runtime code.
- **Trade-offs**: Verbose vs `std::move`; use only for conditional forwarding. Never apply to locals eligible for RVO.

### Universal Reference Detection
- **When to use**: Classifying `T&&` in code.
- **How**: Universal ref iff (1) type deduction occurs AND (2) exact `T&&` form (no `const`, no qualifiers). `vector::push_back(T&&)` not universal (T fixed); `emplace_back(Args&&...)` is universal (Args deduced per call).
- **Trade-offs**: Misclassification → wrong cast choice (`std::move` vs `std::forward`).

### Tag Dispatch
- **When to use**: Alternative to overloading on universal references.
- **How**: Forward to an `Impl` function, passing a tag type (e.g., `std::true_type{}`) constructed from a type trait check on the deduced type.
- **Trade-offs**: Cleaner than multiple overloads; avoids universal reference greediness. Requires extra indirection layer.

### SFINAE / Constrained Templates
- **When to use**: When universal reference overloads must coexist with specific overloads (e.g., perfect-forwarding constructors + copy/move constructors).
- **How**: Use `std::enable_if_t` to disable the universal reference overload when the deduced type doesn't match criteria. Example: disable forwarding ctor when `T` is the class type itself.
- **Trade-offs**: Most powerful solution but syntactically complex. Eliminates overload ambiguity at compile time.

### Reference Collapsing
- **When to use**: Understanding how `T&&` with deduced `T = Widget&` becomes `Widget&`.
- **How**: Four rules: `T& & → T&`, `T& && → T&`, `T&& & → T&`, `T&& && → T&&`. If either ref is lvalue, result is lvalue. Occurs in template instantiation, `auto`, `typedef`/alias, `decltype`.
- **Trade-offs**: Foundation for universal references and `std::forward`. Invisible to most code but essential for correctness.

---

## Modern Idioms

### Braced Initialization
- **When to use**: Default init syntax; works everywhere, prevents narrowing, avoids most vexing parse.
- **How**: `T x{args}`. Use `()` only for non-`initializer_list` ctor on type that also has one.
- **Trade-offs**: `initializer_list` ctors hijack `{}` — `vector<int>{10,20}` is 2 elements, not 10. Know when to use `()`.

### nullptr over 0/NULL
- **When to use**: Always for null pointers.
- **How**: `nullptr` has type `std::nullptr_t`, converts to any pointer type. `0` is `int`; `NULL` is integral type.
- **Trade-offs**: Eliminates overload resolution surprises (0 calls `f(int)`, not `f(void*)`) and makes template code work correctly (deduced as pointer, not integer).

### Alias Declaration (using)
- **When to use**: Always prefer `using X = Y;` over `typedef Y X;`.
- **How**: Cleaner syntax; supports alias templates (`template<typename T> using MyList = std::list<T, MyAlloc<T>>;`).
- **Trade-offs**: Eliminates `::type` suffix and `typename` prefix inside templates. C++14 trait aliases (`remove_const_t`) exist for this reason.

### Scoped Enum (enum class)
- **When to use**: Default for all enums. Unscoped only for `tuple` field access or C APIs.
- **How**: `enum class Color { red, green, blue };` — scoped names, no implicit int conversion, forward-declarable.
- **Trade-offs**: Verbose with `std::get<>` — mitigate with `toUType` helper.

### Deleted Functions (= delete)
- **When to use**: Suppress any function: copy/move, unwanted conversions, template specializations.
- **How**: `= delete` in declaration. Works on any function. Compile-time errors.
- **Trade-offs**: Replaces C++98 private-undefined trick (link-time, member-only). Earlier error detection.

### override
- **When to use**: Every overriding virtual function in derived classes.
- **How**: Tag with `override`. Compiler verifies exact match: name, param types, constness, ref-qualifiers, return type compatibility.
- **Trade-offs**: Catches subtle signature mismatches that silently create new functions. Documents intent and helps assess impact of base class changes.

### constexpr Everywhere
- **When to use**: Variables/functions computable at compile time. Shift work to compile time.
- **How**: `constexpr` variables guarantee compile-time eval. `constexpr` functions callable at compile OR runtime. C++14 relaxes single-return restriction. `constexpr` ctors enable user-defined literal types.
- **Trade-offs**: Enables compile-time constant contexts (array bounds, template args). Not all functions can be `constexpr`.

### Thread-Safe const
- **When to use**: Classes with `mutable` state accessed by `const` member functions in multithreaded contexts.
- **How**: Protect mutable caching/lazy-eval state with `mutable std::mutex` (complex state) or `mutable std::atomic` (simple counters). Lock before modifying mutable state.
- **Trade-offs**: Data race on mutable state in `const` function is undefined behavior. Cost of synchronization vs. correctness — always choose correctness.

### noexcept
- **When to use**: Move constructors, move assignment, swap, destructors (implicit), simple getters/leaf functions. NOT casually — violation triggers `std::terminate`.
- **How**: `void f() noexcept;` — interface contract + optimization hint. Conditional: `noexcept(noexcept(expr))`.
- **Trade-offs**: Enables `std::vector` move-on-realloc optimization (falls back to copy if move isn't `noexcept`). Allows compiler to omit stack unwinding machinery. Part of type system.

---

## Lambda

### Init Capture (Move into Closure)
- **When to use**: Moving move-only types (`unique_ptr`, `thread`, `future`) into lambda closures; creating capture-time computation results.
- **How**: C++14: `[x = std::move(x)]() { ... }`. C++11 fallback: `std::bind` with bound lambda receiving moved object as parameter.
- **Trade-offs**: Enables lambdas to own resources, not just borrow. `std::bind` emulation is less readable but functional in C++11.

### Perfect-Forwarding Generic Lambda
- **When to use**: C++14 generic lambdas with `auto&&` parameters that need value-category-preserving forwarding.
- **How**: `[](auto&&... params) { return f(std::forward<decltype(params)>(params)...); }`. `decltype(param)` encodes lvalue/rvalue category for `std::forward`.
- **Trade-offs**: Generic-lambda equivalent of template perfect forwarding. Slightly verbose but correct.

### Lambda over std::bind
- **When to use**: Always prefer lambdas. `std::bind` only for C++11 move capture emulation.
- **How**: Lambdas more readable, inlineable, handle overloaded names, support short-circuit eval. `std::bind` evaluates args at bind time (breaks `&&`/`||`).
- **Trade-offs**: Lambdas generate faster/smaller code than `std::function`. `std::bind` marginal: polymorphic function objects.

---

## Concurrency

### Task-based over Thread-based
- **When to use**: Running asynchronous work; prefer `std::async` over `std::thread`.
- **How**: `auto fut = std::async(task); int result = fut.get();`. Runtime handles thread management, work-stealing, exception propagation.
- **Trade-offs**: Task-based code avoids oversubscription, provides natural return-value/exceptions channel. Use `std::thread` only when needing direct platform thread API access.

### Join-All-Paths (Thread RAII)
- **When to use**: Every `std::thread` creation.
- **How**: RAII wrapper that calls `join()` or `detach()` in destructor on all paths (including exceptions). Joinable thread destruction calls `std::terminate`.
- **Trade-offs**: Explicit `join` vs `detach` policy choice. `detach` loses parent-child relationship. Custom wrapper is mandatory for correctness.

### Void Future for One-Shot Events
- **When to use**: One-shot inter-thread signaling (initialization done, detection complete, shutdown).
- **How**: `std::promise<void>` + `std::future<void>` pair. Setter thread calls `promise.set_value()`; waiter thread calls `future.wait()`. Use `shared_future` for multiple waiters.
- **Trade-offs**: Solves condition variable pitfalls (spurious wakeups, missed wakeups). Only works once — condition variables still needed for repeated signals.

### Atomic for Concurrency
- **When to use**: Variables shared between threads (`std::atomic`). Hardware registers / memory-mapped I/O (`volatile`).
- **How**: `std::atomic<int>` guarantees atomic RMW operations and prevents tearing. `volatile` only prevents compiler from optimizing away loads/stores — zero concurrency guarantees.
- **Trade-offs**: Never use `volatile` for thread synchronization (common C++98 error). `std::atomic` may still be optimized by compiler (redundant store elimination).

---

## Tweaks

### Pass-by-Value-then-Move
- **When to use**: Function parameters that are always copied into internal storage AND have cheap move operations (constructors, setters). NOT for conditional copying or assignment operators requiring strong exception safety.
- **How**: Take parameter by value: `void f(std::string s) { member = std::move(s); }`. For lvalues: 1 copy + 1 move. For rvalues: 1 move + 1 move. Replaces separate `const T&` and `T&&` overloads.
- **Trade-offs**: Eliminates overload proliferation. Same cost as `const&` for lvalues; cheaper for rvalues. Avoid for types without cheap moves or when parameter is conditionally used.

### Emplace over Insert
- **When to use**: When constructing a new value directly into a container for the first time.
- **How**: `v.emplace_back(args...)` constructs object in-place (no temporary + move). Forward heterogeneous constructor arguments. Revert to `push_back`/`insert` when: already have the object, explicit constructors might be accidentally invoked, or inserting `shared_ptr` (prefer `make_shared`).
- **Trade-offs**: Eliminates temporary + move overhead. Pitfall: `emplace_back(nullptr)` compiles for `std::regex` (explicit ctor invoked) but throws at runtime; `push_back(nullptr)` catches at compile time.
