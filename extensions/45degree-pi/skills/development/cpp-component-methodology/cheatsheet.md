# Cheatsheet — C++ Component-Based Physical Design

> A quick decision guide to keep at hand while working. Each entry should help you make the decision the author would make.

## Physical Aggregation Decision (Mandatory 3 Levels)

| Level | Entity | Typical Size | When to Create |
|------|------|---------|---------|
| Level I | Component (.h/.cpp) | ≈500 lines | Every independent logical abstraction; default 1 public class |
| Level II | Package | ≈20 components | A logically cohesive set of components sharing the same package prefix |
| Level III | Package Group = UOR | ≈20 packages ≈ 200K lines | A subsystem that can be independently released all-or-nothing |

- Fewer than 2 levels → insufficient to manage; more than 3 levels → hard to balance and unnecessary → **stick to 3 levels**
- Deployment partitions (e.g., `xyz.1`/`xyz.2`) → **have no architectural standing whatsoever**; they are merely organizational
- At design time, treat each UOR as atomic: using any part introduces all of it along with its dependencies

## Component Co-location Decision (Default 1 component = 1 public class)

Multiple public classes may be co-located only when one of these four conditions holds:

1. **Friendship** — the most common and strongest reason (e.g., Container + Iterator, which must access each other's private members)
2. **Implied Cyclic Dependency** — splitting them would create a cyclic dependency (rare; usually can be refactored away)
3. **Single Solution** — small, mutually independent, useless on their own; together they form a complete solution
4. **Flea on an Elephant** — extremely lightweight and closely collaborating (e.g., Logger + ScopedGuard)

In all other cases → **separate components**.

## Breaking Dependencies: Nine Hierarchical Techniques

| Technique | Applies To | Cost |
|------|------|------|
| **Escalation** | Mutually dependent functionality moved up to a higher level | Higher levels get heavier |
| **Demotion** | Common functionality moved down to widen reuse | Increases component count |
| **Opaque Pointer** | Forward-declare only, do not include | Indirect access |
| **Dumb Data** | Integer index instead of object pointer (value semantics) | Loss of type safety |
| **Redundancy** | A little duplicated code to avoid coupling | Maintenance duplication |
| **Callback** (5 flavors) | Data/Function/Functor/Protocol/Concept | Inverted control flow |
| **Manager Class** | Holds and coordinates lower-level objects | One extra layer |
| **Factoring** | Extract an independently testable sub-behavior | Design cost |
| **Escalating Encapsulation** | Shadow class implements package-level weak friendship | Complex |

- When you meet an upward dependency or cycle → **prefer Escalation or Demotion**
- When you need runtime polymorphism for decoupling / mock injection → **Protocol Callback + Lateral Architecture**

## Architectural Form Selection (Compare Quantitatively with CCD)

| Form | 3-component CCD | 15-component CCD | When to Choose |
|------|-----------|------------|---------|
| Lateral | 3 | 85 | Large scale, need flexible extension, exploit new technology |
| Tree | 5 | 92 | Medium scale, clear ownership |
| Vertical | 6 | 190 | Small scale, performance first, simple dependencies |
| **Cyclic** | 9 | — | **Forbidden** |

- Lower CCD is better; heavy layering (190) ≈ impossible to test independently
- Classic layering (everything depends on DB) → CCD explosion → **reject**

## Encapsulation vs Insulation

| Need | Use | Means |
|------|----|------|
| Change implementation without breaking client **source code** | Encapsulation | Good encapsulation (a logical property) |
| Change implementation without forcing client **recompilation** | Insulation | Move details into .cpp (a physical property) |
| Production incident needs a hot patch (replace `.o`) | Insulation | Isolate volatile low-level implementation (e.g., `Pool::replenish`) |

Three **overall insulation** techniques:
1. **Protocol class** — a pure abstract interface, an almost perfect insulator (also eliminates link dependencies)
2. **Fully Insulating Concrete Wrapper** — a single component + `d_this_p` pointing to an `_i` implementation class
3. **Procedural Interface (PI)** — pure free functions + opaque type, callable from both C and C++ (`z_` prefix, 1-1 mapping to the lower layer)

## Five Legal Cases for #include in a Header File

Only these 5 cases permit an `#include` in a `.h` (everything else: forward-declare or move to the `.cpp`):

- **(a) Is-A** public inheritance (the only case where transitive inclusion is permitted)
- **(b) Has-A** embedded object (not Holds-A pointer/reference)
- **(c) Inline** substantively used inside a function body
- **(d) Enum** an enum cannot be forward-declared
- **(e) Typedef** an explicit template specialization alias (e.g., `std::string`)

## Naming Quick Reference (Reverse-lookup File from Point of Use)

| Entity | Rule | Example |
|------|------|------|
| Package Group | Exactly 3 lowercase alphanumeric characters | `bdl`, `bal` |
| Grouped Package | Group name + 1-3 character suffix | `bdlt`, `bdlma` |
| Standalone Package | >6 characters or `a_`/`m_` prefix | `xerces`, `m_mailserver` |
| Component | `<package>_<basename>` | `bdlt_date` |
| Include Guard | `INCLUDED_<UPPER_PKG>_<UPPER_BASE>` | `INCLUDED_BDLT_DATE` |
| Test Driver | `<component>.t.cpp` in the same directory, unique and standalone | `bdlt_date.t.cpp` |
| Component-private class | Basename contains an extra underscore | `List_Link`, `Container_Iterator` |

`bdlt::Date` → `bdlt_date.h` → package `bdlt` → package group `bdl` → mechanically locatable without an IDE. Package names are kept very short to discourage the spread of `using`.

## Four Component Properties (Hard Design Rules)

1. The first substantive line of code in a `.cpp` must `#include` its own `.h` (guarantees the header compiles standalone)
2. Every external-linkage construct defined in a `.cpp` must be declared in its `.h`
3. An external-linkage construct declared in a `.h`, if defined, must be defined within this component
4. Access to another component's functionality is only permitted via `#include` of its header (no `extern` declarations)

## Code Smells → Immediate Action

| Smell | Problem | Action |
|------|------|------|
| `#include` path contains `/` | Locks down deployment | Use plain filename only |
| `extern` declaration in a header | Bypasses Property 4 | Delete; use include instead |
| Include guard does not match filename | Organizational chaos | Rename to align |
| Cross-component `friend` | Long-distance friendship | Redesign |
| Redundant `#include` in a `.h` | Transitive dependency, fragile | Delete or move to .cpp |
| `using namespace` in a header | Namespace pollution | Use fully-qualified names |
| File/namespace-scope static object | Unspecified initialization order | Change to function-local static |
| Cyclic physical dependency (at any level) | Core violation | Refactor with one of the 9 techniques |
| Multiple unrelated public classes in one component | Unnecessary physical coupling | Split |
| Bloated flagship class (Winnebago) | Hard to reuse, unstable | Promote nonprimitive parts to a same-package `*util` |
| Single `abc_platform` component wrapping the whole platform | Forces linking all platform libraries | Split by functionality |

## Key Thresholds and Defaults

- **Aggregation levels**: 3 (mandatory; a 4th level is almost always wrong)
- **Component size**: ≈500 lines (100-1000 is reasonable)
- **public classes / component**: 1 (unless one of the 4 co-location criteria is met)
- **Package size**: ≈20 components
- **CCD**: the lower the better; heavy layering (190) is a danger signal
- **Test driver**: one standalone `.t.cpp` per component; its dependencies must not exceed those of the component under test

## Decision Quick Reference

- Software behavior will change? → **Malleable** (application code) → must not be reused
- Software behavior is stable? → **Stable** (library code) → Software Capital, can be reused to amortize cost
- Third-party library is out of your control? → Isolate with a Protocol/adapter, place in an **irregular package**
- Need private access across UORs? → **redesign**; long-distance friendship is never allowed
- System is hard to test? → **inspect the physical dependencies**; this is almost always the root cause
- Want to add a feature to a flagship class? → first ask whether it is **nonprimitive**; if so, promote to a same-package `*util`
- Unsure about a new technology? → **Lateral + Protocol** lets you exploit without betting on it
- Met with a mix of "feature requirement + design suggestion"? → accept the feature, **reject the client's design suggestion**, and redo the physical decomposition yourself
