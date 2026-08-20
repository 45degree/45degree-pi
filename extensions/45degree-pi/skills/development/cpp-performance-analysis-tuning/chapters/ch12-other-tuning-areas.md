# Chapter 12: Other Tuning Areas

## Core Idea

本章汇集了不属于前几章分类但同样重要的优化主题：CPU 特定优化（ISA 扩展、CPU dispatch、指令延迟/吞吐量分析）、微架构特定性能问题（内存序违例、未对齐访问、缓存别名、亚正常浮点数）、低延迟调优技术（页面错误、缓存预热、TLB shootdown、核心节流），以及系统级调优和 LLC 敏感度案例研究。

## Frameworks Introduced

- **CPU Dispatch**:
  - When to use: 需要在单个代码库中为不同微架构提供优化路径时。
  - How: 使用 `__builtin_cpu_supports("avx512f")`（GCC/Clang）或 CPUID 指令在运行时检测硬件特性，分派到不同实现。
- **`-march` / `-march=native`**:
  - When to use: 指定目标微架构以启用对应的 ISA 扩展。
  - How: 生产构建应使用特定 `-march=arch`（如 `-march=armv8.6-a`）而非 `-march=native`，避免 CI/CD 老旧机器导致次优代码生成。
- **`uops.info` / 指令延迟表**:
  - When to use: 分析热循环时需了解具体指令的延迟、吞吐量、端口分配和 µop 数量。
  - How: 访问 uops.info 网站查询 Intel/AMD 处理器数据；Apple 处理器参考 [Apple, 2024, Appendix A]。
- **`#pragma clang fp contract(off)`**:
  - When to use: 当 FMA（fused multiply-add）将乘法加入关键依赖链导致性能下降时。
  - How: 在指定作用域内禁用 FMA 指令生成，阻止编译器融合乘加操作。
- **`mlockall` / `mlock`**:
  - When to use: 低延迟应用中防止内存页面被换出，避免运行时 minor page fault。
  - How: 启动时调用 `mlockall(MCL_CURRENT | MCL_FUTURE)` 锁定所有页面，配合 `M_MMAP_MAX=0`、`M_TRIM_THRESHOLD=-1` 等 glibc 调优。
- **AMX / SVE / SME (Matrix Extensions)**:
  - When to use: 深度学习或矩阵运算密集型 workload。
  - How: 通过编译器选项启用对应 ISA 扩展，使用内建函数或手写汇编。

## Key Concepts

- **Memory Order Violation**: CPU 的 load/store 重排序推测失败时，需冲刷流水线并重新执行，导致显著性能损失。
- **Split Load/Store**: 跨缓存行边界（64B）或跨页边界（4KB）的内存访问，需要额外的一次缓存/TLB 查找。
- **Cache Aliasing / Cache Trashing**: 不同内存地址映射到同一缓存组，导致相互驱逐；常见于 size 为 2 的幂次的矩阵。
- **Subnormal (Denormal) FP Value**: 指数部分小于最小正常数的非零浮点数；Intel 处理器通过微码辅助处理，可慢 10 倍以上。
- **FTZ / DAZ**: 将亚正常浮点数刷新为零的硬件模式，与 IEEE 754 不兼容但可大幅提升性能。
- **Minor Page Fault**: 首次访问新分配页面时触发的硬件中断，延迟从亚微秒到数微秒不等。
- **TLB Shootdown**: 多核系统中某核修改页表后，需通过 IPI 通知其他核使其 TLB 失效；线程数越多影响越大。
- **QoS Extensions (LLC allocation / memory bandwidth limiting)**: 服务器处理器提供的硬件级资源隔离能力，可为不同线程分配 LLC 空间和内存带宽。

## Mental Models

- **Use CPU dispatch as a "multi-version codebase in one binary"**: 对外保留通用 fallback，对内为特定微架构提供最优路径。维护成本随分派分支数线性增长。
- **Think of instruction latency vs. throughput as single-item vs. assembly-line cost**: 延迟影响关键依赖链；吞吐量影响独立操作的并行度。
- **Use partial histograms to break memory order violation chains**: 通过增加中间状态（2/4/8 个部分直方图）拉长同地址访问间隔，减少存储转发误预测概率。
- **Think of subnormal values as "IEEE 754's insurance policy"**: 防止下溢到零但代价高昂；性能关键场景下可以选择 "no insurance"（FTZ/DAZ）。
- **Use pre-faulting + mlockall as "memory warm-up" for latency-critical paths**: 启动时强制所有页面进入物理内存并锁定，消除运行时页面错误风险。

## Anti-patterns

- **仅凭指令延迟表做结论**: OoO 引擎可以隐藏延迟；只有处于关键依赖链上的指令才需要关注延迟，独立的操作应关注吞吐量。
- **对 FMA 指令的盲目信任**: FMA 虽好，但当乘法可并行而加法构成循环依赖链时，拆分乘法与加法反而更快。需分析循环携带依赖。
- **生产构建使用 `-march=native`**: 构建机器的特性可能弱于目标部署机器，导致错失优化机会。应指定具体的微架构级别。
- **频繁读写 MXCSR 寄存器**: 读取延迟高 + 写入序列化，应仅在启动时设置 FTZ/DAZ。
- **对 padding 带来的对齐收益过度乐观**: Padding 增加内存占用、降低带宽利用率，对于大矩阵的带宽敏感算法可能是净损失。

