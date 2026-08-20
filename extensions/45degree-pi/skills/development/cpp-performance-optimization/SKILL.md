---
name: cpp-performance-optimization
description: "Application-level C++ performance optimization: profiling/benchmarking to find hotspots, data-structure selection, memory-allocation reduction, I/O and concurrency tuning. Start here for any C++ performance question. CPU microarchitecture topics (TMA, IPC, SIMD diagnostics, PMU events, roofline, cache coherence, false sharing, assembly throughput) → cpp-performance-analysis-tuning."
---

<!-- argument-hint: [topic, chapter number, or technique name] -->

# C++ Performance Optimization

**Chapters**: 13 | **Generated**: 2026-06-28

## How to Use This Skill

- **Load without args** — core optimization strategy
- **Specify a topic** — ask about `string optimization`, `memory management`, `concurrency`, `data structures`, `measurement`
- **Specify a chapter** — ask for `ch04` for string optimization case study
- **Specify a technique** — ask for `loop hoisting`, `custom allocator`, `binary search`

---

## Core Optimization Strategy

### The Golden Rules (in order)
1. **Use a good compiler and use it well** — optimization flags, LTO, PGO
2. **Use better algorithms** — O(n²) → O(n log n) dwarfs micro-optimizations
3. **Use better libraries** — well-tuned libraries beat handwritten code
4. **Reduce memory allocation and copying** — the #1 source of C++ overhead
5. **Remove unnecessary computation** — precompute, cache, eliminate redundant work
6. **Use better data structures** — match structure to access pattern
7. **Increase concurrency** — parallelize independent work
8. **Optimize memory management** — custom allocators for hot paths

### Measurement Discipline
- **Always measure first** — never optimize based on intuition
- **90/10 rule**: 90% of time is spent in 10% of code
- **Amdahl's Law**: maximum speedup = 1 / ((1-P) + P/N) where P is parallelizable fraction
- Use a calibrated stopwatch, run multiple trials, measure wall-clock and CPU time
- Set a baseline, set a target, measure each change

### Computer Reality vs C++ Abstraction
- Memory access is ~100x slower than register access — cache matters enormously
- Branch misprediction costs 10-20 cycles — prefer predictable branches
- Memory access is not byte-at-a-time — cache lines are 64 bytes
- Some memory is slower than others — L1/L2/L3/DRAM hierarchy
- Function call overhead is real — inline hot functions
- OS calls are expensive — batch system calls

---

## Chapter Index

| # | Title | Key Topics |
|---|-------|------------|
| [ch01](chapters/ch01-overview.md) | Optimization Overview | 90/10 rule, Amdahl, strategy, optimization as engineering |
| [ch02](chapters/ch02-computer-behavior.md) | Computer Behavior | cache, branch prediction, pipelining, memory hierarchy, OS overhead |
| [ch03](chapters/ch03-measuring-performance.md) | Measuring Performance | profiling, timing, stopwatch, experimental design, benchmarking |
| [ch04](chapters/ch04-optimizing-strings.md) | String Optimization | reserve(), compound assignment, copy elimination, char arrays |
| [ch05](chapters/ch05-optimizing-algorithms.md) | Algorithm Optimization | complexity, precomputation, caching, lazy eval, batching, hashing |
| [ch06](chapters/ch06-dynamic-variables.md) | Dynamic Variable Optimization | static alloc, smart pointers, move semantics, COW, flattening |
| [ch07](chapters/ch07-hot-statements.md) | Hot Statement Optimization | loop hoisting, inline, template vs virtual, PIMPL, expressions |
| [ch08](chapters/ch08-better-libraries.md) | Better Libraries | flat hierarchies, minimal alloc, dynamic lookup avoidance |
| [ch09](chapters/ch09-search-sort.md) | Search & Sort | binary search, hash tables, map vs unordered_map, custom keys |
| [ch10](chapters/ch10-data-structures.md) | Data Structures | vector/deque/list/map/set/unordered_map performance comparison |
| [ch11](chapters/ch11-io.md) | I/O Optimization | buffering, read strategies, call chain reduction, buffer sizes |
| [ch12](chapters/ch12-concurrency.md) | Concurrency | async, thread pools, critical sections, lock convoying |
| [ch13](chapters/ch13-memory-management.md) | Memory Management | custom allocators, fixed-size blocks, arenas, class-specific new |

## Topic Index

- **allocator** → ch13
- **Amdahl's Law** → ch01
- **async** → ch12
- **branch prediction** → ch02
- **cache** → ch02
- **concurrency** → ch12
- **copy elision** → ch06
- **data structures** → ch10
- **dynamic allocation** → ch06
- **hashing** → ch05, ch09
- **inline** → ch07
- **I/O** → ch11
- **loop optimization** → ch07
- **measurement** → ch03
- **memory management** → ch13
- **move semantics** → ch06
- **PIMPL** → ch07
- **profiling** → ch03
- **search** → ch09
- **sort** → ch09
- **smart pointers** → ch06
- **string** → ch04
- **thread pool** → ch12
- **90/10 rule** → ch01

## Supporting Files

- [glossary.md](glossary.md) — All key performance optimization terms with definitions
- [patterns.md](patterns.md) — Proven optimization techniques and patterns by category
- [cheatsheet.md](cheatsheet.md) — Quick-reference tables: optimization rules, data structure comparison, CPU facts

## 完成标准（可检验）

- [ ] **测量先行**：优化建议基于已有 profiling/benchmarking 数据；无实测数据时不给"已验证有效"的性能结论，只给测量计划（测什么、怎么测、预期瓶颈）
- [ ] **引用已有指标**：若存在前后对比数据，每条优化建议附引用的测量结果（基线值 → 目标值）；无数据则标注"待测量验证"
- [ ] **限于应用层**：建议限于算法、数据结构、分配、I/O、并发——未涉及 PMU/TMA/SIMD 等微架构级分析（那些转交 `cpp-performance-analysis-tuning`）
- [ ] **代码示例正确**：C++11/14 语法正确，可直接编译

## Scope

Covers C++ performance optimization techniques from measurement to deployment. Code examples are C++11/14.
