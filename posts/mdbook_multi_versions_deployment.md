---
title: '部署多版本的 mdbook 到 Netlify'
date: '2023-11-04'
---

## 背景
新版 Salsa（Salsa 2022）还没有完成，仍然有很多用户在用旧版 Salsa，但是其文档已经被新版 Salsa 的文档替代了。为了让用户能够访问到旧版 Salsa 的文档，我们也需要部署旧版本的文档。

对应的 PR：https://github.com/salsa-rs/salsa/pull/451

## 方案一
我首先考虑的方案是在 Netlify 上部署两个项目，一个项目部署旧版 Salsa 的文档，另一个项目部署新版 Salsa 的文档。但是这样做有几个问题：
1. 两个项目的域名不一样，增加用户的记忆负担
2. 需要维护两个项目的部署

## 方案二
@nikomatsakis 建议让我们的 mdbook 支持多版本，而不是让旧版本重定向到一个外部链接。

> It'd be nice to modify the book here to just have both versions, I suppose, rather than redirecting to an external site. How hard would that be?

最开始我想直接把旧版本的文档放到新版本的文档中，把它们合成一个新的 mdbook，文档的目录结构可能是这样的：
```
Salsa2022
    - Overview
    - Getting Started
    - ...
Salas
    - Overview
    - Getting Started
    - ...
```
但是感觉这样比较麻烦，得手动把旧版本的文档复制到新版本的文档中，还得重新改造 [SUMMARY.md](https://github.com/salsa-rs/salsa/blob/2114c8ae0cb1ec23b56e31fbd3244d9f62e1f6c1/book/src/SUMMARY.md)

后来我考虑通过 URL 路径来区分不同版本的文档，比如：
```
Salsa2022: https://salsa-rs.netlify.app/ or https://salsa-rs.netlify.app/salsa2022
Salsa: https://salsa-rs.netlify.app/salsa
```

经过一番探索，发现是可行的，只需要分别编译出不同版本的文档，然后将其放入不同的目录，并部署至 Netlify。

```
versions/
    - salsa2022/
    - salsa/
```

另外，还需要一个 `_redirects` 文件，用来重定向到默认的版本，即重定向 `/` 到 `/salsa2022`。

```
# _redirects file
/                /salsa2022
```

最终的目录结构是这样的：
```
versions/
    - salsa2022/
    - salsa/
    - _redirects
```

编译不同版本的 mdbook 可以通过下面的脚本来实现：

```bash
# 保存当前分支或提交哈希
original_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$original_branch" == "HEAD" ]; then
  original_branch=$(git rev-parse HEAD)
fi

mkdir -p versions  # 为所有版本创建根目录

# 声明关联数组来映射提交哈希到自定义版本目录名称
declare -A commit_to_version=( ["$original_branch"]="salsa2022" ["754eea8b5f8a31b1100ba313d59e41260b494225"]="salsa" )

# 遍历关联数组中的键（提交哈希或分支名称）
for commit in "${!commit_to_version[@]}"; do
  git checkout $commit
  mdbook build
  version_dir="versions/${commit_to_version[$commit]}"
  mkdir -p $version_dir
  mv book/html/* $version_dir
  rm -rf book
done

# 返回到原始分支或提交
git checkout $original_branch

# 将_redirects文件复制到根目录
cp _redirects versions

```

Netlify 的部署配置如下：

![](../netlify_build_settings.png)