/**
 * CloudBase 云开发 — 留言 + 漂流瓶 数据库工具
 * 
 * 用法：
 *   1. 在 CloudBase 控制台创建数据库集合 guestbook + drift
 *   2. 修改 envId、apiKey 为你的实际值
 *   3. node cloudbase-db-helper.js
 */

const cloudbase = require('@cloudbase/node-sdk');

// ========== 配置区 ==========
const ENV_ID = 'blog-env-d3gma00zf84737315';
// 在 CloudBase 控制台 → 身份认证 → 获取匿名访问令牌（apiKey）
const ANON_API_KEY = 'YOUR_ANON_API_KEY_HERE';
// ============================

const app = cloudbase.init({
  env: ENV_ID,
  secretId: '',   // 匿名登录不需要
  secretKey: '',
 apiKey: ANON_API_KEY,
});

const db = app.database();

// ========== 测试连通性 ==========
async function testConnection() {
  try {
    const col = db.collection('guestbook');
    const res = await col.limit(1).get();
    console.log('✅ 数据库连通！当前 guestbook 有 ' + res.data.length + ' 条记录');
  } catch (e) {
    console.log('⚠️  guestbook 集合不存在或报错:', e.message);
    console.log('   请先在 CloudBase 控制台创建集合。');
  }
}

// ========== 创建集合 ==========
async function ensureCollections() {
  const collections = ['guestbook', 'drift_bottles'];
  for (const name of collections) {
    try {
      // 尝试插入一条测试数据来创建集合
      await db.collection(name).add({
        _id: '_test_' + Date.now(),
        text: '__TEST_RECORD__',
        time: Date.now()
      });
      await db.collection(name).where({ _id: db.command.eq('_test_' + Date.now()) }).remove();
      console.log('✅ 集合', name, '创建成功');
    } catch (e) {
      console.log('⚠️ 集合', name, '已存在或跳过:', e.message);
    }
  }
}

testConnection();
ensureCollections();
