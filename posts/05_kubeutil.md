---
title: "封装我最常用的 3 个 kubectl 命令"
date: "2022-08-17"
---

这篇文章介绍了我最常用的 3 个 `kubectl` 命令，以及如何使用 bash 脚本将它们封装成我喜欢的样子。  

<!-- more -->


最近开始用 `kubectl`，发现有几个命令高频出现，下面来看一下这几个命令。  

1. 查询 pod 的运行状态  
```sh
kubectl get pods -n NAMESPACE | grep NAME_PATTERN
```

2. 查询某个 pod 的日志
```sh
kubectl get pods -n NAMESPACE | grep xxx | awk '{print $1}' | xargs kubectl logs -n NAMESPACE 
```

3. 登录到某个 pod
```sh
kubectl get pods -n NAMESPACE | grep xxx | awk '{print $1}' | xargs -I {} kubectl exec -n NAMESPACE -it {} /bin/bash 
```

每次都要敲这么多字符才能达成我们想要的结果，基本都是重复的东西，很容易想到我们可以把这几个命令写成 bash 脚本，假设这个脚本叫 `kubeutil`，
预期的接口是  

```sh
# 获取名字中包含 “xxx” 的 pod 的运行状态
kubeutil get xxx

# 获取名字中包含 “xxx” 的 pod 的日志
kubeutil log xxx

# 登录到名字中包含 “xxx” 的 pod
kubeutil exec xxx
```

`kubeutil log` 和 `kubeutil exec` 这两个脚本在逻辑上有个明显的漏洞，我们用 `grep xxx` 去匹配 pod 名字中包含 "xxx" 的 pod，如果有不止一个 pod 满足匹配要求呢？应该获取哪个 pod 的日志呢？登录进哪个 pod 呢？  

我们需要使 `grep xxx` 只匹配唯一一个 pod，那就得下更多的功夫在 `xxx` 上，得找到合适的匹配规则。实际上这让我很头疼，我总是需要先用 `kubeutil get xxx` 去匹配到一些 pod，查看这些 pod 的名字，然后去修改 `xxx`。

```sh
kubeutil exec foo
# Oh, get an error!!!

kubeutil get foo
# foo-bf47bc459-qkzbv                        1/1     Running   0          15d
# foo-7cd5bdd6cc-8n6vd                       1/1     Running   0          19d

kubeutil exec foo-bf
# it worked!
```

我们能做的更好吗？  

我们可以将 `kubeutil` 做成交互式的  

```sh
$ kubeutil exec foo                   # 运行指令，输出匹配到的 pod，并附上 index，让用户选择要登录到哪个 pod
0 foo-bf47bc459-qkzbv
1 foo-7cd5bdd6cc-8n6vd
Enter the index of pod that you want to select > 1  # 用户输入 1，表示选择登录到 `foo-7cd5bdd6cc-8n6vd`
```

完整代码  

```bash
#!/bin/bash

NAMESPACE="xxx"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

function select_pod {
    local pod_names=($( kubectl get pods -n $NAMESPACE | grep $1 | awk '{print $1}' ))

    local selected_pod="${pod_names[0]}"
    if [[ ${#pod_names[@]} -gt 1 ]]
    then
        # display pod name line by line with index
        local i=0
        for name in "${pod_names[@]}"
        do
            echo $i $name >&2
            i=$((i+1))
        done

        # read the user input
        echo -e -n "${GREEN}Enter the index of the pod you want to select > ${NC}" >&2
        read index
        selected_pod="${pod_names[$index]}"
    fi
    echo $selected_pod
}

if [ $# -ne 2 ]; then
        echo -e "${RED}error${NC}: please specify 2 command line arguments"
		exit 1
fi

case $1 in
    get)
        kubectl get pods -n $NAMESPACE | grep $2
    ;;

    log)
        selected_pod=$( select_pod $2 )
        kubectl logs -n $NAMESPACE $selected_pod
    ;;

    exec)
        selected_pod=$( select_pod $2 )
        kubectl exec -n $NAMESPACE -it $selected_pod /bin/bash
    ;;

    *)
        echo -e "${RED}error: ${NC}unsupported command"
    ;;
esac
```


