---
title: "rustc 如何做 name resolution"
date: "2021-11-06"
---

先吐槽一下，原本前两天 [rustc reading
club](https://rust-lang.github.io/rustc-reading-club/meetings/2021-11-04.html)
有个关于 name resolution 源码阅读的直播，但直播时发现 zoom 最多只能容纳 100 人，主
讲人进不来了。他们也没有想到会有这么多人，最终是取消了这次活动。

虽然活动没了，但 rustc 还是要学的。这不是一篇源码阅读，全文不涉及任何  rustc 的
代码，因为我压根儿没怎么看
[rustc_resolve](https://github.com/rust-lang/rust/tree/master/compiler/rustc_resolve/src)
的代码，倒是看了一些 rust-analyzer 中 name resolution 的代码。这几天看 rust 开发
文档，RFC 以及 rust-analyzer，本文是对 name resolution 的一个总结。

## 什么是 name resolution?
在编译时，将 name 和 definition 匹配的过程。比如说下面这个例子，我们在 bar 这个
函数中使用 foo 的时候 ，需要知道 foo 指代的是第一行 foo 函数。

```rust
fn foo() { ... }

fn bar() { foo(); }
```

## Namespace
怎么实现 name resolution 呢？能否定义一个 map，key 是 name，value 是 definition
呢？现在的一个关键点是在同一 scope 下，name 是唯一的吗？很遗憾，在 rust 中，并不
是

```rust
fn foo() { ... }

struct foo { field: u32 }
```

上述代码是合法的，可以同时有一个叫 foo 的函数，还有一个叫 foo 的 struct。函数foo
和 struct foo 并不在同一 namespace 下，函数 foo 属于 value namespace，而struct
foo 属于 type namespace。除了 type 和 value namespace 之外，还有macro、lifetime
以及 label namespace， 如果想知道不同 namespace 下有哪些东西，可以参考 [rust
reference
namespace](https://doc.rust-lang.org/nightly/reference/names/namespaces.html)

## Import
考虑 import 的话，会让问题变得复杂起来。

```rust
mod a {
    use crate::b::foo;

    pub fn bar() {}
}

mod b {
    pub fn foo() {}
}
```

假设编译器从上往下开始 resolve，很快就会发现，mod a 中 import 了 mod b 中的东
西，但是现在 mod b 还没有被 resolve，不知道 mod b 中定义了哪些东西，有没有定义
foo。第一反应是，当编译器 resolve 这个 import 的时候，先去把 mod b 给 resolve
了，完事儿后在跑回来 resolve 这个 import 的。听起来很合理，但考虑下面这个情形
呢？

mod a {
    use crate::b::foo;

    pub fn bar() {}
}

mod b {
    use crate::a::bar;

    pub fn foo() {}
}在 mod a 中 import mod b，mod b 中又 import 了 mod a。编译器 name resolution 的
过程是 a-->b-->a-->b-->......，会进入一个死循环。

怎么解决这个问题呢？碰到 import，可以先跳过。第一遍尽可能的去 resolve，如果
import 无法 resolve，就把它放到一个 working list 中。然后遍历 working list，尝试
去 resolve 它们，如果 resolve 完成，就把它踢出 working list。

```rust
mod a {
    use crate::b::bar;
}

mod b {
    pub use crate::c::bar;
}

mod c {
    pub fn bar() {}
}
```

working list 可能要遍历多次，考虑上面这个例子，第一轮 resolve 后，会得到一个包含
`use crate::b::bar`, `use crate::c::bar` 的 working list，遍历 working list，先
去resolve `use crate::b::bar`，但 resolve 它依赖 `use crate::c::bar` 先
resolve。所以第一次遍历 working list 后还会剩下 `use crate::b::bar`，再遍历一次
才能完成所有的name resolution。当然，也有可能 working list 无法清空，比如 mod c
中并没有定义bar 函数。这个方法的核心思想就是不断遍历 working list，直到 working
list 的长度不变，如果 working list 为空，那就说明 name resolution 成功，反之则说
明代码有问题。

## Macro

```rust
macro_rules! strukt {
    ($i:ident) => {
        struct $i { field: u32 }
    }
}
strukt!(Foo);
strukts!(Foo) 做 macro expansion 会定义一个叫 Foo 的 struct

struct Foo {
    field: u32
}
```

在生成 AST 的时候并没有做 macro expansion，在 rust-analyzer 中，`strukt!(Foo)`
对应的 node 如下

```
  MACRO_CALL@176..189
    PATH@176..182
      PATH_SEGMENT@176..182
        NAME_REF@176..182
          IDENT@176..182 "strukt"
    BANG@182..183 "!"
    TOKEN_TREE@183..188
      L_PAREN@183..184 "("
      IDENT@184..187 "Foo"
      R_PAREN@187..188 ")"
    SEMICOLON@188..189 ";" 
```

macro expansion 发生在 name resolution 中，处理的方式和 import 类似，遇到还不能
resolve 的 macro，就先把它放到 working list 中。比如说 macro 是 import 来的，或
者这个 macro 依赖于另一个 macro，下面这个例子中，`strukt!(Foo)` 完全 exapnd 之
前，`field_type!()` 得先 expand。

```rust
macro_rules! field_type {
    () => {
        u64
    };
}

macro_rules! strukt {
    ($i:ident) => {
        struct $i {
            field: field_type!(),
        }
    };
}

strukt!(Foo);
```

rust 中的 name resolution 还有很多细节我没有讨论，其实我也不清楚，但大多对我来说也算 corner case，现在也不想了解。

## 参考资料

[rustc dev guide: name resolution](https://rustc-dev-guide.rust-lang.org/name-resolution.html#name-resolution)

[RFC 1560: name resolution](https://rust-lang.github.io/rfcs/1560-name-resolution.html)

[rust reference: namespace](https://doc.rust-lang.org/stable/reference/names/namespaces.html)

["Do What I Mean": Name Resolution in Programming Languages](https://willcrichton.net/notes/specificity-programming-languages/)