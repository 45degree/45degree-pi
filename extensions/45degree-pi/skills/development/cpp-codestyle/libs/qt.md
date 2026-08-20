# Qt 代码规范

Qt 专属编码规范和内存管理模式。通用 C++ 风格见上层 `SKILL.md`。

---

## Q_OBJECT 宏

所有 QObject 派生类必须包含 `Q_OBJECT` 宏：

```cpp
class MyClass : public QObject {
  Q_OBJECT

 public:
  // ...
};
```

---

## 信号命名

信号使用 **过去式 + "Changed" 后缀**：

```cpp
signals:
  void nameChanged();
  void sceneChanged();
  void positionChanged();
```

---

## 指针类型选择

| 类型 | 用途 |
|------|------|
| `QPointer<T>` | QObject 派生类 |
| `std::unique_ptr<T>` | 独占所有权 |
| `std::shared_ptr<T>` | 共享所有权（罕见） |
| 裸指针 | 非拥有引用 |

**始终初始化指针**：

```cpp
QPointer<QObject> m_child = nullptr;
```

---

## QPointer 模式

```cpp
QPointer<SceneNode> parent;
QPointer<SceneGraph> m_scene_graph = nullptr;
```

`QPointer` 在所指 QObject 被销毁时自动置空，防止悬空指针。所有 QObject 类型指针使用 `QPointer`，不使用裸指针。

---

## 所有权规则

- **Qt 对象树**：父子 QObject 关系管理生命周期。父对象销毁时子对象自动释放
- **非 Qt 对象**：独占所有权用 `std::unique_ptr`，仅在确实需要共享所有权时使用 `std::shared_ptr`
- **裸指针**：仅用于非拥有引用（函数参数、观察者引用）
- **"谁拥有这块数据"必须始终明确** — 绝不让所有权模糊不清

---

## 头文件组织

类声明在前，内联实现在类定义之后：

```cpp
#pragma once

#include <QObject>

#include "dependency.hpp"

namespace project {

class MyClass : public QObject {
  Q_OBJECT

 public:
  explicit MyClass(QObject* parent = nullptr);
  void method();
};

// Inline implementations
inline MyClass::MyClass(QObject* parent) : QObject(parent) {
  // Implementation
}

inline void MyClass::method() {
  // Implementation
}

}  // namespace project
```
