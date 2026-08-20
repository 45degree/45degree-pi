# Chapter 7: Hot Statement Optimization

## Core Idea

Statement-level optimization is about removing instructions from the execution stream. Individual C++ statements rarely consume many machine instructions — the key is finding **amplifying factors**: loops (multiplied by iteration count), frequently-called functions (multiplied by call count), and widely-used idioms (multiplied by usage frequency). Modern compilers are excellent at optimizing simple expressions; developers should focus on what the compiler *cannot* see: alias analysis across translation units, function side effects, and design-level decisions that prevent optimization.

## Key Techniques

### Loop Optimization

- **Cache the Loop Termination Value**: Compute expensive invariant expressions (e.g., `strlen(s)`, `v.size()`) once before the loop. This alone turned an `O(n^2)` loop into `O(n)` in the case study — 20x speedup.
- **Hoist Loop-Invariant Code**: Move any computation that doesn't depend on the loop variable outside the loop. Compilers do this for simple expressions, but cannot for function calls whose bodies are in other translation units. **Pure functions** (no side effects, result depends only on arguments) are candidates.
- **Remove Unnecessary Function Calls from Loops**: Check every function call inside a hot loop — is it truly needed every iteration? Initialization calls that only need to run once are a common finding.
- **Remove Hidden Function Calls**: Object declarations, initializations, assignments, scope exits (destructors), and implicit conversions all invoke constructors, assignment operators, and destructors. Move declarations outside loops and reuse via `clear()`.
- **Loop Inversion (Put the Loop Inside the Function)**: Instead of calling a per-element function in a loop, write a function that takes the whole collection and loops internally. Saves n-1 function calls.
- **`do`-`while` vs `for`**: A `do`-`while` generates one fewer jump per iteration. However, modern compilers and instruction-level parallelism often make the difference negligible or even negative (VS2015 was 25% *slower* with `do`-`while` in one test).
- **Downcounting to Zero**: Comparing against zero can use a more efficient CPU instruction. Change `for (size_t i = 0; i < n; ++i)` to `for (int i = n-1; i >= 0; --i)`. Note: requires `int` (signed) for the zero-comparison to terminate.
- **Poll Infrequently**: Don't check for events (keyboard, termination flags) every iteration if the check is expensive. Poll every N iterations or measure elapsed time between polls.

### Function Call Optimization

- **Inline Functions**: The single most powerful optimization. Put function definitions before their first use, declare short functions `inline`, and define member functions in the class body. Inlining eliminates call/return overhead and enables further compiler optimizations (constant folding, dead branch elimination). The performance difference between Debug and Release builds largely comes from inlining.
- **Virtual Function Overhead**: Each virtual call involves two additional non-contiguous memory loads (vtable pointer dereference + vtable index). This increases cache miss probability and pipeline stalls. **Remove `virtual`** when polymorphism is unused (base class never has derived implementations).
- **Ditch Unused Interfaces**: If an abstract interface class has only one concrete implementation, remove the interface and make the methods non-virtual. Choose implementations at **link time** (different .cpp files per platform) or **compile time** (`#ifdef`) instead of at runtime via virtual dispatch.
- **Templates over Virtual Functions**: Templates resolve at compile time, enabling inlining and static dispatch. Use when the set of types is known at compile time and runtime polymorphism isn't needed.
- **PIMPL Idiom is Obsolete**: PIMPL (Pointer to IMPLementation) adds two levels of function call indirection and prevents inlining. Modern compile times are ~1% of what they were in the 1990s when PIMPL was invented. Decompose large classes into focused interfaces instead.
- **Static Members over Instance Members**: If a member function doesn't access `this` or call virtual functions, declare it `static`. Eliminates the implicit `this` pointer parameter.
- **Virtual Destructor in the Base Class**: Ensure the root of any polymorphic hierarchy has at least one virtual function — the destructor is the best candidate. This forces the vtable pointer to be at offset 0 in all derived classes, eliminating `this`-pointer adjustments on virtual calls.

### Expression Optimization

- **Simplify Expressions Manually**: Compilers cannot apply algebraic transformations (distributive law, associativity) because C++ integer arithmetic is modulo arithmetic and floating-point is approximate. Use **Horner's Rule** to minimize operations: `a*x*x*x + b*x*x + c*x + d` becomes `(((a*x + b)*x) + c)*x + d`, reducing multiplications from 6 to 3.
- **Group Constants Together**: Write `24 * 60 * 60 * days`, not `24 * days * 60 * 60`. Put constants together or use parentheses so the compiler can compute them at compile time.
- **Prefer Integer over Floating-Point**: Integer arithmetic is ~10x faster on hardware with FPUs, and vastly faster on processors without. Use integer division with rounding instead of floating-point division + round-to-int.
- **Use Efficient Operators**: Replace multiplication/division by powers of two with bit shifts (`x << 2` for `x * 4`). Replace `x * 9` with `(x << 3) + x`. Most compilers do this, but only when the operand is a compile-time constant power of two.
- **Double May Be Faster Than Float**: On x87 FPU architectures, both `float` and `double` are promoted to 80-bit internal format, but `float` requires an extra conversion step. SSE-based compilation may behave differently. **Measure on your target platform.**
- **Closed-Form over Iterative**: For bit operations (counting set bits, checking power-of-two, parity), closed-form solutions are `O(1)` vs `O(n)` iterative. Example: `n && !(n & (n-1))` tests if `n` is a power of two.

### Control Flow

