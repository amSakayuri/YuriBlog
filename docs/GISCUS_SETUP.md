# 开启评论

评论使用 Giscus，保存于 GitHub Discussions。评论者通过 GitHub 登录；与本站管理员登录、内容同步无关。

## 配置步骤

1. 准备一个自己管理的公开 GitHub 仓库，在 Settings → General 中开启 Discussions。
2. 为该仓库安装 [Giscus App](https://github.com/apps/giscus)。
3. 新建评论分类，建议选 Announcements 类型。
4. 打开 [giscus.app](https://giscus.app/zh-CN)，填写仓库并选择分类。
5. 在本站后台 Giscus 设置中填入生成的信息，保存并启用。

| 后台字段 | Giscus 生成参数 |
| --- | --- |
| GitHub Repository | `owner/repo` |
| Repository ID | `data-repo-id` |
| Discussion Category | `data-category` |
| Category ID | `data-category-id` |

映射方式固定为 pathname。主题选 `auto` 跟随网站；输入框位置和 Reactions 按需设置。不需要填写 GitHub Token 或私钥。

## 各类内容的开关

- 文章：全局 Giscus 启用后显示。
- 散文：同时开启全局散文评论和该散文的评论开关。
- 小说详情：同时开启全局小说评论和该小说的开关。
- 章节：同时开启全局小说评论和该章节的开关，章节默认关闭。

评论在滚动到页面底部附近时加载。未配置时显示“评论暂未开放”。评论回复、删除和审核请通过后台的 GitHub Discussions 入口操作。

## 来源限制与排错

可在评论仓库根目录创建 `giscus.json`：

```json
{
  "origins": ["https://blog.amsakayuri.cn"],
  "defaultCommentOrder": "oldest"
}
```

评论加载失败时，检查仓库是否公开、Giscus App 是否获授权、仓库及分类 ID 是否匹配、当前域名是否在 origins 中。网络较慢时使用页面重试按钮。

发布后尽量保持文章路径不变；修改 slug 或语言前缀可能对应新讨论，旧评论仍保留在 GitHub。
