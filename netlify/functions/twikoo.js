// Twikoo 服务端云函数（Netlify）
// 官方标准实现：直接复用 twikoo-netlify 包导出的 handler。
// 评论数据存储在 MongoDB，连接串通过 Netlify 环境变量 MONGODB_URI 提供
//（仅在 Netlify 控制台设置，切勿写入本仓库）。
exports.handler = require('twikoo-netlify').handler
