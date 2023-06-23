---
title: '如何看待 rust 体系中 rowan 的红绿树'
date: '2022-04-01'
---

本文源自我在知乎的一个回答，原文地址：https://www.zhihu.com/question/525030607/answer/2418851335

原问题为：

> 仓库：https://github.com/rust-analyzer/rowan  
> 参考文献：[理解 Roslyn 中的红绿树（Red-Green Trees](https://blog.walterlv.com/post/the-red-green-tree-of-roslyn.html)  
> 这种设计似乎可以应用在 lsp 中作为提高语言增量解析和构建的效率。  
> 不过尚未深刻理解其算法的精妙~

## 回答

题主给了篇参考文章

> Roslyn 一开始就将漂亮的 API 作为目标的一部分，同时还要非常高的性能；所以 Roslyn 的开发团队需要找到一种特殊的数据结构来描述语言（如 C#）的语法。这种数据结构要满足这些期望的要求：
>
> 1. 不可变（Immutable）
> 2. 树的形式
> 3. 可以容易地访问父节点和子节点
> 4. 可以非常容易地将任何一个节点对应到源代码文件的一段文本区间
> 5. 可重用（Persistent）

从第 4 点开始说，这是一个很常见的需求，想想我们的编译器报错信息，能够指出错误出现在源文件的哪一行哪一列。我们可能设计出下面这种数据结构作为 syntax tree

```Rust
#[derive(PartialEq, Eq, Clone, Copy)]
struct SyntaxKind(u16);

#[derive(PartialEq, Eq, Clone)]
struct Node {
    kind: SyntaxKind,
    text_len: usize,
    children: Vec<Arc<Either<Node, Token>>>,
    offset: usize
}

#[derive(PartialEq, Eq, Clone)]
struct Token {
    kind: SyntaxKind,
    text: String,
    offset: usize
}

// https://github.com/rust-analyzer/rust-analyzer/blob/master/docs/dev/syntax.md
```

对于 `1 + 2` ，我们会得到如下的 syntax tree

```
               +-----------------+
               |  Node           |
               |  kind: BinExpr  |
      +--------+  text_len: 5    +-------+
      |        |  offset: 0      |       |
      |        +-------+---------+       |
      |                |                 |
      |                |                 |
      |                |                 |
      |                |                 |
      |                |                 |
      |                |                 |
      v                v                 v
+----------+    +------------+    +-----------+
|Token     |    | Token      |    | Token     |
|kind: int |    | kind: plus |    | kind: int |
|text: 1   |    | text: +    |    | text: 2   |
|offset: 0 |    | offset: 2  |    | offset: 4 |
+----------+    +------------+    +-----------+
```

如果我们把 source code 简单改一下，多加一个 whitespace，即 `1  + 2` ，我们的 syntax tree 会发生变化吗？当然，从 + 开始所有节点的 offset 都要发生变化。真实场景中 source code 会复杂得多，加一个 whitespace，整个 syntax tree 就作废了。太浪费了，加 whitespace，加 comments 其实并不影响我们的 syntax，有没有方法使得语法无关的修改不改变 syntax tree 呢？

很容易能想到，我们的 node 不包含 offset 不就可以了吗？问题是如果不包含 offset，“任何一个节点对应到源代码文件的一段文本区间” 这条就不满足了。

我们可以把 whitespace 也放到 syntax tree 中。

```
                               +---------------+
                               | Node          |
      +---------------+--------+ kind: BinExpr +---------+----------------+
      |               |        | text_len: 5   |         |                |
      |               |        +-------+-------+         |                |
      |               |                |                 |                |
      |               |                |                 |                |
      |               |                |                 |                |
      |               |                |                 |                |
      |               |                |                 |                |
      |               |                |                 |                |
      |               |                |                 |                |
      |               |                |                 |                |
      v               v                v                 v                v
+-----------+   +-----------+    +------------+    +-----------+    +-----------+
| Token     |   | Token     |    | Token      |    | Token     |    | Token     |
| kind: int |   | kind: wp  |    | kind: plus |    | kind: wp  |    | kind: int |
| text: 1   |   | text: ' ' |    | text: +    |    | text: ' ' |    | text: 2   |
+-----------+   +-----------+    +------------+    +-----------+    +-----------+
```

现在 syntax tree 已经包含了所有 source code 的信息，当然可以推断出每个 node 对应源代码的文本区间。

题主提到的 [rust-analyzer/rowan](https://blog.walterlv.com/post/the-red-green-tree-of-roslyn.html) ，readme 中的第一句话

> Rowan is a library for lossless syntax trees

lossless 指的应该就如我们上面所做的，source code 的任何东西都没有丢失，包括 whitespace，comments。

另一个有趣的事情是，现在的 syntax tree 有两个节点都是 whitespace，这两个节点有什么不同吗？没有任何不同，所以这两个节点是可以共用的。再比如 `1 + 1` 中的两个节点 `1` 也是可以共用的，这应该就是第 5 点“可重用”所要表达的意思吧。

> 这种设计似乎可以应用在 lsp 中作为提高语言增量解析和构建的效率。

那就以 lsp 为例谈一谈增量编译/计算。现在我们需要 lsp 帮我们做代码自动补全，流程大概像这样

- vscode：嘿，language server，帮我编辑器光标所在的位置做自动补全
- language server: 收到。哈喽，type checker，帮我做一下类型检查
- type checker: 好的，那我得先知道 AST
- ast creater：没问题。嗨，parser，帮我生成一下 syntax tree
- parser: 根据 source code 生成 syntax tree 。

![image](https://pic4.zhimg.com/80/v2-a0480cc5840280f58e321a44386bf645_720w.jpg)

如果哪个过程发现本次计算的结果和上次的结果没有变化，就告诉它的调用方说，计算结果和之前没有变化，你不用再重新计算了。比如说我就只在代码中多加了一个 whitespace，那 syntax tree 不会发生变化，后面的 ast， type check 都不用重新算了，直接用之前缓存的结果就好。

增量计算的话可以看看 [Salsa](https://github.com/salsa-rs/salsa)，rust-analyzer 用了这个库。

其实上面说的都是“绿树”部分。我觉得“红树”主要为了解决访问父节点的问题，另外也可以更方便算每个节点的 offset。

```Rust
type SyntaxNode = Arc<SyntaxData>;

struct SyntaxData {
    offset: usize,
    parent: Option<SyntaxNode>,
    green: Arc<GreeNode>,
}

impl SyntaxNode {
    fn new_root(root: Arc<GreenNode>) -> SyntaxNode {
        Arc::new(SyntaxData {
            offset: 0,
            parent: None,
            green: root,
        })
    }
    fn parent(&self) -> Option<SyntaxNode> {
        self.parent.clone()
    }
    fn children(&self) -> impl Iterator<Item = SyntaxNode> {
        let mut offset = self.offset;
        self.green.children().map(|green_child| {
            let child_offset = offset;
            offset += green_child.text_len;
            Arc::new(SyntaxData {
                offset: child_offset,
                parent: Some(Arc::clone(self)),
                green: Arc::clone(green_child),
            })
        })
    }
}
// https://github.com/rust-analyzer/rust-analyzer/blob/master/docs/dev/syntax.md
```

用起来大概像这样

```Rust
// 1 + 2
let addition_red_node = SyntaxNode::new_root(addtion_green_node);
let one = addtion_red_node.children().next().unwarp()
println!(one.parent().unwrap) // syntax node bin_expr(1,plus, 2)
```

另外注意到，红树的节点维护的都是指向绿树节点的 pointer/reference，构建红树并不需要对绿树做 deep copy，代价会比较小。

对于第 1 点 immutable，我不懂，希望懂的人指点。

Rust analyzer 的作者在 youtube 上讲过红绿树，用 rust 实现了一个简单的红绿树，推荐给各位 https://youtu.be/n5LDjWIAByM
