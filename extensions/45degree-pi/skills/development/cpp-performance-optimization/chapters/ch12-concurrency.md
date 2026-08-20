# Chapter 12: Concurrency Optimization

## Core Idea

Modern multi-core processors provide true hardware concurrency. The goal of concurrency is not to reduce instruction count, but to maximize compute resource utilization by keeping cores busy while other activities wait on events or resources. The key challenge: find enough independent tasks to saturate all available cores without oversubscribing threads.

## Key Techniques

- **Prefer `std::async` over `std::thread`**: Creating a `std::thread` costs ~135μs per start/stop on Windows (operating system table allocation, stack allocation, register initialization, scheduling). `std::async` may reuse threads from an internal thread pool. Testing shows `std::async` is ~14x faster than raw `std::thread` for short tasks. Always prefer `std::async` for fire-and-forget parallelism.

- **Match software threads to hardware threads**: Use `std::thread::hardware_concurrency()` to get the number of available cores. For compute-bound (runnable) threads, create exactly N threads for N cores. Beyond that, performance degrades toward zero as the OS spends all time context-switching. For waitable threads (I/O-bound), you can oversubscribe since they consume only a fraction of a core.

- **Implement task queues with thread pools**: A thread pool keeps a fixed number of persistent threads alive. A task queue holds pending computations. When a thread becomes available, it dequeues and executes the next task. This eliminates thread creation/destruction overhead entirely. Until C++17 standardizes thread pools, use Boost.Thread or Intel TBB.

- **Reduce critical section scope**: Code inside a mutex lock/unlock region serializes execution. Move non-shared work (especially I/O) outside the critical section. In one test, removing `cout` statements from inside a mutex increased throughput from ~40 operations/sec to 1.25 million operations/sec.

- **Limit concurrent thread count to avoid lock convoying**: When more threads than cores exist, a thread holding a mutex may be in the OS "runnable" queue (not actually executing). Another thread trying to acquire the mutex will busy-wait, timeout, then suspend. The mutex holder eventually runs and releases, but the waiter remains in the runnable queue for many milliseconds. This cascade kills throughput. The ideal number of threads contending for a short critical section is two.

- **Avoid the thundering herd**: When many threads wait on a single event and it fires, all become runnable simultaneously. Only one acquires the mutex; the rest discover the event was already serviced and suspend again. The OS wastes time restarting threads that make no progress. Limit the number of threads servicing a single event.

- **Use bounded producer-consumer queues**: If a producer outruns a consumer, data accumulates unboundedly, consuming all memory and starving the consumer of resources. Bound the queue length and block the producer when full. A queue length just large enough to smooth consumer variance is sufficient (often only a few elements).

- **Eliminate synchronization entirely when possible**: Event-driven programs (single-threaded framework dispatching handlers), coroutines (cooperative multitasking with explicit yield), and message-passing pipelines (stages connected by queues, no shared memory) all avoid mutex overhead. MPI, ZeroMQ, and Unix pipes exemplify the message-passing approach.

## Optimization Rules

1. Use `std::async` instead of raw `std::thread` for asynchronous tasks.
2. Keep the number of compute-bound threads ≤ `std::thread::hardware_concurrency()`.
3. Use thread pools and task queues to eliminate per-task thread creation overhead.
4. Shrink critical sections: only lock around shared data access; never do I/O inside a lock.
5. Limit threads contending for the same mutex; two is ideal for short critical sections.
6. Avoid waking many threads for a single unit of work (thundering herd).
7. Bound producer-consumer queues to prevent memory exhaustion.
8. Consider lock-free data structures (Boost.Lockfree, Intel TBB) for heavily contended containers.
9. Consider message-passing architectures that need no shared-memory synchronization.
10. Never busy-wait on a single-core system; always use OS synchronization primitives.
11. Avoid detached threads that wait forever; always provide a termination path.

## Code Examples

### Prefer async over thread

```cpp
// Bad: ~135μs per call on Windows
std::thread t([]() { return; });
t.join();

// Good: ~9μs per call, may reuse thread pool threads
std::async(std::launch::async, []() { return; });
```

### Match threads to hardware

```cpp
void multithreaded_timewaster(unsigned iterations, unsigned threads) {
    std::vector<std::thread> t;
    t.reserve(threads);
    for (unsigned i = 0; i < threads; ++i)
        t.push_back(std::thread(timewaster, iterations / threads));
    for (unsigned i = 0; i < threads; ++i)
        t[i].join();
}
// Best result when threads == std::thread::hardware_concurrency()
```

### Producer-consumer with condition variable

```cpp
std::mutex m;
std::condition_variable cv;
bool terminate = false;
int shared_data = 0;

// Consumer
auto consumer = [&]() {
    std::unique_lock<std::mutex> lk(m);
    do {
        cv.wait(lk, [&]() { return terminate || shared_data != 0; });
        if (terminate) break;
        // consume shared_data (do NOT do I/O here)
        shared_data = 0;
        cv.notify_one();
    } while (true);
};

// Producer
auto producer = [&]() {
    std::unique_lock<std::mutex> lk(m);
    for (int counter = 1; ; ++counter) {
        cv.wait(lk, [&]() { return terminate || shared_data == 0; });
        if (terminate) break;
        shared_data = counter;
        cv.notify_one();
    }
};
```

## Key Takeaways

1. Thread creation is expensive; reuse threads via `std::async` or thread pools.
2. Keep compute-bound thread count ≤ hardware thread count; oversubscription kills performance.
3. The critical section is the enemy of concurrency; minimize what happens inside every lock.
4. Lock convoying and thundering herd cause multi-millisecond stalls even when mutex hold time is short.
5. Bounded producer-consumer queues prevent runaway memory consumption.
6. Message-passing and event-driven architectures can eliminate synchronization entirely.
7. `std::atomic` operations with full memory fences are ~14x slower than non-atomic stores; use only when necessary.
8. Recursive and timed mutexes are warning signs of overcomplicated design; prefer simple `std::mutex`.
9. On single-core systems, busy-waiting wastes the entire time slice; use OS primitives.
10. Always provide a termination path for waiting threads; detached infinite-wait threads prevent clean shutdown.
