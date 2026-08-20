---
name: cpp-component-methodology
description: "Large-scale C++ physical design: component packaging, #include dependency management, levelization to break compile-time cycles, encapsulation vs insulation, and hierarchical reuse. Use when making C++ architectural decisions about physical decomposition, breaking circular dependencies, or structuring library/application boundaries."
---

<!-- argument-hint: [topic, framework name, or chapter number] -->

# C++ Component-Based Physical Design Methodology
**Chapters**: 4 (Ch 0-3) | **Generated**: 2026-06-28

## How to Use

- **No arguments** — Core decision rules below are loaded; read the relevant chapter for full detail.
- **Topic** (e.g. `physical aggregation`, `levelization`, `protocol class`) — I locate and read the corresponding chapter before answering.
- **Chapter** (e.g. `ch02`) — I load that chapter's summary.
- **Browse** — Ask "what chapters are available?" for the full index.

For topics not in the Topic Index below, I read the relevant chapter file first.

---

## Core Decision Rules

| Decision | Rule | Detail |
|----------|------|--------|
| Physical vs logical | Physical design (files, `#include`, link deps) determines testability, maintainability, reusability — architecture, not implementation detail. | [ch00](chapters/ch00-motivation.md) |
| Aggregation levels | Exactly 3: Component → Package → Package Group → UOR. More is almost always wrong. | [ch02](chapters/ch02-packaging-design-rules.md) |
| Component size | **One public class per component** is the default. Colocate only for: friendship, single solution, flea-on-elephant, or likely-to-change-together. | [ch03](chapters/ch03-physical-design-factoring.md) |
| Dependencies | Must be **acyclic**, explicitly declared via metadata (manifest + allowed deps). | [ch02](chapters/ch02-packaging-design-rules.md) |
| Breaking cycles | Levelization Toolbox — 9 techniques by frequency: Escalation/Demotion → Callbacks → Dumb Data → Opaque Pointer → Redundancy → Manager Class → Factoring → Escalating Encapsulation → template specialization. | [ch03](chapters/ch03-physical-design-factoring.md) |
| Encapsulation vs Insulation | Encapsulation: clients don't rewrite. Insulation: clients don't **recompile** (stronger). 3 techniques: Protocol Class, Fully Insulating Wrapper, Procedural Interface. | [ch03](chapters/ch03-physical-design-factoring.md) |
| Layered vs Lateral | Layered doesn't scale. **Lateral**: producers/consumers as independent peers via Protocol Class/templates. Compare with CCD metric. | [ch03](chapters/ch03-physical-design-factoring.md) |
| Component properties | (1) `.cpp` first line = `#include` own `.h`; (2) all external linkage in `.cpp` declared in `.h`; (3) all `.h` declarations defined in-component; (4) access only via `#include`. Result: all physical deps derivable from `#include` alone. | [ch01](chapters/ch01-compilers-linkers-components.md) |
| Interoperability | Components must coexist in one program. Avoid: domain `#ifdef`, app deps in libs, static globals outside `main()`, hidden headers. | [ch03](chapters/ch03-physical-design-factoring.md) |
| Naming | Component = package prefix + `_` + base name (reverse-location). Package group = exactly 3 lowercase alphanumeric chars. | [ch02](chapters/ch02-packaging-design-rules.md) |
| Bindage | Internal (compile-time: typedef, inline) / External (one TU: non-inline fn, globals) / Dual (link-time: class defs, templates). Determines `.h` vs `.cpp` placement. | [ch01](chapters/ch01-compilers-linkers-components.md) |
| Open-Closed | Provide iterators so clients extend containers without modifying them. | [ch00](chapters/ch00-motivation.md) |
| Reuse economics | Treat general-purpose library code as capital asset. Check existing → demote new general-purpose code to the right level. App code = malleable; lib code = stable → enables hierarchical reuse. | [ch00](chapters/ch00-motivation.md) |

## Chapter Index

| # | Title | Key Frameworks |
|---|-------|----------------|
| [ch00](chapters/ch00-motivation.md) | Motivation | Faster/Better/Cheaper, Application vs Library, Hierarchical Reuse, Software Capital, Malleable vs Stable, Component |
| [ch01](chapters/ch01-compilers-linkers-components.md) | Compilers, Linkers, and Components | Bindage (Internal/External/Dual), Four Component Properties, Depends-On, Protocol Class, Levelization, Include Guards |
| [ch02](chapters/ch02-packaging-design-rules.md) | Packaging and Design Rules | Physical Aggregation (Component->Package->Package Group->UOR), Component Design Rules, Naming Cohesion, Hierarchical Testability, Metadata |
| [ch03](chapters/ch03-physical-design-factoring.md) | Physical Design and Factoring | Levelization Techniques, Lateral vs Layered Architecture, Encapsulation vs Insulation, Physical Interoperability, Date/Calendar Case Study |

## Topic Index

- **Aggregate / Aggregation** -> ch02
- **Application vs Library Software** -> ch00
- **Bindage (Internal/External/Dual)** -> ch01
- **CCD (Cumulative Component Dependency)** -> ch03
- **Colocation Criteria** -> ch03
- **Component (definition, properties)** -> ch00, ch01, ch02
- **Component-Private Classes** -> ch02
- **Compile-Time Dependency** -> ch01, ch03
- **Cyclic Dependencies** -> ch02, ch03
- **Demotion** -> ch00, ch03
- **Depends-On** -> ch01
- **Design Rules** -> ch02
- **Dumb Data** -> ch03
- **Encapsulation vs Insulation** -> ch03
- **Faster/Better/Cheaper** -> ch00
- **Friendship (long-distance prohibition)** -> ch03
- **Hierarchical Reuse** -> ch00
- **Hierarchical Testability** -> ch02
- **Include Guards** -> ch01
- **Insulation Techniques** -> ch03
- **Irregular Packages** -> ch02
- **Lateral Architecture** -> ch03
- **Layered Architecture** -> ch03
- **Levelization** -> ch01, ch03
- **Link-Time Dependency** -> ch01, ch03
- **Malleable vs Stable Software** -> ch00
- **Manifest & Allowed Dependencies** -> ch02
- **Metadata** -> ch02
- **Naming Conventions** -> ch02
- **ODR (One Definition Rule)** -> ch01
- **Opaque Pointer** -> ch03
- **Open-Closed Principle** -> ch00, ch03
- **Package** -> ch02
- **Package Group** -> ch02
- **Physical Design** -> ch00, ch03
- **Physical Interoperability** -> ch03
- **Primitive Operations** -> ch03
- **Procedural Interface (PI)** -> ch03
- **Protocol Class** -> ch01, ch03
- **Redundancy (technique)** -> ch03
- **Software Capital** -> ch00
- **Subordinate Components** -> ch02
- **Test Driver** -> ch02
- **Transitive Include** -> ch02
- **UOR (Unit of Release)** -> ch02
- **Uses-In-The-Interface/Implementation/Name-Only** -> ch01
- **Wrapper Component** -> ch03

## Supporting Files

- [glossary.md](glossary.md) - All key terms and their definitions
- [patterns.md](patterns.md) - All techniques, design patterns, and methodology patterns
- [cheatsheet.md](cheatsheet.md) - Quick decision reference (decision tables, thresholds, code smells)

---

## Scope & Limits

Covers process and architecture topics only. For specific implementation details (design patterns, rendering styles) and verification testing, refer to the relevant specialized skills. C++ code examples use primarily a C++98 subset (a pedagogical choice), but all methodology and principles are independent of the C++ version.
