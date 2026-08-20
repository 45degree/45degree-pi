# Chapter 9: Search and Sort Optimization

## Core Idea

Lookup operations appear in hotspot functions across most programs -- from compilers to browsers to databases. The optimization process is systematic: measure baseline performance, identify the abstract activity, decompose it into component algorithms and data structures, then modify or replace non-optimal components. Even within identical big-O complexity, algorithm and data structure choices can yield 3x-10x performance differences.

## Key Techniques

- **Custom Keys for std::map**: Replacing `std::string` keys with fixed-length character arrays (`charbuf`) eliminates dynamic memory allocation during both construction and lookup, yielding ~2x speedup. Using `char const*` with a custom function object comparator (not a raw function pointer) achieves ~3x speedup over the `std::string` baseline.

- **Function Object vs Function Pointer Comparators**: For `std::map<char const*, unsigned, Comp>` with a function object `struct Comp { bool operator()(char const*, char const*); }`, performance is 820ms vs 1453ms for a plain function pointer comparator. Function objects allow inlining; function pointers block it. Lambda expressions that capture nothing degrade to function pointers in some compilers (VS2012/2013).

- **Binary Search with std::lower_bound**: Among standard library binary search algorithms, `std::equal_range()` performs wasteful double traversal (calls both `lower_bound` and `upper_bound`). `std::lower_bound()` with one additional comparison is 86% faster (973ms vs 1810ms). `std::binary_search()` only returns bool, not the matching element.

- **Custom Three-Way Binary Search**: Using `strcmp()` directly in a hand-written binary search exploits the three-way return value (-1, 0, +1) to terminate early on exact match, avoiding the `<`-only two-way split of standard library algorithms. Performance: 771ms vs 973ms for `std::lower_bound` (~26% faster).

- **Hash Tables with Custom Hash Functions**: `std::unordered_map` requires both a custom hash function AND a custom equality comparator when using `char const*` keys -- the default `std::hash` hashes pointer addresses, not string content. With proper custom hash and equality function objects, performance reaches 993ms, but this is only 9% faster than the best `std::map<char const*>` variant for small tables. For large tables, the advantage grows significantly.

- **Perfect Minimal Hashing**: When the set of keys is known at compile time, a perfect minimal hash (no collisions, no unused space) can be constructed. For 26 alphabetically-ordered keys starting with unique first letters, `return key[0] - 'a'` yields a perfect minimal hash with 253ms performance -- 4x faster than `std::unordered_map`. Use `gperf` for automatic generation.

## Lookup Algorithm Performance Comparison (26-key table)

| Method | Time (ms) | Improvement |
|--------|-----------|-------------|
| std::map<std::string, unsigned> | 2307 | baseline |
| std::map<char const*, fn ptr> | 1453 | 59% |
| std::map<char const*, fn object> | 820 | 181% |
| std::find() linear search | 1425 | - |
| std::equal_range() binary | 1806 | - |
| std::lower_bound() binary | 973 | 86% over equal_range |
| find_binary_3way() (strcmp) | 771 | 134% over lower_bound |
| std::unordered_map (string) | 509 | - |
| perfect minimal hash | 195 | 161% over unordered_map |

## Sort Performance Comparison (100K elements in std::vector)

| Algorithm | Data State | Time (ms) |
|-----------|-----------|-----------|
| std::sort() | unsorted | 18.61 |
| std::sort() | sorted | 3.77 |
| std::stable_sort() | unsorted | 16.08 |
| std::stable_sort() | sorted | 5.01 |

Note: `std::stable_sort()` actually outperforms `std::sort()` in these measurements. Stable sort preserves relative order of equal elements and uses merge sort variants.

## Optimization Rules

1. Start by measuring the baseline; decompose the activity into table data structure, key data structure, comparison algorithm, lookup algorithm, and insertion/construction algorithm.
2. `std::string` as a key provides far more functionality than needed (dynamic resizing, modification) -- prefer fixed-length arrays or `char const*` with custom comparators.
3. Always use a function object (not a raw function pointer) as the comparator for `std::map` to enable inlining.
4. For `std::unordered_map` with `char const*` keys, provide BOTH a custom hash function AND a custom equality function object -- the defaults hash/compare pointer addresses.
5. When the key set is small and known at compile time, construct a perfect minimal hash for O(1) lookup with near-zero constant factor.

## Key Takeaways

1. **Stepanov's Abstraction Penalty**: The gap between standard library algorithm performance and the best hand-coded algorithm. Even with excellent big-O properties, generic code using only `<` cannot match hand-coded algorithms using `strcmp()` or domain-specific optimizations. This is the price of productivity.
2. `std::unordered_map` is faster than `std::map`, but for small tables the margin is modest (52% for string keys). The real advantage appears with large tables.
3. Static array initialization has zero runtime construction/destruction cost, while `std::map` construction involves multiple memory allocations per element.
4. Binary search algorithms require random-access iterators for O(log n) performance; using them on `std::list` degrades to O(n).
5. `std::sort()` on `std::list` is O(n²) -- use `std::list::sort()` member function instead, which is O(n log₂ n).
