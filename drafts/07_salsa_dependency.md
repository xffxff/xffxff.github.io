---
title: "Salsa: dependency 理解纠正"
date: "2022-09-02"
---

通过一个简单的例子，发现我对 Salsa dependency 理解有误

<!-- more -->


```rust
#[salsa::input]
struct MyInput {
    field: i32
}

#[salsa::tracked]
fn tracked_fn(db: &dyn Db, input: MyInput) -> i32 {
    0
}

fn main() {
    ...
    let input = MyInput::new(&mut db, 22);
    tracked_fn(&db, input);
    input.set_field(&mut db, 44);
    tracked_fn(&db, input);
}
```
第二次调用 `tracked_fn(&db, input)` 能重用第一次的计算结果吗？

`tracked_fn(&db, input)` 需不需要重新计算，需要考虑 dependencies 有没有变化。这句话听着很简单，也很合理，但是我并没有真正理解它。重点不在 dependencies 是什么，而在是 “谁的” dependencies。

回到具体问题，我之前一直认为是 `tracked_fn` 这个函数本身的 dependencies，那一个函数的 dependencies 就是它的参数以及函数体里调用的其他 tracked function。如果是这样，上述问题的答案就是不能重用，需要重新计算，因为参数发生了改变。

但实际上，Salsa 并不需要重新计算，Salsa 认为的 dependencies 是针对 `tracked_fn(&db, input)` 这个计算结果。`input` 虽然作为参数输入，但在计算时并没有真正被用到，所以 `tracked_fn(&db, input)` 并不依赖 `input`，它的改变对结果不会有任何影响，所以不需要重新计算。

再来看一个例子，对于 `input = MyInput::new(&mut db, 1)`，`tracked_fn(&db, input)` 依赖 `tracked_extra(db, input)` 吗？对于 `input = MyInput::new(&mut db, -1)` 呢？  
```rust
#[salsa::tracked]
fn tracked_fn(db: &dyn Db, input MyInput) -> i32 {
    if input.field(db) < 0 {
        tracked_extra(db: &dyn Db, input)
    } else {
        0
    }
}
```

___
**UPDATE(2022/9/7)**

今天又有一点新的理解，值得一说
```rust
#[salsa::tracked]
fn tracked_fn(db: &dyn Db, input MyInput) -> i32 {
    tracked_extra(db: &dyn Db, input)
}
```
上述例子中 `tracked_fn(&db, input)` 依赖 `input` 吗？

不依赖，只依赖 `tracked_extra(db: &dyn Db, input)`
