# Glossary — C++ Performance Optimization

> All key performance optimization terms, alphabetically sorted with definitions and chapter references.

## 9
- **90/10 Rule**: A program spends ~90% of its execution time in ~10% of its code; profiling identifies that 10% for optimization. (Ch 1, 3)

## A
- **Amdahl's Law**: The maximum overall speedup from optimizing a fraction P of the program is S = 1 / ((1−P) + P/Sp); small P yields small total gain. (Ch 1, 3)
- **Arena Allocator**: A memory allocator that carves blocks from a pre-allocated contiguous region and frees them all at once by resetting. (Ch 13)

## B
- **Batching**: Collecting work items and processing them together to amortize per-item function call overhead (e.g., building a heap in O(n) vs. O(n log n) individually). (Ch 5)
- **Big-O / Time Complexity**: A notation describing how an algorithm's runtime grows with input size; O(n²) vs. O(n log n) can mean hours vs. minutes. (Ch 5)
- **Bounded Producer-Consumer Queue**: A queue with a fixed capacity that blocks the producer when full, preventing runaway memory consumption. (Ch 12)
- **Branch Prediction**: CPU hardware that guesses branch outcomes; misprediction costs 10–20 cycles. Prefer computation over unpredictable branching. (Ch 2)
- **Busy-Wait**: Spinning in a loop waiting for a condition; wastes entire time slices on single-core systems — use OS synchronization primitives instead. (Ch 12)

## C
- **Cache Line**: The 64-byte unit of memory transfer between cache levels; sequential access exploits entire cache lines. (Ch 2)
- **Caching (Computation)**: Saving and reusing the results of expensive computations rather than recomputing them. (Ch 5)
- **Class-specific operator new/delete**: Overriding allocation operators as static members of a class, enabling a fixed-size block allocator with zero fragmentation and inlineable code. (Ch 13)
- **Compound Assignment (+=)**: For strings, `result += s[i]` eliminates temporary strings created by `result = result + s[i]`. (Ch 4)
- **Condition Variable**: An OS synchronization primitive (`std::condition_variable`) for efficiently waiting until a predicate becomes true. (Ch 12)
- **Context Switch**: Saving and restoring thread/process state; invalidates caches and TLB entries, causing a long recovery period of cache misses. (Ch 2)
- **Copy Elision / RVO**: A compiler optimization that constructs the return value directly in the caller's context, eliminating copy/move operations. (Ch 6)
- **Copy-on-Write (COW)**: Sharing dynamic state between copies until one instance mutates, at which point a deep copy is triggered. (Ch 5, 6)
- **Critical Section**: Code inside a mutex lock/unlock region that serializes execution; minimize its scope to maximize concurrency. (Ch 12)

## D
- **deque**: A double-ended queue with O(1) push/pop at both ends; 3–10× slower than `std::vector` for common operations due to two-level indirection. (Ch 10)
- **Double-Check**: Performing a cheap test first (e.g., comparing lengths or hashes) and only doing the expensive full comparison when the cheap test passes. (Ch 5)
- **Downcounting to Zero**: Changing `for (i = 0; i < n; ++i)` to `for (i = n-1; i >= 0; --i)` — comparing against zero can use a more efficient CPU instruction. (Ch 7)
- **Dynamic Dispatch**: Runtime resolution of virtual function calls via vtable pointer dereference; adds measurable overhead vs. static dispatch. (Ch 7)
- **Dynamic Lookup**: Resolving configuration or metadata via key lookup in runtime maps (O(log n) or O(n)) instead of compile-time struct member access (O(1)). (Ch 8)

## E
- **equal_range**: STL algorithm returning a pair of iterators via both `lower_bound` and `upper_bound`; wastes a double traversal compared to `lower_bound` alone. (Ch 9)
- **Expected Path Optimization**: Ordering `if-else` branches by probability so the most frequent case is tested first, minimizing average tests. (Ch 5, 7)

