# Chapter 6: Dynamic Variable Optimization

## Core Idea

After inefficient algorithms, misuse of dynamically allocated variables is the largest performance killer in C++ programs. A single heap allocation costs thousands of memory accesses — removing even one allocation from a hot loop or frequently-called function yields measurable speedup. The goal is not to avoid dynamic variables entirely, but to eliminate *unnecessary* calls to the memory manager. Use static allocation, smart pointers, move semantics, copy elision, and flat data structures strategically.

## Key Techniques

### Reduce Dynamic Variable Usage

- **Static Allocation of Class Instances**: Most non-container class instances can and should be allocated statically. Use `MyClass obj("hello", 123);` instead of `new MyClass("hello", 123)`. The Java-style `new` pattern is a common anti-pattern in C++.
- **Two-Part Construction**: When construction dependencies aren't ready at object creation time, declare the object as a member and provide an `init()` member function. This avoids dynamic allocation and allows `init()` to return error codes (which constructors cannot).
- **`std::array` instead of `std::vector`**: When size is known at compile time, `std::array` provides the same interface without any dynamic allocation. Performance is nearly identical to C-style arrays.
- **Stack-based Large Buffers**: For temporary string or buffer operations, allocate generous fixed-size arrays on the stack (e.g., `char tmp[10000]`). Copying ~10KB on the stack is often cheaper than the dynamic allocation overhead.
- **Static Chain Structures**: Define trees and linked lists using static arrays with index-based links instead of pointer-based nodes. Calculating child indices (`2*i`, `2*i+1`) replaces pointer storage — eliminates allocation overhead and improves cache locality.
- **Ring Buffers**: Replace `std::deque` or `std::list` FIFO queues with a circular buffer backed by a static or pre-allocated array. No per-element allocation, just index arithmetic.

### Smart Pointer Tradeoffs

- **`std::unique_ptr`**: Lightweight ownership. Overhead is near-zero — essentially a raw pointer with automatic `delete`. Use as the "master pointer" that owns a dynamic variable.
- **`std::shared_ptr`**: Shared ownership with reference counting. **Expensive**: each copy/destroy performs an atomic increment/decrement with full memory barriers. Only use when ownership truly must be shared across unpredictable lifetimes.
- **`std::make_shared`**: Allocates the object and reference count in a single memory block, halving the allocation count for `shared_ptr`. Always use `make_shared` instead of `new` with `shared_ptr`.
- **Never pass `shared_ptr` by value to functions that don't need ownership**: Pass `Foo*` or `Foo&` instead. Passing `shared_ptr` unnecessarily adds atomic ref-count operations on every call.
- **Master Pointer Pattern**: One `unique_ptr` or `shared_ptr` owns the object; all other references use raw pointers or references (documented as "non-owning"). Eliminates reference-counting overhead on the non-owning paths.

### Eliminate Unnecessary Copies

- **Delete Copy Operations**: For entity objects (mutexes, resource handles, large state containers), declare copy constructor and assignment operator as `= delete` (C++11) or `private` (C++03). Prevents accidental expensive copies at compile time.
- **Pass by `const&`**: Replace value parameters with const references. Eliminates the copy-construction of the parameter. Especially critical for containers — passing `std::list<int>` by value copies every element.
- **Return by Output Parameter**: Instead of returning a value (which may trigger copy construction), take a reference parameter and write results into it. This is the "copy-free" pattern used throughout the C and POSIX I/O libraries.
- **Copy-on-Write (COW)**: Share dynamic state between copies via `shared_ptr`. Only deep-copy when one instance mutates. Effective when copies are frequent but mutations are rare. Requires care with `make_shared` for efficiency.
- **Slicing (string_view)**: Use non-owning views (`string_view`, `span`) to reference sub-ranges without copying. Ensure the view's lifetime does not exceed the underlying data's lifetime.

### Move Semantics (C++11)

- **Move Constructor / Move Assignment**: Transfer ownership of dynamic resources instead of copying them. Compiler auto-generates these if no copy operations or destructor are user-declared. Explicitly `= default` or implement them for classes with dynamic members.
- **`std::move()`**: Casts an lvalue to an rvalue reference, enabling move instead of copy. Use when you know the source object won't be used afterward.
- **`noexcept` on Move Operations**: **Critical for `std::vector` compatibility**. Without `noexcept`, `std::vector` falls back to copying on reallocation (to preserve strong exception safety). Always mark move constructors and assignment operators as `noexcept`.
- **Move superclass and member data**: In your move constructor, use `std::move()` on the base class and each member. Plain pointers can be swapped via `std::swap()`.
- **RVO beats move, value return beats rvalue-ref return**: Return by value and let the compiler apply Return Value Optimization. Returning `T&&` prevents RVO and forces an extra move. Return values, not rvalue references.
- **RVO Limitations**: RVO only works when the compiler can determine that all return paths return the same local object. Complex functions with multiple return paths may not qualify. Output parameters are a deterministic alternative.

