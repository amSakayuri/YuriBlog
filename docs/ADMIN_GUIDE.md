# 后台使用

## 登录与账户

打开 `https://blog.amsakayuri.cn/admin/login`，使用用户名和密码登录。

没有管理员时，点击“添加管理员”，填写显示名称、用户名和至少 12 位密码。用户名为 3–40 位字母、数字、下划线或短横线，保存时统一小写。已有管理员（包括停用账户）时不再开放首次创建。

超级管理员在“用户与权限”中创建、修改或停用账户。权限分为：

| 角色        | 可用功能                                 |
| ----------- | ---------------------------------------- |
| SUPER_ADMIN | 全部功能，包括用户和内容仓库             |
| ADMIN       | 内容、网站设置、导航和审计               |
| EDITOR      | 文章、作品、项目、页面、媒体、标签和分类 |

会话有效 12 小时；退出或账户权限变更后需重新登录。正式网站必须通过 HTTPS 访问。

## 日常管理

- **文章、小说、散文、项目**：新建、编辑、预览和发布，详见[内容创作](CONTENT_GUIDE.md)。
- **媒体库**：上传图片、编辑替代文本、复制 URL 或 Markdown；最多同时上传 10 张，每张不超过 10 MB。删除被引用图片前需先移除引用。
- **关于页面**：直接编辑中文和英文的作者自我介绍、本站技术栈说明，支持 Markdown 与正文预览；状态选“已发布”并保存后显示在前台。个人介绍需自行填写。
- **页面**：编辑隐私、版权及自定义页面；原有 `about` 页面也会出现在独立“关于页面”入口中。
- **导航**：设置菜单文字、链接、顺序和显示状态。
- **网站设置**：修改网站名称、作者资料、域名、首页模块、主题、SEO 和 RSS。
- **评论**：配置入口在后台，回复与删除在 GitHub Discussions 完成，见[评论设置](GISCUS_SETUP.md)。

删除小说会同时删除卷、章节和章节关系；删除卷会保留章节并移到未分卷。避免多人同时修改同一内容。

## 忘记密码

需要服务器操作权限。先在服务器准备仅容器用户 UID 1000 可读的 UTF-8 密码文件，例如 `/安全目录/admin-password`，内容为至少 12 位新密码，然后执行：

```sh
cd /opt/yuri-blog
export YURI_ENV_FILE=.env.production
docker compose --env-file "$YURI_ENV_FILE" run --rm --no-deps \
  -e ADMIN_USERNAME='your_admin' \
  -e ADMIN_PASSWORD_FILE=/run/admin-password \
  -v /安全目录/admin-password:/run/admin-password:ro \
  worker node --import tsx scripts/create-admin.ts reset
```

将 `your_admin` 换成已有用户名。成功后删除临时密码文件。重置不会重新启用停用账户或改变角色。

旧邮箱账户升级后，用户名为 `user_<用户ID>`，原密码不变。可通过受限数据库连接查询 `SELECT username, name FROM "User";`，登录后修改用户名。
