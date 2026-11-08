# 手动更新网站

手动执行命令，从 `https://github.com/amSakayuri/YuriBlog` 的 `main` 分支获取程序更新，并完成构建、备份、迁移和重启。不会定时检查或自行更新，无需服务器原目录已有 Git 历史。

文章、小说、账户和设置继续使用原 PostgreSQL 数据卷，图片使用原 uploads 卷。服务器 `.env.production` 和密钥不从仓库覆盖。内容仓库同步与程序更新相互独立。

## 首次启用

将 `scripts/update.sh`、`scripts/manage.sh`、`scripts/compose.sh` 上传到原服务器相同位置。服务器需要 git、jq、Docker Compose v2 和 util-linux：

```sh
sudo apt-get update
sudo apt-get install -y git jq util-linux
cd /opt/yuri-blog

# 只查看可用版本，不部署
sh scripts/update.sh --check

# 下载并更新，默认沿用宝塔/Nginx
sh scripts/update.sh
```

公开源码仓库通过 HTTPS 拉取，无需新增 GitHub Token 或上传私钥。

使用 Caddy 时加 `--caddy`；启用了内容仓库的只读密钥挂载时加 `--with-content`，并确保 `.env.production` 中宿主密钥路径为绝对路径。两个选项可组合，每次执行保持相同选项。

## 移除以前的定时服务

如果服务器曾启用定时更新，上传 `scripts/disable-auto-update.sh` 后执行一次：

```sh
cd /opt/yuri-blog
sudo sh scripts/disable-auto-update.sh
```

脚本关闭定时器并删除已安装的服务文件。如果更新正在执行，会提示等待完成后再移除，避免中断数据库迁移。仅删除仓库文件不会停用服务器服务。如果曾在宝塔计划任务或 cron 中另外设置更新命令，也需手动删除对应任务。

## 更新后的管理

源码版本保存在 `.updates/releases/`，当前版本记录在 `.updates/revision`。原目录不被覆盖。之后用以下入口管理当前版本：

```sh
cd /opt/yuri-blog
sh scripts/manage.sh ps
sh scripts/manage.sh logs --tail=100 web worker migrate
sh scripts/manage.sh restart web worker
```

`backup-db.sh`、`restore-db.sh` 和 `deploy.sh` 会跟随当前成功版本。不要在原目录直接使用旧 `docker compose` 配置重建服务；使用 `manage.sh`，以免重新部署旧程序。

## 失败处理

- 下载、构建或检查失败：不替换当前版本，原运行容器保持原状。
- 数据卷不一致、数据库镜像变化、历史迁移被修改：停止更新，需人工处理。
- 新迁移含 DROP、TRUNCATE 或 DELETE：本次更新停止，先检查迁移；此检查不能代替维护者对所有迁移的审查。
- 迁移或启动失败：不标记更新成功；服务可能保持停止，先检查日志和 `backups/`，按[备份恢复](BACKUP_RESTORE.md)处理。不能只切换旧源码就认为数据库也已回退。

更新会短暂停止写入，不是零停机。脚本不删除历史版本、备份或数据卷，请定期检查磁盘空间，并将备份复制到异地。更新期间不要同时运行其他部署或手动写入数据库。
