---
title: '《Crafting Interpreters》阅读笔记（一）'
date: '2021-10-15'
---

最近在看 [《Crafting Interpreters》](http://www.craftinginterpreters.com/)，想知道编程语言到底是怎么实现的，也希望借此加深对其他语言的理解。这个系列算是这本书的阅读笔记，我希望这不是对书上内容的摘抄或者转述，而是融入更多自己的思考。原书中有很多代码片段，跟着敲就能完成语言的实现，跟原书不同的是，我不希望在文章中出现代码，不关心代码实现的细节，更关注为什么要这么实现，从 high level 的角度看怎么实现。

这本书实现的编成语言叫 Lox，全书分为两部分，Part I 是用 java 实现一个 Tree-walk interpreter，parser 生成 AST（Abstruct Syntax Tree）后，通过遍历 AST 的方式去 interpret；Part 2 是用 C 实现的，parser 不再生成 AST，而是 bytecode，通过 VM（Virtual Machine）去 interpret。我们用 clox 指代用 C 语言实现的 Lox，我主要关心 clox 的实现，这篇文章以及可能会有的接下来的文章都是关于 clox 的。

![](/craft_interpreters_1.png)

lexer 将 text string 转化成一连串的 token，parser 根据语法规则将这些 token 解析为 bytecode，这都是 clox 的编译过程，在 clox 中 parser 生成的是 bytecode。bytecode 听起来很高大上，其实就是一个数组，数组中存储的是二进制编码，每个二进制编码代表一个指令，比如用 0000 0001 表示 add，用 0000 0010 表示 return，这都是你自己规定的，数组中每个元素都是一个 byte，这应该就是 bytecode 这个名字的由来吧。VM 怎么理解？可以把 bytecode 想象成一条无限长的纸带，纸带被分成一个个相邻的格子，每个格子中都存储了一条指令。配合上一个指向纸带格子的指针，再加上可以保存当前运行状态的一块存储空间，这不就是图灵机吗？VM 是一个模拟器，模拟了图灵机，或者说模拟了 CPU 和内存，是一个虚拟的 machine ==

呃，说了这么多，还没介绍 Lox 的语法呢？介绍语法真是一个无聊的过程，真的需要介绍吗？不需要吧，反正又没人会用 Lox 写代码。。。只需要知道它是一个动态类型语言，有 GC，支持 function，closure 以及 class 就够了，语法比较像 javascript。

我不太关心 lexer，主要比较好奇 parser 以及 VM，接下来会讨论一些 parser 和 VM 相关的东西。
