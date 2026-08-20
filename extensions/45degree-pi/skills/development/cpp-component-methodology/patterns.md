# Patterns & Techniques — Component-Based Physical Design for C++

> All concrete techniques, design patterns, and methodological patterns from the book.

## Physical Design Patterns

### Component-Based Physical Design
**When to use**: When building any C++ system larger than what a few developers can maintain.
**How**: Organize all code into components (.h/.cpp pairs) satisfying the four fundamental properties (Property 1-4), arranged into an acyclic physical dependency hierarchy.
**Trade-offs**: Higher upfront investment, but pays enormous dividends in testability, maintainability, and reuse as the system grows.

### Protocol Class (Pure Abstract Interface)
**When to use**: When you need to decouple interface from implementation, enable lateral architectures, support polymorphic substitution, or achieve complete compile-time isolation.
**How**: Create a class containing only pure virtual functions (besides the virtual destructor), with no data members and no inheritance from non-protocol classes; this realizes Uses-In-Name-Only, requiring only a forward declaration.
**Trade-offs**: Runtime overhead of virtual function calls; but it is a nearly perfect insulator that can also eliminate link-time dependencies.

### Levelization via Escalation + Demotion
**When to use**: When you need to break a physical design cycle.
**How**:
1. Escalation: Encapsulate the functionality of one component in the cycle within a higher-level wrapper class.
2. Demotion: Place that wrapper class back at the appropriate physical level.
**Trade-offs**: May introduce extra levels of indirection and slight runtime overhead.

### Demotion (Continuous Refactoring)
**When to use**: When application code contains functionality of general utility; the only long-term strategy against the "Big Ball of Mud".
**How**: Rename, refactor, and move the functionality to a lower, more appropriate position in the physical hierarchy so it can be more broadly reused.
**Trade-offs**: Requires sustained disciplined effort; may have short-term schedule impact.

### Opaque Pointers (Uses-In-Name-Only)
**When to use**: When a component only needs to refer to another component's name and does not require its full definition.
**How**: Use only a forward declaration (`class Foo;`) in the header file without `#include`-ing its header; completely eliminates compile-time dependency.
**Trade-offs**: Only applicable when usage is via pointer/reference; cannot access members or embedded objects.

### Dumb Data Pattern
**When to use**: When you need to completely eliminate an explicit physical dependency between two components.
**How**: Replace a direct dependency on another component's type with a non-negative integer index (or other lightweight data type).
**Trade-offs**: Loses type safety; requires runtime validation of index validity.

### Redundancy (Intentional Duplication)
**When to use**: When copying a small amount of code avoids introducing a heavy physical dependency.
**How**: Deliberately duplicate a small amount of code (such as simple constants or small inline functions) to avoid pulling in an entire component.
**Trade-offs**: Violates the DRY principle; requires maintaining two copies and synchronizing changes.

### Callbacks (Five Flavors)
**When to use**: When a component needs to call back into client code without depending on a concrete implementation.
**How**: Choose by increasing coupling strength: (1) Data Callbacks (passing plain data); (2) Function Pointer Callbacks; (3) Functor Callbacks; (4) Protocol Callbacks (pure virtual interface); (5) Concept Callbacks (template constraints).
**Trade-offs**: Protocol Callbacks give the best physical decoupling but require virtual functions; Concept Callbacks have zero overhead but incur compile-time coupling.

### Manager Class
**When to use**: When several lower-level objects need to be owned and coordinated, and the coordination logic itself has value.
**How**: Establish a separate manager class component that owns and coordinates the lifecycle and interactions of the lower-level objects.
**Trade-offs**: Introduces an extra layer of abstraction; but breaks cycles and makes coordination logic independently testable.

### Factoring (Sub-behavior Extraction)
**When to use**: When a piece of behavior within a component can be independently tested and may be reused by other components.
**How**: Extract the sub-behavior into a separate low-level component so it can be independently tested and reused.
**Trade-offs**: Increases the number of components; but each component is smaller, more focused, and easier to test.

