# Chapter 2: Packaging and Design Rules

## Core Idea
This chapter defines the "rules of the game" for component-based software: a uniform, balanced, three-level physical aggregation system (Component → Package → Package Group/UOR), reinforced by acyclic dependencies, cohesive naming, and explicitly declared allowed-dependency metadata, so that enterprise-scale C++ software can be effectively designed, developed, tested, and deployed.

## Frameworks Introduced

- **Physical Aggregation Hierarchy**: Within a single UOR there are at most three architecturally significant levels of physical aggregation; the Component is the innermost level, the UOR (Unit of Release) is the outermost, and the intermediate levels are the Package or Package Group.
  - When to use: Mandated whenever organizing any proprietary library software.
  - How: Level I = Component; Level II = Package; Level III = Package Group (i.e., the UOR). Granularity grows by roughly an order of magnitude per level (≈500 lines/component × 20 components/package × 20 packages/group ≈ 200,000 lines/UOR).

- **Logical/Physical Coherence**: An architecturally cohesive logical entity must be tightly encapsulated within a physical entity; whatever logical construct a physical aggregation advertises to the outside must be implemented entirely within that aggregation.
  - When to use: During modular design at every level (component, package, package group).
  - How: Ensure logical boundaries coincide with physical boundaries, so that physical dependencies can be inferred from abstract logical usage.

- **Logical and Physical Name Cohesion**: The use site of a logical entity should, by itself, identify the component, package, and UOR to which it belongs.
  - When to use: When naming every architecturally significant entity.
  - How: Enterprise namespace → package namespace (prefix) → component name = package prefix + base name → class-name lowercase prefix matches the component base name.

- **Component Design Rules**: A set of objectively verifiable rules that guarantee the regularity and replaceability of components (see Reference Tables).
  - When to use: Whenever writing any source code other than `main`.
  - How: Follow Component Properties 1-4; prohibit cyclic dependencies between components, prohibit cross-component friendship, and aim for one public class per component.

- **Hierarchical Testability Requirement**: Every physical entity must be thoroughly testable relying only on other physical entities that have already been fully tested.
  - When to use: Throughout the entire development lifecycle.
  - How: Equip each component with a single independent test driver (`.t.cpp`) whose dependencies must not exceed those of the component under test.

- **Metadata as Design Intent**: Architectural metadata is a "by decree" design input, not a derivative product inferred from code; when code and metadata disagree, the code is wrong.
  - When to use: In any codebase of non-trivial scale.
  - How: Store files such as `.dep` (dependencies) and `.mem` (membership manifests) alongside the source code.

## Key Concepts

- **Aggregate**: A cohesive physical design unit composed of logical content.
- **Component**: The innermost level of physical aggregation; a `.h`/`.cpp` pair that satisfies the four fundamental properties.
- **Package**: The smallest architecturally significant physical aggregation larger than a component; a physically cohesive aggregation of components sharing a single package namespace.
- **Package Group**: The third (highest) architecturally significant level of physical aggregation; a physically cohesive aggregation of packages that constitutes a UOR.
- **UOR (Unit of Release)**: The outermost level of physical aggregation, deployed and consumed on an all-or-nothing basis.
- **Architecturally Significant**: The name of the entity is deliberately made visible from outside its containing UOR.
- **Allowed Dependency**: A physical dependency, explicitly declared in metadata, that is permitted to exist within the physical hierarchy.
- **Manifest**: A specification of the set of entities contained in a physical aggregation, typically expressed as external metadata.
- **Component-Private Class**: A class defined at package namespace scope but which must not be used directly outside its own component (signaled by an extra underscore convention).
- **Subordinate Component**: A component whose base name contains an underscore and which may be directly `#include`-ed by only a single designated parent component within the same package.
- **Irregular Package**: A package not composed entirely of components that conform to the design rules (legacy/open-source/third-party).
- **Transitive Include**: Relying on one header to indirectly pull in another header in order to achieve direct functionality; prohibited in all cases except public inheritance.

## Mental Models

- **Use 3 levels when** organizing any library UOR: fewer than 2 levels is insufficient for management; more than 3 levels is hard to balance and unnecessary.
- **Think of a UOR as an atom for design**: Even if its internals can be compiled independently, at design time you must assume "use a little, pull in all of it plus its dependencies."
- **Think of a package prefix as a zip code**: From a class name (e.g., `bdlt::Date`) you can mechanically locate `bdlt_date.h`, the `bdlt` package, and the `bdl` package group without any tooling.
- **Think of allowed dependencies as a budget, not a receipt**: What is declared is the design intent (the expected envelope), not an after-the-fact record of dependencies that have already occurred.

