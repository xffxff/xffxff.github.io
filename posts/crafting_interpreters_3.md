---
title: '《Crafting Interpreters》阅读笔记（三）'
date: '2021-10-24'
---

[《Crafting Interpreters》](http://www.craftinginterpreters.com/)中 clox（Part 2 中用 C 实现的 Lox 语言）实现了 [Pratt Parser](http://www.craftinginterpreters.com/compiling-expressions.html#a-pratt-parser)。[上一篇文章](crafting_interpreters_2)讲了 RD（Recursive Descent Parsing），个人感觉 Pratt Parsing 也是属于 RD 的，是 RD 的一个改进。

上篇文章中提到了 parsing 要解决的两个问题

- 不同运算符的优先级，比如 `*` 比 `+` 的优先级高，`1 + 2 * 3` 应该被 parse 为 `1 + (2 * 3)`
- Associativity，比如 `+` 是 left-associative 的， `1 + 2 + 3` 应该被 parse 为 `(1 + 2) + 3`，而赋值 `=` 是 right-associative 的，`a = b = c` 应该被 parse 为 `a = (b = c)`。

RD 中每个优先级都在语法规则中占一个 level，对应到代码中，每个优先级都会对应一个单独的函数，优先级低的函数先被调用，每个函数都会调用比自己优先级更高一级的函数，通过这种方式解决不同运算符的优先级问题。至于 Associativity，是通过是否在函数中递归调用自身解决的。

当语法写成下面这种形式时，表示 Int 比 Plus 的优先级高，函数 plus 会调用 int，且 `+` 是 left-associative 的。

```
Plus -> Int {+ Int }
```

把语法改下，写成

```
Plus -> Int + Plus
```

这样的话，函数 plus 不仅会调用 int，还会调用自身。Int 的优先级仍然比 Plus 高，但是 `+ `变成了 right-associative 的。

RD 对语法的定义很严格，得很小心的去写，避免把 left-associative 和 right-associative 搞错。你还得很小心的写，避免弄出 left recursion。。。比如不能写成下面这样

```
Plus -> Plus + Int
```

另外，RD 每个优先级都对应一个函数，运行效率很低，即使只是 parse 一个 token，也需要调用多个层级的函数。

Pratt Parsing 很优雅的解决了 RD 中的这些问题，没有那么多层级，通过比较当前运算符和上一个运算符的优先级来确定哪个运算符应该先算。

```
  1   +   2   *   3
0   1   1   2   2   0
```

同样通过给运算符左右两侧赋予不一样的值，就可以实现 left-associative 和 right-associative

```
  1     +     2     +   3
0   1.1    1    1.1   1   0
```

对于 Pratt Parsing，我发现了一篇神文，看过几篇写 Pratt Parsing 的文章，没有哪一篇将 Pratt Parsing 写得如此清晰。

[Simple but Powerful Pratt Parsing](https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html)

作者是 rust-analyzer 的作者 matklad，rust-analyzer 中的 parser 用的就是 Pratt Parsing。

比较好笑的是 matklad 说写这篇文章的原因是他经常看不懂自己在 rust-analyzer 中写的 pratt parsing 代码

> Understanding the algorithm myself for hopefully the last time. I’ve implemented a production-grade Pratt parser once, but I no longer immediately understand that code :-)

既然 matklad 已经写得这么好了，我就没必要再写了:-），主要还是因为懒，写这个真的很费劲。另外感觉自己也没有啥额外的东西可写，写的话很可能写成 matklad 文章的翻译。

上篇文章用 RD 实现了加减乘除计算器的 parser，这里贴一下 Pratt Parsing 的实现，代码很简单，看看有助于理解

```Rust
use std::fmt;
use std::iter::Peekable;

#[derive(Debug, Clone)]
enum Token {
    Number(u32),
    Plus,
    Minus,
    Star,
    Slash,
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Token::Number(n) => write!(f, "{}", n),
            Token::Plus => write!(f, "+"),
            Token::Minus => write!(f, "-"),
            Token::Star => write!(f, "*"),
            Token::Slash => write!(f, "/"),
        }
    }
}

#[derive(Debug)]
enum Expr {
    Number(u32),
    Binary(Box<Expr>, Token, Box<Expr>),
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Expr::Number(n) => write!(f, "{}", n),
            Expr::Binary(lhs, token, rhs) => {
                write!(f, "({} ", lhs)?;
                write!(f, "{} ", token)?;
                write!(f, "{})", rhs)
            }
        }
    }
}

fn expr_bp<I: Iterator<Item = Token>>(token_iter: &mut Peekable<I>, min_bp: u8) -> Expr {
    let mut lhs = match token_iter.peek() {
        Some(Token::Number(it)) => Expr::Number(*it),
        Some(token) => panic!("bad token: {:?}", token),
        None => panic!("no more tokens left"),
    };
    token_iter.next();

    while let Some(token) = token_iter.peek().cloned() {
        if let Token::Number(_) = token {
            panic!("bad token: {:?}", token)
        }

        let (l_bp, r_bp) = infix_binding_power(token.clone());
        if l_bp < min_bp {
            break;
        }

        token_iter.next();
        let rhs = expr_bp(token_iter, r_bp);
        lhs = Expr::Binary(Box::new(lhs), token.clone(), Box::new(rhs));
    }
    lhs
}

fn infix_binding_power(op: Token) -> (u8, u8) {
    match op {
        Token::Plus | Token::Minus => (1, 2),
        Token::Star | Token::Slash => (3, 4),
        _ => panic!("bad op: {:?}", op),
    }
}

#[test]
fn tests() {
    let tokens = vec![
        Token::Number(1),
        Token::Plus,
        Token::Number(2),
        Token::Slash,
        Token::Number(3),
    ];
    let s = expr_bp(&mut tokens.into_iter().peekable(), 0);
    assert_eq!(s.to_string(), "(1 + (2 / 3))");

    let tokens = vec![
        Token::Number(1),
        Token::Minus,
        Token::Number(2),
        Token::Plus,
        Token::Number(3),
    ];
    let s = expr_bp(&mut tokens.into_iter().peekable(), 0);
    assert_eq!(s.to_string(), "((1 - 2) + 3)");
```
