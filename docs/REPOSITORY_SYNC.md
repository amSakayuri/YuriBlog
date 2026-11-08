# GitHub 内容仓库同步

专用 GitHub 仓库可保存文章、小说、卷、章节、关系、图片、散文、项目、页面及公开设置。建议使用私有仓库，因为包含草稿。

这是内容同步，不负责更新网站程序。用户、密码、会话、审计日志和密钥不会导出，不能代替[完整备份](BACKUP_RESTORE.md)。

## 配置服务器

1. 生成专用密钥：`ssh-keygen -t ed25519 -f /安全目录/content_deploy`。自动任务不能交互输入密钥口令，私钥需受限保存。
2. 将 `.pub` 公钥添加到目标仓库 Settings → Deploy keys，勾选 **Allow write access**。
3. 准备 GitHub 的 known_hosts 文件，并核对[官方 SSH 指纹](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)；不要关闭主机校验。
4. 在服务器 `.env.production` 中追加：

```dotenv
CONTENT_REPO_KEY_SOURCE=/安全目录/content_deploy
CONTENT_REPO_HOSTS_SOURCE=/安全目录/github_known_hosts
CONTENT_REPO_PRIVATE_KEY_FILE=/run/secrets/content_deploy_key
CONTENT_REPO_KNOWN_HOSTS_FILE=/run/secrets/github_known_hosts
CONTENT_REPO_DIR=/app/data/repository-sync
```

容器 UID 为 1000，确保它能读取文件；例如私钥设置 `chown 1000:1000` 和 `chmod 600`。私钥不要上传到任何 Git 仓库。

重新部署：

```sh
cd /opt/yuri-blog
export COMPOSE_FILE=docker-compose.yml:deploy/repository.compose.yml
sh scripts/deploy.sh
```

后续部署、备份、恢复命令均保留此 COMPOSE_FILE 设置。

## 后台操作

超级管理员打开“内容仓库”，填写 SSH 地址 `git@github.com:你的账号/你的仓库.git` 和分支（例如 `main`），保存并启用。

- **推送**：将本地内容保存到仓库，首次使用先推送。
- **自动推送**：按需开启，需要 worker 持续运行。
- **拉取**：先预览新增、更新和删除项，确认后按远端快照替换本地内容与公开设置。会删除预览中列出的本地独有内容，请先备份。

远端有未合并修改时推送会被拒绝；预览后任一端有变化时需重新预览。不会强制覆盖远端。

正文保存在 `yuri-content/articles/`、`essays/`、`chapters/` 等目录，图片在 `assets/`，元信息和关系在 `manifest.json`。可修改对应 Markdown 正文；新增、删除或修改元信息须同步维护 manifest，日常创作建议使用后台。

连接失败时检查 SSH 地址、分支、Deploy Key 写权限，以及密钥和 known_hosts 是否在容器中可读。
