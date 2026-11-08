# 部署与更新

## 首次部署

服务器需要 Docker Engine、Compose v2 和 util-linux（提供 flock）。上传完整外层项目到 `/opt/yuri-blog`，不要上传本机 `.env`、`.local`、`node_modules` 或 `.next`。

将 `blog.amsakayuri.cn` 的 DNS 指向服务器公网 IP，放行 TCP 80/443。

```sh
cd /opt/yuri-blog
sh scripts/deploy.sh --init --domain blog.amsakayuri.cn
```

首次运行生成 `.env.production`、构建镜像、初始化数据库并启动网站。已有配置不会被覆盖；已有数据库却丢失配置时，先找回原文件，不能重新生成密码。

默认不启动 Caddy，适用于宝塔/Nginx。在宝塔添加绑定 `blog.amsakayuri.cn` 的站点，设置：

- 反向代理目录：`/`。
- 目标：`http://127.0.0.1:3000`。
- 发送域名：`$host`；关闭代理缓存。
- 为博客子域名申请 SSL 证书，开启强制 HTTPS。

然后访问 `https://blog.amsakayuri.cn/admin/login` 创建首位管理员。

没有其他代理占用 80/443 时，也可由 Caddy 自动管理 HTTPS：

```sh
sh scripts/deploy.sh --init --domain blog.amsakayuri.cn --caddy
```

换域名时同步修改 `.env.production` 的 `APP_ORIGIN=https://你的域名` 和 `SITE_HOST=你的域名`，并重新配置 DNS、代理和证书。

## 更新网站

先上传更新后的源码，保留服务器 `.env.production` 和密钥文件，再执行：

```sh
cd /opt/yuri-blog
sh scripts/deploy.sh
```

脚本先构建，再停止写入、备份已有数据库和图片、执行迁移并启动服务。使用 Caddy 的站点每次加 `--caddy`。

`deploy.sh` 不拉取源码；需要从 GitHub 获取版本并自动重启时使用[自动更新模块](UPDATE.md)。文章、小说和图片保存在持久卷中，不随镜像重建删除。不要执行 `docker compose down -v`。

## 日常命令

每次重新登录服务器，先执行：

已启用自动更新的站点，以下 `docker compose --env-file "$YURI_ENV_FILE"` 命令请改用 `sh scripts/manage.sh`，以管理当前成功版本。

```sh
cd /opt/yuri-blog
export YURI_ENV_FILE=.env.production
```

```sh
# 查看状态和日志
docker compose --env-file "$YURI_ENV_FILE" ps
docker compose --env-file "$YURI_ENV_FILE" logs --tail=100 web worker migrate

# 重启服务
docker compose --env-file "$YURI_ENV_FILE" restart web worker

# 修改环境变量后重新创建服务
docker compose --env-file "$YURI_ENV_FILE" up -d --force-recreate web worker
```

更新失败时查看脚本报告的阶段。迁移阶段失败后服务可能保持停止，先查日志并处理，勿盲目恢复旧镜像。备份和恢复见[备份恢复](BACKUP_RESTORE.md)。

## 常见问题

| 现象             | 处理                                                             |
| ---------------- | ---------------------------------------------------------------- |
| 80/443 已占用    | 宝塔用户使用默认模式，不加 `--caddy`                             |
| Nginx 404        | 确认站点绑定博客子域名，代理目录为 `/`                           |
| Nginx 502        | 检查 web 容器状态和迁移日志                                      |
| 请求来源不匹配   | 访问 HTTPS；容器 APP_ORIGIN 必须与浏览器来源完全一致，无末尾斜杠 |
| 登录后返回登录页 | 确认使用有效 HTTPS 证书，生产登录 Cookie 需要 HTTPS              |
| 上传提示 413     | 在代理中适当调大请求体限制，批量上传建议 110 MB                  |

容器检查：`curl -fsS http://127.0.0.1:3000/api/health`，正常返回 `{"ok":true}`。

查看实际来源配置：

```sh
docker compose --env-file "$YURI_ENV_FILE" exec web printenv APP_ORIGIN
```

启用[内容仓库](REPOSITORY_SYNC.md)挂载时，部署、备份和恢复前都需设置对应 `COMPOSE_FILE`。
