---
name: cpp-codestyle
description: "C++ style rules NOT enforced by clang-format/clang-tidy — naming, include guards, forward declarations, class organization, accessor design, comment hierarchy, expression style. Use when writing or reviewing any .cpp/.h/.hpp/.inl. Modern idiom selection → cpp-modern-idioms. Performance → cpp-performance-optimization / cpp-performance-analysis-tuning. Qt conventions → libs/qt.md."
---

# C++ Code Style

Rules here complement (not overlap) clang-format (formatting) and clang-tidy (`override`, `= default`, `[[nodiscard]]`, `noexcept`, member init). For Qt-specific conventions, read `libs/qt.md`.

---

## Naming Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| **Classes** | PascalCase | `SceneNode`, `EditorController` |
| **Functions/Methods** | snake_case | `set_local_transform()`, `get_uuid()` |
| **Member Variables** | `m_` prefix + snake_case | `m_name`, `m_scene` |
| **Parameters** | snake_case | `parent`, `transform` |
| **Template Parameters** | PascalCase | `Node`, `Args` |

---

## Include Rules

### Include Guards
Always use `#pragma once`, never `#ifndef/#define/#endif`.

### Forward Declarations
Prefer `#include` over forward declarations. Forward declarations are only allowed for:
1. **Circular dependencies**: two classes reference each other
2. **Friend declarations**: declaring a friend class

---

## Namespace

- Code belongs in the project namespace
- **No anonymous namespaces**: use `static` functions for file-local helpers
- **No `detail` namespace**: do not create `namespace detail` for internal implementation unless explicitly requested. Use `static` functions or private class members instead.
- **No namespace aliases** (`namespace fs = std::filesystem;`): always use the full namespace name
- **No redundant namespace qualification**: when referencing a symbol from within the same namespace, omit the namespace prefix

```cpp
// Bad -- redundant qualification inside the same namespace
namespace example {
class A {};

example::A func();
}

// Good -- unqualified within the same namespace
namespace example {
class A {};

A func();
}
```

```cpp
namespace my_project {

class MyClass { /* ... */ };

}  // namespace my_project
```

---

## Class Organization

### Method Separation
Exactly one blank line between each method declaration/definition.

### Logical Grouping
Use separate `public:` / `protected:` / `private:` access specifiers for each logical group.

Category comments (`/* ... */`) are only needed for **custom / domain-specific** method groups — business logic, queries, mutators, resource management, etc. **Do not** add category comments for standard C++ method groups that are self-evident from their signatures:

| No comment needed (self-evident) | May need comment (domain-specific) |
|---|---|
| Constructors / destructor | Business logic methods |
| Comparison operators (`==`, `!=`, `<`, `>`) | Resource / timeline operations |
| `operator bool()` / conversion operators | Queries and mutators |
| Copy / move constructors & assignments | Validation / helper methods |
| Iterator / STL boilerplate | Subsystem integration methods |

```cpp
class MyClass {
 public:
  MyClass();

  explicit MyClass(int value);

  ~MyClass();

  bool operator==(const MyClass& other) const;

  explicit operator bool() const { return m_value > 0; }

  /* Type queries */
 public:
  [[nodiscard]] bool is_valid() const { return m_value > 0; }

  [[nodiscard]] int value() const { return m_value; }

  /* Mutators */
 public:
  void set_value(int v) { m_value = v; }

  void reset() { m_value = 0; }

 private:
  int m_value = 0;
};
```

### Member Variable Occam's Razor
Every member variable must have a clear, irreplaceable reason to exist. These are **not** valid reasons:
- "We might need it later" — YAGNI, don't add it
- "Avoid recomputation" — profile first, don't prematurely optimize
- "Handy for debugging/logging" — debug scaffolding left in becomes technical debt
- "It was passed in from outside, keep a copy" — values used only within a single call chain belong as parameters
- "Multiple places need this data" — data should not be duplicated; derive or query from a single authoritative source

**Alternatives**:
| Instead of adding a member to... | Do this instead |
|---|---|
| Cache a computed result | Profile first; cache only after confirming bottleneck, using `m_cached_xxx` + `m_xxx_dirty` |
| Store something "just in case" | Fetch on demand via a query method |
| Hold a method argument | Pass it as a parameter |
| Mirror a field from another object | Hold a reference or pointer to that object and query as needed |

---

## Function Definitions

**Rule**: Functions longer than 1 line must be defined outside the class body using `inline`.

```cpp
// Good -- single-line functions inside class
class Foo {
 public:
  int getValue() const { return m_value; }

  void setValue(int v) { m_value = v; }

 private:
  int m_value = 0;
};

// Good -- multi-line functions outside class with inline
class Bar {
 public:
  void complexOperation();
};

inline void Bar::complexOperation() {
  doSomething();
  doSomethingElse();
}
```

### When to use .cpp files
Only when the function is long (approaching 10 lines), for PIMPL idiom, or when needing complex external headers.

---

## Expression Style

### No Chained Calls as Function Arguments
Fluent API chains that span multiple lines must not appear as arguments to an outer function call. The chain is harder to read when embedded inside parentheses, and the intermediate object has no name. Extract the chain into a named variable first, then pass that variable.

