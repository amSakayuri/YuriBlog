# 自动更新网站

从 `https://github.com/amSakayuri/YuriBlog` 的 `main` 分支获取程序更新，自动构建、备份、迁移并重启服务。无需服务器原目录已有 Git 历史。

文章、小说、账户和设置继续使用原 PostgreSQL 数据卷，图片使用原 uploads 卷。服务器 `.env.production` 和密钥不从仓库覆盖。内容仓库同步与程序更新相互独立。

## 首次启用

将本次更新中的 `scripts/update.sh`、`scripts/manage.sh`、`scripts/compose.sh` 以及两个 `deploy/yuri-blog-update.*` 文件上传到原服务器相同位置。服务器需要 git、jq、Docker Compose v2 和 util-linux：

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

## 定时更新

默认每小时检查一次，有新版本才部署。先手动完成一次更新，再启用：

```sh
sudo cp deploy/yuri-blog-update.service /etc/systemd/system/
sudo cp deploy/yuri-blog-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now yuri-blog-update.timer
```

默认安装路径为 `/opt/yuri-blog`。若路径不同，修改 service 中的 WorkingDirectory 和 ExecStart。使用 Caddy 或内容挂载时，在 ExecStart 末尾追加对应选项，例如 `--with-content`。

```sh
# 查看更新日志
sudo journalctl -u yuri-blog-update.service -n 100 --no-pager

# 停止自动更新
sudo systemctl disable --now yuri-blog-update.timer
```

定时服务会运行仓库代码，仅向可信维护者开放源码仓库写权限。

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
- 新迁移含 DROP、TRUNCATE 或 DELETE：自动更新停止，先检查迁移；此检查不能代替维护者对所有迁移的审查。
- 迁移或启动失败：不标记更新成功；服务可能保持停止，先检查日志和 `backups/`，按[备份恢复](BACKUP_RESTORE.md)处理。不能只切换旧源码就认为数据库也已回退。

更新会短暂停止写入，不是零停机。脚本不删除历史版本、备份或数据卷，请定期检查磁盘空间，并将备份复制到异地。更新期间不要同时运行其他部署或手动写入数据库。
