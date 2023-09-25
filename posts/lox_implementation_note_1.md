---
title: 'Lox 实现日记：局部变量'
date: '2023-09-26'
---                      

本文介绍了 lox 中局部变量的实现原理，重点关注了如何通过 bytecode 来实现局部变量。

```
{
    var a = 1;
    {
        var b = 2;
        print b;
    }
    print a;
}
```

局部变量的实现需要解决以下几个问题：
* 声明/定义变量
* 读取变量
* 释放变量

先来看看上述代码对应的 bytecode
```
Constant(value: 1)
Constant(value: 2)
ReadLocal(index_in_stack: 1)
Print
PopStack
ReadLocal(index_in_stack: 0)
Print
PopStack
```

将源代码和 bytecode 对应起来
```
{
    var a = 1;                           # Constant(value: 1)
    {
        var b = 2;                       # Constant(value: 2)
        print b;                         # ReadLocal(index_in_stack: 1), Print
    }                                    # PopStack
    print a;                             # ReadLocal(index_in_stack: 0), Print
}                                        # PopStack
```

仔细看看生成的 bytecode，有几个很有意思的地方
* 在定义变量的时候，我们仅仅是将变量的值压入了栈中，变量的名字 `a` 和 `b` 并没有出现在 bytecode 中
* 在读取变量的时候，我们并没有指定变量的名字，而是指定了变量在栈中的位置，比如 `ReadLocal(index_in_stack: 1)`，这里的 `1` 表示变量在栈中的位置
* 在离开作用域的时候，通过 pop 栈顶元素的方式释放在这个作用域中定义的变量

不妨先试着执行一下这段 bytecode，看看会发生什么，重点关注栈的变化。
```
Constant(value: 1)               push(1)                     # stack: [1]
Constant(value: 2)               push(2)                     # stack: [1, 2]
ReadLocal(index_in_stack: 1)     push(stack[1])              # stack: [1, 2, 2]
Print                            print(pop())                # stack: [1, 2]   output: 2
PopStack                         pop()                       # stack: [1]
ReadLocal(index_in_stack: 0)     push(stack[0])              # stack: [1, 1]
Print                            print(pop())                # stack: [1]      output: 1
PopStack                         pop()                       # stack: []
```

至少对于这段代码来说，生成这样的 bytecode 是没有问题的。那这种方式能否推广到一般情况呢？是可以的。目前，我们的 stack 中只会存局部变量和临时变量，而临时变量的生命周期是很短的，临时变量由 expression 生成，expression 所在的 statement 执行完毕后，临时变量就会被释放。所以，每个 statement 执行完毕后，栈中只会剩下局部变量，而且这些局部变量的位置是固定的，所以我们可以通过位置来引用这些局部变量。当要退出一个作用域时，该作用域中定义的局部变量都在栈顶，所以可以通过 pop 栈顶元素的方式释放这些局部变量。