```cpp
// Bad -- multi-line chain embedded in push_back()
wait_semaphores.push_back(vk::SemaphoreSubmitInfo{}
                              .setSemaphore(vk_fence->vk_semaphore())
                              .setValue(signal.value)
                              .setStageMask(vk::PipelineStageFlagBits2::eAllCommands));

// Good -- extract to named variable, then pass
vk::SemaphoreSubmitInfo wait_semaphore{};
wait_semaphore.setSemaphore(vk_fence->vk_semaphore());
wait_semaphore.setValue(signal.value);
wait_semaphore.setStageMask(vk::PipelineStageFlagBits2::eAllCommands);
wait_semaphores.push_back(wait_semaphore);
```

This applies equally to initializer lists, lambda captures, and any context where a multi-line expression is nested inside another call.

---

## Accessor Design Principles

### 1. Simple properties: use the name directly, no prefix
Cheap, side-effect-free reads that return a stored value:

```cpp
// Good
uint8_t r() const { return m_r; }

size_t vertex_count() const { return m_vertex_count; }

// Bad -- get_ prefix on simple stored-value accessors adds noise
FVec3f get_position() const { return m_position; }
```

### 2. Expensive or query-based reads: use `query_` prefix
Use `query_` when the call crosses a subsystem boundary, involves non-trivial computation, or allocates a result:

```cpp
std::vector<std::string> query_all_keywords() const;

std::vector<std::string> query_enabled_keywords() const;
```

### 3. Writes with side effects: use `set_` prefix
Use `set_` when the write propagates through an API boundary, triggers a signal, or causes cascading state updates:

```cpp
void set_intensity(float intensity);

void set_position(const FVec3f& position);
```

### Setter Necessity Review
Before writing `set_xxx()`, ask three questions:
1. **Does external code actually need to set this value?** -- most internal state should not have setters; prefer constructor injection
2. **What state does changing this implicitly affect?** -- document affected members in the comment
3. **Is there a required call order between this setter and others?** -- document ordering constraints

### Setter Design Constraints
- **Don't write a setter for pure assignment** -- use a public member or constructor injection
- **Keep setters single-responsibility** -- validation, computation, and dispatch go in separate methods
- **Avoid circular setter dependencies** -- document the call relationship explicitly
- **Never silently reject invalid input** -- use `assert` or return an error

---

## Error Handling

| Mechanism | When to use |
|-----------|-------------|
| **Exceptions** | Unrecoverable non-local errors (parse errors, type mismatches) |
| **`std::optional` / error codes** | Expected, recoverable outcomes |
| **`assert()` with message** | Programming errors and invariants |
| **Logging** | Diagnostics and non-fatal conditions |

```cpp
// Good -- unrecoverable error throws a typed exception
if (!best) throw TypeError(location, "no matching overload");

// Good -- recoverable miss uses optional
std::optional<Match> score_overload(...) const;

// Good -- programming error uses assert
assert(ptr && "callee must not be null");
```

- Don't use exceptions for ordinary control flow
- Prefer a small set of well-defined exception types

---

## Comment Rules

### Language
Write comments and documentation in English.

### Comment Hierarchy
Comments serve two distinct roles. Use the appropriate style for each:

- **Section comments** (`/* xxx */`): Mark a logical code block or access-control group. Placed on the line above the block they describe. These act as structural separators that help readers scan the code.
- **Detail comments** (`// xxx`): Explain a single line or a small group of lines. Use for intent, rationale, or non-obvious side effects.

```cpp
/* Build wait-semaphore list from pending fence signals */

// Each FgfxFenceSignal resolves to a (timeline semaphore, value) pair that
// this submission must wait for before any work begins.
std::vector<vk::SemaphoreSubmitInfo> wait_semaphores;
// ...
```

- **Never** use separator-line style comments: `// --- xxx ---` or `// === xxx ===`.
- **No `///` triple-slash comments** on classes or methods — use Doxygen `/** */` (see below) for symbol-level API docs.
- If a code block is self-explanatory (well-named functions, clear control flow), omit the section comment entirely — the structure should speak for itself.

### Doxygen Format (symbol-level API docs)
Use `/** */` with `@brief`, `@param`, `@return` tags:

```cpp
/**
 * @brief Returns the held bool value.
 * @return The bool value, or an error if kind is wrong.
 */
[[nodiscard]] Expected<bool> as_bool() const;
```

### Inline Comments
- Comments should explain **intent (why)**, not mechanics (how)
- **Self-documenting code needs no comment** — well-named functions and clear control flow remove the need for explanatory comments. Delete a comment if it adds nothing beyond what the code already says.
- **No class-level description comments** — do not write multi-line prose above a class definition describing what it does. That information belongs in a Doxygen `@brief` or an external design document.
- Use end-of-line comments on data declarations to annotate units, ranges, and meanings
- Never write comments that merely restate what the code already says

```cpp
// Good -- explains why
total += fee;  // Include settlement fee required by gateway contract.

// Bad -- restates the code with no added value
total += fee;  // Add fee to total.
```

---

## 库专属规范

编写以下库的代码时，请同时读取对应子文件：

| 库 | 规范文件 |
|---|---------|
| Qt | `libs/qt.md` |
