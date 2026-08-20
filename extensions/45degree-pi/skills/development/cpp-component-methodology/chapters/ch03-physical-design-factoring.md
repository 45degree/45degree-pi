# Chapter 3: Physical Design and Factoring

## Core Idea
Software has a physical dimension: in addition to logical design, compile-time/link-time dependencies, the absolute position of components, and the hierarchical reuse structure are equally important. Purely logical design does not scale; only by distributing logical content "physically" into an acyclic hierarchy of components, packages, and package groups can long-term maintainable, reusable Software Capital be achieved.

## Frameworks Introduced

- **Thinking Physically**: The software design space is anisotropic, with an inherent "up/down" direction and absolute positions.
  - When to use: Every design decision must answer "which layer of the physical hierarchy should this functionality live in."
  - How: Every public entity must be tagged with a package prefix, forcing designers to think about its physical location and dependencies globally and early.

- **Four Criteria for Class Colocation**: The default is one class per component; multiple public classes may be colocated only in the following four situations.
  - When to use: Deciding whether to place two or more public classes in the same component.
  - How: (1) Friendship (most common, e.g., a container and its iterator); (2) Implied Cyclic Physical Dependency (splitting would create a cyclic dependency, rare and usually refactorable); (3) Single Solution (mutually independent, small, useless alone, together forming a complete solution, e.g., placeholder classes for variadic macros); (4) Flea on an Elephant (extremely lightweight and closely cooperating, e.g., a ScopedGuard for a Logger).

- **Nine Levelization Techniques**: Used to break cyclic physical dependencies and reduce excessive coupling.
  - When to use: When an upward physical dependency or cycle arises between two components.
  - How: Escalation (move mutually dependent functionality upward) / Demotion (move common functionality downward) / Opaque Pointers (use by name only) / Dumb Data (replace pointers with integer indices) / Redundancy (a small amount of duplication to avoid coupling) / Callbacks (five flavors: data/function/Functor/Protocol/Concept) / Manager Class (a manager that holds and coordinates lower-level objects) / Factoring (extract independently testable sub-behaviors) / Escalating Encapsulation (move the encapsulation point upward, using a shadow class to achieve a "package-level weak friendship").

- **CCD (Cumulative Component Dependency)**: Measures the total number of components that must be linked when each component of a subsystem is independently test-driven.
  - When to use: Quantitatively comparing the quality of different physical designs and judging whether the layering is excessive.
  - How: Lateral (horizontal) = 3, tree = 5, vertical = 6, cyclic = 9 (for a 3-component subsystem); the lateral architecture has a significantly lower CCD.

- **Encapsulation vs. Insulation**:
  - Encapsulation: Changing implementation details does **not require rewriting** client code (a logical property).
  - Insulation: Changing implementation details does **not require recompiling** client code (a physical property). Hiding details in a .cpp is sufficient to insulate.

- **Three Total-Insulation Techniques**:
  - When to use: When you need to completely eliminate the compile-time coupling between clients and implementation changes.
  - How: (I) Protocol class (a pure abstract interface, which also eliminates link-time dependency); (II) Fully Insulating Concrete Wrapper (a single-component wrapping wrapper using `d_this_p` to point to the `_i` implementation class); (III) Procedural Interface (PI, pure free functions + opaque types).

- **PI's Eight Essential Properties**: (1) Physically separated from the accessed C++ component; (2) Completely independent of other PI functions; (3) No physical interdependencies among PI-layer components; (4) Provides no additional domain functionality; (5) 1-1 mapping with the underlying C++ component (`z_` prefix); (6) Natural, regular, and predictable naming; (7) Callable from both C and C++; (8) Opaquely exposes the **real** underlying C++ type.

## Key Concepts

- **Component**: Simultaneously the atomic unit of logical and physical design, its size constrained by "independently testable with a single test driver."
- **Physical Hierarchy**: A directed acyclic hierarchy composed of component -> package -> package group/UOR.
- **Package Charter**: A package-level document that fully describes the semantic boundary and target size of the package.
- **Primitive Operation**: Functionality that must access the private implementation of a type to be implemented efficiently; everything else is nonprimitive and should be escalated to a utility struct.
- **Complete/Minimal/Primitive**: The three goals of a component interface - complete (satisfies the open-closed principle), minimal (no redundancy), primitive (predominantly primitive operations).
- **Vocabulary Type**: A stable type widely used throughout the enterprise as interface currency (e.g., `Date`); it must remain lightweight and focused.
- **Lateral Architecture**: Decouples clients from implementations into physically peer-level sibling components via pure abstract interfaces, breaking the classical layered model.
- **Open-Closed Principle (at component level)**: Provide enough primitive functionality (e.g., iterators, delta/offset) so that arbitrary application-level functionality can be efficiently implemented in higher-level components without modifying the original component.
- **Continuous Demotion**: Continuously extract reusable functionality from applications and demote it into stable libraries; otherwise the system degenerates into a "Big Ball of Mud".

