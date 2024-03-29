---
title: '《The Programmer's Brain》'
date: '2023-06-19'
---

《The Programmer's Brain》介绍大脑是如何工作的，以及利用大脑工作的特点来提高代码阅读能力，以及写出更好的代码。

## 读代码遇到的困难
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

这三段代码我读不懂的原因是一样的吗？

第一段代码读不懂的原因是我完全不了解 APL 这门语言，而且看起来它的语法和我之前见过的所有编程语言有很大区别。这本书把这种原因归类为 缺乏知识。

第二段代码并没有读不懂，只是通过这段代码我不知道 `Integer.toBinaryString` 是如何实现的，这对我来说是个黑盒，这本书把这种原因归类为 缺乏信息。当然，我可以通过在 IDE 中进行代码跳转，看看 `Integer.toBinaryString` 是如何实现的，这里作者更想表达的意思其实是 缺乏容易获取的信息（lack of easy-to-access infomation）。这个还是有感触的，比如前段时间我想看看 python `requests.post` 是怎么读取 proxy 有关的环境变量的，发现这个函数套了很多层，`reqeusts.post` -> `request` --> `session.request` -> ...

读第三段代码的困难在于有点费脑子，我得在大脑中模拟每一步的计算过程，作者把这类困难归类为 缺乏处理能力。

## 如何快速阅读代码

想要快速阅读代码，可以从上述三个读代码的困难之处入手，怎样优化我们的方法，削弱甚至克服这些困难带来的影响。

对于“缺乏知识”，并没有立竿见影的策略，你需要不断的积累，不断学习。这类知识存储在大脑的长期记忆（long time memory）中，我们唯一能做的就是怎样让知识更好的存储在长期记忆中，不要遗忘。艾宾浩斯遗忘曲线告诉我们，有规律的复习可以更好的记忆，这里就不展开了。作者提出了一个快速学习编程语言语法的方法——flashcard，制作一些卡片，一面是提示词，一面是对应的语法。中学时学英语听说过这种方法记单词，这里就不展开了。我个人对这种方法并不感冒，没有必要去专门记语法，要用的时候搜索一下就好了，记不住是因为它对于之前的我来说不够重要。作者这里给出的说法是，记住语法的好处是，去搜索会打断当前的工作，频繁打断当前的任务会影响效率，而且还有可能在搜索的时候注意到一个新闻，跑去看了会儿新闻。。。

对于“缺乏容易获取的信息”，它之所以会成为阅读代码的障碍，仍然是由于人脑记忆的限制。这回限制我们的是短期记忆（short time memory），短期记忆的容量太小了。比如说阅读代码的时候需要经常跳转，跳转的层级比较深的话，很容易忘记之前看的代码，甚至忘记自己本来看这段代码的目的。那有没有办法通过训练提升短期记忆的容量呢？很遗憾，没有。

作者提到一个关于国际象棋的有趣实验，实验分为两组，一组是普通棋手，一组是国际象棋大师，向他们展示一个棋局，当选手看完棋局后，棋子被遮盖起来，选手需要根据记忆重新摆放棋局。实验结果发现象棋大师的表现比普通棋手好很多，这是因为象棋大师的短期记忆容量比普通棋手更大吗？实验者又做了另外一个实验，同样要求普通和专家选手在短时间内记忆棋局。不同之处在于棋局本身。他展示给参与者的不是一个真实的棋局，而是随机放置棋子的棋盘，而且这些棋子的摆放是完全不符合实际的。再次比较了专家选手和普通选手的表现。第二个实验的结果却不同：两种类型的选手表现都很糟糕！

深入研究两组选手如何记忆棋局后发现，无论是在哪个实验中，普通选手大多是逐个棋子地记忆棋局，而专家们非常依赖存储在他们长期记忆中的信息，将信息以逻辑方式分组，比如记忆比较当前的棋面和常见的布局的差异。







