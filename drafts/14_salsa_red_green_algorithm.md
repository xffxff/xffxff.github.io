---
title: "WIP: Salsa: The red green algorithm"
date: "2022-12-23"
---

> The goal of Salsa is to support efficient incremental recomputation. Salsa is used in rust-analyzer, for example, to help it recompile your program quickly as you type.
> 
> The basic idea of a Salsa program is like this:
>
> ```rust
> let mut input = ...;
> loop {
>     let output = your_program(&input);
>     modify(&mut input);
> }
> ```
> 
> You start out with an input that has some value. You invoke your program to get back a result. Some time later, you modify the input and invoke your program again. Our goal is to make this second call faster by re-using some of the results from the first call.
> 
> In reality, of course, you can have many inputs and "your program" may be many different methods and functions defined on those inputs. But this picture still conveys a few important concepts:
> 
> - Salsa separates out the "incremental computation" (the function `your_program`) from some outer loop that is defining the inputs.
> - Salsa gives you the tools to define `your_program`.
> - Salsa assumes that your_program is a purely deterministic function of its inputs, or else this whole setup makes no sense.
> - The mutation of inputs always happens outside of `your_program`, as part of this master loop.




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
