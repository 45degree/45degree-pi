# Chapter 1: Compilers, Linkers, and Components

## Core Idea
The foundation of large-scale C++ software engineering lies in understanding physical design: how source code is transformed through the preprocessor, compiler, and linker into an executable program, and how we encapsulate logical entities into `.h`/`.cpp` pairs (i.e., components) that satisfy four essential properties - so that `#include` directives alone fully capture all physical dependencies, underpinning hierarchical, testable, and reusable architectures.

## Frameworks Introduced
- **Bindage (physical binding) three-way classification**: Replace the overused term linkage with bindage, and classify by "how uses and definitions are associated on a typical platform" into internal, external, and dual.
  - When to use: When deciding whether a construct must produce a symbol in the `.o`, and whether repeated definitions across translation units are permitted.
  - How: Inspect whether the compiler leaves artifacts in the `.o` - none means internal; present and globally unique means external; present but permitted to repeat and be merged means dual.
- **Four Component Properties**: The four necessary and sufficient properties that distinguish an ordinary `.h/.cpp` pair from a component (see Key Concepts).
  - When to use: When evaluating whether a pair of source files constitutes an independently testable, hierarchically reusable atomic unit.
  - How: Check Properties 1-4 one by one; failing any single one means it is not a component.
- **Implied Dependency inference**: Infer physical Depends-On from logical relationships (Is-A, Uses-In-The-Interface, Uses-In-The-Implementation, Uses-In-Name-Only).
  - When to use: During the design phase, before any code is written, to predict the physical architecture.
  - How: The first three relationships, when crossing component boundaries, necessarily introduce physical dependencies (Is-A and Uses-In-Impl always imply direct compile-time dependencies; Uses-In-The-Interface implies at least an indirect dependency); Uses-In-Name-Only introduces no dependency at all.
- **Levelization**: Assigning non-negative integer levels to an acyclic physical dependency graph.
  - When to use: When assessing whether a subsystem can be independently tested and reused in a layered fashion.
  - How: Non-local components have level=0; local leaf components have level=1; all others have level = max(level of dependencies) + 1. If every component can be assigned a level, the subsystem is levelizable.

## Key Concepts
- **Declaration**: A language construct that introduces a name into a scope.
- **Definition**: A construct that uniquely characterizes an entity in the program and, where appropriate, allocates storage.
- **(Logical) Linkage**: The rules, defined by standard C++, that determine whether names in different scopes/translation units refer to the same logical entity; categorized as no/internal/external.
- **Bindage**: The physical mechanism, on a typical platform, that binds the use of a name to its definition; categorized as internal/external/dual.
- **Internal Bindage**: Binding is completed at compile time within the current translation unit, leaving no artifacts in the `.o` (e.g., typedef, class definitions, enums, file-scope static).
- **External Bindage**: The definition must be unique across the entire program; the compiler produces a symbol in the `.o` for the linker to resolve (e.g., non-inline free functions, static data members).
- **Dual Bindage**: The definition may safely appear in multiple translation units; the compiler/linker may pick any one for binding (e.g., inline functions, implicitly instantiated function templates).
- **ODR (One Definition Rule)**: Every entity that is used has exactly one definition in the entire program; interpreted and implemented differently depending on the category of the construct.
- **Translation Unit**: The source-level intermediate representation formed when the preprocessor expands a `.cpp` along with all recursively included headers.
- **Object File (`.o`)**: The relocatable machine code produced by the compiler for a single translation unit; classically atomic.
- **Library Archive (`.a`)**: A library formed by packing multiple `.o` files with tools such as `ar`; a member `.o` is included only when it can resolve an undefined symbol (included on demand).
- **Component**: A `.h/.cpp` pair that satisfies the four Component Properties; the atomic unit of physical design.
- **Protocol Class**: A class that contains only pure virtual functions (plus a single non-inline virtual destructor defined in a `.cpp`), has no data members, and does not derive from any non-protocol class; the canonical example of Uses-In-Name-Only.
- **Levelizable**: A subsystem whose component physical dependency graph forms a DAG, and can therefore be assigned level numbers.
- **Includes**: If the contents of `y.h` are ultimately incorporated into the translation unit of `x.cpp`, then x Includes y.

## Mental Models
- **Think of bindage as "where the symbol resolution happens"**: internal = the compiler settles it internally; external = it must go to the linker and be globally unique; dual = the linker deduplicates, whichever is present is used.
- **Use Component Property 1-4 when auditing a `.h/.cpp` pair**: Violating any single one means it is not yet a component, and hierarchical reuse is out of the question.
- **Use level numbers as a cycle detector**: If a level number cannot be assigned, a physical dependency cycle exists; a cycle cannot be independently tested or reused in a layered fashion.
- **Think of a library archive as "lazy `.o`" vs. direct `.o` as "eager"**: A `.o` supplied directly on the command line is included in full; a `.o` inside a library is included only when it resolves a symbol - this asymmetry is the root of the Singleton registry trap.

