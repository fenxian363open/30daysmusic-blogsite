# 部署手册：Cloudflare Pages（静态站）+ 腾讯云 CloudBase（Twikoo 评论后端）

> 适用：博客 `fenxian363open/30daysmusic-blogsite`
> 当前前端已配置：Twikoo 1.7.14（国内 CDN 镜像 npmmirror）、`envId = blog-env-d3gma00zf84737315`、地域默认 `ap-shanghai`

## 架构

| 部分 | 托管方 | 说明 |
|---|---|---|
| 静态博客 | **Cloudflare Pages**（免费，无 credits 限制） | 发布 `blog-site/` 目录，已由仓库根 `wrangler.jsonc` 指定 |
| 评论后端 | **腾讯云 CloudBase（云开发）** | 云函数 `twikoo`，数据存 CloudBase 自带数据库（**不再需要 MongoDB Atlas**） |

为何不用 Vercel/Netlify：Vercel 默认域名 `*.vercel.app` 在中国大陆访问极慢/超时；Netlify 新 credits 机制对个人项目不友好。CloudBase 是 Twikoo 原生后端，大陆速度快、不被墙。

---

## 一、腾讯云 CloudBase 控制台配置（必须，约 10 分钟）

代码已就绪，但以下控制台操作需要你来做（我无法登录你的腾讯云）：

1. **确认环境**
   - 环境 ID：`blog-env-d3gma00zf84737315` 已填进前端。
   - 地域：上海 = `ap-shanghai`（前端默认值，无需改动）；若你的环境在广州，需把 `blog-site/index.html` 与单文件 HTML 里的 `window.TWIKOO_REGION` 改为 `'ap-guangzhou'`（改完告诉我，我帮你提交重部署）。

2. **启用匿名登录**
   - 云开发控制台 → 环境 → **登录授权** → 开启「**匿名登录**」。

3. **添加 WEB 安全域名**（否则评论框会报「安全域名不允许」）
   - 环境 → **安全配置** → WEB 安全域名 → 添加你的站点域名，例如 `https://xxx.pages.dev`（以及以后绑定的自定义域名）。

4. **创建 Twikoo 云函数**
   - 环境 → **云函数** → 新建
   - 函数名称：`twikoo`（必须叫这个）
   - 创建方式：**空白函数**
   - 运行环境：**Nodejs 16.13**
   - 函数内存：**128MB**
   - 清空示例代码，填入：
     ```js
     exports.main = require('twikoo-func').main
     ```
   - 进入函数详情 → 函数代码 → 文件 → 新建文件 `package.json`，内容：
     ```json
     { "dependencies": { "twikoo-func": "1.7.14" } }
     ```
   - 点击「**保存并安装依赖**」。

> 不推荐「一键部署」按钮：它只支持按量计费环境，免费额度用尽后会产生费用，且无法切包年包月。手动部署更可控。

---

## 二、Cloudflare Pages 静态站（代码已就位）

- 仓库 `fenxian363open/30daysmusic-blogsite` 已连接 Cloudflare Pages，构建输出目录为 `blog-site`（仓库根 `wrangler.jsonc` 已指定，避免把整个仓库当资源上传）。
- 本次代码推送会触发 Cloudflare **自动重新部署**，无需你手动点。
- 若需手动触发：Pages 项目 → **Deployments** → 最新构建应变绿 ✅。
- 部署如遇 `Asset too large`：确认仓库根有 `wrangler.jsonc` 且 `assets.directory` 为 `blog-site`（不是 `.`）。

---

## 三、开启管理员面板（评论管理 / 删评 / 置顶）

CloudBase 环境需先配置登录私钥：

1. 云开发控制台 → 环境 → **登录授权** → 点「自定义登录」右边的 **「私钥下载」**，下载私钥文件。
2. 用文本编辑器打开私钥文件，**复制全部内容**。
3. 打开你的网站留言区，点评论框右下角 **齿轮 ⚙️** → 粘贴私钥内容 → 设置**管理员密码**。
4. 配置好后无需留存私钥文件；**不要再次下载登录私钥**，否则之前配置的私钥会失效。

---

## 四、验证（在你自己的机器 / 浏览器做，沙箱连不上 CloudBase）

1. 浏览器打开 `https://xxx.pages.dev` → 进「留言区」：
   - 能加载评论框、能发评论 → 🎉 **全链路打通**
   - 一直转圈 / 报错 → 按下方排查
2. 进任意文章详情页，确认文章评论区也能加载。

---

## 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 评论框提示「请在腾讯云云开发控制台开启匿名登录」 | 匿名登录未开 | 控制台 → 登录授权 → 开启匿名登录 |
| 「安全域名不允许」 | 没加 WEB 安全域名 | 安全配置 → 添加你的 `pages.dev` 域名 |
| 评论框转圈 / 加载失败 | 云函数 `twikoo` 未部署成功，或 `package.json` 依赖未安装 | 回 CloudBase 确认函数状态、依赖安装完成 |
| 广州环境评论不显示 | 前端地域不匹配 | `index.html` 与单文件里 `TWIKOO_REGION` 改为 `'ap-guangzhou'`，重部署 |
| 想删评论 / 设管理员 | 未配置登录私钥 | 见「三、开启管理员面板」 |

---

## 备注

- 之前配置的 **MongoDB Atlas 不再需要**（评论数据现存在 CloudBase 自带数据库）。
- 单文件版本 `30天推歌挑战-手机版.html` 与 `blog-site/` 已同步同样的 envId / region / CDN 配置。
- 升级 Twikoo 时：前端 CDN 版本号（1.7.14）与 CloudBase 云函数 `package.json` 里的 `twikoo-func` 版本需**保持一致**。
