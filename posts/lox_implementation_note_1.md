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

可以看到，这段 bytecode 的执行结果是符合预期的。

仔细观察 bytecode，有几个很有意思的地方
* 在定义变量的时候，我们仅仅是将变量的值压入了栈中，变量的名字 `a` 和 `b` 并没有出现在 bytecode 中
* 在读取变量的时候，我们并没有指定变量的名字，而是指定了变量在栈中的位置，比如 `ReadLocal(index_in_stack: 1)`，这里的 `1` 表示变量在栈中的位置

之所以能这样做，是因为我们在编译期就能确定局部变量在 stack 中的位置。