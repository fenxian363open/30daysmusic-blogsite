// Twikoo serverless function for Netlify
// 评论数据存储在 MongoDB（连接串通过环境变量 MONGODB_URI 提供）。
// MONGODB_URI 仅在 Netlify 控制台设置，请勿写入本仓库。
const twikoo = require('twikoo')

// twikoo 1.6.x 以命名导出 app 暴露服务端处理函数；兼容默认导出/其他形态。
const app =
  twikoo.app ||
  (twikoo.default && twikoo.default.app) ||
  twikoo.default ||
  twikoo

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const result = await app(body)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: (e && e.message) || String(e) })
    }
  }
}
