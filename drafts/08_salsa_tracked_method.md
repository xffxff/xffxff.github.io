---
title: "Salsa: tracked methods"
date: "2022-09-04"
---


PR [392](https://github.com/salsa-rs/salsa/pull/392) supports tracked methods, I reviewed it and thought there were some notes to make, I tried to making it an RFC, although the pr was not created by me.

<!-- more -->


## Metadata
* introduced in: [https://github.com/salsa-rs/salsa/pull/392](https://github.com/salsa-rs/salsa/pull/392)

## Summary
Support tracked methods

## Motivation
In the Salsa 2022 system, tracked functions are almost always defined on some kind of salsa struct, it would be nice if we support tracked methods.

## User's guide
Impl blocks with `#[salsa::tracked]` and then create tracked methods by marking individual methods with `#[salsa::tracked]`. We will get an error if we annotate a method with `#[salsa::tracked]` but forget to mark the impl block.

```rust
#[salsa::jar(db = Db)]
struct Jar(MyInput, MyInput_tracked_fn)


#[salsa::input]
struct MyInput {
    field: u32
}

#[salsa::tracked(jar = Jar)]
impl MyInput {
    #[salsa::tracked]
    fn tracked_fn(self, db: &dyn Db) -> u32 {
        self.field(db) * 2
    }
}
```

We also support trait impls.

```rust
#[salsa::jar(db = Db)]
struct Jar(MyInput, MyInput_TrackedTrait_tracked_trait_fn)

trait TrackedTrait {
    fn tracked_trait_fn(self, db: &dyn Db) -> u32;
}

#[salsa::tracked(jar = Jar)]
impl TrackedTrait for MyInput {
    #[salsa::tracked]
    fn tracked_trait_fn(self, db: &dyn Db) -> u32 {
        self.field(db) * 4
    }
}
```

## Reference Guide
For 
```rust
#[salsa::tracked(jar = Jar)]
impl MyInput {
    #[salsa::tracked]
    fn tracked_fn(self, db: &dyn Db) -> u32 {
        self.field(db) * 2
    }
}
```
We treat it as  
```rust
#[salsa::tracked(jar = Jar)]
MyInput_tracked_fn(db: &dyn Db, __salsa_self: MyINput) -> u32 {
    __salsa_self.field(db) * 2
}
```

So what we generate is the code generated for the tracked function `MyInput_tracked_fn` and the impl block looks like
```rust
impl MyInput {
    fn tracked_fn(self, db: &dyn Db) -> u32 {
        Clone::clone(MyInput_tracked_fn::get(db, self))
    }
}
```

**How to raise an error if we annotate a method with `#[salsa::tracked]` but forget to mark the impl block?**

If we forget to mark the impl block, the tracked methods with attributes `#[salsa::tracked]` will be treated as tracked functions, so we just check if the tracked function has `self` argument, and if so, we can be sure we forget to mark the impl block.

[related code](https://github.com/salsa-rs/salsa/blob/bac4c668cfb20ad2971e244d6fe5337c651f0f17/components/salsa-2022-macros/src/tracked_fn.rs#L21-L26)

```rust
// salsa-2022-macros::tracked_fn::tracked_fn

if let syn::FnArg::Receiver(receiver) = &item_fn.sig.inputs[0] {
    return Err(syn::Error::new(
        receiver.span(),
        "#[salsa::tracked] must also be applied to the impl block for tracked methods",
    ));
}
```


