# Chapter 5: Optimizing Algorithms

## Core Idea

When a program takes hours instead of seconds, switching to a better algorithm is often the only optimization that works. Most optimizations yield linear improvements; better algorithms can yield exponential ones. Know the time complexity of your operations and select algorithms that match your data characteristics. Beyond algorithmic choice, ten general optimization patterns provide a mental toolkit for improving code performance.

## Key Techniques

### Algorithm Selection

- **Time Complexity Awareness**: Understand the Big-O cost of your operations. `O(n^2)` on a million elements means 17 minutes. `O(n log n)` on the same data means ~20 ms. Know the difference.
- **Best/Worst/Average Case**: Quick sort is `O(n log n)` average but `O(n^2)` worst case (on sorted data with naive pivot selection). `std::sort()` in C++11+ uses introsort — quick sort that switches to heap sort when recursion depth is too high, guaranteeing `O(n log n)` worst case.
- **Leverage Data Characteristics**: If data is already sorted or nearly sorted, insertion sort runs in `O(n)`. Timsort (Python's default) achieves `O(n)` on sorted data and `O(n log n)` otherwise. Flash Sort runs in `O(n)` for uniformly distributed data.
- **Lookup Beyond Binary Search**: Binary search is `O(log n)` — but interpolation search is `O(log log n)` for uniform distributions, and hash tables provide average `O(1)` lookup. For n < 4, all lookup algorithms examine roughly the same number of entries.

### Optimization Patterns

- **Precomputation**: Move computation to earlier phases — design time, compile time, link time, or program initialization. Compilers precompute constant expressions like `60 * 60 * 24`. Template parameters evaluated at compile time. Design-time thinking: "weekend" is always 2 days.
- **Lazy Evaluation / Deferred Computation**: Delay computation until the result is actually needed. Avoid work on code paths that never execute. Two-part construction: build a minimal empty object in the constructor, complete initialization later when data is available. Copy-on-write: share dynamic state until mutation.
- **Batching**: Collect work items and process them together. Reduces per-item function call overhead. Building a heap from n elements in batch is `O(n)` vs. `O(n log n)` for individual insertions. Buffered I/O is a classic example.
- **Caching**: Save and reuse expensive computation results. `std::string` caches its length. Thread pools cache expensive-to-create threads. Dynamic programming caches subproblem results. Compilers cache array element addresses in registers.
- **Specialization**: Remove unused generality. `std::swap()` has a generic implementation, but a specialized version using move semantics is faster. If you only need fixed-length string comparison, use C-style arrays and `strcmp` instead of `std::string`.
- **Hashing**: Compute a compressed numeric mapping (hash) of large data structures. Compare hashes first for quick inequality checks; only do full comparison when hashes match.
- **Double-Check**: Perform a cheap test first, then only do the expensive test if necessary. Compare string lengths before comparing characters. Compare hash values before byte-by-byte comparison. Check cache before computing.
- **Optimize the Expected Path**: Order `if-else` branches by expected frequency. If one case occurs 95% of the time, test it first — only one test in 95% of cases instead of ~n/2.
- **Hinting**: Provide hints to improve operation efficiency. `std::map::insert()` accepts an optional hint iterator; with a good hint, insertion becomes `O(1)` instead of `O(log n)`.
- **Throughput**: Process data in larger chunks. Request I/O in bulk. Clear or move memory by words/longs instead of bytes. Wake threads to process multiple work units, not just one.

## Optimization Rules

1. **Replace `O(n^2)` or worse algorithms with `O(n log n)` or `O(n)` alternatives** when data sizes are large.
2. **Avoid quicksort's naive pivot selection** on data that may already be sorted — use `std::sort()` (introsort) instead.
3. **Choose algorithms based on data characteristics** — if data is nearly sorted, insertion sort or Timsort outperforms general-purpose sorts.
4. **Precompute everything you can** — at compile time (`constexpr`, template parameters) or at initialization.
5. **Batch operations** — process groups of items together instead of one at a time.
6. **Cache expensive computations** — never compute the same thing twice if you can store and reuse the result.
7. **Use double-checking** — cheap test first (hash, length), expensive test only when needed.
8. **Order conditional branches by probability** — put the most frequent case first.
9. **Provide hints to data structures** when you know the insertion position.
10. **Be skeptical of constant-time claims** — `O(1)` with a huge constant factor may be worse than `O(log n)`.

## Code Examples

```cpp
// PRE-COMPUTATION: hoist loop-invariant work
// BAD
for (size_t i = 0; i < v.size(); ++i) {
    v[i].x_ = cos(theta)*x - sin(theta)*y;
    v[i].y_ = sin(theta)*x + cos(theta)*y;
}

// GOOD
double sin_theta = sin(theta);
double cos_theta = cos(theta);
for (size_t i = 0; i < v.size(); ++i) {
    v[i].x_ = cos_theta*x - sin_theta*y;
    v[i].y_ = sin_theta*x + cos_theta*y;
}

// DOUBLE-CHECK: compare lengths before characters
// BAD
bool equals(std::string const& a, std::string const& b) {
    return a == b;  // always compares character-by-character
}

// GOOD
bool equals_fast(std::string const& a, std::string const& b) {
    return a.size() == b.size() && a == b;  // quick length check first
}

// BATCHING: build heap in batch vs. one-by-one
// BAD: O(n log n)
std::vector<int> data = {3,1,4,1,5,9,2,6};
std::priority_queue<int> pq;
for (int x : data) pq.push(x);

// GOOD: O(n)
std::vector<int> data = {3,1,4,1,5,9,2,6};
std::make_heap(data.begin(), data.end());  // batch heap construction

// CACHING: use std::string's cached length
// BAD: O(n) per call to strlen
for (size_t i = 0; i < strlen(s); ++i) { ... }

// GOOD: cache the length once
for (size_t i = 0, len = strlen(s); i < len; ++i) { ... }
```

## Key Takeaways

1. The most impactful optimization is often **replacing a bad algorithm with a good one** — the gains are multiplicative, not additive.
2. Know your data: the best algorithm for random data may be terrible for nearly-sorted data, and vice versa.
3. The ten optimization patterns (precomputation, lazy eval, batching, caching, specialization, hashing, double-check, expected path, hinting, throughput) provide a reusable mental toolkit applicable across all domains.
4. Amortized time matters: an `O(1)` amortized operation that occasionally triggers a reallocation may still be painful if reallocations happen frequently on small datasets.
5. `std::sort()` (introsort) is generally the safest choice — it guarantees `O(n log n)` worst case.
6. For lookups, hash tables give `O(1)` average, but consider interpolation search (`O(log log n)`) for sorted, uniformly-distributed data with expensive comparisons.
