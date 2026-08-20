# Chapter 8: Tweaks

## Core Idea

The final chapter addresses two practical performance and correctness concerns: how to declare function parameters for copyable/movable types to minimize overhead, and when to use emplacement functions (`emplace_back`, `emplace`) instead of insertion functions (`push_back`, `insert`). Both items challenge conventional C++98 wisdom and reveal how move semantics change the design landscape.

## Items

### Item 41: Consider Pass by Value for Copyable Parameters That Are Cheap to Move
**Rule**: For parameters that you always end up copying, pass by value and `std::move` into place -- if the type is cheap to move and always copied.
**When to apply**: When a function unconditionally copies its parameter into internal storage (constructor, setter) AND the type has a cheap move operation. Do NOT use for assignment operators where the old state matters, or when the lvalue case is overwhelmingly common.
**Key example**:
```cpp
class Widget {
    std::string name;
    std::vector<int> data;
public:
    // C++98 style: two overloads or const& only
    void setName(const std::string& n) { name = n; }  // always copies

    // Modern style: pass by value + move
    void setName(std::string n) {          // n is a copy
        name = std::move(n);               // move into member
    }

    // Constructor version -- ideal candidate
    Widget(std::string n, std::vector<int> d)
        : name(std::move(n)), data(std::move(d)) {}

    // Counter-example: assignment operator
    Widget& operator=(Widget rhs) {        // OK, but different tradeoffs
        std::swap(name, rhs.name);         // copy-and-swap idiom
        return *this;
    }
};
```
**Why it matters**: 
- For lvalue arguments: pass-by-value does one copy (parameter construction) + one move (internal storage). The `const&` approach also does one copy. So the cost is nearly identical for cheap-to-move types.
- For rvalue arguments: pass-by-value does one move (parameter construction) + one move (internal). The `const&` approach still does one copy -- which could be expensive.
- Pass-by-value eliminates overload proliferation (no need for both `const T&` and `T&&` overloads).
- Caveat: do NOT use pass-by-value for assignment operators where you need strong exception safety via copy-and-swap (then pass by value is fine) or for types without cheap moves (like `std::array` of large objects).
- The rule only applies when the function always makes a copy. If the parameter is conditionally copied, `const&` is still better.

### Item 42: Consider Emplacement Instead of Insertion
**Rule**: Use `emplace_back` / `emplace` instead of `push_back` / `insert` when constructing a new value directly into the container.
**When to apply**: When you are creating a new object whose value will live in the container, especially if the object is expensive to move or the constructor arguments differ from the stored type. Use with caution when the container manages resource lifetime (e.g., `shared_ptr`) or when explicit constructors matter.
**Key example**:
```cpp
std::vector<std::string> vs;

// push_back: creates a temporary, then moves or copies it
vs.push_back(std::string("hello"));  // temporary created
vs.push_back("hello");               // implicit temporary (same)

// emplace_back: constructs in-place, no temporary
vs.emplace_back("hello");            // string constructed directly in vector
vs.emplace_back(50, 'x');            // "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."

// Emplacement avoids temporary + move for heterogeneous types
std::vector<std::pair<std::string, int>> vp;
vp.push_back({"key", 42});           // temporary pair created, then moved
vp.emplace_back("key", 42);          // pair constructed in-place, no move

// DANGER: emplace_back + explicit constructor interaction
std::vector<std::regex> regexes;
regexes.push_back(nullptr);          // ERROR: std::regex(nullptr) is explicit
regexes.emplace_back(nullptr);       // COMPILES but may throw at runtime!
```
**Why it matters**:
- **Performance**: Emplacement constructs the object directly inside the container's storage, eliminating a temporary + move (or two copies). The advantage grows with expensive-to-move types.
- **Heterogeneous forwarding**: Emplacement forwards arbitrary constructor arguments; insertion requires a pre-built object. This enables construction with arguments that match a non-primary constructor.
- **Pitfall 1 -- explicit constructors**: Emplacement uses direct-initialization, which invokes explicit constructors. Insertion uses copy-initialization, which rejects them. This can silently compile buggy code (e.g., `emplace_back(nullptr)` for `std::regex`).
- **Pitfall 2 -- resource management**: With `std::shared_ptr`, emplacement may construct from raw pointer arguments, breaking the `make_shared` optimization and potentially causing memory leaks if an exception is thrown before the container takes ownership.
- **Heuristic**: In general, prefer emplacement. Revert to insertion when: (a) you already have the object and want to insert it, (b) explicit constructors might be invoked accidentally, or (c) you're inserting `shared_ptr` and the `new` expression should be protected by `make_shared`.

## Key Takeaways

1. **Pass by value + move** replaces `const&` overloads when the type is always copied and cheap to move -- eliminates overload proliferation with minimal performance cost.
2. **Emplace beats insert** when constructing new values into containers -- avoids temporary objects, can forward heterogeneous arguments, and often generates better code.
3. **Beware explicit constructors** with emplacement -- they compile silently and can cause runtime errors that insertion would have caught at compile time.
4. **Both items are "consider" not "always"** -- the optimal choice depends on the specific type, usage pattern, and whether the function unconditionally copies or conditionally uses the parameter.
