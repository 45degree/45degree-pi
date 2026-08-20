# Chapter 1: Optimization Overview

## Core Idea

Performance optimization is a coding activity that improves a correct program's speed, throughput, memory footprint, and energy consumption. Unlike bug fixing (binary: exists or not), performance is a continuous variable. Optimization is iterative -- after the slowest part is improved, a new bottleneck emerges. Approach it as experimental science: observe, form a testable hypothesis, measure, and verify.

## Key Techniques

- **Use a modern compiler with optimizations enabled**: C++11 compilers provide move semantics that eliminate unnecessary copies. Simply turning on compiler optimizations (which are off by default in debug builds) can yield multi-fold speed gains. Test multiple compilers (GCC, Clang, MSVC, Intel C++) on your code -- the winner varies.

- **Use better algorithms**: Algorithm choice provides the largest potential gain. A poor sort (O(n²) insertion sort) vs. a good one (O(n log n) merge sort) can mean the difference between hours and minutes. Even for small datasets, optimal algorithms are worth using when called frequently. Precomputation, lazy computation, and caching are key optimization patterns.

- **Use better libraries**: The standard library is robust but not always tuned for performance. Specialized open-source libraries (Boost, Google Code) may provide faster implementations for I/O, strings, concurrency, and memory management. Build your own domain-specific libraries that relax safety constraints for speed. Design library APIs that minimize per-item function call overhead (e.g., provide `get_buffer()` alongside `get_char()`).

- **Reduce memory allocation and copying**: Each dynamic memory allocation costs thousands of instructions. Reducing allocations is the single most impactful optimization technique. Copy reduction often eliminates allocations as well -- constructors, assignment operators, and I/O are common copy hotspots.

- **Remove computation from hot paths**: Individual C++ statements are cheap, but executing them millions of times in a loop or event handler is expensive. Modern compilers handle micro-optimizations well, so focus on reducing the volume of work in frequently-executed paths rather than statement-level micro-tuning.

- **Choose better data structures**: Data structure choice affects insertion, iteration, search, and sort costs, memory manager usage patterns, and cache locality.

- **Increase concurrency**: Use otherwise-idle time spent waiting for I/O or user input. Exploit multiple cores to parallelize work.

## Optimization Rules

1. **Hotspot-targeted rule**: Follow the 90/10 rule -- a program spends 90% of its time in 10% of its code. Optimize only that 10%. Randomly guessing where to optimize has a low probability of success.
2. **Amdahl's Law rule**: The overall speedup S = 1 / ((1-P) + P/Sp). If the optimized portion P is small, even infinite speedup of that portion yields minimal overall improvement. Verify that the code you optimize dominates execution time.
3. **No premature pessimization**: Writing efficient code upfront takes no more time than writing inefficient code. Learn and practice efficient idioms as you code.
4. **Experiment-driven rule**: Never trust intuition about what is slow. Measure. Record predictions, changes, and results. Let the data guide you.
5. **Avoid heroic micro-optimizations of bad algorithms**: Replacing a bad algorithm with a good one dwarfs the effect of hand-tuning assembly. Learn the optimal algorithms for searching and sorting.

## Key Takeaways

1. Optimization is a normal, valuable coding activity -- not something to avoid or defer indefinitely.
2. The "don't optimize" advice applies to wasting time on the 90% of code that doesn't matter, not to writing efficient code in the first place.
3. Faster processors do not rescue inefficient code; wasted instructions accumulate at the same rate they execute.
4. Use C++11 or later for move semantics to eliminate unnecessary copying.
5. The optimization strategy is: good compiler + good algorithms + good libraries + fewer allocations + fewer copies + less computation in hot loops + right data structures + better concurrency.
