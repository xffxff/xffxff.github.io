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
query 的 outputs 在最新的 [revision] 下得到了验证，因为 Salsa 的一个基本假设就是
所有的计算都是确定性的，inputs 不变，outputs 就应该不变。

## Panic if outdated
现在再次回到最开始的问题，对于 tracked struct 的 fields，一旦发现它过时了，就应
该 panic。怎么判断它是否过时了呢？如果保存的旧值的 `verified_at` 小于系统的
`current_revision`，我们就说这个值过时了（我们这里对“过时”的讨论是针对 tracked
struct 的）。看看我们上面这个例子，改变 input 的时候，`current_revision` 就会
+1，大于 `tracked.field(&db)` 查询到的值的`verified_at`，所以应该
panic。（reference:
https://github.com/salsa-rs/salsa/issues/407#issuecomment-1244550905）

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

第二次调用 `tracked_fn` 会 panic，这里真的应该 panic 吗？对于整个系统来说，我们
更改了部分输入，但并没有更改这里的 `input`，所以保存的 `tracked_fn(&db, input)`
旧值仍然是有效的，这种情况正是我们希望 Salsa 帮我们节省的计算。

这个例子的特殊之处在 `tracked`（准确来说应该是 `tracked.field`） 既是
`tracked_fn(&db, input)` 的 input，又是它的output。

第二次调用 `tracked_fn(&db, input)`，发现 db 中保存有之前的计算结果，但它可能是
过时的，因为它对应的 `verified_at` 小于 `current_revision` （这里讨论的是tracked
function，所以并不一定是过时的，和上面讨论的 tracked struct 不一样）。这时，我们
需要 [deep verify]，检查这个 query 的所有 inputs 在其 `verified_at` 之后有没有改
变。`tracked.field(db)` 就是它的一个 input，显然它的 `verified_at` 小于
`current_revision`，前面已经提到

> 对于 tracked struct 的 fields，一旦发现它 outdated，就应该 panic。如果保存的旧
> 值的 `verified_at` 小于 `current_revision`，我们就说这个旧值outdated。

```rust
#[salsa::tracked]
fn tracked_fn(db: &Db, input: MyInput) -> MyTracked {
    MyTracked::new(db, input.field(db) * 2)
}

fn main() {
    ...
    let input = MyInput::new(&db, 11);
    _ = tracked_fn(&db, input);

    db.synthetic_write(salsa::Durabiliby::High);
    let tracked = tracked_fn(&db, input);
    dbg!(tracked.field(&db));
}
```

如果改写成上面这样，就可以正常工作了。第二次调用 `tracked_fn(&db, input)` 发现保
存的旧值是有效的，不用重新计算。在验证完这个 query 之后，我们认为这个它的所有
outputs 也在`current_revision` 下得到了验证，也是有效的，即更新 outputs 的
`verified_at` 为`current_revision`。所以接下来调用 `tracked.field(&db)` 时，它的
`verified_at` 等于 `current_revision`，这个 field 的旧值也是有效的。

如果一个 tracked struct 既是一个 query 的 input，又是其 output，在验证这个 query
的**过程中**，我们还没来得及更新 outputs 的 `verified_at`（**必须在验证结束后才能更新
其 outputs**)，就要将它作为input使用，这时它的 `verified_at` 小于
`current_revision`，所以会 panic。


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