## F
- **False Sharing**: When different cores write to distinct variables residing in the same cache line, causing unnecessary cache-coherency synchronization. (Ch 2)
- **Fixed-Size Block Allocator**: A free-list-based allocator serving identically-sized blocks; O(1) allocation/deallocation, inlineable, and trivially implementable. (Ch 13)
- **Flat Call Chains**: Limiting nested function calls to ≤3 levels to avoid accumulating per-call overhead. (Ch 8)
- **Flat Data Structures**: Contiguous-memory containers (`std::vector`, `std::array`) that avoid pointer-chasing, reducing allocations and improving cache locality vs. node-based containers. (Ch 6, 10)
- **Flat Inheritance Hierarchies**: Limiting class inheritance depth to ≤3 levels (base, derived, mixin) to minimize constructor/destructor chains and per-call dispatch overhead. (Ch 8)
- **Free List**: A singly-linked list of available memory blocks in a block allocator; allocation pops from the head, deallocation pushes back. (Ch 13)
- **Function Object Comparator**: A struct with `operator()` used as a comparator for `std::map`; enables inlining, unlike raw function pointers which block it. (Ch 9)

## G
- **getline()**: Standard library function reading a line at a time; reduces per-character function call overhead for line-oriented text I/O. (Ch 11)
- **God Function**: A function like `printf()` that pulls in formatting code for every type, bloating executables — `puts()` uses 100 bytes vs. 8 KB for the same output. (Ch 8)

## H
- **Hardware Concurrency**: The number of logical cores on the machine, queried via `std::thread::hardware_concurrency()`; match compute-bound thread count to this value. (Ch 12)
- **Hashing**: Computing a compact numeric fingerprint of data; compare hashes first for quick inequality checks, full comparison only when hashes match. (Ch 5)
- **Hinting**: Providing an optional position hint to data structures (e.g., `std::map::insert(hint, ...)`) to improve insertion from O(log n) to amortized O(1). (Ch 5)
- **Hoisting**: Moving loop-invariant code (computations and function calls) outside the loop body so they execute once instead of per iteration. (Ch 7)
- **Horner's Rule**: A polynomial evaluation method rewriting `a*x³ + b*x² + c*x + d` as `(((a*x + b)*x) + c)*x + d`, reducing multiplications from 6 to 3. (Ch 7)
- **Hotspot**: A function or code region consuming a disproportionate fraction of execution time; the primary target for optimization effort. (Ch 1, 3)

## I
- **Inlining**: Replacing a function call with the function body at the call site; eliminates call/return overhead and enables further compiler optimizations. (Ch 7)
- **Introsort**: A hybrid sort (used by `std::sort`) combining quicksort with heapsort fallback to guarantee O(n log n) worst-case performance. (Ch 5)

## J
- **Jump Table**: A compiler-generated dispatch table for `switch` on contiguous values, providing O(1) case selection vs. O(n) for `if-else if` chains. (Ch 7)

## K
- **KISS (Keep It Simple, Stupid)**: A design principle favoring minimal, single-purpose library components that accept narrow interfaces (e.g., `std::istream&` instead of a filename). (Ch 8)

## L
- **L1/L2/L3 Cache**: Levels of CPU cache; each level is roughly 10× slower than the one above, with L1 fastest (~1 ns) and L3 slowest (~10–30 ns). (Ch 2)
- **Lazy Evaluation**: Deferring computation until the result is actually needed; avoids work on code paths that never execute. (Ch 5)
- **Lock Convoying**: When more threads than cores contend for a mutex, a thread holding the lock may be descheduled, causing all waiters to time out and suspend — cascading stalls. (Ch 12)
- **Loop Inversion**: Moving a per-element function call's loop inside the function itself, saving n−1 function call overheads. (Ch 7)
- **lower_bound**: STL binary search algorithm returning an iterator to the first element ≥ value; uses only `<` comparisons and is ~86% faster than `equal_range`. (Ch 9)

