# Chapter 10: Data Structure Selection

## Core Idea

Standard library containers share similar interfaces but differ dramatically in real-world performance -- far beyond what big-O notation suggests. Containers with identical O(1) asymptotic guarantees can differ by 10x or more in absolute time. `std::vector` is the fastest container for insertion (at end), deletion, iteration, and sorting. Understanding cache locality, memory allocation patterns, and iteration mechanisms is essential for optimal selection.

## Data Structure Performance Comparison

### Insertion (100K elements, VS2010 Release, i7)

| Container | Assign | push_back (iter) | push_front (iter) | insert(end, range) | insert(begin) |
|-----------|--------|------------------|--------------------|--------------------|----------------|
| **vector** | 0.445ms | 2.26ms | N/A | 0.696ms | 8065ms |
| **deque** | 5.70ms | 4.33ms | 5.19ms | 5.28ms | - |
| **list** | 5.10ms | 4.26ms | 4.77ms | 3.69ms | - |
| **forward_list** | - | - | 4.16ms | 4.24ms* | - |
| **map** | - | - | - | - | 33.8ms |
| **unordered_map** | - | - | - | - | 15.5ms |

\* forward_list uses `insert_after()`

### Iteration (100K elements)

| Container | Iterator | operator[] | at() |
|-----------|----------|------------|------|
| **vector** | 0.236ms | **0.129ms** | 0.230ms |
| **deque** | **0.450ms** | 0.828ms | - |
| **list** | 0.326ms | N/A | N/A |
| **forward_list** | 0.343ms | N/A | N/A |
| **map** | 1.34ms | N/A | N/A |
| **unordered_map** | 0.34ms | N/A | N/A |

### Lookup (100K elements, unordered/sorted)

| Container | Unsorted Find | Sorted Binary Search |
|-----------|---------------|---------------------|
| **vector** | O(n) | 28.92ms (`std::lower_bound`) |
| **deque** | O(n) | 35.1ms (`std::lower_bound`) |
| **list** | O(n) only | O(n) only |
| **map** | N/A | 42.3ms (`.find()`) |
| **unordered_map** | N/A | **10.4ms** (`.find()`) |

### Sort + Lookup Combined (100K elements)

| Container | Insert + Sort | Lookup | Total |
|-----------|--------------|--------|-------|
| **vector** | 19.1ms | 28.9ms | **48.0ms** |
| **map** | 33.8ms | 42.3ms | 76.1ms |
| **unordered_map** | 15.5ms | 10.4ms | 25.9ms |

## Container Deep Dive

### std::vector
- **Best for**: everything. Bjarne Stroustrup's rule: prefer `vector` unless you have a specific reason to use another container.
- **Key tricks**: Call `reserve(n)` before loops to prevent repeated reallocation. Use `assign()` or range `insert()` over per-element `push_back()` for bulk insertion (6x faster). Use `operator[]` for iteration (83% faster than iterators on VS2010). Use `swap()` with empty vector to force memory release: `vector<Foo>().swap(x)`.
- **Weakness**: Front insertion is O(n) -- 3000x slower than back insertion. Never `insert(begin(), ...)` in a loop.
- **Memory**: Does not release capacity on `clear()`. Use `shrink_to_fit()` (C++11, non-binding) or the swap idiom.

### std::deque
- **Best for**: FIFO queues where push/pop at both ends is needed with random access.
- **Reality**: 3-10x slower than `vector` for common operations. Two levels of indirection hurt cache locality. No `reserve()` equivalent. Debug-mode performance is catastrophically worse due to diagnostic code in memory allocation.
- **Bright spots**: Iteration, sorting, and lookup are only ~30% slower than `vector`.
- **Note**: It is the default underlying container for `std::queue` and `std::stack`.

### std::list
- **Best for**: frequent mid-list insert/delete with known insertion point, splice/merge operations.
- **Reality**: 10x slower than `vector` for assignment/copy. Iteration and sort only ~30% slower. Surprisingly competitive with `deque` and actually beats it for most operations tested.
- **Key feature**: Iterators/references never invalidated except when elements are removed. `splice()` and `merge()` are O(1) without copying.
- **Sort**: MUST use member `list::sort()` (O(n log n)), not `std::sort()` (O(n²) due to bidirectional iterators).
- **Lookup**: O(n) only. Not suitable as an associative container replacement.

### std::forward_list
- **Best for**: memory-constrained small processors where single pointer per node matters.
- **Reality**: On desktop/handheld hardware, performance is nearly identical to `std::list`. The overhead of per-element allocation and poor cache locality dominate.
- **Interface**: Uses `insert_after()` and `before_begin()`. No `back()`, `rbegin()`, or `size()`.

### std::map
- **Best for**: ordered key-value storage requiring logarithmic lookup and sorted iteration.
- **Reality**: Per-element node allocation. Iteration 10x slower than `vector`. Insertion hint with C++11's `end()` hint can halve insertion time (18ms → 8.56ms with sorted input). C++11 changed the best hint position from predecessor to successor.
- **Check-and-update idiom**: Use `lower_bound()` or the pair-returning `insert()` to avoid duplicate O(log n) traversals.

### std::unordered_map
- **Best for**: fast key-based lookup when order is irrelevant and memory is plentiful.
- **Reality**: Lookup is 4x faster than `std::map`, but only ~1.7x faster than `lower_bound` on a sorted `vector`. Construction is expensive due to dynamic bucket array + per-element nodes. Memory usage is high (test shows 62% of bucket array unused, 0.38 load factor).
- **Tuning**: Set initial bucket count, `max_load_factor()`, call `reserve()` or `rehash()`. The `insert()` hint parameter is ignored but still carries call overhead.
- **Inspection**: Use `bucket_count()`, `begin(i)`/`end(i)` per-bucket iterators to diagnose hash quality.

## Optimization Rules

1. Default to `std::vector` -- it is fastest for insertion, deletion, iteration, and sorting.
2. If you need lookup, consider a sorted `vector` + `std::lower_bound()` before reaching for `map`. For one-time build, many-time lookup, `vector` wins (48ms vs 76ms combined).
3. Only use `std::unordered_map` when lookup dominates and memory is not constrained. It is fastest for lookup (10.4ms) but consumes significantly more memory.
4. For `vector` insertion into loops, always `reserve()` first; use range `insert()` or `assign()` over per-element `push_back()`.
5. For `vector` iteration, prefer `operator[]` over iterators (83% faster on VS2010); for `deque`, prefer iterators over `operator[]` (80% faster).
6. Never use `std::sort()` on `std::list` -- it becomes O(n²). Use `list::sort()`.
7. Big-O performance guarantees do not capture constant-factor differences. Measure.

## Key Takeaways

1. Stepanov's STL was the first reusable, efficient container and algorithm library. It remains the gold standard.
2. `std::vector` is the universal default -- fastest at nearly everything. Its cache-friendly contiguous memory layout is its superpower.
3. `std::deque` is surprisingly slow; use only when both front and back operations with random access are genuinely required.
4. `std::list` and `std::forward_list` perform similarly on modern hardware; the single-pointer savings of `forward_list` matter mainly on embedded systems.
5. For static or rarely-modified tables, a sorted `vector` outperforms `std::map` for both construction and lookup.
6. `std::unordered_map` is the lookup champion but requires vast memory. The much-hyped advantage over `std::map` is real but not an order of magnitude.
