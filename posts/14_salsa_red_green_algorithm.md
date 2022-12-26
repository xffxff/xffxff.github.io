---
title: "WIP: Salsa: The red green algorithm"
date: "2022-12-23"
---

```rust
#[salsa::input]
struct MyInput {
    field: u32,
}

#[salsa::tracked]
fn tracked_fn(db: &Db, input: MyInput) -> u32 {
    some_slow_fn(input.field(db))
}
```

If the `input` isn't changed, the second call to `tracked_fn` doesn't need to recompute the result. But if the `input` is changed, no matter how small the change is and whether it affects the final result, the tracked struct is invalidated. This is not what we want. Even if the `input` is changed, we may benefit from the previous computation by reusing intermediate results to speed up this one. Take the compiler as an example, if we just add a space or a comment, the AST is not changed, all the following analysis can reuse the previous results.

What if we add some tracked functions to compute the intermediate results?

```rust
#[salsa::input]
struct MyInput {
    field: u32,
}

#[salsa::tracked]
fn final_result(db: &Db, input: MyInput) -> u32 {
    let res1 = intermediate_result1(input);
    let res2 = intermediate_restul2(res1);
    ...
}

#[salsa::tracked]
fn intermediate_result1(db: &Db, input: MyInput) -> u32 {
    ...
} 

#[salsa::tracked]
fn intermediate_result2(db: &Db, input: u32) -> u32 {
    ...
}
```