## M
- **make_shared**: Allocates the managed object and its reference count in a single memory block, halving allocation count vs. `new` with `shared_ptr`. (Ch 6)
- **map**: Ordered associative container with O(log n) lookup; each element is a separately allocated node, making iteration 10× slower than `std::vector`. (Ch 10)
- **Master Pointer Pattern**: One smart pointer (`unique_ptr` or `shared_ptr`) owns the object; all other references use raw pointers/references, eliminating reference-count overhead on non-owning paths. (Ch 6)
- **Memory Hierarchy**: The layered memory system from registers (fastest) through L1/L2/L3 cache, main memory (DRAM), to disk (slowest) — spanning 5 orders of magnitude in latency. (Ch 2)
- **Message Passing**: Architecture where threads communicate via queues rather than shared memory, eliminating mutex synchronization entirely. (Ch 12)
- **Move Semantics**: Transferring ownership of dynamic resources instead of copying them; enabled by move constructors, move assignment, and `std::move()`. (Ch 1, 6)

## N
- **noexcept**: A specifier required on move constructors and move assignment operators; without it, `std::vector` falls back to copying on reallocation to preserve exception safety. (Ch 6)

## O
- **Out-of-Order Execution**: Processor hardware reordering instructions to hide memory latency and keep execution units busy. (Ch 2)

## P
- **Perfect Minimal Hashing**: A hash function with zero collisions and zero unused space, computable when all keys are known at compile time (e.g., via `gperf`). (Ch 9)
- **PIMPL (Pointer to Implementation)**: An idiom hiding class implementation behind a pointer; adds two levels of indirection, prevents inlining, and is largely obsolete with modern compile times. (Ch 7)
- **Placement new**: Constructing an object at a pre-allocated memory address without calling the allocator; bypasses dynamic allocation entirely. (Ch 13)
- **Pool Allocator**: An allocator that never returns individual blocks; `clear()` resets the entire free list, making all memory instantly available — ideal for phased computations. (Ch 13)
- **Precomputation**: Moving computation to design time, compile time, link time, or program initialization to avoid runtime cost. (Ch 5)
- **Prefetching**: Hardware mechanism that detects sequential memory access patterns and fetches upcoming cache lines before they are requested. (Ch 2)
- **Profiling**: Instrumenting a program (by function entry/exit or periodic sampling) to measure cumulative time per function, revealing hotspots. (Ch 3)
- **Producer-Consumer Queue**: A bounded FIFO queue decoupling producer and consumer threads; the producer blocks when full, the consumer blocks when empty. (Ch 12)
- **pubsetbuf()**: Method to override the default `streambuf` buffer size; increasing to 8 KB can yield modest I/O speed improvements. (Ch 11)

## R
- **Relative Performance**: The ratio of optimized time to original time; cancels systematic measurement errors and is more intuitive than absolute times. (Ch 3)
- **reserve()**: Pre-allocates a container's internal storage to prevent repeated reallocation as elements are added. (Ch 4, 10)
- **Ring Buffer**: A circular buffer backed by a static or pre-allocated array; replaces `std::deque`/`std::list` FIFO queues with zero per-element allocation. (Ch 6)
- **RVO (Return Value Optimization)**: See Copy Elision. (Ch 6)

