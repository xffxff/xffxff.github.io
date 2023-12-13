---
title: '简单了解什么是 MoE'
date: '2023-12-13'
---

这两天 [Mixtral 8x7B](https://mistral.ai/news/mixtral-of-experts/) 发布，效果很不错，于是好奇什么是 MoE。

根据 8x7B 这个名字，我还以为是下面这种架构，有 8 个 7B 的模型，每个模型是一个 expert，然后用一个 gating network 来决定用哪个 expert。

![](/moe.png)

实际上并非如此，并不是有 8 个完整的 7B 模型，这 8 个 expert 有一部分参数是共享的，只有一部分参数是专门为这个 expert 专门训练的。以 Mixtral 8x7B 模型为例，这些 expert 只在 Transformer block 的 FFN 层是不同的，其它部分都是共享的。

![](/switch_transformer.png)

每次过 FFN 层时，都会有一个 router 来决定某个 token 由哪个或者哪几个 expert 来处理。

Router 其实很简单，一个全连阶层加上 softmax，输出是一个概率分布，每个 expert 对应一个概率，概率越大，这个 expert 被选中的概率越大。

不考虑优化的话 MoE 的逻辑和实现其实很简单，可以直接看看  [huggingface transformers mixtral model 的核心逻辑](https://github.com/huggingface/transformers/blob/371fb0b7dc1b533917e2f85b464a3ec9c74f28b9/src/transformers/models/mixtral/modeling_mixtral.py#L703-L746)

涉及到 tensor 的一些操作，直接看代码很难 trace 到一些细节，我通常喜欢单步调试。8x7B 模型太大了，我改了 model config，把模型变小，然后单步调试。下面是我调试的代码：

```python
from transformers import AutoConfig
from transformers.models.mixtral import MixtralForCausalLM 
from transformers import AutoTokenizer

config = AutoConfig.from_pretrained("mistralai/Mixtral-8x7B-v0.1")
config.num_hidden_layers = 4
config.num_attention_heads = 16
config.max_position_embeddings = 128
config.intermediate_size = 128
config.hidden_size = 128

tok = AutoTokenizer.from_pretrained("mistralai/Mixtral-8x7B-v0.1")
x = tok.encode("The mistral wind in is a phenomenon ", return_tensors="pt").cuda()
model = MixtralForCausalLM(config).to("cuda")

model.generate(x)
```

[Mixture of Experts Explained](https://huggingface.co/blog/moe) 这篇文章非常棒，推荐阅读。