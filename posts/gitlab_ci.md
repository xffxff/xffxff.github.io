---
title: "如何使用 GitLab CI/CD 自动化 Docker 镜像打包和部署"
date: "2023-05-25"
---
最近在公司参与一个后端项目，当有功能更新或者 bug 修复时，需要重新打包镜像并部署到 k8s 集群中。这个过程比较繁琐，需要手动打包镜像、手动推送镜像、手动部署。这个过程中，有很多重复的操作，而且容易出错。因此，我考虑使用 GitLab CI/CD 来自动化这个过程。本文将介绍如何使用 GitLab CI/CD 来自动化打包镜像、推送镜像、部署应用。

在讨论如何使用 GitLab CI/CD 之前，有两个问题需要我们思考：什么时候触发打镜像、推送镜像、部署应用的流程？打镜像应该打什么标签呢？当有代码合并到 main 分支时触发该流程显然不太合理，因为有些代码只是一些小的修改，例如改了 readme 中的一个 typo，这种情况下没必要重新部署应用。打镜像应该打什么标签也是一个问题，总是打 latest 显然也不太合理，因为我们可能需要回滚到之前的版本，所以我们需要打上版本号。通常，项目的包管理工具都有一些配置项去管理版本号，例如 npm 的 package.json 中的 version 字段，rust 的 Cargo.toml 中的 version 字段，我们可以使用这些配置项来管理版本号，然后在打镜像时将版本号作为镜像的 tag。

基于以上考虑，我们可以确定以下流程：

当代码合并到 main 分支时，检查版本号是否有更新，如果有则触发打标签，打包并推送镜像，部署应用。

检查版本号是否有更新的方法可以使用 git tag 来实现。我们可以给所有历史版本都使用 git tag 打上标签，然后检查当前代码最新版本号的 tag 是否已在远端存在。如果不存在，说明版本号有更新，此时触发上述流程。

为了提高 CI 的可维护性，我们可以将上述流程拆分成多个 job。例如：

- 打标签
- 打包并推送镜像
- 部署应用

其中，打标签的难点在于如何查询当前版本号对应的 tag 是否在远端存在，以及如何向远端推送 tag。因为这些代码是跑在 Runner 上的，没办法交互式输入用户名和密码，也很难通过配置 ssh key 的方式获得远端仓库的读写权限（主要是因为我用的是 [在 docker 容器中跑 CI/CD 的模式](https://docs.gitlab.com/ee/ci/docker/using_docker_images.html) 这个模式）。不过，我们可以参考 https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html#bot-users-for-projects  。下面是一个可能的脚本实现（以 poetry 管理的 python 项目为例）：

```bash
# 仅在 git 未配置时进行配置
git config user.name >&- || git config user.name "ci-bot"
git config user.email >&- || git config user.email "ci-bot@xxx.com"
git config remote.gitlab_origin.url >&- || git remote add gitlab_origin https://oauth2:$ACCESS_TOKEN@gitlab.xxx
git remote -v

poetry_version=$(poetry version) # e.g. foo 0.1.0
project_name=$(poetry version | cut -d' ' -f1)  # 获取版本字符串中的第一个字符串，如 foo
project_version=$(poetry version | cut -d' ' -f2) # 获取版本字符串中的第二个字符串，如 0.1.0

tag_name="$project_name-$project_version"

# 检查标签是否已存在于远端
if git ls-remote --tags --exit-code gitlab_origin "$tag_name" > /dev/null 2>&1; then
    echo "Tag $tag_name already exists in remote, skipping"
else
    git tag -a "$tag_name" -f -m "Tagging $tag_name"
    git push gitlab_origin "$tag_name"
fi
```
打包并推送镜像的难点在于如何在 Runner 上使用 Docker CLI。我们可以选择使用 Docker-in-Docker 的方式来完成该操作，具体可以参考 https://docs.gitlab.com/ee/ci/docker/using_docker_build.html#use-docker-in-docker


对于部署应用，我们没有太多其他的要点可以讨论。如果使用 Helm 部署的话，建议在测试环境中部署 latest 镜像，而在生产环境中部署指定版本号的镜像。在测试环境中，可以使用 `helm delete` 命令删除已有应用，然后使用 `helm install` 命令来部署该应用。因为测试环境每次都是使用 latest 镜像，对于更新操作，如果用 `helm upgrade` 命令，k8s 会认为不需要进行更新，deployment 的状态没有发生改变。对于生产环境，可以使用 `helm upgrade` 命令来更新应用，因为有更新时我们总是会更新 charts 中的版本号。

总的来说，使用 GitLab CI/CD 可以完全自动化打包、推送镜像及部署应用的流程，并减少出错概率。