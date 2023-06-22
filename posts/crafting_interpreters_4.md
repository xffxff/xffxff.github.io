---
title: "《Crafting Interpreters》阅读笔记（四）"
date: "2021-11-19"
---

## 什么是 VM？
这是我问自己的第一个问题，想了很久，也查了一些资料，却并没有得到一个满意的答案。那如果我没有办法直接定义它，能否通过它有什么行为，提供什么功能去理解它呢？

## VM 有什么用？

![](https://picx.zhimg.com/80/v2-a2e11841bd50de897dbdaa08d559ed91_1440w.png?source=d16d100b)

由于硬件或者操作系统的不同，我们写的程序要想跨平台的运行，就得为所有平台定制一个 compiler，用于将高级语言翻译成各平台能认识的 machine code。

VM 会带来什么不同呢？以 JVM 为例，我们写的 java 代码并不直接翻译成 machine code，而是先翻译成 VM code，再把 VM code 丢给 JVM 就啥也不用管了。

![](https://pic1.zhimg.com/80/v2-30876b3fba4f52b8f851826d09d37052_1440w.png?source=d16d100b)

原本我们要针对不同的平台写多个 compiler，现在我们只用写一个用于将高级语言翻译成 VM code 的 compiler。等等，我们确实只用写一个 compiler 了，但是我们得写多个 JVM 啊，不同的平台都要写一个 JVM，我们只是把原本写多个 compiler 的工作转换成写多个 JVM 罢了。那 VM 的好处到底是什么呢？

第一个好处是可以让很多编程语言共用同一套 VM，真的有节省跨平台的工作量。以上图为例，有 Kotlin，Java 和 Scala 三种语言，假设有 5 个不同的平台，原来要写 15 个 compiler，现在只用写 3 个将高级语言翻译成 VM code 的 compiler，加上 5 个不同平台的 JVM。

还一个好处是我猜的，VM code 更接近 machine code，把 VM code 翻译成 machine code 比把高级语言翻译成 machine code 要简单的多，解决跨平台问题的工作量相对减少了。参考下面这张图，VM code 和汇编代码已经很接近了，将 VM code 翻译成汇编代码看起来并不是一件很复杂的事情（不用看了，图中的汇编你不认识，这是 nand2teries 课程老师自己设计的汇编：））


![](https://pic1.zhimg.com/80/v2-4a6cd2ea631b5cee6e54c183432d5442_1440w.png?source=d16d100b)

## 从 clox 的角度看 VM

> clox 是 [crafting interpreters part 2](https://craftinginterpreters.com/a-bytecode-virtual-machine.html) 用 c 实现的编程语言

通过上面的几张图或者例子，我们能否说 VM 在高级语言和 machine code 中加了一层抽象，接收 VM code 作为输入，将其翻译成 machine code？

并不是，clox 中的 VM 就没有将 VM code 翻译成 machine code 这一步，而是直接借助 C 语言去 interpret，比如说 VM code 是 push constant 2; push constant 3; add，直接转化成 2 + 3，交给 C 语言去处理。

现在对 VM 的认识又近了一步，VM 没有限制说要怎么去处理 VM code，给它 VM code，它就能输出一个计算结果。VM，virtual machine，就如字面意思，一个虚拟的机器，一个模拟器，模拟了一个输入 VM code 就可以计算出结果的机器。

## clox 为什么要用 VM 呢？

clox 用 VM 是为了解决跨平台问题吗？不全是。[crafting interpreter part 1](https://craftinginterpreters.com/a-tree-walk-interpreter.html) 中通过 walk AST 实现的 jlox 已经做到跨平台了，只要所在的平台能运行 java，就能运行 jlox。

![](https://picx.zhimg.com/80/v2-a8dc7bca9e8530a2bbf91cc5eebce11a_1440w.png?source=d16d100b)

但是 walk AST 实在是太慢了。以简单的1+2为例，AST 有多个节点，这些节点分散在内存的各个地方，访问这些节点的时候没法利用空间局部性提高 cache 命中。比如我们要 interpret 1+2 这个 binary node，需要访问的多个节点，节点之间分散在内存的各个地方，访问还很慢，这就是 jlox 性能差的根本原因。

抛弃 walk AST，生成在内存中是连续存储的 VM code，可以用一个数组去存储 VM code，这对 cache 来说是非常友好的。比如1+2对应的 VM code 如下

```
| 0000 0001 |           | push constant 1 |
| 0000 0002 |   <-->    | push constant 2 |
| 1000 0000 |           | add             |
```

通常用一个或者多个字节去编码 VM 的指令集，所以 VM code 又叫 bytecode。

## 随便写写
近一个月一直把 Crafting Interpreter 晾在一边，主要在看 rust 相关的东西，感觉有点累，学不动了，突然想到不如换个脑子，就又重新拾起 Crafting Interpreter。

其实这是一个不错的思路，就像打游戏一样，可以同时有多条主线任务，当一条主线卡关后，可以先放一放，去打打别的主线，又或者去刷刷比较轻松的支线，不然可能就直接放弃游戏，永远也没法通关了。