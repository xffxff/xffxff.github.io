---
title: '大模型训练优化——我的问题合集'
date: '2024-04-19'
---

**为什么 Megatron-LM 要在 PP 的第一 stage 和最后一个 stage 的 rank 上 build dataset 呢？**

看代码可以发现 Megatron-LM 在 build dataset 的时候，会根据 rank 来决定是否 build dataset，如果 PP 是第一个 stage 或者最后一个 stage 的 rank，那么就会 build dataset。

```python
# https://github.com/NVIDIA/Megatron-LM/blob/2196398f5252ead6f036b06d45f7acb89b1308da/pretrain_gpt.py#L168-L169
def is_dataset_built_on_rank():
    return (mpu.is_pipeline_first_stage() or mpu.is_pipeline_last_stage()) and mpu.get_tensor_model_parallel_rank() == 0
```

我的疑问其实是只用在第一个 stage build dataset 不就好了吗？其他 stage 的输入数据都是上一个 stage 的输出，通过网络传输过来的，为什么还要在最后一个 stage build dataset 呢？

这么做的原因是一个 batch 的数据包含 tokens, labels, loss_mask, attention_mask, position_ids，其中 labels, loss_mask 只在计算 loss 的时候用到，而 loss 的计算是在最后一个 stage 进行的，这些数据从第一个 stage 传到最后一个 stage 的过程中，会占用一些带宽，所以在最后一个 stage build dataset 可以减少数据传输的带宽。

![alt text](/get_batch.png)
[code link](https://github.com/NVIDIA/Megatron-LM/blob/2196398f5252ead6f036b06d45f7acb89b1308da/megatron/training/utils.py#L276-L314)