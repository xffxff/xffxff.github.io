---
title: '如何实现一个Rust Language Server?'
date: '2021-10-30'
---

标题听起来像是一个教程，但它真的只是一个问题，是我问自己的一个问题，这篇文章记录
我初步的思考。

先说说为什么会有这个问题吧，我觉得还挺有意思的。最近在看 [RA（Rust
Analyzer）](https://github.com/rust-lang/rust-analyzer) 的源码，对 RA 的整体架构
有了基本的认识，也提过一些 pr，但不知道接下来该怎么深入，迷茫之际，脑袋里突然蹦
出这么一个问题：如果我去实现一个 Rust LS（languageserver），该怎么设计呢？

## 如何实现

实现一个 Rust LS。太复杂了，包括代码高亮、自动补全、定义跳转、Find Usages。

实现一个只有自动补全功能的 LS。再简化下，把自动补全功能限制在单个 rust 文件中，
也就是不考虑 workspace 中有多个 crate，甚至多个文件的情况。

实现一个能在单个 rust 文件中自动补全的 LS。自动补全些什么呢？对 rust 来说，要补
全 keyword、built-in type、function、struct、trait、macro、attribute。太多了，不
如把自动补全限制在 keyword、built-in type 以及用户自定义的 function 和 struct
上。

别管是通过磁盘 IO 读取 rust 文件还是 client 发送给我们，我们的输入就是一个字符
串。

最后，再把问题明确一下，输入是一个字符串，包含 rust 代码以及一个表示光标所在位置
的符号，输出是自动补全的建议，只针对 keyword、build-in type 以及用户自定义
function 和 struct。

```
Inputs:
st$0

Suggestions:
struct
static
```

上面的例子是说输入是“st$0”，“st”是 rust 代码，“$0”表示光标位置，意思是当键盘敲击
“st”时，应该补全为“struct”或者“static”。

## 如何实现

keyword 和 built-in type 比较容易，建个 hash 表，字符串匹配就行，那对于 function
和 struct 呢？也能用字符串匹配吗？

```rust
struct Foo;

impl Foo {
    fn bar(self) {}
}

fn main() {
    let f = Foo;
    f.$0;
}
```

对于上述情况，字符串匹配应该匹配啥呢？

```rust
//foo.rs
pub struct Foo;

impl Foo {
    pub fn bar(self) {}

    fn baz(self) {}
}

//main.rs
mod foo;
use foo::Foo;

fn main() {
    let f = Foo;
    f.$0;
}
```

这里应该建议补全 f.baz 吗？baz 作为一个私有方法，在 main.rs 中是没有权限访问的
（虽然在上一节限制了只考虑单个文件，但这里还是想提一下）。在 RA 中会给出补全
f.bar 和 f.baz 的建议，补全后会给出"associated function baz is private"的
error。也不知道这是个 bug，还是故意这么设计的。但无关紧要，这里想说的是，字符串
匹配不足以实现自动补全。通过上面的例子，实现自动补全似乎需要知道 f 是一个
struct，该 struct 有哪些方法，哪些 field？甚至每个方法，每个 field 的
visibility。

如果我们有了 AST，能完成自动补全吗？

```rust
struct Foo {
    first: i32,
    second: String,
}

impl Foo {
    fn bar(self) {}
    fn baz(self) {}
}

fn main() {
    let foo = Foo {
        first: 0,
        second: String::from("hello"),
    };
    foo.$0
}
```

假设上述代码的 AST 如下

![](/13/ast.png)

AST 已经有足够的信息去做 struct 的自动补全，遍历 AST 可以知道 foo 是一个 Struct
Foo，再遍历 AST 可以知道 Foo 有哪些 field，哪些 method。最终给出自动补全的建议

```
first
second
bar()
baz()
```

Rust Analyzer 是怎么做的？RA 的做法和我上面说的没有本质不同，下面简单聊聊 RA 中额外的东西

> 2022.12.17：今天再读，感觉 “RA 的做法和我上面说的没有本质不同” 这个结论是有很
> 大问题的，RA 做了编译器前端需要做的一切事情，包括 name resolution，type check
> 等等

### 易用性

首先是为了易用性，RA 在 AST 上再包了一层。怎么理解呢，假设 AST 中非叶子节点的定义是

```rust
struct Node {
    kind: Kind,
    text: String,
    children: Vec<Either<Node, Token>>
}
```

对于 Foo

```
Node { kind: Kind::Struct, text: "Foo".to_string(), children: vec![first, second, bar, baz] }
```

无论是一个 struct，还是一个 function，又或者是一个 trait，在 AST 中它们都只是
Node，类型是相同的，要得到 struct 的 field、method，或是得到 function 的
parameter、return type 都只能通过遍历 children。

对于 struct，RA 定义了类似下面的数据类型

```rust
struct Struct {
    node: Node
}

impl Struct {
    fn fields(&self) -> impl Iterator<Item = Field> {}
    fn first_field(&self) -> Field {}
    fn methods(&self) -> impl Iterator<Item = Method> {}
    fn first_method(&self) -> Method {}
    ...
}
```

把 Foo 对应的 Node 转换成一个 Struct，对一个 Struct 操作比对一个 Node 操作要方便
的多。

### 性能优化

每次找一个 node 都需要遍历 AST 吗？在 IDE 中敲代码，每个小改动都要重新分析一遍所
有代码吗？

事实是大多数的改动都非常小，我们之前的一些计算结果并不需要抛弃。得益于 salsa
，RA 实现了增量计算，对于 salsa 的细节，我也搞不清
楚，https://github.com/rust-analyzer/rust-analyzer/blob/master/docs/dev/guide.md#salsa
high level 的讲了 salsa 是如何工作的。

之后应该会去研究一下 salsa，再来分享
