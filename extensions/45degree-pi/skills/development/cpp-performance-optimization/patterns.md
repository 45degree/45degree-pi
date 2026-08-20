# Patterns & Techniques — C++ Performance Optimization

> Proven optimization techniques and patterns for C++ code.

## Measurement Patterns

### Profiler-Driven Hotspot Identification
**When to use**: Any optimization effort — before making any code change
**How**: Run a sampling or instrumenting profiler on a realistic workload. Identify the 10% of functions consuming 90% of execution time. Focus optimization exclusively on those hotspots.
**Trade-offs**: Profiler overhead may skew results; sampling profilers can miss very short functions called infrequently

### RAII Stopwatch
**When to use**: Micro-benchmarking individual functions or code blocks
**How**: Implement a timer class using `std::chrono::high_resolution_clock` that records start time on construction and prints/returns elapsed time on destruction. Wrap measured code in braces with a Stopwatch instance.
**Trade-offs**: Minimal overhead (~nanoseconds); must run warm-up iterations to avoid cold-cache distortion

### Relative Performance Measurement
**When to use**: Comparing optimization alternatives
**How**: Measure baseline time, apply the change, measure again. Report as ratio (e.g., "2.3x speedup"). Run multiple trials and take the minimum for comparison to filter OS jitter.
**Trade-offs**: More reliable than absolute timings; still requires consistent test environment

### Iterative Loop Amplification
**When to use**: Measuring operations that complete in nanoseconds
**How**: Wrap the target code in a loop executing thousands or millions of iterations, measure total time, divide by iteration count. Use enough iterations to accumulate >1 second total for stable measurement.
**Trade-offs**: Loop overhead may bias results; calibrate with an empty loop of the same iteration count

## Memory Optimization Patterns

### Reserve-and-Fill
**When to use**: Building containers of known or estimated size
**How**: Call `reserve()` on `std::vector` or `std::string` before inserting elements. Prevents incremental reallocation and the resulting copies. Combines with `append()` for block-copy semantics.
**Trade-offs**: Over-reserving wastes memory; under-reserving still causes some reallocation

### Compound Assignment (`+=`)
**When to use**: String or container concatenation in loops
**How**: Replace `result = result + s[i]` with `result += s[i]`. Eliminates the temporary string created by `operator+`. The single largest win for string building — often 10x+ speedup on its own.
**Trade-offs**: None; always preferable to `operator+` for repeated concatenation

### Output Parameter (No-Copy Return)
**When to use**: Returning large objects from frequently-called functions
**How**: Pass a non-const reference parameter and write results into it, rather than returning by value. Caller reuses the same object across multiple calls (combine with `clear()`). The classic C/POSIX pattern.
**Trade-offs**: Less idiomatic than return-by-value; RVO often eliminates the need in modern C++

### Move Semantics with `noexcept`
**When to use**: Transferring ownership of dynamic resources (buffers, smart pointers)
**How**: Implement move constructor and move assignment operator. **Always mark them `noexcept`** — without it, `std::vector` falls back to copying on reallocation. Use `std::move()` to cast lvalues to rvalue references.
**Trade-offs**: Source object enters valid-but-unspecified state; `noexcept` is non-negotiable for `std::vector` compatibility

### Static Allocation over Dynamic
**When to use**: Non-container class instances with function-scope or member-scope lifetime
**How**: Declare the object directly (`Foo obj(args);`) instead of using `new`. Use `std::array<T,N>` instead of `std::vector<T>` when size is known at compile time. Use two-part construction (`init()` method) when constructor dependencies aren't ready.
**Trade-offs**: Stack overflow risk for very large objects; `init()` adds validity-state management

### Flat Data Structures
**When to use**: Traversal-heavy workloads where cache locality dominates
**How**: Prefer `std::vector` and `std::array` over node-based containers (`std::list`, `std::map`). Elements stored contiguously in memory enable hardware prefetching and dramatically reduce cache misses.
**Trade-offs**: Insert/delete in middle becomes O(n); only beneficial when traversal dominates mutation

