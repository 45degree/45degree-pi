# Chapter 8: Better Library Design

## Core Idea

Libraries form the foundation of program assembly and are often called in the innermost loops, making them hotspots. C++ standard library provides Spartan, general, fast primitives. For project-specific libraries, careful design is essential to ensure efficient use. The cardinal rule: interface stability is the core of deliverable libraries.

## Key Techniques

- **Minimal Allocation**: Move memory allocation outside library functions. Let callers pass buffers via parameters rather than having the library allocate and return memory. This enables callers to reuse storage (Chapter 6) and reduces copies when passing data between functions. If allocation is unavoidable, delegate it to derived classes and store only a pointer in the base class.

- **Flat Inheritance Hierarchies**: Most abstractions need no more than three levels of inheritance: a base class with common functions, one or more derived classes implementing polymorphism, and optionally a mixin layer. Deeper hierarchies increase the risk of extra computation on every member function call and lengthen constructor/destructor call chains.

- **Flat Call Chains**: Most abstractions need no more than three nested function calls: a strategy function, a member function call on some class, and a public/private member implementing the abstraction. Long nested call chains introduce overhead on every call and return.

- **Avoid Dynamic Lookup**: Looking up configuration or metadata by key string in JSON/XML maps is O(log n) or O(n), compared to O(1) with a tiny constant factor for struct member access. Dynamic lookup tables are opaque "bags of unnamed values" requiring extensive documentation. Prefer compile-time structs over runtime symbol tables.

- **Prefer Functions over Frameworks**: Function libraries are collections of composable components that can be independently measured and optimized. Frameworks implement complete program skeletons (window apps, web servers) and violate separation of concerns, making them hard to isolate and test. Frameworks also pull in "god functions" that link many unused library functions into the executable.

- **Add Functions, Don't Change Functionality**: When optimizing existing libraries, the safest approach is adding new functions/classes rather than modifying existing ones. New overloads accepting rvalue references can add move semantics to legacy libraries. Keep changes minimal to avoid breaking undocumented dependencies.

## Optimization Rules

1. When in doubt, bias toward speed during library design -- poor performance is hard to fix later, especially if it requires signature or behavior changes.
2. Test cases are critical: they identify coupling, help understand library usage, and catch performance regressions.
3. Parsimony (KISS) is a virtue: a library should focus on one task using minimal resources. Accept `std::istream&` rather than a filename; accept a buffer pointer rather than allocating and returning memory.
4. Compress redundant layers: review whether Façade patterns, PIMPL idioms, and DLL boundaries introduce unnecessary call layers. Excessive layering signals over-design.
5. Beware of "god functions" like `printf()` -- they pull in formatting code for every type, bloating executables (8KB vs 100 bytes for the same output using `puts()`).

## Key Takeaways

1. C++ standard library is Spartan by design -- it provides only what cannot be provided otherwise or is universally needed across operating systems.
2. No standard library implementation is perfectly conforming; bugs exist, performance is not the top priority for library maintainers, and the path from library call to native OS function can be long and winding.
3. When modifying existing libraries, change as little as possible. Adding functions is relatively safe; changing signatures or behavior breaks compatibility.
4. Design libraries the same as other C++ code, but with higher risk -- flaws affect all users. Invest in specifications, design, documentation, and tests upfront.
5. Flat is fast: keep inheritance hierarchies, call chains, and architectural layers at three or fewer.
6. Standard library efficiency may be limited; achieving the last bit of performance often requires calling native OS functions, trading portability for speed.