## Anti-patterns

- **Unbalanced aggregation**: Placing components alongside much larger aggregates within a UOR, harming comprehension and reuse.
- **Logical/physical incoherence**: Mechanically repartitioning to eliminate cyclic dependencies so that a logical subsystem is no longer encapsulated within a single physical library, losing the ability to infer physical dependencies from logical usage.
- **Cyclic physical dependencies (at any level)**: Cyclic dependencies between components, between packages, or between UORs are all unscalable and break hierarchical testing and release ordering.
- **Long-distance (inter-component) friendship**: Granting private access across component boundaries, undermining component replaceability and hierarchical testability.
- **Transitive includes (except for public inheritance)**: Relying on implementation-detail nested includes, so that any small change can cause client compilation failures.
- **Overly specific package scope**: Creating a package for a single component (e.g., `base64encoder`), hindering balanced aggregation and the future placement of similar components.
- **Descriptive long namespace names**: Encourages the spread of `using` directives, which in turn weakens name cohesion.
- **Architectural significance of organizational partitions**: Treating partitions made only for deployment optimization (e.g., `xyz.1`, `xyz.2`) as architectural entities, locking down deployment flexibility.

## Reference Tables

### Scale estimation for the three-level physical aggregation

| Level | Entity | Typical scale |
|---|---|---|
| Level I | Component | ≈ 500 lines/component |
| Level II | Package | ≈ 20 components/package |
| Level III | Package Group (UOR) | ≈ 20 packages/group ≈ 200,000 lines |

### Summary of Component Design Rules

| Rule | Content |
|---|---|
| Form | Exactly 1 `.h` + at least 1 `.cpp`, same root name, satisfying the four properties |
| Property 1 | The first substantive line of code in the `.cpp` `#include`s its own `.h` |
| Property 2 | Every externally linked construct defined in the `.cpp` must be declared in the `.h` |
| Property 3 | Any externally bound construct declared in the `.h`, if defined, must be defined within this component |
| Property 4 | Accessing functionality of another component is only permitted via `#include` of its header |
| Include guard | Unique and mechanically predictable: `INCLUDED_<PACKAGE>_<BASENAME>` |
| Prohibited | Cyclic dependencies between components, cross-component friendship, runtime initialization of file/namespace-scope static objects |
| Direct include | Any substantive use requires a direct `#include`; only public inheritance may rely on transitive inclusion |
| Goal | 1 public class per component (except for engineering reasons such as friendship) |

### Five cases where `#include` is legitimate in a header

| Case | Description |
|---|---|
| (a) Is-A | Public inheritance; complete definition required |
| (b) Has-A | Embedded object (not Holds-A) |
| (c) Inline | Substantive use within an inline function body |
| (d) Enum | Enumeration types cannot be forward-declared |
| (e) Typedef | Alias for an explicit template specialization (e.g., `std::string`) |

### Naming rules quick reference

| Entity | Rule | Example |
|---|---|---|
| Package Group | Exactly 3 lowercase alphanumeric characters | `bdl`, `bal`, `std` |
| Grouped Package | Group name + 1-3 character suffix | `bdlt`, `bdlma` |
| Standalone Package | >6 characters, or `a_`/`m_` prefix, or (rarely) exactly 3 characters | `xerces`, `m_mailserver` |
| Component | `<package>_<basename>` | `bdlt_dayofweek` |
| Application Package | `m_<name>` | `m_mailserver` |
| Component-Private Class | Name contains an extra underscore; base name matches the component | `List_Link`, `Container_Iterator` |
| Subordinate Component | Base name contains an underscore | `bdlmt_threadpool_unix64_linux` |

### Metadata classification

| Type | Purpose | File |
|---|---|---|
| Dependency | Declares allowed physical dependencies (most important; 100% architectural) | `.dep` |
| Membership | Declares which entities an aggregate contains | `.mem` |
| Build Requirements | Local/global build flags, capabilities | `.cap`, etc. |
| Policy | Enterprise-specific boolean policy assertions | Tags such as `PRIVATE DEPENDENCY` |

## Worked Example

**Reverse-locating the physical position from a use site + component layout** — this is the most instructive comprehensive example in the chapter.

Suppose you see the following line in the source code:
```cpp
bdlt::Date today;
```