### Escalating Encapsulation (Shadow Class)
**When to use**: When you need to implement "package-level weak friendship" (limited private access sharing within a package) without violating the long-distance friendship prohibition.
**How**: Move the encapsulation point upward as a whole, using the shadow class technique to let same-package components cooperate.
**Trade-offs**: Complex to implement; but preserves component replaceability and hierarchical testability.

### Opaque Pointer (pimpl)
**When to use**: When you need to hide implementation details to reduce compile-time coupling.
**How**: Keep only an opaque pointer to an implementation class in the public header of the class; hide all implementation details in the .cpp file.
**Trade-offs**: Additional heap allocation and indirection overhead.

### Fully Insulating Wrapper Component
**When to use**: When you need to completely isolate implementation details so clients do not need to recompile due to implementation changes.
**How**: Create a wrapper component whose public interface exposes no underlying implementation types; forward all dependencies via pointers or opaque types (use `d_this_p` pointing to the `_i` implementation class).
**Trade-offs**: Significant runtime overhead; multi-component wrapping usually requires cross-component friendship.

### Procedural Interface (PI)
**When to use**: (1) Isolating legacy systems; (2) Providing a bridge layer between C and C++.
**How**: Create a C-style function interface (with `z_` prefix) satisfying the eight fundamental properties, with each PI function living in its own component, mapping 1-1 to the underlying C++ component; callable by both C and C++.
**Trade-offs**: Significant additional overhead; loses the flexibility of inheritance and templates; should not be used in contexts that may limit parallel reuse.

### Lateral Architecture via Abstract Interfaces
**When to use**: As an alternative to the classic layered architecture in large-scale systems; to eliminate heavy link-time dependencies and enable mock injection.
**How**: Define pure virtual abstract interfaces (Protocols) so that producers and consumers of functionality become independent peers, each depending only on lower-level interfaces (e.g., CalendarCache + CalendarLoader).
**Trade-offs**: Runtime overhead of virtual function calls; but achieves unlimited extensibility and physical decoupling with markedly lower CCD.

### Lateral Architecture via Templates
**When to use**: When you need physical independence but cannot accept the runtime overhead of virtual functions.
**How**: Turn the methods that use abstract interfaces into method templates, with the type parameter bound at compile time.
**Trade-offs**: Tight compile-time coupling; requires exposing the template implementation in the header file.

### CCD (Cumulative Component Dependency)
**When to use**: When quantitatively comparing the quality of different physical designs and judging whether layering is excessive.
**How**: Measure the total number of components that must be linked to independently test-drive each component of a subsystem; lateral = 3, tree = 5, layered = 6, cyclic = 9 (for a 3-component subsystem).
**Trade-offs**: A static metric that does not reflect runtime performance; but precisely characterizes testability and reuse quality.

## Logical Factoring Patterns

### Component Colocation Criteria (Four Cases)
**When to use**: When deciding whether to place two or more public classes in the same component (default is one class per component).
**How**: Colocate only in the following four cases: (1) Friendship (e.g., a container and its iterator); (2) Implied Cyclic Physical Dependency (splitting them would create a cycle); (3) Single Solution (small, useless alone, complete only when combined); (4) Flea on an Elephant (extremely lightweight and in close cooperation).
**Trade-offs**: Colocation reduces the number of components but increases component size; balance testability against cohesion.

### Primitive vs. Nonprimitive Factoring
**When to use**: When designing a reusable component interface.
**How**: Keep Primitive operations (which must access private implementation) on the flagship class; elevate Nonprimitive operations (which can be efficiently implemented on top of primitives) to a same-package `*util` component.
**Trade-offs**: Requires resisting the urge to add convenience methods; but prevents the flagship type from degenerating into a Winnebago.

