# Cheatsheet — C++ Performance Optimization

> Quick decision reference for performance-critical C++ code.

## Optimization Priority (in order)
| Priority | What | Impact |
|----------|------|--------|
| 1 | Use better compiler + flags (-O2, -O3, LTO, PGO) | 10-50% |
| 2 | Use better algorithms (O(n²)→O(n log n)) | 10-1000x |
| 3 | Use better libraries | 2-10x |
| 4 | Reduce memory allocation/copying | 2-10x |
| 5 | Remove unnecessary computation | 1-5x |
| 6 | Use better data structures | 1-3x |
| 7 | Increase concurrency | 1-Nx |
| 8 | Custom memory management | 1-3x |

## CPU Reality Check
| Fact | Impact |
|------|--------|
| L1 cache hit: ~4 cycles | Access patterns matter |
| L2 cache hit: ~12 cycles | Keep hot data together |
| L3 cache hit: ~40 cycles | Minimize working set |
| DRAM access: ~200 cycles | Avoid cache misses |
| Branch mispredict: ~15 cycles | Make branches predictable |
| Function call: ~5-20 cycles | Inline hot functions |
| System call: >1000 cycles | Batch OS operations |

## Data Structure Selection
| Need | First Choice | Avoid |
|------|-------------|-------|
| Contiguous, indexed access | `std::vector` | `std::list` for random access |
| Front + back insertion | `std::deque` | `std::vector` for front insert |
| Frequent middle insert/delete | `std::list` | `std::vector` for middle insert |
| Key-value lookup (ordered) | `std::map` | Linear search in vector |
| Key-value lookup (unordered) | `std::unordered_map` | `std::map` when order not needed |
| Unique sorted values | `std::set` | Maintaining sorted vector manually |

## String Optimization
| Technique | When | Gain |
|-----------|------|------|
| `s.reserve(n)` | Known size | Avoids reallocation |
| `s += "..."` vs `s = s + "..."` | Concatenation | Avoids temporary |
| `const std::string&` param | Read-only | Avoids copy |
| `std::string_view` (C++17) | Read-only substring | Zero allocation |
| `const char*` + length | Fixed content | No allocation at all |

## Loop Optimization Checklist
| Step | Technique |
|------|-----------|
| 1 | Hoist invariants out of loop |
| 2 | Cache end condition (`auto end = v.end()`) |
| 3 | Remove virtual calls from loop body |
| 4 | Remove implicit function calls (operators, conversions) |
| 5 | Consider `--i` over `i++` for iterators |
| 6 | Prefer range-for or iterators over index |
| 7 | Unroll small loops manually or via pragma |

## Allocation Reduction
| Technique | When |
|-----------|------|
| Stack allocate | Object lifetime ≤ function scope |
| `std::make_unique` / `std::make_shared` | Single allocation + exception safety |
| Object pool | Repeated alloc/free of same type |
| `std::vector::reserve` | Known or estimated size |
| Move instead of copy | Transferring ownership |
| COW (Copy-on-Write) | Rarely modified shared data |

## Concurrency Rules
| Rule | Why |
|------|-----|
| `std::async` > `std::thread` | Automatic load balancing, simpler |
| Thread count = hardware concurrency | `std::thread::hardware_concurrency()` |
| Minimize critical section size | Less contention |
| Avoid lock convoying | Stagger lock acquisition |
| Prefer `std::atomic` over mutex for single variables | Lock-free, faster |
| Use thread pool for repeated tasks | Avoid thread creation overhead |

## Memory Manager Selection
| Need | Solution |
|------|----------|
| Fixed-size objects, high frequency | Fixed-size block allocator |
| Many small, short-lived objects | Arena/region allocator |
| Per-class allocation | Class-specific `operator new` |
| Thread-local allocation | Thread-local allocator (no lock) |
| General purpose | Default `malloc`/`new` (surprisingly good) |