- **`switch` over `if`-`else if`**: A `switch` on contiguous values compiles to a jump table — `O(1)` dispatch regardless of the number of cases. `if`-`else if` chains are `O(n)` in the worst case. For non-contiguous values, the compiler may generate binary search code (`O(log n)`).
- **Virtual Dispatch over Type-Switch**: Replace `if (type == TIGER) pounce(); else if (type == RABBIT) hop();` with virtual functions. The vtable lookup is constant-time and the design is cleaner.
- **Optimize the Expected Path**: Order `if`-`else` branches by probability. Put the 95% case first.
- **Exception Handling**: Modern compilers implement "zero-cost" exception handling — no runtime overhead on the normal execution path. Avoid manual error-code propagation which adds branches to the hot path. That said, avoid `throw()` exception specifications (deprecated in C++11); use `noexcept` only where functionally required (move constructors).

## Optimization Rules

1. **Always cache loop-invariant values** — especially function calls to `strlen()`, `size()`, or pure math functions.
2. **Move variable declarations outside hot loops** — `clear()` and reuse instead of reconstructing.
3. **Check every function call in a hot loop** — is it truly needed each iteration?
4. **Inline aggressively** — define functions before use, use `inline`, prefer templates over virtual dispatch.
5. **Remove `virtual` when the class hierarchy has no derived implementations.**
6. **Use `switch` instead of long `if`-`else if` chains** for discrete value dispatch.
7. **Group compile-time constants together** in expressions.
8. **Use integer arithmetic instead of floating-point** when possible.
9. **Avoid PIMPL in new code** — compile times are fast enough; the indirection cost is not worth it.
10. **Measure before and after** — statement-level optimizations are compiler, platform, and context sensitive.

## Code Examples

```cpp
// LOOP INVARIANT HOISTING
// BAD: strlen() called every iteration → O(n^2)
for (size_t i = 0; i < strlen(s); ++i)
    if (s[i] == ' ') s[i] = '*';

// GOOD: cache the result → O(n)
for (size_t i = 0, len = strlen(s); i < len; ++i)
    if (s[i] == ' ') s[i] = '*';

// REMOVE HIDDEN FUNCTION CALLS FROM LOOPS
// BAD: constructor + destructor + potential reallocation every iteration
for (int i = 0; i < n; ++i) {
    std::string s("<p>");
    s += process(i);
    s += "</p>";
    write(s);
}

// GOOD: reuse buffer across iterations
std::string s;
for (int i = 0; i < n; ++i) {
    s.clear();
    s += "<p>";
    s += process(i);
    s += "</p>";
    write(s);
}

// LOOP INVERSION: put the loop inside the function
// BAD: n-1 function call overheads
void replace_nonprinting(char& c) {
    if (!isprint(c)) c = '.';
}
for (size_t i = 0; i < str.size(); ++i)
    replace_nonprinting(str[i]);

// GOOD: one function call, loop internal
void replace_nonprinting(std::string& str) {
    for (size_t i = 0; i < str.size(); ++i)
        if (!isprint(str[i])) str[i] = '.';
}

// HORNER'S RULE: reduce operations
// BAD: 6 multiplications, 3 additions
double y = a*x*x*x + b*x*x + c*x + d;

// GOOD: 3 multiplications, 3 additions
double y = (((a*x + b)*x) + c)*x + d;

// INTEGER INSTEAD OF FLOATING-POINT
// BAD: floating-point division + rounding (3125 ms / 100M iterations)
unsigned q = (unsigned)round((double)n / (double)d);

// GOOD: integer division with rounding (102 ms / 100M iterations) — 30x faster
inline unsigned div_round(unsigned n, unsigned d) {
    return (n + (d >> 1)) / d;
}

// POWER-OF-TWO CHECK: closed form
// BAD: iterative — O(n) in bit width
inline bool is_power_2_iterative(unsigned n) {
    for (unsigned bits = 0; n != 0; n >>= 1)
        if ((n & 1) == 1)
            if (bits++ != 0) return false;
    return true;
}

// GOOD: closed form — O(1), ~2.3x faster
inline bool is_power_2_closed(unsigned n) {
    return n != 0 && !(n & (n - 1));
}

// TEMPLATE OVER VIRTUAL (compile-time dispatch)
// Virtual dispatch — runtime overhead
class File {
public:
    virtual int GetChar() = 0;
};

// Template — compile-time dispatch, inlinable
template <typename Impl>
class FileT {
    Impl impl_;
public:
    int GetChar() { return impl_.GetChar(); }  // can be inlined
};
```

## Key Takeaways

1. Statement-level optimization only pays off when **amplified by loops, call frequency, or widespread usage**.
2. Modern compilers are excellent at optimizing expressions and hoisting obvious loop-invariant code — focus on what they **cannot** see (function bodies in other translation units, aliasing, design-level constraints).
3. **Inlining is the king of function optimizations** — it eliminates call overhead and enables cascading optimizations. Put definitions before use, use templates, avoid PIMPL.
4. Virtual functions have measurable overhead. **Remove `virtual`** when no derived classes exist. **Use templates or link-time resolution** when runtime dispatch is unnecessary.
5. For bit-level and integer arithmetic, **closed-form solutions** dramatically outperform iterative ones. Keep *Hacker's Delight* on your shelf.
6. `double` may outperform `float` on some architectures. **Measure, don't assume.**
7. The `clear()`-and-reuse pattern for containers in loops is one of the cheapest, highest-impact optimizations available — zero redesign cost, often significant speedup.
