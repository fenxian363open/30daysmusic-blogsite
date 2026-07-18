# 部署手册：Cloudflare Pages（静态站） + Vercel（Twikoo 后端）

> ⚠️ 本手册**取代** `DEPLOY_NETLIFY_TWIKOO.md`。原 Netlify 方案因账号 credits 耗尽被弃用。
> 新架构：**静态博客 → Cloudflare Pages（免费、无 credits 限制）**；**Twikoo 评论后端 → Vercel（官方 `twikoo-vercel` 模板，免费额度宽裕）**；**数据 → 已有的 MongoDB Atlas**（已配好，沿用）。
> 前后端分离、各管各的，互不牵扯。

---

## 你已具备的条件
- GitHub 仓库 `fenxian363open/30daysmusic-blogsite`（代码已就位，envId 已填为 `https://30daysmusic.vercel.app`）
- MongoDB Atlas 连接串（已验证可连通）：
  ```
  mongodb+srv://30daysmusic:WqLk7kTiFBCWW291@30daysmusic.4alz1l6.mongodb.net/?appName=30daysmusic
  ```
- 一个 Vercel 账号、一个 Cloudflare 账号（均免费注册）

---

## 第一步：部署 Twikoo 后端到 Vercel（约 3 分钟）

1. 打开一键部署链接（需登录 Vercel）：
   ```
   https://vercel.com/import/project?template=https://github.com/twikoojs/twikoo/tree/main/src/server/vercel-min
   ```
   > 若该链接失效，可手动：Fork `twikoojs/twikoo` → 在 Vercel `Add New → Project` 选择该 fork → Framework 选 `Other` → Build Command 留空 → 部署。
2. 部署完成后，进入该项目 **Settings → Environment Variables**，新增：
   - `MONGODB_URI` = 上面的连接串（整串粘贴，无空格/引号/换行）
3. 保存后回到 **Deployments**，点最新部署的 ⋮ → **Redeploy**（让环境变量生效）。
4. 部署完成后，进入 **Project → Settings → Domains**，复制分配给你的域名，形如：
   ```
   https://twikoo-xxxx.vercel.app
   ```
   **这个完整 URL 就是 Twikoo 的 `envId`**。把它发给我。

> 提示：Vercel 免费版对个人博客额度很宽裕，不会像 Netlify 那样硬性停用。
> 若日后想换后端平台，Render 同样支持（部署 `twikoo-vercel` 同款，设 `MONGODB_URI` 即可）。

---

## 第二步：部署静态站到 Cloudflare Pages（约 3 分钟）

1. 登录 [Cloudflare](https://dash.cloudflare.com) → 左侧 **Workers 和 Pages** → **Create** → **Pages** → **Connect to Git**。
2. 授权 GitHub，选择仓库 `fenxian363open/30daysmusic-blogsite`。
3. 构建设置：
   - **Framework preset**：选 **None**（重要，避免 Cloudflare 误判框架去跑 npm build）
   - **Build command**：**留空**
   - **Build output directory**：填 `blog-site`
4. 点 **Save and Deploy**。几分钟后得到站点地址，形如：
   ```
   https://30daysmusic-blog.pages.dev
   ```
   （可后续在 Pages 项目 Settings → Custom domains 绑自己的域名）

> Cloudflare Pages 免费、无 credits 计量墙，静态托管长期零成本。

---

## 第三步：envId 已填好（无需你操作）

Vercel 域名 `https://30daysmusic.vercel.app` 已写入 `blog-site/index.html` 和单文件 HTML，并已提交推送。Cloudflare Pages 连着仓库，会自动重新部署，你不用碰任何代码。

> 注意：AI 沙箱网络无法访问 `vercel.app`（连接超时），所以后端健康状态请你从**自己的浏览器/网络**验证（见文末「验证」）。

---

## 第四步：验证

1. 打开 `https://30daysmusic-blog.pages.dev`，滚动到留言区，应能看到 Twikoo 评论框。
2. 发一条测试评论 → 刷新后仍在，说明 MongoDB 读写正常 ✅。
3. 点评论框右下角齿轮 ⚙️ → 首次设置**管理员密码** → 进入管理面板可做基础配置。
4. 文章详情页底部评论同理可用。

---

## 故障排查

- **评论框一直转圈 / 报 network error**：检查第三步的 envId 是否已正确填入并重新部署；确认 Vercel 后端域名可访问（浏览器直接打开 `https://xxx.vercel.app` 应返回 Twikoo 提示 JSON）。
- **`{"code":1001,"message":"请更新 Twikoo 云函数至最新版本"}`**：前端 `twikoo@1.7.14` 与 Vercel 后端版本不一致。Vercel 后端用 `twikoo-vercel`（`twikoo-func@1.7.14`），正常一致；若仍报，去 Vercel 对该项目 **Redeploy** 一次即可。
- **`bad auth` / MongoDB 连接失败**：同 Netlify 时期的排查——检查 `MONGODB_URI` 格式、Atlas *Database Access* 账号密码、*Network Access* 已加 `0.0.0.0/0`。
- **Cloudflare Pages 部署报 “No build command” 或框架误判**：确认 Framework preset 设为 **None**、Build command 留空、Output directory = `blog-site`。

---

## 文件改动说明（本次迁移）
- 删除 `netlify.toml` 与 `netlify/` 目录（不再需要）
- 根 `package.json` 改为静态站描述（去掉 `twikoo-netlify` 依赖）
- `blog-site/index.html` 与单文件 HTML 的 `window.TWIKOO_ENV_ID` 改为 Vercel 占位符
- 前端 Twikoo CDN 仍为 `twikoo@1.7.14`，与后端版本对齐，无需降级
