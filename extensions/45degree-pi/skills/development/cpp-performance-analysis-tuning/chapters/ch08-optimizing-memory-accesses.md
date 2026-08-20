# Chapter 8: Optimizing Memory Accesses

## Core Idea

Memory accesses (loads/stores) account for the largest fraction of performance bottlenecks due to the growing CPU-DRAM latency gap. Optimizing memory means designing cache-friendly data structures, reducing TLB misses via huge pages, and using explicit prefetching when hardware prefetchers fail.

## Frameworks Introduced

- **TMA Memory Bound category**: estimates the fraction of pipeline slots stalled due to demand load/store instructions.
  - When to use: TMA attributes high `MemoryBound` metric → apply one of the techniques in this chapter.
  - How: drill down to find the hottest memory-access instruction (Section 6.1.1), then choose among cache-friendly layouts, huge pages, or prefetching.

- **Heaptrack / Mtuner (memory profiler from Ch7)**: used here to identify temporary allocations.
  - When to use: check if dynamic allocations in hot code can be eliminated or batched.
  - How: `heaptrack ./app` → find temporary malloc/free pairs → replace with arena/stack allocator.

- **jemalloc / tcmalloc**: drop-in replacements for `malloc`/`free`.
  - When to use: application does many small concurrent allocations; standard allocator shows contention or fragmentation.
  - How: link `-ljemalloc` or `LD_PRELOAD=libjemalloc.so`, optionally enable THP via `MALLOC_CONF="thp:always"`.

- **Linux perf mem / perf annotate --data-type**: data-type profiling (Linux 6.8+).
  - When to use: find struct fields accessed together to guide field reordering.
  - How: `perf mem record` → `perf annotate --data-type` shows field-level access samples.

- **Intel Memory Latency Checker / lmbench**: measure theoretical vs expected memory bandwidth.
  - When to use: determine if application is bandwidth-bound.
  - How: run tools to measure max BW; compare with application BW from VTune.

## Key Concepts

- **Cache line**: smallest transfer unit between cache and memory (typically 64 bytes). Design around cache lines, not individual variables.
- **Spatial locality**: accessing nearby memory locations; enables hardware prefetchers and full cache line utilization.
- **Temporal locality**: re-accessing the same location within a short time window; keeps data hot in cache.
- **Prefetching window**: the interval from when an address is known until the value is demanded; longer window = more latency hiding.
- **Demand paging**: physical pages allocated only when first touched (minor page fault). `malloc` returns a promise, not real pages.
- **DTLB (Data TLB)**: cache for virtual-to-physical address translations for data accesses; limited entries.
- **Huge Pages (2MB/1GB)**: reduce TLB pressure by mapping large regions with fewer entries.
- **Temporary allocation**: allocation immediately followed by deallocation; target for elimination.
- **Structure splitting**: splitting a struct into hot fields and cold fields to avoid loading unnecessary data into cache.
- **Pointer inlining**: embedding a frequently-accessed pointed-to field into the parent struct to avoid an indirection.

## Mental Models

- **Row-major vs column-major traversal**: always iterate in the memory layout order; compilers rarely fix this for you.
- **Cache line thinking**: if two fields are accessed together, they belong on the same cache line; if not, they can be separated.
- **Memory bandwidth as hard limit**: once bandwidth is saturated, code optimizations (vectorization, loop unrolling) stop helping; only data reduction (quantization, compression) or faster hardware works.
- **Temporary allocation = wasted work**: every malloc/free pair that does not persist across iterations can potentially be hoisted or replaced with an arena.

## Anti-patterns

- **Pointers in hot data structures**: linked lists, trees, and pointer-chasing patterns destroy spatial locality and defeat prefetchers. Prefer contiguous storage (`std::vector`, `boost::flat_map`).
- **Blindly using standard allocators in concurrent code**: contention on `malloc` lock can become a scalability bottleneck; use jemalloc/tcmalloc or per-thread arenas.
- **Forgetting data-type padding**: rearranging struct fields from largest to smallest can reduce size significantly without any code change.
- **Over-using explicit prefetching**: non-portable, platform-specific; if prefetch hints are wrong, they pollute caches and degrade performance. Verify with cache-miss counters on every target platform.

## Code Examples

**Row-major vs column-major traversal**:
```cpp
// Bad (column-major): skips NCOLS elements per inner iteration
for (int col = 0; col < NCOLS; col++)
    for (int row = 0; row < NROWS; row++)
        matrix[row][col] = ...;

// Good (row-major): sequential access, exploits spatial locality
for (int row = 0; row < NROWS; row++)
    for (int col = 0; col < NCOLS; col++)
        matrix[row][col] = ...;
```