## S
- **sgetn()**: `std::streambuf` method for bulk-reading an arbitrary number of characters in one call; 5–11× faster than per-character streambuf iterators. (Ch 11)
- **Shared Ownership**: `std::shared_ptr` — reference-counted ownership; expensive because each copy/destroy performs atomic increment/decrement with full memory barriers. (Ch 6)
- **shrink_to_fit()**: C++11 method requesting the container to reduce its capacity to match its size; non-binding but useful for releasing unused memory. (Ch 10)
- **Slicing (string_view)**: Using non-owning views (`std::string_view`, `span`) to reference sub-ranges without copying the underlying data. (Ch 6)
- **Small String Optimization (SSO)**: Storing short strings directly inside the string object's internal buffer, avoiding heap allocation entirely for small strings. (Ch 4)
- **Spatial Locality**: The principle that memory addresses accessed close together in time tend to be close together in space; exploited by arrays and cache lines. (Ch 2)
- **Specialization**: Removing unused generality from an implementation for a specific, performance-critical case. (Ch 5)
- **splice()**: O(1) `std::list` member function that moves elements between lists without copying or allocating. (Ch 10)
- **Static Chain Structures**: Trees and linked lists implemented with static arrays and index-based links instead of pointer-based nodes, improving cache locality. (Ch 6)
- **Static Dispatch**: Compile-time function resolution via templates or non-virtual functions; enables inlining and avoids vtable indirection. (Ch 7)
- **Stateless Allocator**: A C++11 custom allocator with no per-instance state, usable as a template parameter for STL containers (`std::list<T, Alloc>`). (Ch 13)
- **Stepanov's Abstraction Penalty**: The performance gap between generic STL algorithms (using only `<`) and hand-coded domain-specific algorithms (e.g., using `strcmp()`'s three-way result). (Ch 9)
- **Stopwatch**: An RAII timer class that starts timing on construction and reports elapsed duration on destruction. (Ch 3)
- **std::async**: A higher-level asynchronous task launcher that may reuse threads from an internal pool; ~14× faster than raw `std::thread` for short tasks. (Ch 12)
- **std::atomic**: Atomic operations with full memory fences; ~14× slower than non-atomic stores — use only when inter-thread visibility is required. (Ch 12)
- **std::endl**: Inserts a newline AND flushes the output stream; using `'\n'` instead yields a ~5× write speedup by avoiding per-line flushes. (Ch 11)
- **streambuf Iterator**: Per-character iteration over a stream buffer; 5–11× slower than bulk-read methods like `sgetn()` or `istream::read()`. (Ch 11)
- **System Call**: A call from user space to the OS kernel; costs hundreds of times more than a function call — batch operations and use buffered libraries to amortize. (Ch 2)

## T
- **TCMalloc / jemalloc**: High-performance replacement allocators for `malloc`/`free`; modern OS allocators are already well-tuned so gains are diminishing. (Ch 13)
- **Temporal Locality**: The principle that recently accessed memory locations are likely to be accessed again soon; exploited by keeping hot code/data in cache. (Ch 2)
- **Thread Pool**: A fixed set of persistent threads that dequeue and execute tasks from a shared queue, eliminating per-task thread creation/destruction overhead. (Ch 12)
- **Throughput**: Processing data in larger chunks (words/longs instead of bytes, bulk I/O instead of per-character) to amortize per-unit overhead. (Ch 5)
- **Thundering Herd**: When many threads wait on a single event, all wake simultaneously, but only one acquires the mutex — the rest wastefully suspend again. (Ch 12)
- **Timsort**: A hybrid sort achieving O(n) on sorted/nearly-sorted data and O(n log n) otherwise; Python's default sort. (Ch 5)
- **TLB (Translation Lookaside Buffer)**: A CPU cache for virtual-to-physical address translations; invalidated on context switch, causing subsequent TLB misses. (Ch 2)
- **Two-Part Construction**: Declaring an object statically (as a member) and calling an `init()` method later when dependencies are ready, avoiding dynamic allocation. (Ch 6)

## U
- **Unique Ownership**: `std::unique_ptr` — exclusive ownership with near-zero overhead (essentially a raw pointer plus automatic `delete`). (Ch 6)
- **unordered_map**: Hash-based associative container with average O(1) lookup; ~4× faster lookup than `std::map` but consumes significantly more memory. (Ch 10)

## V
- **vector**: The fastest STL container for insertion (at end), deletion, iteration, and sorting due to contiguous cache-friendly memory; the universal default container. (Ch 10)
- **Virtual Function**: A member function resolved at runtime via vtable pointer dereference; has measurable overhead from indirect calls and blocking inlining. (Ch 7)

## Z
- **Zero-Cost Exception Handling**: Modern compiler implementation where exception handling adds no runtime overhead on the normal (non-throwing) execution path. (Ch 7)
