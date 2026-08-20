# Chapter 4: Optimizing Strings

## Core Idea

`std::string` is dynamically allocated, behaves as a value (copies on assignment), and triggers frequent memory allocations. In programs like Chromium, `std::string` accounts for half of all memory manager calls. The optimization strategy is simple: **remove memory allocations and related copies**. Each removed allocation can yield dramatic speedups — the case study in this chapter went from 24.8 µs to 0.15 µs per call (~165x faster).

## Key Techniques

- **Compound Assignment (`+=`)**: Replace `result = result + s[i]` with `result += s[i]`. Eliminates temporary strings created by each concatenation. The single biggest win — 13x speedup in the case study.
- **`reserve()`**: Call `result.reserve(s.length())` before building a string. Prevents repeated reallocation as the string grows. Improves cache locality. ~17% additional speedup.
- **`const&` Parameters**: Pass strings by const reference instead of by value. Avoids copying the argument string. However, be aware that references are implemented as pointers, so each access requires a dereference. Use iterators to mitigate the dereference cost.
- **Iterators**: Cache `s.end()` at loop initialization. Iterators are simple char pointers; they eliminate the pointer dereference overhead of const-reference parameters. Typically faster than index-based access.
- **Output Parameters**: Return results via `std::string&` reference parameter instead of by value. Eliminates the return-value copy. Caller reuses the same string across multiple calls. ~2% additional speedup but alters the interface.
- **C-style Character Arrays**: For extremely tight performance requirements, use fixed-size `char[]` buffers on the stack. Zero dynamic allocation. 6x faster than the best `std::string` version in the case study. Tradeoff: manual memory management, less safe.
- **Better Algorithms**: Copy blocks of characters instead of one character at a time. Use `result.append(s, b, i-b)` or `s.erase()` to mutate in place. The block-copy approach achieved a 36x speedup over the original.
- **Better String Libraries**: Consider `std::string_view` (no-ownership substring view), `folly::fbstring` (small-string optimization), or expression templates for concatenation.
- **Better Allocators**: Custom allocators (e.g., fixed-size block allocators) for `std::basic_string` can yield significant speedups. Use a project-wide typedef to allow easy experimentation.
- **Eliminate String Conversions**: Avoid converting C-strings to `std::string` unnecessarily. Return `char const*` from functions when possible, deferring conversion to the point of use. Pick one encoding format (e.g., UTF-8) project-wide to avoid charset conversions.

## Optimization Rules

1. **Use `+=` instead of `+` for string concatenation** — this is typically the largest single win.
2. **Always `reserve()` when you know or can estimate the final size**.
3. **Pass strings by `const&`, never by value.**
4. **Return strings via output reference parameter when the same variable is reused across calls.**
5. **Use iterators and cache `end()` at loop initialization.**
6. **Prefer `append()` over `substr()` + `+=` to avoid intermediate temporaries.**
7. **Never declare temporary strings inside loops** — move the declaration outside and call `clear()`.
8. **Return `char const*` from simple accessors** instead of converting to `std::string`.
9. **Define a project-wide `typedef` for the string type** to allow experimenting with alternative string implementations or allocators.
10. **Consider `std::stringstream`** when building strings via repeated `<<` insertions — it behaves as an entity (no temporaries) and reuses its internal buffer.

## Code Examples

```cpp
// BEFORE: Original — extremely slow
std::string remove_ctrl(std::string s) {
    std::string result;
    for (int i = 0; i < s.length(); ++i)
        if (s[i] >= 0x20)
            result = result + s[i];  // allocates a new temp string every iteration!
    return result;
}

// AFTER: Optimized — compound assignment + reserve + const& + iterators + output param
void remove_ctrl_fast(std::string& result, std::string const& s) {
    result.clear();
    result.reserve(s.length());
    for (auto it = s.begin(), end = s.end(); it != end; ++it)
        if (*it >= 0x20)
            result += *it;
}

// AFTER: Block-copy algorithm — even faster for large strings
void remove_ctrl_block(std::string& result, std::string const& s) {
    result.clear();
    result.reserve(s.length());
    for (size_t b = 0, i = 0, e = s.length(); b < e; b = i + 1) {
        for (i = b; i < e && s[i] >= 0x20; ++i) ;
        result.append(s, b, i - b);  // no temporary, copies a whole block at once
    }
}

// AFTER: C-style — fastest, no dynamic allocation
void remove_ctrl_cstrings(char* destp, char const* srcp, size_t size) {
    for (size_t i = 0; i < size; ++i)
        if (srcp[i] >= 0x20)
            *destp++ = srcp[i];
    *destp = 0;
}
```

### Avoiding Unnecessary Conversions

```cpp
// BAD: Converts to std::string at every call site
std::string MyClass::Name() const { return "MyClass"; }

// GOOD: Defers conversion; no overhead if caller only needs a C-string
char const* MyClass::Name() const { return "MyClass"; }
```

### Reusing Strings Across Loop Iterations

```cpp
// BAD: allocates and deallocates config every iteration
for (auto& filename : namelist) {
    std::string config;
    ReadFileXML(filename, config);
    ProcessXML(config);
}

// GOOD: reuses the internal buffer
std::string config;
for (auto& filename : namelist) {
    config.clear();
    ReadFileXML(filename, config);
    ProcessXML(config);
}
```

## Key Takeaways

1. String performance problems are almost always caused by **unnecessary memory allocation and copying**.
2. The `+=` operator is the single most impactful optimization for string building — it eliminates temporary strings.
3. `reserve()` is cheap insurance against repeated reallocation; use it whenever you can estimate the final size.
4. Block-level operations (`append()`, `erase()`) outperform character-by-character loops because they reduce both allocation frequency and the number of operations.
5. `std::string` is a general-purpose tool — for extreme performance requirements, consider C-style arrays, `string_view`, or specialized string libraries.
6. Moving string declarations outside loops and reusing buffers is a low-effort, high-impact pattern applicable to many scenarios beyond strings.
