# Chapter 13: Memory Management Optimization

## Core Idea

The memory manager is often a hotspot in C++ programs. However, Amdahl's Law limits improvements from replacing the allocator: studies of large open-source programs show at most ~30% overall speedup even with a 10x faster allocator. Greater gains often come from reducing allocations in the first place (Chapter 6). Still, when dynamic allocation of fixed-size objects is identified as a bottleneck, custom allocators—class-specific `operator new`/`delete` or standard library allocators—can deliver 3x–15x improvements for allocation-heavy code paths.

## Key Techniques

- **Class-specific `operator new`/`delete`**: Override `operator new(size_t)` and `operator delete(void*)` as static member functions of a class. Since all instances of the same class have identical size, a fixed-size block allocator can serve allocations with zero fragmentation, minimal overhead, and inlineable code. This avoids the global allocator's thread-safety overhead when the class is used in a single thread.

- **Fixed-size block memory manager**: Maintain a singly-linked free list of identically-sized memory blocks carved from a pre-allocated arena (a `char` array). Allocation pops a block from the free list; deallocation pushes it back. Both operations are O(1), inlineable, and require no synchronization. When the free list is empty, carve a new set of blocks from the arena. This is the simplest and fastest custom allocator pattern.

- **Arena allocator**: An arena is a contiguous block of memory from which allocations are carved in sequence. The `fixed_arena_controller` partitions a `char` array into equal-sized blocks, chaining them into a free list on first allocation. Arenas work best when objects have bounded lifetimes and can be deallocated en masse by simply resetting the arena pointer (pool semantics).

- **Block allocation pools**: When objects are created, used, and bulk-destroyed, a pool allocator never returns individual blocks—it only resets the entire pool. This eliminates per-object deallocation overhead. The pool's `clear()` method resets the free list, making all memory instantly available again. Ideal for phased computations (e.g., building a graph, processing it, then tearing it down).

- **Custom standard library allocators**: STL containers like `std::list`, `std::map`, `std::set` allocate many same-sized internal nodes. Provide a custom `Allocator` template parameter that forwards `allocate()`/`deallocate()` to a fixed-size block manager. In one test, a custom allocator for `std::list<int>` (1000 elements) was 5.6x faster than the default allocator (11.6μs vs 76μs).

- **Fixed-size string allocator**: If maximum string length is known, an allocator that ignores the requested size and always returns a fixed-size block works for `std::basic_string`. Testing `remove_ctrl()` with a 512-byte fixed-block allocator showed a 1.4x speedup (1124ms vs 2693ms), though other optimizations (Chapter 4) gave larger gains.

- **Non-thread-safe allocators are faster**: Thread-safe allocators pay synchronization overhead even when only one thread calls them (memory fences are expensive). If a class is used exclusively in one thread, a class-specific allocator without mutexes avoids this cost entirely.

- **Replace global malloc/free**: As a last resort, replace the system `malloc()`/`free()` with high-performance alternatives: TCMalloc (Google), Hoard, ptmalloc (glibc ≥ 3.7), or jemalloc. Modern OS allocators (Linux 3.7+, Windows 7+) are already highly optimized; gains are smaller than they once were.

## Optimization Rules

1. First, reduce the number of dynamic allocations (Chapter 6) before optimizing the allocator itself.
2. For classes with many short-lived instances, provide class-specific `operator new`/`delete` backed by a fixed-size block manager.
3. Pre-allocate arenas as `char` arrays with sizes tuned to expected object counts.
4. Use pool semantics (bulk reset instead of per-object deallocation) when object lifetimes are phased.
5. For STL node-based containers (`std::list`, `std::map`, `std::set`), provide a stateless custom allocator wrapping a fixed-size block manager.
6. For strings with known maximum length, use a fixed-size allocator that always returns a uniform block size.
7. If a class is single-threaded, skip synchronization in its allocator—even a single uncontended mutex incurs memory fence overhead.
8. Consider replacing the global allocator with TCMalloc/jemalloc only after exhausting class-level optimizations.
9. Use placement `new` to construct objects in pre-allocated memory, avoiding the allocator entirely for known-lifetime objects.
10. Remember: allocator benchmarks often exaggerate real-world gains; measure end-to-end program performance.

