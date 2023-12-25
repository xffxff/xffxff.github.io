---
title: 'Perplexity'
date: '2023-12-24'
---

在大模型评测中，经常会看到 perplexity 这个指标，我只是知道 perplexity 越小越好，但是不知道它的具体含义，本文尝试深入理解 perplexity。

## 直观理解“困惑”
现在有两个句子
* The cat sat on the mat
* The cat sat on the Thursday

显然第一个句子很容易理解，第二个句子让人困惑。如果 model 生成了第二个句子，那么这个 model 是不尽如人意的。

## 设计一个评测
给 model 一段高质量的文本，比如 wikipedia 的一段文章，去测试 model 对这段文本的困惑程度，一个优秀的 model 应该对这段文本的“困惑程度”很小。

怎么去量化 model 对一段文本的困惑程度呢？

## 如何量化“困惑”
最容易想到的就是计算 model 生成这个句子的概率。如果 model 生成某一文本的概率大，就说 model 对这一文本的困惑度小，反之困惑度大。

现在基于 decoder only 架构的大模型生成一个新的 token 会依赖于之前生成的 token，如果我们想要计算 model 生成某一句子的概率，就是一个联合概率的问题，即：
$$
p(x_{1:L}) = \prod_{i=1}^{L} p(x_i|x_{1:i-1})
$$

但是这样做有一个问题，就是如果句子很长，那 $p(x_{1:L})$ 就会很小，这样的话，我们就很难比较两个句子的概率了。

那如果给每个 token 的概率 $p(x_i|x_{1:i-1})$ 取平均值呢？考虑句子 “the cat sat on the mat”，假设每个 token 的概率都是 0.5，那么用平均值计算出来的结果就是 0.5，现在假设 model 认为 $p(mat|the \quad cat \quad sat \quad on \quad the) = 0$，这时候用平均值计算出来的结果就是 (0.5 * 5 + 0) / 6 = 0.4167，这个值确实比 0.5 小，但是这个指标并没有给到 $p(mat|the \quad cat \quad sat \quad on \quad the) = 0$ 这个显然不合理的概率一个足够大的惩罚。即这个句子应该是很有可能出现的，并没有什么让人困惑的地方，如果对这个句子感到困惑，就应该在评测指标上给予足够的惩罚。

几何平均是一个更合理的计算方式，几何平均值的计算公式是：
$$
\sqrt[L]{\prod_{i=1}^{L} p(x_i|x_{1:i-1})}
$$

困惑度应该和生成概率成反比，对概率取倒数，就是 perplexity 的定义：
$$
\text{Perplexity} = \frac{1}{\sqrt[L]{\prod_{i=1}^{L} p(x_i|x_{1:i-1})}}
$$

如果某一 token 的概率很小，比如说为 0，那么 perplexity 就会变得无穷大，这样就给了这个 token 一个足够大的惩罚。

## Perplexity 的信息论解释
对 $Perplexity$ 取对数，然后指数化，可以得到：
$$
\begin{align*}
\text{Perplexity} &= \frac{1}{\sqrt[L]{\prod_{i=1}^{L} p(x_i|x_{1:i-1})}} \\
&= \exp\left(\log\left(\frac{1}{\sqrt[L]{\prod_{i=1}^{L} p(x_i|x_{1:i-1})}}\right)\right) \\
&= \exp\left(\log\left(\left(\prod_{i=1}^{L} p(x_i|x_{1:i-1})\right)^{-\frac{1}{L}}\right)\right) \\
&= \exp\left(-\frac{1}{L} \sum_{i=1}^{L} \log(p(x_i|x_{1:i-1}))\right) \\
&= \exp\left(\frac{1}{L} \sum_{i=1}^{L} \log \frac{1}{p(x_i|x_{1:i-1})}\right)
\end{align*}
$$

其中 $\exp(\frac{1}{L} \sum_{i=1}^{L} \log \frac{1}{p(x_i|x_{1:i-1})})$ 就是交叉熵，即：
$$
\text{Perplexity} = \exp(\text{CrossEntropy})
$$

在信息论中，一个事件的信息量与该事件发生的概率成反比在信息论中，概率的倒数被称为概率的“信息量”。信息论告诉我们，对于一个特定事件，其最优编码长度应该与其信息量相等。所以 $$\frac{1}{L} \sum_{i=1}^{L} \log \frac{1}{p(x_i|x_{1:i-1})}$$ 表示使用 model 预测的分布来编码的平均长度。$$exp(average code length)$$ 可以看作是 model 在预测下一个 token 时平均有多少种选择。类似排列组合问题，每一位都有 0 1 两种选择，一共有 3 位，那么一共有 $2^3$ 种选择。

## 参考资料
https://stanford-cs324.github.io/winter2022/lectures/capabilities/#language-modeling

[为什么交叉熵（cross-entropy）可以用于计算代价？](https://www.zhihu.com/tardis/zm/ans/244557337?source_id=1003)