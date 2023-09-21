---
title: '安装配置 WSL2'
date: '2023-09-21'
---

## 安装 WSL2

按照官网 [How to install Linux on Windows with WSLinstall wsl](https://learn.microsoft.com/en-us/windows/wsl/install#install-wsl-command) 的步骤安装 WSL2。下面是我安装的步骤：

管理员身份运行 powershell，执行以下命令：
```powershell
wsl --install
```

重启电脑

执行 `wsl --list` 查看已安装的 distro，但是显示没有安装任何 distro。官方文档的意思是执行完 `wsl --install` 后会自动安装 Ubuntu，但是我这里没有自动安装 Ubuntu。然后我发现在应用程序列表中有一个 Ubuntu，点击它，按照提示安装 Ubuntu，然后就可以在 `wsl --list` 的输出中看到 Ubuntu 了。现在可以使用 `wsl` 命令进入 Ubuntu。

![](wsl/20230921075234.png)


## 配置代理

前置条件：
1. 在 Windows 是使用 clash for windows 作为代理
2. 代理的端口是 7890

```bash
#!/bin/sh
hostip=$(cat /etc/resolv.conf | grep nameserver | awk '{ print $2 }')
wslip=$(hostname -I | awk '{print $1}')
port=7890

PROXY_HTTP="http://${hostip}:${port}"

set_proxy(){
    export http_proxy="${PROXY_HTTP}"
    export HTTP_PROXY="${PROXY_HTTP}"

    export https_proxy="${PROXY_HTTP}"
    export HTTPS_proxy="${PROXY_HTTP}"
}

unset_proxy(){
    unset http_proxy
    unset HTTP_PROXY
    unset https_proxy
    unset HTTPS_PROXY
}

test_setting(){
    echo "Host ip:" ${hostip}
    echo "WSL ip:" ${wslip}
    echo "Current proxy:" $https_proxy
}

if [ "$1" = "set" ]
then
    set_proxy
    echo "Proxy set to ${PROXY_HTTP}"

elif [ "$1" = "unset" ]
then
    unset_proxy

elif [ "$1" = "test" ]
then
    test_setting
else
    echo "Unsupported arguments."
fi
```

```shell
source proxy.sh set
```

用 `curl -v www.google.com` 测试，发现代理不起作用。

在 clash for windows 中，开启 `Allow LAN` 选项，就可以了。

![](wsl/20230921080117.png)


## 配置 terminal 以及常用命令行工具

### 安装 Nix

使用 [nix-installer](https://github.com/DeterminateSystems/nix-installer) 安装

```shell
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

### 安装 home-manager

按照 [install standalone](https://nix-community.github.io/home-manager/index.html#sec-install-standalone) 安装。

不过安装巨慢，感觉是 `nix-shell` 没有读取走代理。

参考 https://github.com/NixOS/nixpkgs/issues/27535#issuecomment-1178444327 的方案配置代理，下面是整理的适合 wsl 的脚本：

```bash
#!/bin/sh
hostip=$(cat /etc/resolv.conf | grep nameserver | awk '{ print $2 }')
wslip=$(hostname -I | awk '{print $1}')
port=7890

PROXY_HTTP="http://${hostip}:${port}"

sudo mkdir -p /etc/systemd/system/nix-daemon.service.d/
cat << EOF | sudo tee /etc/systemd/system/nix-daemon.service.d/override.conf >/dev/null
[Service]
Environment="http_proxy=${PROXY_HTTP}"
Environment="https_proxy=${PROXY_HTTP}"
Environment="all_proxy=${PROXY_HTTP}"
EOF
sudo systemctl daemon-reload
sudo systemctl restart nix-daemon
```

#### 配置 home-manager

```shell
git clone https://github.com/xffxff/nixfiles

ln -s /path/to/nixfiles ~/.config/home-manager

home-manager switch
```

大功告成，不过有个瑕疵是 terminal 的字体不对，zsh 主题有些图标显示为乱码。

![](wsl/20230921090053.png)

下载 [Meslo LGM Nerd Font](https://github.com/ryanoasis/nerd-fonts/blob/master/patched-fonts/Meslo/M/Regular/MesloLGMNerdFont-Regular.ttf) 并安装。

然后在 Windows Terminal 中将字体设置为 MesloLGM Nerd Font

![](wsl/20230921090242.png)

现在看起来好多了。
![](wsl/20230921090418.png)