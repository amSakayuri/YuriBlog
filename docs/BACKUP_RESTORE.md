# 备份恢复

## 备份

在服务器执行：

```sh
cd /opt/yuri-blog
export YURI_ENV_FILE=.env.production
sh scripts/backup-db.sh
```

脚本短暂停止 web/worker，备份数据库和图片，结束后恢复原本运行的服务。备份位于 `backups/时间戳-进程号/`，包含：

- `database.dump`：数据库。
- `uploads.tar.gz`：图片。
- `SHA256SUMS`、`RECEIPT`：完整性信息。

将整个目录复制到服务器以外的受限存储。建议每天备份，旧备份不会自动删除。环境文件、Deploy Key、代理配置和证书需另行安全保管；评论存放在 GitHub Discussions。

## 恢复

恢复会覆盖当前数据库，请先另做一次备份。使用与备份兼容的应用版本和 PostgreSQL 版本；生产默认为 PostgreSQL 17。

```sh
cd /opt/yuri-blog
export YURI_ENV_FILE=.env.production
docker compose --env-file "$YURI_ENV_FILE" up -d --wait postgres

sh scripts/backup-db.sh
sh scripts/restore-db.sh /安全备份目录/时间戳-进程号 --confirm

# 恢复完成后升级结构，再启动
docker compose --env-file "$YURI_ENV_FILE" run --rm --no-deps migrate
docker compose --env-file "$YURI_ENV_FILE" up -d --wait web worker
```

恢复后旧登录会话失效，需重新登录。恢复失败时不要启动网站，先处理日志中的问题；数据库和图片可能只完成了部分恢复。恢复不会自动删除额外的未引用图片。

启用内容仓库挂载时，先设置：

```sh
export COMPOSE_FILE=docker-compose.yml:deploy/repository.compose.yml
```

内容仓库不包含账户等数据，不能代替完整备份。恢复旧备份后先检查远端内容差异，再启用自动推送。
