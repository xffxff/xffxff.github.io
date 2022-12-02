---
title: "Salsa: The red-green Algorithm"
date: "2022-12-2"
---


```rust
fn func(input: Input) -> Output {
    // ...
}
```

当 `input` 不变的时候，我们第二次调用 `func` 的时候，我们可以直接从缓存中读取结果，而不需要再次执行 `func`。

```rust
...
let output1 = func(input)
let output2 = func(input) // do not need to execute func again
assert output1 == output2
```

这就是所谓的增量计算，Salsa 提供了工具来帮助我们实现增量计算。

实现增量计算，本质上是因为我们保存了之前的计算结果，如果对于每一个不同的 `input`，我们都保存了之前的计算结果，存储的压力会很大。

![](../public//10/input-output.png)

在这种模式下，我们不知道哪些 `input` 是过期的，这些 input 除了创建时间不一样，并没有什么不同。当然，我们可以使用一些缓存替换策略（cache replacement policy）来缓解这个问题，但是我们仍然存储了多余的东西，且可能剔除了一些仍然有用的数据。

![](../public/10/input-version.png)

如果我们 input 分组呢？我们可以为每一个 `input` 分配一个版本号，当 `input` 发生变化的时候，我们就更新版本号。这样，我们就可以知道哪些 `input` 是过期的了。

对于之前的模式，我们的代码可能是这样的：

```rust
let input1 = Input { ... }
let output1 = func(input1)
let input2 = Input { ... }
let output2 = func(input2)
let input3 = Input { ... }
let output3 = func(input3)
let input4 = Input { ... }
let output4 = func(input4)
```

如果将 input 分组的话，我们的代码可能是这样的：

```rust
let mut input1 = Input { ... } // input 1 version 1
let output1 = func(input1)
change_input(&mut input1) // input 1 version 2
let output1 = func(input1) // we can safely remove the data stored for input 1 version 1
let mut input2 = Input { ... } // input2 version 1
let output2 = func(input2) 
change_input(&mut input2) // input2 version 2
let output2 = func(input2) // we can safely remove the data stored for input 2 version 1
```

简单来说，我们并不会为每个不同的 input 都构造 `Input` 实例，而是将 input 分组，每个分组只有一个 `Input` 实例，这个实例的版本号会随着 input 的变化而变化。这样的好处是，我们可以安全地删除同一个分组中过期（低版本）的 input，以及该 input 对应的计算结果。**当然我们的前提假设是，我们对同一分组中旧的 input 不感兴趣.**
