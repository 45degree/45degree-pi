# Appendix A: Reducing Measurement Noise

## Core Idea
Performance measurements are polluted by non-deterministic factors (frequency scaling, SMT, scheduler interference). Controlling these variables is essential for reproducible, trustworthy benchmarks.

## Key Concepts

- **Dynamic Frequency Scaling (DFS)**: CPUs automatically raise/lower frequency based on workload. Turbo Boost (Intel) and Turbo Core (AMD) cause variable clock speeds that make measurements unreproducible across runs.
- **Simultaneous Multithreading (SMT)**: sibling hardware threads share execution resources. Disabling SMT removes one source of variability and simplifies core-count scaling analysis.
- **Scaling Governor**: Linux kernel policy that controls CPU frequency. The `performance` governor locks frequency at maximum to avoid sub-nominal clocking.
- **CPU Affinity**: binding a process to specific core(s) eliminates context-switch migrations (`cpu-migrations`), reducing measurement noise.
- **Process Priority**: increasing priority with `nice -n -<N>` reduces preemption by other processes, decreasing `context-switches` during measurement.

## Code Examples

```shell
# Disable Turbo Boost (Intel)
echo 1 | sudo tee /sys/devices/system/cpu/intel_pstate/no_turbo

# Disable Turbo Core (AMD)
echo 0 | sudo tee /sys/devices/system/cpu/cpufreq/boost

# Set performance scaling governor
echo performance | sudo tee /sys/devices/system/cpu/cpufreq/policy*/scaling_governor

# Pin process to core 0 with taskset
perf stat -e context-switches,cpu-migrations -r 10 -- taskset -c 0 ./a.exe

# Reserve CPUs with cset shield
cset shield -c N1,N2 -k on
cset shield --exec -- perf stat -r 10 <cmd>

# Increase process priority (highest: -20)
sudo nice -n -5 taskset -c 1 ./a.exe
```

```shell
# Disable SMT sibling of core 0
echo 0 | sudo tee /sys/devices/system/cpu/cpu4/online

# Verify sibling topology
lscpu --all --extended
cat /sys/devices/system/cpu/cpu0/topology/thread_siblings_list
```

```shell
# Windows: pin to cores 6 and 7 (mask 0xC0)
start /wait /b /affinity 0xC0 myapp.exe
```

## Key Takeaways

- Disable DFS (Turbo Boost/Core) when measuring CPU-bound workloads to eliminate frequency variability.
- Set scaling governor to `performance` to avoid sub-nominal clocking.
- Use `taskset` (Linux) or `start /affinity` (Windows) to pin processes and eliminate migration noise.
- Use `cset shield` to isolate CPUs from kernel interference for critical benchmarks.
- Increase process priority (`nice -n -5`) to reduce preemption-based context switches.
- Disable SMT when analyzing single-threaded performance or when SMT scaling effects confound results.
- macOS does not provide an API for thread-to-core pinning — account for this in cross-platform benchmarking.

## Connects To

- Ch 2 (Measuring Performance): the foundational discussion of measurement noise and reproducibility.
- Ch 13 (Optimizing Multithreaded Applications): thread count scaling study requires controlled frequency and SMT settings to isolate scaling behavior from measurement noise.
- Appendix B (Enable Huge Pages): another system configuration technique that impacts measurement stability.