## Mental Models

- **Think of the physical design space as a building with gravity**: Higher layers may depend on lower layers, but the reverse is forbidden; two entities may reside on the same floor (lateral), independent of each other.
- **When encountering an upward dependency between components**, first refactor using one of the 9 levelization techniques; the most commonly used are Escalation (move the conflicting functionality upward) and Demotion (move the common functionality downward).
- **Treat a Protocol class as an "almost perfect insulator"**: When inheritance is already intended, extracting a protocol is almost always the right call.
- **When designing a component interface, treat it as the supply side of the open-closed principle**: Prefer to provide an additional set of reusable primitive "tools" (e.g., Polygon's vertex/delta/offset + RotationalIterator) rather than cramming `area`, `isConvex`, and the like into the flagship class.

## Anti-patterns

- **Multicomponent Wrapper**: Sharing private access across components violates the long-distance friendship prohibition and is usually impossible; only the escalating-encapsulation shadow-class trick can be used.
- **Winnebago Class**: Cramming day-count, parsing, date-math, and more into `Date`, making it too heavy, unstable, and hard to reuse.
- **Monolithic Platform Adapter (`abc_platform`)**: A single component wrapping the entire platform API, forcing any client to link against all platform libraries.
- **Hiding Headers for Encapsulation**: Hiding header files to "achieve encapsulation" breaks physical interoperability and is a BAD IDEA.
- **Colocation by Syntax**: Partitioning packages by syntax (e.g., all enums together, all classes together) breaks semantic/physical cohesion.
- **`u` Package Suffix**: Placing all utilities into a separate `*u` package impedes client discovery and forbids same-package value types from using them.
- **Classically Layered Architecture (excessive vertical layering)**: Everything depends on the database; CCD explodes and business objects cannot be tested independently.

## Reference Tables

### Modularity Criteria: Good vs. Poor

| Good | Poor |
|---|---|
| Semantically related functionality | Syntactically related functionality |
| Application vs. Library | "Needed here and now" |
| Focused functionality | |
| Physical dependency | Written by the same person/team |
| Distinct client categories | |
| Primitive vs. Nonprimitive | |

### Nine Levelization Techniques Quick Reference

| Technique | Core Practice |
|---|---|
| Escalation | Move mutually dependent functionality up to a higher-level component |
| Demotion | Move common functionality down to a lower level to broaden reuse |
| Opaque Pointers | Use only a local forward declaration, no `#include` |
| Dumb Data | Use integer indices instead of object pointers (value semantics) |
| Redundancy | Intentionally duplicate a small amount of code to avoid coupling |
| Callbacks | Client-supplied function/functor/protocol/concept |
| Manager Class | Establish a manager class that owns and coordinates lower-level objects |
| Factoring | Extract independently testable sub-behaviors |
| Escalating Encapsulation | Use a shadow class to move the encapsulation point wholesale upward |

### CCD Comparison (15-component subsystem)

| Architecture Form | CCD |
|---|---|
| Lightly layered | 85 |
| Correspondingly layered | 92 |
| Heavily layered | 190 |

## Worked Example

### Date/Calendar Subsystem Design (§3.12, the capstone case of the book)

**Initial Requirement (misguided)**: "Give me a Date class that can tell me whether today is a business day."

**Step 1: Decompose the requirement and reject the design suggestion.** The client is right about the "functionality" but wrong about the "design" (a Date class with a built-in isHoliday). The SI engineer reframes it into four genuine requirements: (1) represent a date value with a C++ type; (2) obtain "today"; (3) determine whether a given date is a business day; (4) deliver it as a hierarchically reusable component.

**Step 2: Identify the vocabulary type and its auxiliary types.** Create `Date` (a complex-constrained value-semantic type with range `[1/1/1 .. 9999/12/31]`) and the accompanying `DayOfWeek` enumeration type, each as its own independent component. `dayOfWeek()` is primitive (under a serial-date implementation it is just a modulo), so it stays within `Date`.

**Step 3: Avoid stuffing "today" into Date.** `Date` must remain lightweight and must not depend on the OS clock. Create `CurrentTimeUtil` (**not** named `DatetimeUtil`, because it carries a heavy OS dependency and also needs to return `TimeInterval`), providing `local()`/`utc()`/`now()`. Introduce `Datetime`, `Time`, `DatetimeInterval`, and reuse the existing `bsls::TimeInterval`.

**Step 4: Calendar design - value-semantic, fast, set-like.** `isHoliday` is not an intrinsic property of Date (it depends on locale/context). Design `Calendar` (runtime-efficient, internally using a `BitArray` to cache 1 bit per serial date; `isNonBusinessDay` is only ~6 instructions) and `PackedCalendar` (space-efficient, ~750 bytes/30 years, used for transmission). Both represent the same value and are interconvertible. Provide `intersectBusinessDays` to support one-time precomputation across multiple locales.

**Step 5: CalendarCache + CalendarLoader (Lateral Architecture).** `CalendarCache` does not fetch data itself; at construction it receives a `CalendarLoader*` (a pure abstract protocol). On a cache miss it calls back `load(PackedCalendar*, name)`. This is a classic application of Protocol Callback + Lateral Architecture - the library does not depend on any concrete database.

**Step 6: Reject excessive indirection (CalendarFactory).** The initial idea was to add another layer of `CalendarFactory` protocol + `CacheCalendarFactory` adapter; upon evaluation it was deemed low-value (the existing value type `Calendar` plus `CalendarLoader` already provide two sufficient variation points), so it was decisively cut, using a singleton/global `CalendarCache` directly.

**Step 7: Separate nonprimitive functionality into utility structs.** `DateUtil` (depends only on Date + DayOfWeek, e.g., `nthDayOfWeekInMonth`), `CalendarUtil` (depends on Date + Calendar, e.g., the financial `shiftModifiedFollowingIfValid`), `DateParserUtil` (unstable, volatile formats - must never enter Date), `DateConvertUtil` (serial<->ymd<->yday conversion, an independent component so that switching Date's internal representation in the future does not affect `DateConvertUtil`'s clients). Finance-specific functionality such as day-count is escalated to the dedicated package `bbldc` (located in the `bbl` package group).

**Step 8: Implementation-level factoring.** `Date` chooses a serial-date internal representation to optimize `operator-`/`++`/`dayOfWeek`; extract `PrimitiveDateUtil` (`isLeapYear`, etc., usable without Date) and `DateConvertUtil`. `PackedCalendar` uses `PackedIntArray` (auto-adapting element width to the maximum value) + `PackedIntArrayUtil` (`isSorted`/`lowerBound`). `Calendar`'s `BitArray` is further factored into `BitUtil` (bit counting, etc.) and `BitStringUtil` (string-level algorithms).

**Key Design Lessons**:
- `Date` and `DateConvertUtil` **must** be two separate components from the very beginning (§3.12.11.2, Figure 3-171). If colocated, when `Date` is later changed from serial back to a ymd representation, `DateConvertUtil` cannot be removed (clients already `#include <date.h>`), dragging along the code of both sides' utilities.
- Every "implementation utility" is an independently testable, reusable sub-component; the client-facing and implementation-only perspectives iterate recursively until component size is manageable.
- The final result (Figure 3-178) shows the complete hierarchical reuse graph behind `bdlt::CalendarCache` - the product of years of accumulated methodology, by no means reconstructable from scratch in a single project.

## Key Takeaways

1. **Physical design is as important as logical design and must proceed in parallel**; purely logical design inevitably fails at scale.
2. **Cyclic physical dependencies are forbidden** is the number-one hard rule; when encountered, immediately refactor using the 9 levelization techniques.
3. **Every public class owns its own component by default**; colocation is allowed only for friendship, cycle avoidance, single-solution, and flea-on-elephant situations.
4. **A reusable component interface must be complete, minimal, and primitive**; nonprimitive functionality is always escalated to a same-package `*util` component, preventing the flagship type from degenerating into a Winnebago.
5. **Lateral architecture + Protocol class** is the core weapon for eliminating heavy link-time dependencies, enabling mock injection, and "exploiting without betting on" new technologies; use CCD to quantitatively compare design quality.
6. **Encapsulation is not Insulation**: encapsulation prevents rewriting, insulation prevents recompiling; for widely used low-level components, placing volatile implementations (e.g., `Pool::replenish`) in .cpp rather than inline allows directly swapping the `.o` to patch during production incidents.
7. **Continuous demotion** is the only long-term strategy against the "Big Ball of Mud"; demote reusable functionality into Software Capital in a timely manner.

## Connects To

- **Ch 2**: The physical hierarchy builds on Ch2's component/package/package group/UOR aggregation hierarchy and design rules (§2.6 long-distance friendship prohibition, §2.13 application-library unidirectional dependency); CCD and levelization both depend on Ch2's notion of level.
- **Ch 0**: Directly serves §0.4 hierarchical reuse, §0.9 Software Capital, and §0.5 open-closed principle; this chapter provides the concrete, actionable techniques that bring those goals to life.
