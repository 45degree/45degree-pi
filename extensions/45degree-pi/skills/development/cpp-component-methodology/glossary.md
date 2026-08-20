# Glossary — Component-Based Physical Design in C++

> All key terms from the book, alphabetically sorted. Each entry includes a concise definition and the chapter where it is introduced.

## A
- **Aggregate**: A cohesive physical design unit that holds logical content. (Ch 2)
- **Architecturally Significant**: A logical or physical entity is architecturally significant if its name (or symbol) is **intentionally visible** outside the UOR in which it is defined. (Ch 2)
- **Allowed Dependency**: A physical dependency — typically expressed via external metadata — that is permitted to exist within the physical hierarchy to which it belongs. (Ch 2)
- **Aspect Function**: A named (member or free) function with a particular signature that has universally consistent semantics (e.g., begin or swap); if it is a free function, it behaves much like an operator — for example, with respect to ADL. (Ch 2)

## B
- **Base Name (of a component)**: The root name of a component's header file, excluding its package prefix and the trailing underscore. (Ch 2)
- **Bindage, Internal**: A C++ construct has internal bindage if, on a typical platform, the binding of the **declared** name of the construct to its corresponding **definition** (or meaning) is always in effect at **compile time**. (Ch 1)
- **Bindage, External**: A C++ construct has external bindage if, on a typical platform, the corresponding **definition** must not appear in **multiple** translation units of the program (e.g., to avoid linker errors from multiply-defined symbols). (Ch 1)
- **Bindage, Dual**: A C++ construct has dual bindage if, on a typical platform, (1) the corresponding definition may safely appear in **multiple** translation units of the same program, and (2) the binding of the construct's declared name to its corresponding definition can occur at **link time**. (Ch 1)

## C
- **Component**: The innermost level of physical aggregation. A component consists of exactly one .h file and one corresponding .cpp file (also defined as a .h/.cpp pair that satisfies four fundamental properties). (Ch 2)
- **Component-Private Class**: A class (or struct) defined at package namespace scope that **must not** be used directly by any logical entity outside the defining component. (Ch 2)
- **Compile-Time Dependency**: Component y has a compile-time dependency on component x if compiling y.cpp requires x.h. (Ch 1)
- **Corollary**: A necessary conclusion that follows naturally from a design rule or definition. (Throughout)

## D
- **Declaration**: A language construct that introduces a **name** into a scope. (Ch 1)
- **Definition**: A language construct that **uniquely characterizes** an entity in the program and, where applicable, **reserves storage** for it. (Ch 1)
- **Depends-On (components)**: Component y Depends-On component x if compiling or linking y requires x. (Ch 1)
- **Depends-On (aggregates)**: Aggregate y Depends-On aggregate x if compiling, linking, or **thoroughly testing** y requires any file within aggregate x. (Ch 2)
- **Design Imperative**: An absolute design constraint that must be obeyed unconditionally (violation leads to undefined behavior or invalidates the methodology). (Ch 2)
- **Design Rule**: An objectively verifiable logical or physical design provision that must be obeyed. (Ch 2)

## E
- **Encapsulated**: An implementation detail (type, data, or function) of a component is encapsulated if it can be modified, added, or removed **without forcing clients to rework** their code. (Ch 3)

## G
- **Guideline**: A recommended best practice that may be deviated from for justified reasons. (Ch 2)

## I
- **Includes**: Component x Includes component y if the contents of y.h are **ultimately incorporated** into the translation unit corresponding to x.cpp during compilation (for any supported build target). (Ch 1)
- **Insulated**: An implementation detail of a component is insulated if it can be modified, added, or removed **without forcing clients to recompile**. (Ch 3)
- **Irregular Package**: A package that is **not** composed entirely of appropriate components that obey our design rules (especially those relating to cohesive naming). (Ch 2)

## L
- **Level Numbers**: An acyclic physical dependency enables canonical level numbering for components: Level 0 = non-local components; Level 1 = local components that do not depend on any other local component (leaf components); Level N = a component that physically depends on at least one Level N-1 local component, but does not depend on any Level N or higher component. (Ch 1)
- **Levelizable**: A software subsystem expressed in terms of components is **levelizable** if it can be assigned level numbers. (Ch 1)
- **Link-Time Dependency**: Component y has a link-time dependency on component x if the object file y.o produced by compiling y.cpp contains an undefined symbol that the linker requires x.o to resolve. (Ch 1)

## M
- **Malleable Software**: Software whose behavior is **expected to change**. Application software is typically malleable. (Ch 0)
- **Manifest**: A specification of the content set of a physical aggregate — typically expressed via external metadata. (Ch 2)

## O
- **Observation**: An empirical fact or natural consequence derived from the methodology. (Throughout)

## P
- **Package**: (1) The smallest architecturally significant physical aggregate that is larger than a component. (2) An architecturally significant collection of components, (a) organized as a physically cohesive unit, (b) sharing a common package namespace. (Ch 2)
- **Package Group**: An architecturally significant collection of packages, organized as a physically cohesive unit. (Ch 2)
- **Primitive Operation**: A function is a **primitive operation** of its operating type if, **by its very nature**, it requires **private access** to objects of that type in order to be implemented efficiently. (Ch 3)
- **Protocol Class**: A class that: (1) has only pure virtual functions apart from a non-inline virtual destructor (defined in the .cpp file), (2) has no data members, and (3) does not directly or indirectly derive from any class that is not itself a protocol class. (Ch 1)

## S
- **Stable Software**: Software whose behavior **does not change**. Library software must be stable in order to be reused levelizably. (Ch 0)
- **Subordinate Component**: A component that **must not** be directly #included (or used) by any component other than the one it is explicitly designated as subordinate to (located within the same package); a component may be subordinate to at most one non-subordinate component. (Ch 2)

## T
- **Transitive Include**: Means that a client **relies on** one header including another header in order to **directly use**, indirectly, functionality supplied via the nested include. (Ch 2)

## U
- **Unit of Release (UOR)**: The outermost level of physical aggregation. (Ch 2)
- **Uses-In-The-Interface**: A type is **used in the interface** of a function if it is named as part of the function's signature or return type; for a class, a type is used in its interface if it appears in the interface of any (public) member function of the class. (Ch 1)
- **Uses-In-The-Implementation**: A type is **used in the implementation** of a function if it is referenced anywhere within the function's definition but is not named in its public (or protected) interface. (Ch 1)
- **Uses-In-Name-Only**: A special case of Uses-In-The-Interface in which the type appears only through a pointer or reference — typically achieved via a Protocol Class. (Ch 1)
