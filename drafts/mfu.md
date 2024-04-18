
模型训练过程中大多数浮点运算都是矩阵乘法，对于一个 $m \times n$ 的矩阵 $A$ 和一个 $n \times p$ 的矩阵 $B$，$A \times B$ 需要 $m \times n \times p$ 次乘法和 $m \times n \times p$ 次加法，即需要 $2mnp$ FLOPs。

## Transformer Architecture 的 FLOPs 计算

![alt text](image-1.png)

![alt text](image-2.png)

### Attention

Q，K，V transformation:  $3 \times 2Bsh^2$ 

$QK^T$: $2Bs^2h$

attention over values: $2Bs^2h$

post-attention linear projection: $2Bsh^2$

### Feed Forward Network

linear h->4h: $8Bsh^2$

linear 4h->h: $8Bsh^2$

### Total

forward: $(6 + 2 + 8 + 8)Bsh^2 + (2 + 2)Bs^2h = 24Bsh^2 + 4Bs^2h$

backward 的 FLOPs 大致是 forward 的 2 倍，所以 forward + backward 的 FLOPs 大致是 $72Bsh^2 + 12Bs^2h$


![alt text](image.png)