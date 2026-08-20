# Chapter 7: The Concurrency API

## Core Idea

C++11's concurrency API provides two levels of abstraction: low-level `std::thread` (manual thread management) and high-level task-based programming (`std::async`, `std::future`, `std::promise`). Task-based programming is almost always superior -- it handles load balancing, avoids oversubscription, and simplifies exception propagation. The chapter also covers thread lifecycle management, communication primitives, and the critical distinction between `std::atomic` (for concurrency) and `volatile` (for special memory).

## Items

### Item 35: Prefer Task-Based Programming to Thread-Based
**Rule**: Use `std::async` (task-based) instead of manual `std::thread` creation (thread-based).
**When to apply**: Whenever you need to run work asynchronously and can express it as a function returning a value.
**Key example**:
```cpp
// Thread-based: manual management, risk of oversubscription
int doWork();
std::thread t(doWork);
t.join(); // must manage join/detach manually

// Task-based: automatic management, work-stealing, exception propagation
auto fut = std::async(doWork);  // default launch policy
int result = fut.get();        // blocks, propagates exceptions
```
**Why it matters**: Task-based code gets thread management from the runtime (work-stealing, avoiding oversubscription) and provides a natural channel for return values and exceptions. Thread-based code requires manual `join`/`detach`, explicit synchronization for results, and doesn't participate in the system's thread pool. Use `std::thread` only when you need direct access to the underlying platform thread API.

### Item 36: Specify std::launch::async if Asynchronicity Is Essential
**Rule**: When you need guaranteed asynchronous execution on a separate thread, pass `std::launch::async` explicitly.
**When to apply**: When deferred execution (lazy evaluation on `get()`/`wait()`) would break your code, e.g., when using `thread_local` variables or when you need the work to run concurrently.
**Key example**:
```cpp
// Default policy: async OR deferred -- unpredictable which
auto futDefault = std::async(doWork);

// Guaranteed async: runs on a separate thread immediately
auto futAsync = std::async(std::launch::async, doWork);

// Test which policy was used (fragile, don't depend on this in production)
if (fut.wait_for(std::chrono::seconds(0)) == std::future_status::deferred) {
    // task was deferred, not running on a separate thread
}
```
**Why it matters**: The default launch policy (`std::launch::async | std::launch::deferred`) makes it impossible to predict whether the task runs on its own thread. This breaks `thread_local` variables, causes `wait_for`/`wait_until` loops to spin forever (always returns `deferred`), and makes timeout-based task cancellation impossible. Be explicit about your threading requirements.

### Item 37: Make std::threads Unjoinable on All Paths
**Rule**: Ensure every `std::thread` object is either `join()`ed or `detach()`ed before destruction -- including on exception paths.
**When to apply**: Every time you create a `std::thread`.
**Key example**:
```cpp
// WRONG: std::terminate if doWork throws before join()
std::thread t(doWork);
someFunctionThatMightThrow();
t.join();

// RIGHT: RAII wrapper guarantees join on all paths
class ThreadRAII {
    std::thread t;
public:
    enum class DtorAction { join, detach };
    ThreadRAII(std::thread&& t_, DtorAction a) : t(std::move(t_)), action(a) {}
    ~ThreadRAII() {
        if (t.joinable()) {
            if (action == DtorAction::join) t.join();
            else t.detach();
        }
    }
    std::thread& get() { return t; }
};
```
**Why it matters**: A joinable `std::thread`'s destructor calls `std::terminate` -- a program-ending crash. This includes exception paths. `detach()` avoids the crash but breaks the parent-child thread relationship (making it impossible to join later). A custom RAII wrapper is the only reliable solution: explicitly choose join or detach as destruction policy.

### Item 38: Be Aware of Varying Thread Handle Destructor Behavior
**Rule**: `std::future` destructors do NOT block, except for the final future referencing a shared state created by `std::async`.
**When to apply**: When architecting task pipelines or when discarding futures from `std::async`.
**Key example**:
```cpp
// This future's destructor WILL BLOCK until the async task completes
{
    auto fut = std::async(std::launch::async, longRunningTask);
} // <-- destructor blocks here (last reference to std::async shared state)

// These futures' destructors do NOT block
{
    std::promise<int> p;
    auto fut = p.get_future();
    // ... fut destructor: just decrements ref count, no block
}
{
    std::packaged_task<int()> pt(someTask);
    auto fut = pt.get_future();
    // ... fut destructor: no block (task runs via operator() on pt)
}
```
**Why it matters**: The blocking behavior is unique to shared states created by `std::async`. This implicit join-like behavior means discarding a future from `std::async` can block the calling thread. Understanding this is critical for responsive UI threads and throughput-sensitive server code.

### Item 39: Consider Void Futures for One-Shot Event Communication
**Rule**: Use `std::promise<void>` / `std::future<void>` for one-shot signaling between threads instead of condition variables when possible.
**When to apply**: For one-shot events (detection task completes, initialization done, shutdown signal). Use condition variables only for repeated notifications.
**Key example**:
```cpp
// Simple one-shot signaling
std::promise<void> readySignal;
auto readyFuture = readySignal.get_future();

// Detector thread
std::thread detector([&readySignal]() {
    if (eventDetected()) {
        readySignal.set_value();  // signal once
    }
});

// Reactor thread
readyFuture.wait();  // blocks until signaled, no spurious wakeups
// Use shared_future if multiple threads need to wait
```
**Why it matters**: Condition variables have two fundamental problems: spurious wakeups (thread wakes without notification) and missed wakeups (notifier runs before waiter calls `wait`). Promises/futures solve both: no spurious wakeups, and the future remembers the signal even if set before `wait()`. The cost is that they work only once -- for repeated signals, condition variables are still the right tool.

### Item 40: Use std::atomic for Concurrency, volatile for Special Memory
**Rule**: `std::atomic` is for concurrent access by multiple threads. `volatile` is for special memory (memory-mapped I/O, signal handlers). They are NOT interchangeable.
**When to apply**: `std::atomic`: any variable shared between threads. `volatile`: hardware registers, memory-mapped I/O addresses, variables accessed in signal handlers.
**Key example**:
```cpp
std::atomic<int> ai(0);  // thread-safe reads and writes
volatile int vi(0);      // tells compiler: "don't optimize reads/writes"

// std::atomic: RMW operations are atomic, prevents tearing
ai++;  // atomic increment -- no data race

// volatile: prevents compiler from optimizing away repeated reads
while (vi == 0) {}  // compiler must re-read vi each iteration

// But volatile does NOT make multi-threaded code correct:
volatile int counter = 0;
// ++counter from two threads is STILL a data race even with volatile!
```
**Why it matters**: `volatile` provides zero concurrency guarantees -- no atomicity, no ordering relative to other memory operations. It only tells the compiler not to optimize away loads/stores. Using `volatile` for thread synchronization is a common C++98 legacy error. Conversely, `std::atomic` may be optimized by the compiler (e.g., redundant stores eliminated) because its purpose is correctness, not preventing optimization.

## Key Takeaways

1. **Task-based > thread-based**: `std::async` handles scheduling, exceptions, and return values automatically.
2. **Always specify launch policy**: `std::launch::async` when you need guaranteed concurrent execution.
3. **Make threads unjoinable before destruction**: Use an RAII wrapper that joins or detaches on all paths.
4. **`std::future` destructors have special semantics**: Only futures from `std::async` block on destruction.
5. **Promises/futures for one-shot events**: Avoid condition variable pitfalls (spurious/missed wakeups).
6. **`atomic` for threads, `volatile` for hardware**: Never confuse the two -- they serve entirely different purposes.