### Master Pointer Pattern
**When to use**: Shared objects with clear ownership semantics
**How**: One `std::unique_ptr` (or `std::shared_ptr`) owns the object. All other references use raw pointers or references, documented as non-owning. Eliminates reference-counting overhead on non-owning access paths.
**Trade-offs**: Requires discipline to ensure the master outlives all non-owning references

### Fixed-Size Block Allocator
**When to use**: High-frequency allocation/deallocation of same-sized objects
**How**: Maintain a singly-linked free list of identically-sized blocks carved from a pre-allocated arena (`char` array). Override class-specific `operator new`/`delete` or provide a custom STL allocator template. Both alloc and free are O(1) and inlineable.
**Trade-offs**: Wasted memory if block size poorly matched; per-class granularity requires per-class implementation

### Arena / Region Allocation
**When to use**: Many small objects with identical lifetimes (per-frame, per-request, per-phase)
**How**: Allocate a large contiguous block upfront. Carve objects from it sequentially via pointer bump. Free all at once by resetting the arena pointer — no per-object deallocation.
**Trade-offs**: Cannot free individual objects; lifetime must be batch-oriented

### Pool Allocator with Bulk Reset
**When to use**: Phased computations where objects are created, used, then torn down together
**How**: A fixed-size block manager whose `clear()` method resets the free list, making all blocks available instantly. Never returns individual blocks to the system.
**Trade-offs**: Memory is tied up for the pool's lifetime; only suitable for bounded-lifetime phases

## Computation Optimization Patterns

### Precomputation
**When to use**: Values computable once and reused many times
**How**: Move computation to compile time (`constexpr`, template parameters), link time, or program initialization. Store the result and reuse. Hoist loop-invariant expressions (e.g., `sin(theta)`) outside loops.
**Trade-offs**: Memory-for-computation tradeoff; only worthwhile when reuse count is high

### Lazy Evaluation
**When to use**: Expensive computation on code paths that may never execute
**How**: Defer computation until the result is actually accessed. Cache the result after first computation. Two-part construction: initialize a minimal object, complete setup only when needed. Copy-on-write: share state until mutation.
**Trade-offs**: Adds complexity; first access is slow; mutability tracking requires care

### Batching
**When to use**: Operations with high per-call overhead (system calls, allocations, network)
**How**: Accumulate multiple work items and process them together. Build a heap from a vector in O(n) via `std::make_heap()` instead of O(n log n) via individual insertions. Read/write I/O in bulk blocks rather than character-by-character.
**Trade-offs**: Increases latency for individual items; requires buffering memory

### Double-Check
**When to use**: Expensive comparisons or tests
**How**: Perform a cheap test first, then only do the expensive test if necessary. Compare string lengths before comparing characters. Compare hash values before byte-by-byte comparison. Check cache before computing.
**Trade-offs**: Adds one extra cheap test on the fast path; net win when the cheap test frequently succeeds

### Optimize the Expected Path
**When to use**: Conditional branches with highly skewed probabilities
**How**: Order `if`-`else` branches by expected frequency. Put the 95% case first so only one test is evaluated in the common case. Extract rare slow paths into separate non-inlined functions (hot-cold splitting).
**Trade-offs**: Slightly harder to read; requires profiling data to determine actual probabilities

### Loop Hoisting
**When to use**: Invariant code inside loops
**How**: Cache loop-invariant function results (`strlen(s)`, `v.size()`) before the loop. Move constant expressions, invariant calculations, and variable declarations outside the loop body. Reuse containers via `clear()` instead of re-constructing each iteration.
**Trade-offs**: None; always beneficial. Modern compilers hoist simple expressions but cannot hoist function calls defined in other translation units.

### Strength Reduction
**When to use**: Expensive operations inside hot loops
**How**: Replace multiplication/division by powers of two with bit shifts (`x << 2` for `x * 4`). Replace floating-point with integer arithmetic (use integer division with rounding: `(n + d/2) / d`). Replace iterative bit-counting with closed-form expressions. Apply Horner's Rule to minimize multiplications in polynomial evaluation.
**Trade-offs**: May reduce code clarity; profile first to confirm it matters

