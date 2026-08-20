# Chapter 11: I/O Optimization

## Core Idea

File I/O is deceptively expensive due to the vast speed gap between rotating disks (or network latency) and CPU chips. Additionally, there is excessive code between the user's program and the physical medium -- multiple abstraction layers in the C++ stream library, the C runtime, and the OS kernel. Optimization focuses on reducing these layers, minimizing per-character overhead, and reading/writing in bulk.

## Key Techniques

- **Parse Input Signatures**: A good I/O library function does one thing. Separate file-opening and error-handling from the read operation. Accept `std::istream&` rather than a filename -- this enables use with any stream type (`std::ifstream`, `std::stringstream`, etc.) and lets callers manage errors their way. Accept a `std::string&` output parameter rather than allocating and returning one (avoids copy-on-return).

- **Shorten the Call Chain**: Each abstraction layer adds function call overhead per character. `std::istream::read()` connects more directly to the OS-level `read()`/`ReadFile()` than the streambuf iterator approach. Performance difference: 267ms (VS2010) for `read()` vs 1510ms for streambuf iterators -- a 5.7x improvement.

- **Bulk Read with sgetn()**: `std::streambuf::sgetn(char*, streamsize)` reads an arbitrary number of characters in one call directly from the stream buffer into a pre-sized string. Performance: 307ms (VS2010), 148ms (VS2015). Combined with increased buffer size: 244ms (VS2010), 134ms (VS2015).

- **Pre-allocate String Buffer**: Determine file size by seeking to end (`seekg(0, end)`, `tellg()`), restore position, then `reserve()` or `resize()` the string before reading. This eliminates repeated reallocation as the string grows. The cost of two `seekg()` calls is typically far less than multiple reallocations.

- **Increase Stream Buffer Size**: Override the default `streambuf` buffer (typically small) via `rdbuf()->pubsetbuf(buf, size)` before any read/write. An 8KB buffer can yield ~5% improvement. Returns diminish beyond 8KB.

- **Read by Lines**: `std::getline()` reduces function call count compared to per-character iteration. Performance: 1284ms (VS2010) vs 1510ms for streambuf iterators. Combining with `reserve()` and increased buffer size: 1193ms (VS2010).

- **Avoid `std::endl` When Writing**: `std::endl` inserts a newline AND flushes the output stream. Flushing forces the OS to write buffered data to disk immediately, dramatically slowing throughput. Use `'\n'` instead and call `flush()` explicitly only when needed. Performance difference: 1972ms (with `endl`) vs 367ms (with `'\n'`) -- a 5.4x improvement.

- **Write Entire Content at Once**: Accumulate output in a single string and write it once rather than line-by-line. Performance: 132ms vs 367ms for line-by-line (1.7x faster).

## File Reading Performance Comparison (10K-line file read 100 times, VS2010 Release, i7)

| Method | VS2010 (ms) | VS2015 (ms) | Notes |
|--------|-------------|-------------|-------|
| streambuf iterator → stringstream | 1548 | - | baseline, per-char copy |
| streambuf iterator → string::assign | 1510 | 1787 | slightly better |
| `s << f.rdbuf()` | 1294 | 1181 | shorter call chain |
| `getline()` loop | 1284 | 1440 | read line-by-line |
| `getline()` + reserve + 8K buf | 1193 | 1404 | combined optimizations |
| custom streambuf subclass | 1312 | 1182 | useless -- no gain |
| `sgetn()` directly into string | 307 | 148 | **fast, pre-size required** |
| `sgetn()` + increased rdbuf | 244 | 134 | **best sgetn variant** |
| `istream::read()` into string | 267 | 144 | **fast, short call chain** |
| `read()` into array → assign | 307 | 186 | extra copy, slightly slower |

## Writing Performance Comparison (10K lines written 100 times)

| Method | VS2010 (ms) | VS2015 (ms) | Notes |
|--------|-------------|-------------|-------|
| `f << line << std::endl` | 1972 | 2110 | flush on every line |
| `f << line << '\n'` | 367 | 302 | no flush per line |
| write entire string at once | 132 | 137 | **fastest** |

## Optimization Rules

1. Separate file open/error handling from reading -- produce functions that accept `std::istream&` and `std::string&` parameters.
2. Determine stream size with `seekg()`/`tellg()` and pre-allocate the output string via `resize()` or `reserve()`.
3. Use `std::istream::read()` or `std::streambuf::sgetn()` for bulk reads -- avoid per-character streambuf iterators for large files.
4. Increase the `streambuf` buffer to 8KB via `pubsetbuf()` for modest gains.
5. For line-oriented text, `getline()` is acceptably fast; combine with pre-allocation for best results.
6. Never use `std::endl` in performance-sensitive write paths -- use `'\n'` and flush only when necessary.
7. Cut the tie between `std::cin` and `std::cout` (`cin.tie(nullptr)`) and between C++ streams and C stdio (`sync_with_stdio(false)`) to prevent expensive automatic flushes.
8. Beware of "fast" file I/O recipes from the internet -- many offer negligible or no improvement over the simplest approaches.

## Key Takeaways

1. The fastest file read method found: pre-size a string to the file size, then call `std::streambuf::sgetn()` or `std::istream::read()` to fill it in one operation -- 5x to 11x faster than streambuf iterator approaches.
2. Writing performance is dominated by flush frequency. Simple `'\n'` instead of `std::endl` yields a 5x speedup; writing the entire content at once yields another 1.7x.
3. `std::cin` is tied to `std::cout` (reading from cin flushes cout), and C++ streams are tied to C stdio by default. Breaking these ties improves I/O performance.
4. Custom `streambuf` subclasses are generally a waste of effort -- the overhead eliminated is swamped by other factors in the call chain.
5. Always measure I/O performance carefully; disk caching and background system activity create high variance. Take the minimum of multiple runs for comparison.
