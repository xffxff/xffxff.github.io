---
title: 'RWKV'
date: '2024-01-06'
---

Transformer self-attention 的时间复杂度是 $O(T^2d)$， 空间复杂度是 $O(T^2 + Td)$， T 是序列长度，d 是 hidden size。而 RWKV 可以将**推理**的时间复杂度降低到 $O(Td)$，空间复杂度降低到 $O(d)$。
> 这里强调了“推理”，训练的话，我还搞不清楚

在 RWKV 之前，有一些对不同 Transformer 架构也是为了降低 attention 的时间复杂度或者空间复杂度。比如 Linear Transformer 和 AFT（Attention Free Transformer）。

![](/different_transformers.png)
*图片来源：https://arxiv.org/pdf/2305.13048.pdf*

Linear Transformer 的核心思想去掉 scaled-dot attention 中的 softmax，这样计算 $QK^TV$ 时，可以先算 $K^TV$，这样时间复杂度就变成了 $O(Td^2)$。建议阅读 [线性Attention的探索：Attention必须有个Softmax吗？](https://spaces.ac.cn/archives/7546)

AFT 的一个改变是在做 $Q$，$K$，$V$ 的相关计算时，不要用 dot product 了，而是改用 element-wise product。
$$
Y_t = \sigma_q(Q_t) \odot \frac{\sum_{t'=1}^T \exp(K_{t'} + w_{t,t'}) \odot V_{t'}}{\sum_{t'=1}^T \exp(K_{t'} + w_{t,t'})}
$$
这样做相对于 Transformer 的时间复杂度并没有改变，仍然是 $O(T^2d)$（$K_t$ 和 $V_t$ element wise 的乘法是 $O(d)$，对 $T$ 求和是 $O(T)$，有 $T$ 个 $Y_t$，所以是 $O(T^2d)$），但是空间复杂度降低到 $O(Td)$，因为不需要保存 $QK^T$ 生成的 $T \times T$ 的矩阵。建议阅读 [RWKV的RNN CNN二象性](https://zhuanlan.zhihu.com/p/614311961) 中关于 AFT 的部分。

> 只有在 $T$ 足够大的时候，Transformer 的 $T^2$ 时间复杂度和空间复杂度才是值得重视的问题，我们上面都是在分析 Transformer attention 相关的复杂度，实际上在 LLM 中，当 $T$ 没有足够大的时候，FFN 层的计算量可能会比 attention 层的计算量大很多。推荐阅读：[线性Transformer应该不是你要等的那个模型](https://spaces.ac.cn/archives/8610)

## RWKV
### RWKV 和 RNN 的关系
*Reinventing RNNs for the Transformer Era*，RWKV 的标题非常霸气，RWKV 真的是一个传统 RNN 模型吗？

RWKV 的新颖之处在于它的 “attention”（RWKV 中叫做 WKV） 可以写成 RNN 的形式
$$
wk v_t = \frac{\sum_{i=1}^{t-1} e^{-(t-1-i)w+k_i} \odot v_i + e^{u+k_t} \odot v_t}{\sum_{i=1}^{t-1} e^{-(t-1-i)w+k_i} + e^{u+k_t}}.
$$

令 
$$
\alpha_{t} = \sum_{i=1}^{t} e^{-(t-i)w+k_i} \odot v_i 
$$
$$
\beta_{t} = \sum_{i=1}^{t} e^{-(t-i)w+k_i}
$$
$$
wk v_t = \frac{\alpha_{t-1} + e^{u+k_t} \odot v_t}{\beta_{t-1} + e^{u+k_t}}
$$
写成 RNN 形式的好处是计算 $wk v_t$ 的时候可以利用之前的状态 $\alpha_{t-1}$ 和 $\beta_{t-1}$，这样计算 $wk v_t$ 的时间复杂度就是 $O(d)$，空间复杂度也是 $O(d)$。

推荐阅读 [RWKV的RNN CNN二象性](https://zhuanlan.zhihu.com/p/614311961) 中关于 RWKV 的部分，作者清晰的解释了 RWKV 和 AFT 的关系，以及如何直观理解 wkv。

### Token Shift
传统的 Transformer 在 self-attention 之前会对输入 $x$ 做 linear projections 得到 $Q$，$K$，$V$。RWKV 的不同之处在于并不是直接对 $x$ 做 linear projection，而是对 current inputs 和 previous inputs 做一个线性插值后再做 linear projection。这个线性插值的过程就是 token shift。即：
$$
r_t = W_{r} \cdot (\mu_r \odot x_t + (1 - \mu_r) \odot x_{t-1})
$$
$$
k_t = W_{k} \cdot (\mu_k \odot x_t + (1 - \mu_k) \odot x_{t-1})
$$
$$
v_t = W_{v} \cdot (\mu_v \odot x_t + (1 - \mu_v) \odot x_{t-1})
$$


感觉 token shift 很像 kernel size 为 2 的卷积

![](/token_shift.png)

作者几年前就提出了 token shift 的想法，参见 [Time-shift: 一行代码，免费提高 Transformer 性能（无参数，无耗时）](https://zhuanlan.zhihu.com/p/399480671)

### 局限性
* 超长上下文任务上效果受限：RWKV 这种递归架构限制了它回顾之前 token 的能力，不像 self-attention 可以保留所有 token 的信息。
* 对 prompt 比较敏感：用苏剑林的话说，RWKV 只会做闭卷考试，不会做开卷考试（不会往前翻书），prompt 中在一开始描述任务比较好，带着问题去阅读后续内容。Prompt "For the document below do X" 好于 "For the document above do X"。参考[苏剑林的回答](https://www.zhihu.com/question/602564718/answer/3062973388)
