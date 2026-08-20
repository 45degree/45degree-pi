# Chapter 10: Optimizing Branch Prediction

## Core Idea

Branch mispredictions incur a 10–25 cycle penalty per occurrence due to pipeline flush and recovery. 本章介绍了将难以预测的分支替换为无分支等效操作的直接方法（查表、算术运算、条件选择、SIMD），以及通过减少动态分支数量来减轻分支预测器压力的间接方法。

## Frameworks Introduced

- **TMA Bad Speculation 指标**:
  - When to use: 当需要量化分支误预测对整个程序性能的影响程度时。
  - How: 查看 TMA 分解中的 Bad Speculation 指标；正常范围 5–10%，超过 10% 需要关注。
- **`__builtin_unpredictable` / `[[likely]]` / `[[unlikely]]`**:
  - When to use: 向编译器提示分支条件难以预测（或具有明确倾向性），引导编译器生成分支预测友好的代码。
  - How: 在条件表达式中包裹 `__builtin_unpredictable(cond)`（Clang-17+），或在 C++20 中使用 `[[unlikely]]` 属性。

## Key Concepts

- **Branch Misprediction Penalty**: CPU 清空推测执行的指令并重新填充流水线所需的 10–25 个周期。
- **Cold / Capacity / Conflict Misses (BPU)**: 分支预测单元（BPU）同样受缓存问题影响——首次遇到的分支（cold）、历史记录被覆盖（capacity）、多分支映射到同一缓存条目（conflict）都会导致误预测。
- **Bad Speculation (TMA)**: TMA 顶层指标，衡量因误预测而浪费的流水线周期。
- **CMOV (Conditional Move)**: x86 的条件移动指令，将控制依赖转换为数据依赖，消除分支。
- **Conditional Selection (CSEL / CSINC / CSNEG)**: ARM ISA 中的条件选择指令系列。
- **MSROM (Microcode Sequencer)**: 处理复杂或异常微操作的微码引擎（如处理亚正常浮点数时被调用）。
- **FTZ / DAZ (Flush To Zero / Denormals Are Zero)**: 将亚正常浮点数刷新为零的硬件模式，避免微码辅助开销。
- **Split Load/Store**: 跨缓存行边界的内存访问，需要两次缓存行读取，可能引发性能惩罚。

## Mental Models

- **Use branchless code when the branch pattern is unpredictable**: 如果分支结果近似随机（50% 预测率），分支版本可能比无分支版本更慢。
- **Think of CMOV as converting control dependency into data dependency**: 消除了分支但增加了计算量（同时执行两条路径），适用于小函数体。
- **Use lookup tables when the mapping is dense and the range is small**: 当值域有限且密集时，查表可以替换整个分支链，用一次内存访问换取预测失败的风险消除。
- **Use SIMD "multiple tests single branch" when processing large homogeneous data**: 每次处理多个元素，用一个分支代替多个分支，特别适合字符处理类算法。

## Anti-patterns

- **对总是正确预测的分支使用无分支代码**: 分支指令允许 CPU 推测执行，完全可以隐藏延迟；强制使用 CMOV 反而增加不必要的工作量。
- **无差别地使用 `__builtin_unpredictable`**: 仅在 TMA 确认该分支误预测率很高时才使用；否则编译器默认选择分支指令是合理的。
- **对大函数体使用 selection 消除分支**: 如果 `computeX` 和 `computeY` 很大且无法内联，无论如何都需要调用它们，分支误预测的代价可能低于同时执行两个大函数。

## Code Examples

```c
// Listing 10.1: Replace branches with lookup table
int8_t mapToBucket(unsigned v) {
    if (v < 10) return 0;
    else if (v < 20) return 1;
    else if (v < 30) return 2;
    else if (v < 40) return 3;
    else if (v < 50) return 4;
    return -1;
}
// => branchless with lookup table:
int8_t buckets[50] = {
    0,0,0,0,0,0,0,0,0,0,
    1,1,1,1,1,1,1,1,1,1,
    2,2,2,2,2,2,2,2,2,2,
    3,3,3,3,3,3,3,3,3,3,
    4,4,4,4,4,4,4,4,4,4
};
int8_t mapToBucket(unsigned v) {
    if (v < (sizeof(buckets) / sizeof(int8_t)))
        return buckets[v];
    return -1;
}
```

