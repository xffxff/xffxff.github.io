---
title: '如何在 k8s 上部署单节点的 redis'
date: '2023-06-14'
---

背景是这样的，项目的测试环境需要 redis，对于测试环境来说，redis 的高可用性要求不高，所以就想着部署一个单节点的 redis，但在网上逛了一圈，发现教程都是部署 redis-cluster 的，看起来比较麻烦，所以我就想着不如从零开始使用 k8s YAML 文件的方式部署一个单节点的 redis。此文就是记录这个过程。

## 创建 deployment

```bash
kubectl create deployment my-redis --image=redis:latest --dry-run=client -o yaml > deployment.yaml
```

以上命令会生成一个 deployment.yaml 文件，内容如下：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    app: my-redis
  name: my-redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-redis
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: my-redis
    spec:
      containers:
        - image: redis:latest
          name: redis
          resources: {}
status: {}
```

`--image=redis:latest` 指定了使用的镜像，`--dry-run=client` 和 `-o yaml` 参数是为了生成 yaml 文件，而不是直接创建 deployment，如果不加这两个参数，会直接在 k8s 中创建 deployment。

## 暴露服务

我们需要将 redis 服务暴露出来，这样才能在集群上的其他 pod 中或者公司内网中访问到 redis 服务。这里使用 LoadBalancer 类型的 service。上一节中我们创建的 deployment 的名字是 my-redis，redis 默认的端口是 6379，所以我们可以使用以下命令创建 service：

```bash
kubectl expose deployment my-redis --port 6379 --target-port 6379 --name=my-redis-service --type=LoadBalancer --dry-run=client -o yaml > service.yaml
```

以上命令会生成一个 service.yaml 文件，内容如下：

```yaml
apiVersion: v1
kind: Service
metadata:
  creationTimestamp: null
  labels:
    app: my-redis
  name: my-redis-service
spec:
  ports:
    - port: 6379
      protocol: TCP
      targetPort: 6379
  selector:
    app: my-redis
  type: LoadBalancer
status:
  loadBalancer: {}
```

## 让 deployment 和 service 生效

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

或者

```bash
kubectl apply -f . # 一次性应用所有 yaml 文件
```

查看 deployment 和 service 是否生效：

```bash
> kubectl get svc | grep my-redis
my-redis-service   LoadBalancer   10.244.116.225   11.1.101.115 6379:32387/TCP 2m

> kubectl get pods | grep my-redis
my-redis-d8f7b7d64-sx87r    1/1     Running   0          14m
```

测试一下：

```bash
> redis-cli -h 11.1.101.115
```

## 修改 redis 配置

我们现在是使用的 redis 的默认配置，但是如果我们需要修改一下配置，比如设置密码，怎么做呢？

参考 [redis docker 镜像文档](https://hub.docker.com/_/redis)，我们需要将需要修改的配置文件挂载到容器中 `/usr/local/etc/redis/redis.conf` 这个路径下，然后在启动容器的时候指定配置文件的路径 `redis-server /usr/local/etc/redis/redis.conf`。

我们可以使用 ConfigMap 来挂载配置文件，然后在 deployment 中指定挂载的路径，这样就可以修改 redis 的配置了。

### 创建 ConfigMap

首先我们在本地创建一个 redis.conf 文件，内容如下：

```
requirepass 123456
```

根据 redis.conf 文件创建名为 my-redis-config 的 ConfigMap

```bash
kubectl create configmap my-redis-config --from-file=redis.conf --dry-run=client -o yaml > configmap.yaml
```

以上命令会生成一个 configmap.yaml 文件，内容如下：

```yaml
apiVersion: v1
data:
  redis.conf: |
    requirepass 123456
kind: ConfigMap
metadata:
  creationTimestamp: null
  name: my-redis-config
```

### 修改 deployment

修改 deployment.yaml 文件，添加 volumes 和 volumeMounts 以及 command：

```diff
apiVersion: apps/v1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    app: my-redis
  name: my-redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-redis
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: my-redis
    spec:
      containers:
      - image: redis:latest
        name: redis
        resources: {}
+        volumeMounts:
+        - mountPath: /usr/local/etc/redis
+          name: redis-config
+          command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
+      volumes:
+      - name: redis-config
+        configMap:
+          name: my-redis-config
status: {}
```