Relying purely on name cohesion, you can mechanically infer:
1. Class `Date` → component base name `date` → component `bdlt_date` → files `bdlt_date.h` / `bdlt_date.cpp`.
2. Package prefix `bdlt` → the `bdlt` package → belongs to the `bdl` package group (3-character prefix).
3. No IDE or global search is needed to locate the definition file.

The standard physical directory structure for this component (located under the `bdl` package group directory):
```
bdl/                          # package group
├── group/
│   └── bdl.dep               # allowed-dependency declaration for the entire package group
├── bdlt/                     # package
│   ├── package/
│   │   └── bdlt.dep          # this package's allowed dependencies on other packages in the same group
│   ├── doc/
│   ├── include/
│   ├── lib/
│   ├── bdlt_date.h           # component header
│   ├── bdlt_date.cpp         # component implementation
│   └── bdlt_date.t.cpp       # the single independent test driver
└── ...
```

The standard "boilerplate" layout inside the header (a simplified `bdlt_dayofweek.h`):
```cpp
// bdlt_dayofweek.h -*-C++-*-
#ifndef INCLUDED_BDLT_DAYOFWEEK
#define INCLUDED_BDLT_DAYOFWEEK
//@PURPOSE: Provide support for enumerating the seven days of the week.
#include <iosfwd>
namespace BloombergLP {
namespace bdlt {

struct DayOfWeek {
    enum Enum { e_SUN = 1, e_MON, e_TUE, /* ... */ };
    static const char *toAscii(Enum value);
    static std::ostream& print(std::ostream& stream, Enum value,
                               int level = 0, int spacesPerLevel = 4);
};

std::ostream& operator<<(std::ostream& stream, DayOfWeek::Enum value);

// =====================
// INLINE FUNCTION DEFINITIONS
// =====================
inline
std::ostream& bdlt::operator<<(std::ostream& stream, DayOfWeek::Enum value)
{
    return DayOfWeek::print(stream, value, 0, -1);
}
}  // close package namespace
}  // close enterprise namespace
#endif
```

Key points:
- The file-name prefix = package prefix + base name, guaranteeing global uniqueness within the enterprise.
- The package namespace (`bdlt`) is nested directly inside the enterprise namespace (`BloombergLP`), with no intervening namespace layer.
- The inline free operator is defined outside the package namespace (qualified with `bdlt::`), so that a declaration/definition signature mismatch can be detected at compile time.
- Even if nearly empty, the `.cpp` must exist and must begin with `#include <bdlt_dayofweek.h>` (Property 1), ensuring the header is independently compilable.

## Key Takeaways

1. **Three levels are sufficient**: Component → Package → Package Group (UOR); a balanced three-level architecture is enough to describe systems of tens of millions of lines — do not introduce a fourth level of architectural aggregation.
2. **Design every aggregate atomically**: Assume at design time that any use pulls in the whole; the dependency envelope must be explicitly declared in metadata before coding begins.
3. **Name cohesion = maintainability**: Being able to mechanically locate the component/package/UOR from a use site is an essential property of development at scale; keep package names extremely short to prevent the spread of `using` directives.
4. **Regularity takes priority over "optimization"**: Every component must have a paired `.h`+`.cpp`, even enumerations or protocols — any deviation should be resisted.
5. **Acyclic dependencies are a design imperative**: Cyclic dependencies are prohibited at all three levels — component, package, and UOR; if the allowed dependencies form a cycle, that constitutes a violation, regardless of whether the actual dependencies cycle.
6. **Encapsulation does not cross boundaries**: Cross-component friendship and private access across aggregates are both prohibited, in order to preserve component replaceability and hierarchical testability.
7. **Development is architecture, deployment is organization**: Deployment-optimization partitions must not gain architectural status; hard-coded paths are prohibited in `#include`; metadata drives tooling automation.

## Connects To

- **Ch 1**: Reuses Component Properties 1-4 as Design Rules; carries forward concepts such as `.h`/`.cpp` pairing, include guards, `#include` and angle-bracket conventions, and link-time dependencies.
- **Ch 3**: The "rules" defined in this chapter provide the governance targets for the levelization techniques (escalation, demotion, dummy includes) and the restructuring techniques for eliminating cyclic or excessive dependencies in Chapter 3; subordinate components, insulation, and protocol-based decoupling are deepened in Chapter 3.
- **Vol II**: Details of in-component class layout (§6.14), contract/implementation separation (§5.2), and value-semantic categories (§4.x) build upon the component form established in this chapter.
- **Vol III**: The Hierarchical Testability Requirement directly drives the component-level test driver organization, test-data selection, and driver structure covered in Chapters 7-10.