### Inline Aggressively
**When to use**: Small, frequently-called functions in hot paths
**How**: Define functions before first use, declare with `inline`, define member functions in the class body. Use templates instead of virtual functions for compile-time dispatch. Avoid PIMPL — its double-indirection prevents inlining.
**Trade-offs**: Increases binary size; excessive inlining can bloat instruction cache

### Templates over Virtual Functions
**When to use**: Compile-time-known type sets where runtime polymorphism is unnecessary
**How**: Replace abstract interface + virtual dispatch with template parameters and static polymorphism. Enables inlining, eliminates vtable indirection, and removes the two extra memory loads per virtual call.
**Trade-offs**: Increased compile time; larger binaries; cannot switch implementations at runtime

### `switch` over `if`-`else if` Chain
**When to use**: Multi-way branching on integral or enum values
**How**: Replace long `if`-`else if` chains with `switch` statements. Compilers optimize `switch` on contiguous values to jump tables — O(1) dispatch regardless of case count. For non-contiguous values, the compiler may generate binary search.
**Trade-offs**: Only works with integral types; `switch` on strings requires hash mapping

### Perfect Minimal Hashing
**When to use**: Lookup into a small, compile-time-known key set
**How**: Design a hash function that maps each key to a unique index with zero collisions and zero unused slots. For keys with unique first letters, `key[0] - 'a'` can serve as a perfect hash. Use `gperf` to auto-generate for larger sets.
**Trade-offs**: Requires all keys known at compile time; cannot add keys at runtime

### Function Object over Function Pointer Comparator
**When to use**: Custom comparators for `std::map` or `std::sort`
**How**: Use a `struct` with `operator()` instead of a raw function pointer. Function objects can be inlined by the compiler; function pointers block inlining. Performance difference can be 2x or more.
**Trade-offs**: Slightly more verbose than a lambda or function pointer

## Concurrency Patterns

### Task-Based over Thread-Based
**When to use**: Dispatching parallel work
**How**: Use `std::async` (with `std::launch::async`) instead of raw `std::thread`. Thread creation costs ~135μs; `std::async` may reuse internal thread-pool threads (~9μs). For repeated tasks, use thread pools with task queues.
**Trade-offs**: Less control over thread affinity; `std::async` may not launch asynchronously without explicit launch policy

### Thread Pool with Task Queue
**When to use**: Repeated parallel tasks with similar duration
**How**: Create N persistent threads (N = `std::thread::hardware_concurrency()`). Feed tasks via a thread-safe queue. Waking threads process multiple work units, not just one. Eliminates per-task thread creation overhead entirely.
**Trade-offs**: Overhead for very short tasks; starvation possible with uneven task sizes

### Minimize Critical Section
**When to use**: Shared data protected by mutex
**How**: Move all non-shared work — especially I/O and computation — outside the mutex lock/unlock region. In one test, removing `cout` from inside a mutex increased throughput from 40 ops/sec to 1.25 million ops/sec.
**Trade-offs**: Requires careful analysis to ensure correctness; may require data copying before/after the critical section

### Avoid Lock Convoying
**When to use**: Multiple threads contending for the same short critical section
**How**: Limit the number of threads contending for one mutex — two is ideal. Beyond `hardware_concurrency()` threads, a lock holder may be preempted while waiters spin or suspend, creating multi-millisecond cascading stalls.
**Trade-offs**: Reduces parallelism; may require restructuring work distribution

### Avoid Thundering Herd
**When to use**: Many threads waiting on a single event or condition variable
**How**: When the event fires, all waiters become runnable simultaneously. Only one acquires the mutex and makes progress; the rest discover the work is done and suspend again. Limit the number of threads servicing a single event source.
**Trade-offs**: May require per-thread event queues or work-stealing

### Bounded Producer-Consumer Queue
**When to use**: Producer outruns consumer with unbounded buffering
**How**: Bound the queue length and block the producer when full. A queue just large enough to smooth consumer variance (often only a few elements) is sufficient. Prevents memory exhaustion and keeps the consumer from being starved of resources.
**Trade-offs**: Producer throughput limited by consumer speed; deadlock possible if consumer also produces