## Anti-patterns
- **Re-declaring (rather than `#include`-ing the header) in the `.cpp` (violates Property 4)**: Drift in return types or signatures is not exposed at compile time, degrading into link-time or even runtime defects.
- **Self-registering Singleton via file-scope static objects + library archive deployment**: The library includes `.o` files on demand; unreferenced derived `.o` files are never pulled in, leaving the registry empty (Figure 1-10/1-11 trap).
- **Forming cyclic link dependencies across libraries**: A single-pass linker requires the libraries to be listed repeatedly (`libx.a liby.a libx.a liby.a`); link order becomes fragile and cannot be reused in a layered fashion.
- **Opening a namespace in a header to define free functions (rather than scoping with a struct)**: When the self-declared definition disagrees with the `.h` declaration, the compiler cannot detect it (Figure 1-16).
- **Putting superfluous `#include`s in a header**: Including "for convenience" introduces unnecessary compile-time coupling and obscures the real dependencies.

## Code Examples
```cpp
// shape.h - Protocol class exemplifying Uses-In-Name-Only
class Point;  // forward declaration suffices; no #include needed

class Shape {
public:
    virtual ~Shape();                    // non-inline virtual dtor defined in .cpp
    virtual Point origin() const = 0;    // pure virtual; Point used in name only
};

// shape.cpp
#include <shape.h>
Shape::~Shape() { }
```
- **What it demonstrates**: The Protocol class needs only a forward declaration of Point in order to compile, link, and be independently tested; the Shape component does not physically depend on the Point component - this is the essence of Uses-In-Name-Only.

## Worked Example
**Singleton Registry Trap (Section 1.2.5)** - The author constructs a process-global polymorphic object registry: `Registry::enter(name, exemplar)` is invoked by each derived class (e.g., `DerivedEntry1`) from within the constructor of a file-scope static object, achieving "self-registration". When all `.o` files are listed directly on the link line, everything works:

```
$ CC main.o registry.o baseentry.o derivedentry1.o derivedentry2.o ...
DerivedEntry1
DerivedEntry2
```

But once they are packaged into a library `libreg.a` and linked with `CC main.o libreg.a`, the output becomes `(* Empty Registry *)`. The reason: `.o` files inside a library are **included on demand**. `main.o` pulls in `registry.o` only because `Registry::print` generates an undefined symbol; afterwards there are no further undefined symbols, so none of the `derivedentry*.o` files ever enter the executable image, and the self-registration code never runs. Lesson: do not rely on the deployment form (command line vs. library) to determine logical behavior; avoid file-/namespace-scope static objects that require runtime initialization (see Vol II §6.2).

## Key Takeaways
1. Use bindage (internal/external/dual) as the primary mental model for deciding "whether a `.o` symbol is produced and whether repeated definitions across translation units are permitted."
2. Any `.h/.cpp` pair must satisfy all four Component Properties to qualify as a component; missing even one, there is no guarantee that `#include` alone captures the true dependencies.
3. Use Implied Dependency inference during the design phase to predict the physical architecture: Is-A, Uses-In-The-Interface, and Uses-In-Impl crossing component boundaries necessarily introduce dependencies, while Uses-In-Name-Only introduces none - leverage protocols and forward declarations to actively eliminate unnecessary compile-time coupling.
4. Having every `.cpp` include its corresponding `.h` as the first substantive line of code permanently eliminates include-order defects and ensures the header is self-sufficient.
5. The "on-demand vs. full" difference between library archives and direct `.o` files is a genuine behavioral trap - model third-party libraries and designs in terms of "atomic `.o`" when evaluating them.
6. Maintaining an acyclic physical dependency (levelizable) graph is the only way to obtain subsystems that can be independently tested and reused in a layered fashion; an unassignable level number is an architectural alarm.
7. A script that parses only `#include` directives (e.g., in Perl) can continuously verify in CI that dependencies conform to the design, orders of magnitude faster than full C++ parsing.

## Connects To
- **Ch 0**: This chapter grounds the Software Capital, hierarchical reuse, and fine-grained modularity introduced in Ch 0 at the C++ physical layer; the component is their atomic carrier.
- **Ch 2**: The four Component Properties and the Depends-On/levelization presented here are formalized in Ch 2 into the strict definition of a component (§2.6), and extended to larger physical aggregates and release units such as packages (§2.7) and package groups (§2.8).
- **Ch 3 (Vol I)**: The Uses-In-Name-Only, Protocol class, and Implied Dependency concepts from this chapter provide the prerequisite terminology for the levelization techniques of Ch 3 (e.g., Opaque Pointers §3.5.4) and compile-time decoupling (§3.10, §3.11).
- **Vol II**: Bindage/ODR details (inline, templates, extern template, unnamed namespaces) are explored in depth in Vol II §4.5, §6.2, §6.6, §6.8; testing strategies appear in Vol III Ch 7.