**Data packing with bitfields**:
```cpp
struct S {                // 3 bytes
    unsigned char a;
    unsigned char b;  =>  struct S { unsigned char a:4, b:2, c:2; }; // 1 byte
    unsigned char c;
};
```

**Structure splitting**:
```cpp
struct Point { int X, Y, Z; /* many other fields */ };
// Split into hot coords + cold info
struct PointCoords { int X, Y, Z; };
struct PointInfo { /* many other fields */ };
std::vector<PointCoords> pointCoords;
std::vector<PointInfo> pointInfos;
```

**Explicit huge pages (mmap + MAP_HUGETLB)**:
```cpp
void* ptr = mmap(nullptr, size, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB, -1, 0);
if (ptr == MAP_FAILED) throw std::bad_alloc{};
// use ptr ...
munmap(ptr, size);
```

**Transparent huge pages with madvise**:
```cpp
void* ptr = mmap(nullptr, size, PROT_READ | PROT_WRITE | PROT_EXEC,
                 MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
madvise(ptr, size, MADV_HUGEPAGE);
```

**Software memory prefetching**:
```cpp
// Baseline: random access, small prefetching window
for (int i = 0; i < N; ++i) {
    size_t idx = random_distribution(generator);
    int x = arr[idx];
    doSomeExtensiveComputation(x);
}

// Optimized: pipeline + prefetch next iteration
size_t idx = random_distribution(generator);
for (int i = 0; i < N; ++i) {
    int x = arr[idx];
    idx = random_distribution(generator);
    __builtin_prefetch(&arr[idx]);
    doSomeExtensiveComputation(x);
}
```

**Prefetching lookahead for graph traversal**:
```cpp
template <int lookahead = 8>
void Graph::update(const std::vector<Edge>& edges) {
    for (int i = 0; i + lookahead < edges.size(); i++) {
        VertexID v = edges[i].from;
        VertexID u = edges[i].to;
        this->out_neighbors[u].push_back(v);
        this->in_neighbors[v].push_back(u);
        VertexID v_next = edges[i + lookahead].from;
        VertexID u_next = edges[i + lookahead].to;
        __builtin_prefetch(this->out_neighbors.data() + v_next);
        __builtin_prefetch(this->in_neighbors.data() + u_next);
    }
}
```

## Worked Example

**Explicit Memory Prefetching for Random Access (Section 8.5)**:

A loop accesses `arr[idx]` where `idx` is a random value. Hardware prefetcher cannot predict random addresses. The prefetching window (time from address known to value needed) is essentially zero — the load is immediately demanded.

The author applies **software pipelining**: generate the random index for iteration `M+1` during iteration `M`, and issue `__builtin_prefetch(&arr[idx])` before calling `doSomeExtensiveComputation(x)`. This overlaps the cache miss latency with useful computation, fully hiding the latency (as shown in Figure 8.5 vs 8.4). The index variable becomes a loop-carried dependency in a good way — it is computed one iteration ahead of the load.

For more complex cases (graph construction, Listing 8.11), a `lookahead` template parameter (default 8) controls how many iterations ahead to prefetch, allowing experimentation to find the optimal overlap.

## Key Takeaways

1. Sequential memory access is the single most impactful optimization: it enables hardware prefetchers and full cache line utilization.
2. Use data-type profiling (`perf annotate --data-type`, Linux 6.8+) to discover field-reordering opportunities from real access patterns.
3. Temporary allocations are low-hanging fruit — identify them with Heaptrack and eliminate with arena/pool allocators.
4. When memory bandwidth is saturated, code optimizations stop helping; consider data reduction (quantization, compression) or faster hardware.
5. Huge pages (2MB/1GB) can improve TLB performance by 10-30% for workloads with large, randomly-accessed data sets. Prefer per-process THP for production; use EHP for low-latency.
6. Explicit prefetching is powerful but fragile: test on every target platform, verify cache-miss counters declined, and consider dropping if maintenance cost outweighs benefit.
7. Drop-in allocators (jemalloc, tcmalloc) often provide immediate wins for multithreaded applications without code changes.

## Connects To

- **Ch3 (Memory Hierarchy)**: foundational concepts of cache, TLB, prefetchers.
- **Ch5 (Performance Measurements)**: tools to measure bandwidth (lmbench, MLC).
- **Ch6 (TMA)**: MemoryBound category is the trigger for this chapter's techniques.
- **Ch7 (Heaptrack, memory profiling)**: tools to identify temporary allocations and memory intensity.
- **Ch9 (Optimizing Computations)**: once memory path is cleared, focus on compute bottlenecks.
- **Ch12 (Low-latency)**: huge page strategies for HFT, demand-paging mitigation.
- **Ch13 (Multithreaded)**: false sharing, custom per-thread allocators.
