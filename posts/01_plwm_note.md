---
title: "自顶向下编译"
date: "2022-02-21"
---

本文是 nikomatsakis 在 [PLWM 2022](https://github.com/nikomatsakis/plmw-2022) 演讲的一点笔记。

传统编译器的工作模式是自底向上的。读取源代码，lexer 将源文本转换为一连串的 token，这些 token 输入给 parser ，parser 生成 syntax tree。Type checker 顾名思义会做一些类型检查，optimizer 会把 syntax tree/ast 转换成一些中间表示，coder generator 生成最终的可执行程序。   
<!-- more -->

![](/compiler1.png)  
这种自底向上的方式有什么问题呢？它需要将所有的源码都分析一遍，即使运行现在的程序只涉及部分代码。比如说下面这段代码，运行main函数并不需要compiler去分析函数helper。    
```
fn helper() {
    ...
}

fn main() {
    print("hello world")
}
```
如果我们只想运行某一个函数，理想情况下，只需要编译该函数以及该函数调用的其他函数，传统的编译器没有办法做到这一点。  

编译能自顶向下运行吗？  
![](/compiler2.png)  
要运行 main 函数  -> 
需要知道 main 函数的 IR -> 
需要对 main 函数做 type check -> 
那得先 parse main 函数  
传统编译器的每个模块都是被动的，喂给我什么我就用什么。上图的编译器中每个模块都是主动的，自己需要什么就找其他模块要。

非常合理啊，唯一的问题是假设一个函数多次被调用，那每次都得重新编译一遍？第一反应是搞一个缓存，编译过的就不再编译了。远不止如此，这个过程还揭示了什么时候需要重新计算，比如说在原有代码中加了一行注释，type checker 在向下索要 syntax tree 的时候，发现其并没有改变， 所以 type check 不需要重新再做了，直接用上一次的结果就好，相应的，之后的编译的所有计算都不需要重新再做了。  