### Lock-Free Single Variable
**When to use**: Single shared variable (counter, flag, pointer) with simple operations
**How**: Use `std::atomic<T>` instead of a mutex-protected variable. Atomic operations compile to lock-free CPU instructions (on most platforms) and avoid kernel transitions.
**Trade-offs**: `std::atomic` with full memory fences is ~14x slower than non-atomic stores; complex multi-variable updates still require mutexes

### Message-Passing Architecture
**When to use**: Avoiding shared-memory synchronization entirely
**How**: Connect processing stages via bounded queues. Each stage is single-threaded (or internally synchronized) and communicates only through messages. Can use MPI, ZeroMQ, Unix pipes, or in-process channels.
**Trade-offs**: Adds latency; data must be copied or moved between stages

## Data Structure Selection Patterns

### Vector-First Default
**When to use**: Choosing a container without specific requirements
**How**: Start with `std::vector`. It is fastest for insertion (at end), deletion, iteration, and sorting due to cache-friendly contiguous memory. Only switch after profiling proves `vector` is the bottleneck.
**Trade-offs**: Poor for frequent front/middle insertion (O(n)); no stable iterators on modification

### Sorted Vector over Map (Build-Once, Query-Many)
**When to use**: Key-value lookups where the table is built once then queried repeatedly
**How**: Use a `std::vector<std::pair<K,V>>`, sort it, then use `std::lower_bound()` for lookups. For one-time-build, many-time-lookup workloads, the combined insert+sort+lookup time beats `std::map` (48ms vs 76ms for 100K entries).
**Trade-offs**: Insert into a sorted vector is O(n); only viable when inserts are rare

### Map-to-Unordered_Map Migration
**When to use**: Key-value lookups where iteration order is irrelevant
**How**: Replace `std::map` with `std::unordered_map`. O(1) average lookup vs O(log n). Tune with initial bucket count and `max_load_factor()`. Provide custom hash and equality function objects for non-standard key types.
**Trade-offs**: Significantly higher memory usage (~62% of buckets unused at default load factor); iteration order is arbitrary

### `operator[]` over Iterators for Vector Iteration
**When to use**: Iterating `std::vector` by index
**How**: Use `v[i]` instead of iterators. On some compilers (e.g., VS2010), `operator[]` is 83% faster because the compiler generates better code when it sees the index variable directly.
**Trade-offs**: Platform-dependent; newer compilers may produce identical code. For `std::deque`, iterators are faster.

### Member `list::sort()` — Never `std::sort()` on `std::list`
**When to use**: Sorting a `std::list` or `std::forward_list`
**How**: Use the member function `list::sort()`, which is O(n log n). `std::sort()` requires random-access iterators; on `std::list` it degrades to O(n²) by repeatedly calling `std::swap()` with bidirectional iterators.
**Trade-offs**: `list::sort()` is stable; memory allocation pattern differs from `std::sort()` on vectors

## I/O Patterns

### Bulk Read/Write over Per-Character I/O
**When to use**: File I/O larger than a few kilobytes
**How**: Pre-size a string to file size (using `seekg`/`tellg`), then call `std::istream::read()` or `std::streambuf::sgetn()` to fill it in one operation. For writing, accumulate output in a string and write once. Performance: 5x-11x faster than per-character streambuf iterators.
**Trade-offs**: Requires knowing or determining file size; entire file must fit in memory

### Avoid `std::endl`
**When to use**: Any performance-sensitive output path
**How**: Use `'\n'` instead of `std::endl`. `std::endl` inserts a newline AND flushes the stream, forcing an immediate OS write. Call `flush()` explicitly only when data must be visible immediately (e.g., before reading a response). Performance difference: ~5x.
**Trade-offs**: Output may not appear immediately; buffered output can be lost on crash

### Untie Streams
**When to use**: Programs doing interleaved input and output
**How**: Call `std::cin.tie(nullptr)` to break the tie between `cin` and `cout`. Call `std::ios::sync_with_stdio(false)` to decouple C++ streams from C stdio. Prevents expensive automatic flushes on every input operation.
**Trade-offs**: Cannot safely mix C++ streams with C stdio (`printf`/`scanf`) after decoupling
