---
title: "(WIP) Salsa: Is the tracked struct valid?"
date: "2022-09-26"
---


来来回回讨论了两周，终于把这个 [PR](https://github.com/salsa-rs/salsa/pull/413)
合进去了，这是我参与开源项目以来，第一次讨论这么多。通过这个 PR，有很多思
考，对Salsa 也有了更深入的理解，值得把它们记录下来

<!-- more -->


Issue: https://github.com/salsa-rs/salsa/issues/407

PR: https://github.com/salsa-rs/salsa/pull/413

## 问题

```rust
#[salsa::tracked]
fn tracked_fn(db: &Db, input: MyInput) -> MyTracked {
    MyTracked::new(db, input.field(db) * 2)
}

fn main() {
    ...
    let input = MyInput::new(&db, 11);
    let tracked = tracked_fn(&db, input);

    input.set_field(&mut db).to(12);
    dbg!(tracked.field(&db));
}
```

修改 `input` 后，`tracked` 还有效吗？对于上面这段代码，Salsa 希望在调用
`tracked.field(&db)` 时 panic。而我们现在的代码，也就是这个 PR 之前，并不会
panic，会返回上次保存的值 22。

## Inputs and Outputs
在深入讨论这个问题之前，有必要介绍一下 inputs 和 outputs 这两个概念。

> **_NOTE:_** 这里的inputs 和 outputs 都是 salsa 内部实现的概念，不是用户接口
> [input]

Inputs 就是我们在[这篇文章](./07_salsa_dependency.md)中讨论的 dependencies。一个
query 的 inputs 即这个 query 依赖的其他 query。

以下三种东西会视为 query 的 outputs
* 生成的 [tracked struct]
* 调用 [specify]
* push 到 [accumulator] 的值

Inputs 和 outputs 这两个东西有什么用？Salsa 的核心是尽可能利用之前的计算结果来加
快当前的计算，inputs 用来判断之前的计算结果现在仍否可用，outputs 对更多地利用之
前的计算结果有帮助。

```rust
#[salsa::tracked]
fn tracked_fn(db: &Db, input: MyInput) -> MyTracked {
    MyTracked::new(db, input.field(db) * 2)
}
```

对于 query `tracked_fn(db, input)` 来说  
* inputs: `input.field(db)`
* outputs: `MyTracked::new(db, input.field(db) * 2)`

如果我们发现数据库中存储有 query `tracked_fn(db, input)` 的值，我们能直接用这个
结果吗？换句话说，我们需要重新计算吗？如果这个结果没有在最新的 [revision] 下被验
证，我们就需要检查这个 query 的 inputs，如果所有的 inputs 在上次计算后都没有改
变，就可以下结论之前存储的计算结果仍然是有效的。与此同时，我们还可以认为这个
query 的outputs 在最新的 [revision] 下得到了验证，因为 Salsa 的一个基本假设就是
所有的计算都是确定性的，inputs 不变，outputs 就应该不变。

## Panic if outdated
对于 tracked struct 的 fields，一旦发现它 outdated，就应该 panic。如果保存的旧值
的 `verified_at` 小于 `runtime.current_revision`，我们就说这个旧值 outdated。看
看我们上面这个例子，改变 input 的时候，`runtime.current_revision` 就会 +1，大于
`tracked.field(&db)` 查询到的值的 `verified_at`，所以应该 panic。（reference:
<a>https://github.com/salsa-rs/salsa/issues/407#issuecomment-1244550905</a>）

看起来合理，但这样改之后，之前的测试有的通不过了。

```rust
#[salsa::tracked]
fn tracked_fn(db: &Db, input: MyInput) -> u32 {
    let tracked = MyTracked::new(db, input.field(db) * 2);
    tracked.field(db)
}

fn main() {
    ...
    let input = MyInput::new(&db, 11);
    _ = tracked_fn(&db, input);

    // A "synthetic write" causes the system to act *as though* some
    // input of durability `durability` has changed. This is mostly
    // useful for profiling scenarios.
    db.synthetic_write(salsa::Durabiliby::High);
    _ = tracked_fn(&db, input); // panic
}
```
第二次调用 `tracked_fn` 会 panic，但这段代码在 salsa 中绝对应该是合理的。第二次
调用 `tracked_fn(&db, input)`，我们发现 db 中保存有之前的计算结果，但它可能是过
时的，因为它对应的 `verified_at` 小于 `current_revision`。这时，我们需要 [deep
verify]，检查这个 query 的所有 dependency 在 `verified_at` 之后有没有改变。（我
们在 [这篇文章](./07_salsa_dependency.md) 讨论过 query 的 dependency）。对于
`tracked_fn(&db, input)` 来说，一个 dependency 就是 `tracked.field(db)`，显然它
的 `verified_at` 小于 `current_revision`，前面已经提到

> 对于 tracked struct 的 fields，一旦发现它 outdated，就应该 panic。如果保存的旧
> 值的 `verified_at` 小于 `runtime.current_revision`，我们就说这个旧值
> outdated。

[deep verify]: https://github.com/salsa-rs/salsa/blob/2ffe4a78a824acb8c73e77497e4c2c469fcbed37/components/salsa-2022/src/function/maybe_changed_after.rs#L145

## Is it really outdated?
上一节中 `tracked.field(db)` 其实是可用的，我们单纯用它的 `verified_at` 做比较是
有漏洞的。这个场景的特殊之处在于 `tracked.field(db)` 既是 `tracked_fn(&db,
input)`这个 query 的 input，也是其 output。`tracked.field(db)` 是在
`MyTracked::new` 中被创建的，所以是这个 query 的 output。所以，我们能不能加上一
条限制：如果某个 dependency/input 同样也是该 query 的 output，我们就认为这个
dependency/input 是有效的。

很遗憾，这仍然有漏洞，看下面这个例子。

```rust
#[salsa::tracked]
fn tracked_fn(db: &Db, input: MyInput) -> u32 {
    let tracked = MyTracked::new(db, input.field(db) * 2);
    tracked_fn_extra(tracked)
}

#[salsa::tracked]
fn tracked_fn_extra(db: &Db, tracked: MyTracked) -> u32 {
    tracked.field(db)
}

fn main() {
    ...
    let input = MyInput::new(&db, 11);
    _ = tracked_fn(&db, input);

    // A "synthetic write" causes the system to act *as though* some
    // input of durability `durability` has changed. This is mostly
    // useful for profiling scenarios.
    db.synthetic_write(salsa::Durabiliby::High);
    _ = tracked_fn(&db, input); // panic
}
```

这个例子的和上一个的区别是，我们并没有在创造 tracked struct 的 query 中使用
tracked struct 的 fields，但是我们间接在 query 依赖的其他 query 中使用了它的
fields。回到这个例子，`tracked_fn(db, input)` 这个 query 创造了 `tracked` 这一
tracked struct，但是


[input]: https://salsa-rs.netlify.app/overview.html#inputs
[tracked struct]: https://salsa-rs.netlify.app/overview.html#tracked-structs
[accumulator]: https://salsa-rs.netlify.app/overview.html#accumulators
[specify]: https://salsa-rs.netlify.app/overview.html#specify-the-result-of-tracked-functions-for-particular-structs
[revision]: https://salsa-rs.netlify.app/plumbing/terminology/revision.html?highlight=revision#revision
