---
title: "(WIP) Salsa: Is the tracked struct valid?"
date: "2022-09-26"
---


来来回回讨论了两周，终于把这个 [PR](https://github.com/salsa-rs/salsa/pull/413)
合进去了，这是我参与开源项目以来，第一次讨论这么多。通过这个 PR，确实有很多思
考，对Salsa 也有了更深入的思考，值得把它们记录下来

<!-- more -->


Issue: https://github.com/salsa-rs/salsa/issues/407

PR: <a>https://github.com/salsa-rs/salsa/pull/413</a>

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
修改了 `input`，`tracked` 还有效吗？对于上面这段代码，希望在调用
`tracked.field(&db)` 时 panic。而我们现在的代
码，也就是这个 PR 之前，并不会
panic，会返回上次保存的旧值 22。

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

## Query
> Salsa is a query based increamental computation system.  

Query 一词经常在 Salsa 中提到，那到底什么是 query 呢？是 `tracked_fn` 这个函数
吗？我的理解是 `tracked_fn(&db, input)` 这个调用？当然
`input.field(db)`，`tracked.field(&db)` 都是 query。  

个人认为在 Salsa 代码中，`DatabaseKeyIndex`、`DependencyIndex` 和 `Memo` 都对应
一个 query。


## Input & Output
这里所说的 input 不是 `salsa::input`，Input 和 output 都是对 query 而言的。Input
就是这个 query 依赖的其他 query，我们在[这篇文章](./07_salsa_dependency.md)中讨
论过。Query 的 output 有 3 种：
* tracked strcuts created
* invacations of specify
* accumulators pushed to

