---
title: "《Crafting Interpreters》阅读笔记（二）"
date: "2021-10-17"
---

[《Crafting Interpreters》](http://www.craftinginterpreters.com/)中 jlox（Part I 中用 java 实现的 Lox 语言）用了 recursive descent parsing 去实现 parser。为了偷懒，下面用 RD 代指 recursive descent parsing 这个方法。

## 设计简易计算器

假如我们现在要实现一个支持加减乘除的计算器，那 parser 应该怎么设计？

* 并不是所有的输入都是支持的，比如输入“1 +/ 2”
* 不同运算符优先级不一样，考虑“1 + 2 * 3”，应该先算乘法，再算加法
* 当运算符优先级一样时，应该优先算靠左边的

上面三条都是在定义或者限制计算器的语法规则，我们将语法规则用一套符号语言去表示。

```
Expr -> Expr + Term     (1)
      | Expr - Term     (2)
      | Term            (3)
Term -> Term * Factor   (4)
      | Term / Factor   (5)
      | Factor          (6)
Factor -> Number        (7)
```

每一行表示一条语法规则，为了方便描述，给每条规则都标了号，这里一共有7条规则。上面的这套符号应该怎么理解呢？箭头左边的表达式可以转换成右边的表达式，“｜”表示逻辑或，比如说 Expr 可以展开成 Expr + Term， Expr - Term 和 Term 中的任何一个， 以"1 + 2 * 3" 为例列出每一步展开的过程。

```
0.               Expr
1. 应用规则1      Expr + Term
2. 应用规则4      Expr + Term * Factor
3. 应用规则7      Expr + Term * Number
4. 应用规则6      Expr + Factor * Number
5. 应用规则7      Expr + Number * Number
6. 应用规则3      Term + Number * Number
7. 应用规则6      Factor + Number * Number
8. 应用规则7      Number + Number * Number
```

不同运算符的优先级能在上述语法规则中体现吗？可以的，箭头左边的表达式，从上往下优先级递增。

上述语法真的能 work 吗？这里其实有一个在 RD 中非常出名的问题——Left Recursion

回到我们展开“1 + 2 * 3”这里例子，在第4行的时候我们应用规则6，将 Term 展开成 Factor，得到了 Expr + Factor * Number。Term 展开成了 Factor，为什么不是 Term * Factor，不是 Term / Factor 呢？这里我们站在上帝视角，知道应该走 Term → Factor → Number 路径才是正确的，但是根据我们的语法规则定义，由“｜”连接起来的都是平等的。好，现在放弃上帝视角，Term 展开成 Term * Factor，Term * Factor 中的 Term 又可以展开成 Term * Factor，现在变成了 Term * Term * Factor，以此类推，将无线递归下去。stack overflow！！！

怎么解决这个问题呢？其实很简单，表达式展开的时候不要把自身写在最左边

```
Expr -> Term + Expr     
      | Term - Expr     
      | Term            
Term -> Factor * Term   
      | Factor / Term   
      | Factor          
Factor -> Number
```

写成这样的语法规则能达到我们最开始设计时的那三点要求吗？oh，我们好像还没讨论运算符优先级相同时的情况。

考虑“1 + 2 + 3”会被 parse 成什么？答案是“(1 + (2 + 3))”，竟然是先算右边的，你可能会觉得先算右边好像也没啥大不了嘛，结果都一样，为啥要强调得先算左边呢？那试试“1 - 2 - 3”呢？为什么会先算右边呢？你可以尝试根据语法规则一步步展开推一下。感兴趣的话，这儿有一份用 python 实现的 parser，语法比我们这个略微复杂一点，（代码不是我写的，我甚至都没有看过，我只看了大佬的博客）。

刚刚讨论的其实是 parser 中一个非常重要的问题，叫 Asscociativity，像“+”，“-”，“*”，“/”都是 left-associative，“=”是一个典型的 right-associative，“a = b = c”应该被 parse 为 “a = (b = c)”。

```
Expr -> Term {+ Term}     
      | Term {- Term}     
      | Term            
Term -> Factor {* Factor}   
      | Factor {/ Term}   
      | Factor          
Factor -> Number
```

“{}”表示括号内可以重复一次或多次。（忘了“{}”这个叫中括号还是大括号了。。。）

这次它真的可以解决 left-associative 的问题，不信你可以推一下（狗头）。

## 优缺点
> Recursive descent parsers are fast, robust, and can support sophisticated error handling. In fact, GCC, V8 (the JavaScript VM in Chrome), Roslyn (the C# compiler written in C#) and many other heavyweight production language implementations use recursive descent.

这是《Crafting Interpreters》中说的，又快有稳定，GCC 都在用。但是下面两篇文章都指出 RD 有性能问题，每个优先级在语法规则中都会有一个单独的 level，直白点，代码中每个优先级会对应一个函数，优先级层数越多，对应的函数也就越多。即使输入只有一个 token “1”，也需要先后调用 expr，term，factor 函数。

https://web.archive.org/web/20191231231734/www.engr.mun.ca/~theo/Misc/exp_parsing.htm

https://eli.thegreenplace.net/2009/03/14/some-problems-of-recursive-descent-parsers/

这一块还没有怎么调研，先挖个坑吧。

## 参考
贴一下我觉得有用的文章，有用程度和先后顺序有关

https://eli.thegreenplace.net/2009/03/14/some-problems-of-recursive-descent-parsers/

https://web.archive.org/web/20191231231734/www.engr.mun.ca/~theo/Misc/exp_parsing.htm

《Engineering A Compiler (second edition)》3.3 left recursion

http://craftinginterpreters.com/parsing-expressions.html#ambiguity-and-the-parsing-game

## Implementing it in Rust
最后用 rust 实现了最终版的 RD，手动 lexer，哈哈哈

```Rust
/* 
Expr -> Term {+ Term}     
      | Term {- Term}     
      | Term            
Term -> Factor {* Factor}   
      | Factor {/ Factor}   
      | Factor          
Factor -> Number        

 */
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

fn expr<I: Iterator<Item = Token>>(token_iter: &mut Peekable<I>) -> Expr {
    term(token_iter)
}

fn term<I: Iterator<Item = Token>>(token_iter: &mut Peekable<I>) -> Expr {
    let mut lhs = factor(token_iter);
    while let Some(token) = token_iter.peek().cloned() {
        match token {
            Token::Plus | Token::Minus => {
                token_iter.next();
                let rhs = factor(token_iter);
                lhs = Expr::Binary(Box::new(lhs), token, Box::new(rhs));
            }
            _ => break,
        }
    }
    lhs
}

fn factor<I: Iterator<Item = Token>>(token_iter: &mut Peekable<I>) -> Expr {
    let mut lhs = primary(token_iter);
    while let Some(token) = token_iter.peek().cloned() {
        match token {
            Token::Slash | Token::Star => {
                token_iter.next();
                let rhs = primary(token_iter);
                lhs = Expr::Binary(Box::new(lhs), token, Box::new(rhs));
            }
            _ => break,
        }
    }
    lhs
}

fn primary<I: Iterator<Item = Token>>(token_iter: &mut Peekable<I>) -> Expr {
    if let Some(Token::Number(n)) = token_iter.peek().cloned() {
        token_iter.next();
        return Expr::Number(n);
    }
    panic!("No more tokens left")
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
    let s = expr(&mut tokens.into_iter().peekable());
    assert_eq!(s.to_string(), "(1 + (2 / 3))");

    let tokens = vec![
        Token::Number(1),
        Token::Minus,
        Token::Number(2),
        Token::Plus,
        Token::Number(3),
    ];
    let s = expr(&mut tokens.into_iter().peekable());
    assert_eq!(s.to_string(), "((1 - 2) + 3)");
}
```