### Flat Data Structures

- **Contiguous memory beats pointer-chasing**: `std::vector` and `std::array` are "flat" — elements stored contiguously. `std::list`, `std::map`, `std::unordered_map` scatter elements across the heap. Flat structures have fewer allocations, less memory overhead (no per-node pointers), and dramatically better cache locality.
- **Prefer `std::vector`** over node-based containers when the primary operation is iteration, even if both have the same Big-O complexity. The constant factor difference can be 10-50x due to cache effects.
- **Move semantics make flat data structures viable**: Before C++11, storing non-copyable objects in `std::vector` required wrapping them in `shared_ptr`. Move semantics allow direct storage of non-copyable movable types in flat containers.

## Optimization Rules

1. **Allocate statically whenever possible** — automatic and static storage have zero runtime allocation cost.
2. **Use `std::unique_ptr` for exclusive ownership**; use raw pointers/references for non-owning access.
3. **Use `std::make_shared` instead of `new` with `std::shared_ptr`** — halves allocations.
4. **Never pass `shared_ptr` by value** when a raw pointer or reference suffices.
5. **Mark move constructors and move assignment operators as `noexcept`** or `std::vector` will copy instead of move.
6. **Delete copy operations for entity types** — prevents accidental deep copies.
7. **Pass by `const&` instead of by value** for all non-trivial types.
8. **Return results via output parameter** when deterministic copy elimination is needed.
9. **Prefer `std::vector` over node-based containers** for iteration-heavy workloads.
10. **Move variable declarations outside loops** — `clear()` and reuse instead of re-constructing.

## Code Examples

```cpp
// STATIC vs DYNAMIC ALLOCATION
// BAD: unnecessary heap allocation
MyClass* obj = new MyClass("hello", 123);
// ...
delete obj;

// GOOD: automatic storage
MyClass obj("hello", 123);

// TWO-PART CONSTRUCTION
class ExpensiveObject {
    bool initialized_ = false;
public:
    bool init(Config const& cfg) { /* ... */ return true; }
    bool is_ready() const { return initialized_; }
};

// SMART POINTER OWNERSHIP
// Master pointer owns the object
std::unique_ptr<Foo> master = std::make_unique<Foo>();

// Non-owning references for function calls
void process(Foo& f);       // preferred: signals non-null, non-owning
void process(Foo* f);       // alternative: may be null

process(*master);           // no reference-count overhead

// MOVE SEMANTICS: noexcept is critical for std::vector
class Buffer {
    std::unique_ptr<char[]> data_;
    size_t size_;
public:
    Buffer(Buffer&& other) noexcept              // noexcept required!
        : data_(std::move(other.data_))
        , size_(other.size_) {
        other.size_ = 0;
    }
    Buffer& operator=(Buffer&& other) noexcept { // noexcept required!
        data_ = std::move(other.data_);
        size_ = other.size_;
        other.size_ = 0;
        return *this;
    }
};

// COPY ELISION: let RVO work
// GOOD: compiler can apply RVO
std::vector<int> make_vector(int n) {
    std::vector<int> result;
    result.reserve(n);
    for (int i = 0; i < n; ++i) result.push_back(i);
    return result;  // RVO eliminates the copy
}

// BETTER: output parameter — deterministic, no RVO dependence
void make_vector(int n, std::vector<int>& result) {
    result.clear();
    result.reserve(n);
    for (int i = 0; i < n; ++i) result.push_back(i);
}

// LOOP HOISTING: reuse dynamic buffers
// BAD: allocates every iteration
for (auto& file : files) {
    std::string content;
    read_file(file, content);
    process(content);
}

// GOOD: reuses the buffer
std::string content;
for (auto& file : files) {
    content.clear();
    read_file(file, content);
    process(content);
}
```

## Key Takeaways

1. Dynamic allocation is expensive — **thousands of memory accesses** per call. Even one removed allocation in a hot path is worth the effort.
2. **`std::unique_ptr` has near-zero overhead**; use it liberally for ownership. **`std::shared_ptr` is expensive**; use it only when ownership truly must be shared.
3. Move semantics are powerful but subtle: **always mark move operations `noexcept`** for `std::vector` compatibility, and **return by value** (not rvalue reference) to enable RVO.
4. **Flat data structures (`vector`, `array`) dominate node-based structures** (`list`, `map`) in iteration performance due to cache locality, even when Big-O complexity is the same.
5. The **"copy-free" pattern** (output parameters through layers of library calls) is a battle-tested design for performance-critical paths.
6. **Two-part construction** and **loop hoisting** are low-effort patterns that eliminate allocations without sacrificing safety or readability.
