# 部署到腾讯云 CloudBase 指南

## 已完成
- ✅ 注册 CloudBase 账号，获得 6 个月个人版免费套餐
- ✅ 环境 ID：`blog-env-d3gma00zf84737315`
- ✅ 网站已通过 CloudBase Hosting 部署上线
- ✅ 网站访问地址：https://blog-env-d3gma00zf84737315-1453450169.tcloudbaseapp.com

## 下一步：留言 + 漂流瓶数据持久化

目前网站静态资源已部署成功，但**留言区**和**漂流瓶**仍使用 localStorage（仅保存在用户自己浏览器里）。要让所有访客看到彼此的留言，需要后端数据库。

### 方案 A：CloudBase 云数据库（推荐）

1. **登录 CloudBase 控制台**
   访问 https://console.cloud.tencent.com/tcb/ ，选择环境 `blog-env-d3gma00zf84737315`

2. **创建数据库集合**
   在左侧菜单点击【数据库】→【新建集合】，创建以下两个集合：
   
   | 集合名 | 用途 | 数据格式 |
   |--------|------|----------|
   | `guestbook` | 留言区 | `{ name, text, time, owner }` |
   | `drift_bottles` | 漂流瓶 | `{ day, song, reason, name, time, anon }` |

3. **获取匿名访问令牌**
   点击左侧【身份认证】→【匿名登录】→ 复制你的**匿名访问令牌（apiKey）**

4. **替换前端代码中的数据库调用**
   我已写好完整的集成代码，替换后留言/漂流瓶将存入 CloudBase 数据库，所有用户实时共享。

### 方案 B：CloudBase 云函数 + 云数据库

如果你想实现邮件通知功能，可以额外创建云函数。

## 更新网站

以后修改代码后，运行以下命令即可重新部署：

```bash
cloudbase hosting:deploy ./blog-site / --env-id blog-env-d3gma00zf84737315
```
