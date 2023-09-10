---
title: '《The Programmer's Brain》'
date: '2023-06-19'
---

《The Programmer's Brain》介绍大脑是如何工作的，以及利用大脑工作的特点来提高代码阅读能力，以及写出更好的代码。

## 为什么读代码很难
我经常会遇到读不懂的代码，然后抱怨：“我太菜了”，“这人代码写的太烂了”。这本书帮我给我读不懂的原因归了下类：
* 缺乏知识（lack of knowledge）
* 缺乏信息（lack of infomation）
* 缺乏处理能力（lack of processing power）

比如下面三段代码，分别用 APL, Java 和 Basic 实现的，将数字 N 转换为二进制表示

```APL
2 2 2 2 2 ⊤ n
```

```java
public class BinaryCalculator { 
   public static void main(Integer n) {
      System.out.println(Integer.toBinaryString(n)); 
   }
}
```

```basic
LET N2 =  ABS (INT (N))
LET B$ = ""
FOR N1 = N2 TO 0 STEP 0
     LET N2 =  INT (N1 / 2)
     LET B$ =  STR$ (N1 - N2 * 2) + B$
     LET N1 = N2
 NEXT N1
 PRINT B$
 RETURN
```

这三段代码我读不懂的原因是一样的吗？第一段代码读不懂的原因是我完全不了解 APL 这门语言，而且看起来它的语法和我之前见过的所有编程语言有很大区别。这本书把这种原因归类为 缺乏知识。

第二段代码并没有读不懂，只是通过这段代码我不知道 `Integer.toBinaryString` 是如何实现的，这对我来说是个黑盒，这本书把这种原因归类为 缺乏信息。当然，我可以通过在 IDE 中进行代码跳转，看看 `Integer.toBinaryString` 是如何实现的，这里作者更想表达的意思其实是 缺乏容易获取的信息（lack of easy-to-access infomation）。这个还是有感触的，比如前段时间我想看看 python `requests.post` 是怎么读取 proxy 有关的环境变量的，发现这个函数套了很多层，`reqeusts.post` -> `request` --> `session.request` -> ...

读第三段代码的困难在于有点费脑子，我的在大脑中模拟每一步的计算过程，作者把这类困难归类为 缺乏处理能力。