### Vocabulary Type Isolation
**When to use**: When designing types used widely across the enterprise as interface currency (e.g., Date).
**How**: Keep them lightweight and focused; never mix in unstable or heavy dependencies (such as OS clocks); split related but independent functionality into separate util components.
**Trade-offs**: A restrained interface surface; but ensures the type remains stable over the long term and reusable in all contexts.

### Encapsulation vs. Insulation Distinction
**When to use**: When deciding how much implementation detail to expose.
**How**: Encapsulation = changing the implementation does not require rewriting client code (a logical property); Insulation = changing the implementation does not require recompiling client code (a physical property), achieved by hiding details in the .cpp file.
**Trade-offs**: Full insulation (pimpl/Protocol/PI) has runtime overhead; it is especially worthwhile for widely used low-level components.

## Testing Patterns

### Hierarchical Testability
**When to use**: When ensuring that every physical unit of a large-scale system can be thoroughly tested in isolation.
**How**: No test driver's physical dependencies may exceed the dependency scope of the component under test; test in level order (test lower levels first, and have higher levels reuse already-tested components).
**Trade-offs**: Requires strict testing discipline; but makes testability scale linearly with system size.

### Component Test Driver Organization
**When to use**: When writing tests for each component.
**How**: Associate each component with a dedicated test driver (.t.cpp) located in the same directory; test primitive operations first (primary manipulators and basic accessors), then rely on them to test higher-level functionality.
**Trade-offs**: Requires maintaining a test file per component; but ensures fine-grained test coverage.

## Organizational Patterns

### Separate Library and Application Teams
**When to use**: When the organization has both application development and library development needs.
**How**: Establish a dedicated library development team (with core team size m/N between 5% and 50%), following strict discipline to create reusable Software Capital; application development teams enjoy more freedom in organizational rules.
**Trade-offs**: Short-term opportunity cost (reduces immediate productivity); but long-term productivity grows super-linearly.

### Metadata-Driven Architecture
**When to use**: When you need to manage dependency relationships across large collections of components.
**How**: Use external metadata (`.dep` dependencies, `.mem` member manifests) to declare each aggregate's members and allowed dependencies; metadata is a by-decree design input - when code and metadata disagree, the code is wrong.
**Trade-offs**: Requires maintaining metadata; but enables automated tools (such as bde_verify) to verify design rules.

### Unique Enterprise-Wide Naming
**When to use**: When the organization develops multiple libraries that may be used together.
**How**: Every architecturally meaningful entity has a unique name across the entire enterprise; the package prefix is the first part of the component name (e.g., `bdlt_date` -> `bdlt` package -> `bdl` package group).
**Trade-offs**: Requires a central registry; but eliminates naming collisions and makes it possible to locate the physical location backwards from the point of use.

### Three-Level Physical Aggregation
**When to use**: When organizing the physical hierarchy of any library UOR.
**How**: Strictly adopt a three-level architecture: Component -> Package -> Package Group/UOR (approximately 500 lines/component x 20 components/package x 20 packages/group ~= 200,000 lines/UOR).
**Trade-offs**: Fewer than 2 levels is insufficient for management, more than 3 levels is hard to balance; three levels is the proven optimal balance.

### Parallel Creation over In-Place Modification
**When to use**: When you need incompatible new behavior, and the original component is already widely depended upon.
**How**: Create a new parallel component (e.g., an HTTP 1.0 parser coexisting with a 1.1 parser); never modify a depended-upon stable component in place.
**Trade-offs**: Short-term duplication; but protects the stability of existing clients and follows the open-closed principle.

### Hybrid Design (Top-Down + Bottom-Up)
**When to use**: When designing any application subsystem.
**How**: First design the application top-down, actively identify cross-cutting commonalities, and introduce or create reusable components bottom-up.
**Trade-offs**: Requires dual-thinking discipline; but avoids the no-reuse pitfall of pure top-down design.
