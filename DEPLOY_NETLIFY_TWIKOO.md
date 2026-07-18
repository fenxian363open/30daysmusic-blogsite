# 部署手册：Netlify 托管 + Twikoo 评论系统

本项目已完成全部代码改造。评论系统（留言区 + 每篇碎碎念文章评论）由 **Twikoo** 接管，
后端云函数与静态站点部署在**同一个 Netlify 站点**，评论数据存放在**免费的 MongoDB Atlas**。
漂流瓶功能仍保持本地 localStorage，不受影响。

> 代码侧结论（已验证）：
> - 服务端函数 `netlify/functions/twikoo.js` 采用官方标准写法 `require('twikoo-netlify').handler`，已本地安装验证 handler 可用（v1.7.14）。
> - 根 `package.json` 依赖 `twikoo-netlify@1.7.14`，Netlify 构建时自动安装。
> - `netlify.toml`：publish=`blog-site`，functions=`netlify/functions`，Node 20。
> - 前端 CDN `twikoo@1.7.14`，与后端版本对齐（无版本不一致告警）。

---

## 需要你手动完成的 5 步（约 15 分钟）

### 第 1 步：创建 MongoDB Atlas 免费数据库，拿到连接串
1. 打开 https://www.mongodb.com/cloud/atlas/register 注册并登录。
2. 创建集群：选 **M0 Free**（免费永久 512MB）。区域建议 **AWS / Oregon (us-west-2)** 或离你近的区。
3. 左侧 **Database Access** → Add New Database User：
   - Authentication 选 Password；用户名自定；密码点 **Autogenerate**（用不含特殊符号的强密码，妥善保存）。
   - Database User Privileges → Add Built-in Role → 选 **Atlas Admin** → Add User。
4. 左侧 **Network Access** → Add IP Address → 填 `0.0.0.0/0`（允许所有 IP，因为 Netlify 出口 IP 不固定）→ Confirm。
5. 左侧 **Database** → 集群上点 **Connect** → **Drivers** → 复制连接串，形如：
   ```
   mongodb+srv://<用户名>:<密码>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   把 `<用户名>:<密码>` 替换为第 3 步的真实用户名和密码。**这串就是下面要用的 MONGODB_URI，务必保密。**

### 第 2 步：在 Netlify 导入本 GitHub 仓库
1. 打开 https://app.netlify.com 用 GitHub 登录。
2. **Add new site → Import an existing project → Deploy with GitHub**。
3. 授权并选择仓库 `fenxian363open/30daysmusic-blogsite`（main 分支）。
4. 构建设置**保持默认即可**（`netlify.toml` 已配置好 publish 与 functions，无需手填）。先不要点最终 Deploy 之前，进入下一步加环境变量。

### 第 3 步：配置环境变量 MONGODB_URI
1. 在导入页面的 **Add environment variables**（或站点建好后 Site settings → Environment variables）。
2. New variable：
   - Key：`MONGODB_URI`
   - Value：第 1 步得到的完整连接串
3. 保存后点 **Deploy site**，等待构建完成。

### 第 4 步：拿函数地址，填回前端并重新部署
1. 部署成功后，你的站点地址形如 `https://<你的站点名>.netlify.app`。
2. 打开浏览器访问函数地址验证后端：
   ```
   https://<你的站点名>.netlify.app/.netlify/functions/twikoo
   ```
   看到 **“Twikoo 云函数运行正常”** 即为成功。
3. 编辑 `blog-site/index.html`，把这一行的占位替换成上面的函数地址：
   ```js
   window.TWIKOO_ENV_ID = 'https://<你的站点名>.netlify.app/.netlify/functions/twikoo';
   ```
   （原占位是 `REPLACE_WITH_NETLIFY_FUNCTION_URL`）
4. 提交并推送这次修改，Netlify 会自动重新部署：
   ```
   git add blog-site/index.html
   git commit -m "Config: set Twikoo envId to Netlify function URL"
   git push
   ```
   > 如果你不方便用 git，也可以把这行改好后告诉我，我来提交。

### 第 5 步：设置 Twikoo 管理员密码
1. 打开你的站点首页，滚动到底部留言区，点评论框右下角的**齿轮图标 ⚙️**。
2. 首次进入会提示**设置管理员密码**，设好后即可登录管理评论（置顶/删除/导出/垃圾拦截等）。

---

## 说明与注意
- **原有 localStorage 留言不会迁移**：Twikoo 是全新的评论库，从零开始。
- **没有“悄悄话/仅博主可见”**：Twikoo 为公开评论系统，不支持原来的私密留言概念。
- **免费额度**：Netlify 免费版函数每月 12.5 万次请求 / 100 小时计算；MongoDB Atlas M0 免费 512MB —— 个人博客完全够用。
- **首次冷启动**：Netlify 函数偶有几秒冷启动延迟，属正常现象。
- **版本对齐**：前端 `twikoo@1.7.14` 与后端 `twikoo-netlify@1.7.14` 已一致，升级时请两端同步改版本号。