## Code Examples

```cpp
// CPU Dispatch example
if (__builtin_cpu_supports("avx512f")) {
    avx512_impl();
} else {
    generic_impl();
}
```

```asm
; FMA hurts performance (creates loop-carried dependency)
; Bad: fused multiply-add chains through xmm0
loop:
    vmovss       xmm1, dword ptr [rcx + 4*rdx]
    vfmadd231ss  xmm0, xmm1, xmm1    ; xmm0 = xmm0 + xmm1*xmm1 (4 cycles)
    inc          rdx
    cmp          rax, rdx
    jne          .loop
; Good: separate mul and add (mul parallel, add 2-cycle latency)
; vmulss xmm1, xmm1, xmm1
; vaddss xmm0, xmm0, xmm1
```

```cpp
// Aligned allocator for std::vector (cache line alignment)
template <typename T>
class CacheLineAlignedAllocator {
public:
    using value_type = T;
    static std::align_val_t constexpr ALIGNMENT{64};
    [[nodiscard]] T* allocate(std::size_t N) {
        return reinterpret_cast<T*>(::operator new[](N * sizeof(T), ALIGNMENT));
    }
    void deallocate(T* allocPtr, [[maybe_unused]] std::size_t N) {
        ::operator delete[](allocPtr, ALIGNMENT);
    }
};
template<typename T>
using AlignedVector = std::vector<T, CacheLineAlignedAllocator<T>>;
```

```c
// Subnormal value detection
unsigned usub = 0x80200000;  // -2.93873587706e-39 (subnormal)
unsigned unorm = 0x411a428e; // 9.641248703 (normal)
float sub = *((float*)&usub);
assert(std::fpclassify(sub) == FP_SUBNORMAL);

// Enable FTZ/DAZ
unsigned MXCSR = _mm_getcsr();
_mm_setcsr(MXCSR | 0x8000 | 0x0040);  // FTZ | DAZ
```

```c
// Pre-fault all pages + mlockall for low-latency initialization
#include <malloc.h>
#include <sys/mman.h>
mallopt(M_MMAP_MAX, 0);
mallopt(M_TRIM_THRESHOLD, -1);
mallopt(M_ARENA_MAX, 1);
mlockall(MCL_CURRENT | MCL_FUTURE);
char *mem = malloc(size);
for (int i = 0; i < size; i += sysconf(_SC_PAGESIZE))
    mem[i] = 0;
```

## Worked Example

**场景**: 矩阵乘法性能意外下降，经分析发现 AVX2 向量化后的 split loads/stores。

**问题**: 9×9 float 矩阵，每行 9 个元素。AVX2 一次加载 8 个 float（32 字节），但第二行起始地址不是 64 字节对齐的缓存行边界，导致每行第二个 load 跨缓存行（split load）。

**修复**:
1. 使用 `alignas(64)` 对齐矩阵起始地址。
2. 每行填充 dummy 列使行大小为 16（例如 9×16 矩阵），确保每行起始地址对齐到 64 字节。

**结果**: 性能提升达 30%（取决于矩阵大小和平台配置）。代价是额外内存占用——对于 9×9 小矩阵，利用率降低约一半；但对于 1025×1025 大矩阵，padding 开销可忽略。

## Key Takeaways

1. **CPU dispatch 是实现跨平台最优性能的标准手段**：保持通用 fallback，为特定微架构渐进式添加优化路径。
2. **指令延迟 vs. 吞吐量**：关键依赖链关注延迟，独立操作关注吞吐量；执行端口竞争是更深层的瓶颈。
3. **FMA 并非总是更快**：当 FMA 将可并行的乘法串行化到循环携带依赖链上时，拆分为独立 mul 和 add 可能双倍加速。
4. **内存序违例、缓存别名、split load/store** 是容易被忽视的性能 corner case，通过直方图拆分、padding、cache blocking 等方式修复。
5. **亚正常浮点数可通过 FTZ/DAZ 消除**，`-ffast-math` 或 `-mdaz-ftz` 可自动启用。
6. **低延迟应用需主动管理内存**：启动时 pre-fault + mlockall 消除 minor page fault；禁用 `munmap` 等系统调用避免 TLB shootdown。
7. **系统级调优是最后一道防线**：BIOS 设置、内核参数（numa_balancing、transparent huge pages）、QoS 扩展等可显著影响应用性能。

## Connects To

- **Ch 9.5 SIMD Intrinsics**: CPU dispatch 通常结合编译器内建函数实现 platform-specific SIMD 代码。
- **Ch 5.6.1 FMA Throughput**: 前文的 FMA 吞吐量案例与此处的 FMA 延迟案例形成对比。
- **Ch 3.8.3 Memory Ordering**: 内存重排序和 store-to-load forwarding 是 memory order violation 的基础机制。
- **Ch 3.6.1 Cache Organization**: 缓存别名问题根源于组相联缓存的 set/index 计算方式。
- **Ch 8.4 Huge Pages**: 大页对数据 TLB 的缓解与本章对 ITLB 的缓解原理一致。
- **Ch 13 Multithreaded Applications**: TLB shootdown 和核心节流是多线程低延迟应用的常见陷阱。