```c
// Listing 10.2: Replace branches with arithmetic
int8_t mapToBucket(unsigned v) {
    constexpr unsigned BucketRangeMax = 50;
    if (v < BucketRangeMax)
        return v / 10;  // compiler replaces div with mul+shift
    return -1;
}
```

```asm
; Listing 10.4: Branchless version with CMOV
; original (with branch)         ; branchless version
test ebx,ebx                      mov eax,0x0
je  400514                        call <computeX>   ; compute x
mov eax,0x0                       mov ebp,eax       ; save x
call <computeX>                   mov eax,0x0
jmp 40051e                        call <computeY>   ; compute y
400514: mov eax,0x0                test ebx,ebx
call <computeY>                   cmovne eax,ebp    ; select x if cond
40051e: mov edi,eax                mov edi,eax
call <foo>                        call <foo>
```

```cpp
// Listing 10.6: SIMD "multiple tests single branch" - longest line (8 chars at a time)
uint32_t longestLine(const std::string &str) {
    uint32_t maxLen = 0;
    const uint64_t eol = 0x0a0a0a0a0a0a0a0a;
    auto *buf = str.data();
    uint32_t lineBeginPos = 0;
    for (uint32_t pos = 0; pos + 7 < str.size(); pos += 8) {
        uint64_t vect = *((const uint64_t*)(buf + pos));
        uint8_t mask = compareBytes(vect, eol);  // SIMD byte-wise comparison
        while (mask) {
            uint16_t eolPos = tzcnt(mask);
            uint32_t curLen = (pos - lineBeginPos) + eolPos;
            lineBeginPos += curLen + 1;
            maxLen = std::max(curLen, maxLen);
            mask >>= eolPos + 1;
        }
    }
    return maxLen;
}
```

## Worked Example

**场景**: 直方图计算中的内存序违例（memory order violation）。

**原始代码**（每个像素执行 `hist[image[i]]++`）在连续相同颜色像素上会触发存储转发误预测，导致流水线冲刷。

**优化方案**: 使用两个部分直方图交替处理像素，减少同色像素的紧密重复访问：

```cpp
std::array<uint32_t, 256> hist1, hist2;
hist1.fill(0); hist2.fill(0);
int i = 0;
for (; i + 1 < N; i += 2) {
    hist1[image[i+0]]++;
    hist2[image[i+1]]++;
}
// combine partial histograms
for (int i = 0; i < hist1.size(); ++i)
    hist1[i] += hist2[i];
```

**结果**: 在最坏情况下（全图同色）获得 2 倍加速，实际图像测试中观察到 10%–50% 的性能提升，额外消耗 1 KB 内存。

## Key Takeaways

1. **仅在 TMA Bad Speculation > 10% 时关注分支误预测**；现代 CPU 的分支预测器已经非常优秀。
2. **查表（Lookup Table）适用于值域小且密集的场景**，用一次内存访问替换分支链。
3. **算术替换（Arithmetic）** 可在映射关系有数学公式时使用，编译器通常不会自动做这种转换。
4. **条件选择（CMOV/CSEL）** 将控制依赖转换为数据依赖，适合难以预测的小条件分支；对大函数体不适用。
5. **SIMD "multiple tests single branch"** 可大幅减少动态分支数量，在长输入上效果显著，但短输入可能更慢。
6. **间接减少分支**（循环展开、向量化、PGO/BOLT 优化 fallthrough）也能缓解分支预测器压力。
7. **始终测量**：无分支代码并非普遍更优，性能测量是最终裁决者。

## Connects To

- **Ch 11 Machine Code Layout**: PGO 和 BOLT 在改善代码布局的同时，通过提高 fallthrough 率间接减少分支误预测。
- **Ch 3.3.3 Speculative Execution**: 分支误预测的根本原因——CPU 推测执行错误路径后需要恢复。
- **Ch 9.5 SIMD Intrinsics**: SIMD 是实现"multiple tests single branch"技术的基础设施。