## Code Examples

### Fixed-size block memory manager (core)

```cpp
template <class Arena> struct fixed_block_memory_manager {
    struct free_block { free_block* next; };
    free_block* free_ptr_ = nullptr;
    size_t block_size_ = 0;
    Arena arena_;

    void* allocate(size_t size) {
        if (free_ptr_ == nullptr) {
            free_ptr_ = reinterpret_cast<free_block*>(arena_.allocate(size));
            block_size_ = size;
            if (free_ptr_ == nullptr) throw std::bad_alloc();
        }
        if (size > block_size_) throw std::bad_alloc();
        auto p = free_ptr_;
        free_ptr_ = free_ptr_->next;
        return p;
    }

    void deallocate(void* p) {
        if (p == nullptr) return;
        auto fp = reinterpret_cast<free_block*>(p);
        fp->next = free_ptr_;
        free_ptr_ = fp;
    }
};
```

### Class-specific operator new/delete

```cpp
class MemMgrTester {
    int contents_;
public:
    MemMgrTester(int c) : contents_(c) {}

    static void* operator new(size_t s) {
        return mgr_.allocate(s);
    }
    static void operator delete(void* p) {
        mgr_.deallocate(p);
    }

    static fixed_block_memory_manager<fixed_arena_controller> mgr_;
};

// In a .cpp file:
char arena[4004];
fixed_block_memory_manager<fixed_arena_controller>
    MemMgrTester::mgr_(arena);
```

### Minimal C++11 stateless allocator for STL

```cpp
template <typename T> struct my_allocator {
    using value_type = T;
    my_allocator() = default;
    template <class U> my_allocator(const my_allocator<U>&) {}

    T* allocate(std::size_t n, void const* = 0) {
        return reinterpret_cast<T*>(::operator new(n * sizeof(T)));
    }
    void deallocate(T* ptr, size_t) {
        ::operator delete(ptr);
    }
};

template <typename T, typename U>
inline bool operator==(const my_allocator<T>&, const my_allocator<U>&) {
    return true;
}
template <typename T, typename U>
inline bool operator!=(const my_allocator<T>& a, const my_allocator<U>& b) {
    return !(a == b);
}

// Usage:
std::list<int, my_allocator<int>> my_list;
```

### Arena controller carving blocks from a char array

```cpp
struct fixed_arena_controller {
    void* arena_;
    size_t arena_size_;
    size_t block_size_ = 0;

    void* allocate(size_t size) {
        if (block_size_ != 0) return nullptr; // already allocated
        block_size_ = std::max(size, sizeof(void*));
        size_t count = arena_size_ / block_size_;
        if (count == 0) return nullptr;

        char* p;
        for (p = (char*)arena_; count > 1; --count, p += block_size_)
            *reinterpret_cast<char**>(p) = p + block_size_;
        *reinterpret_cast<char**>(p) = nullptr;
        return arena_;
    }

    size_t capacity() const {
        return block_size_ ? (arena_size_ / block_size_) : 0;
    }
    void clear() { block_size_ = 0; }
    bool empty() const { return block_size_ == 0; }
};
```

## Key Takeaways

1. Custom allocators give the biggest wins for fixed-size, short-lived objects allocated in tight loops.
2. A fixed-size block manager is trivial to implement: a free list + an arena. Allocation/deallocation are O(1) and inlineable.
3. Class-specific `operator new` was 15x faster than `malloc()` in a raw allocation benchmark, and 3.3x faster in a random replace test.
4. For STL node containers, a stateless allocator wrapping a fixed-size block manager yielded 5.6x speedup for `std::list`.
5. Non-thread-safe allocators avoid memory fence overhead; use them when a class is confined to a single thread.
6. Pool allocators with bulk reset eliminate per-object deallocation costs for phased computations.
7. Always measure end-to-end: Amdahl's Law means even a 10x allocator speedup rarely translates to more than ~30% program speedup.
8. Modern OS allocators (glibc ptmalloc, Windows LFH) are already well-tuned; replacing them gives diminishing returns.
9. Placement `new` lets you construct objects in pre-allocated memory, bypassing the allocator entirely.
10. If a constructor throws, `operator delete` with matching signature is called; ensure your custom `operator new` has a matching `operator delete`.
