/**
 * EdgeOne Pages 边缘函数 — 留言区 API
 * 路由：
 *   GET  /api/guestbook   → 获取公开留言列表
 *   POST /api/guestbook   → 新增留言（公开/悄悄话）
 * 
 * KV 存储绑定：
 *   GB_PUBLIC_KV  → gb_public_v1: [{name,text,time,senderName,isPrivate}]
 *   GB_PRIVATE_KV → gb_private_v1: [{name,text,time}]（悄悄话）
 * 
 * 邮件通知（可选）：
 *   SMTP_HOST   → SMTP 服务器地址（如 smtp.126.com）
 *   SMTP_PORT   → 端口号（25/465/587）
 *   SMTP_USER   → 发件人邮箱
 *   SMTP_PASS   → 邮箱授权码
 *   NOTIFY_EMAIL → 接收通知的邮箱（同 SMTP_USER 或不同）
 */

// KV 命名空间的变量名：需在 EdgeOne 控制台绑定 KV 命名空间
// 绑定名称必须与此常量一致
const GB_PUBLIC_NS = 'GB_PUBLIC_KV';
const GB_PRIVATE_NS = 'GB_PRIVATE_KV';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return corsResponse({}, request, env);
  }

  // GET /api/guestbook - 获取公开留言列表
  if (request.method === 'GET' && path === '/api/guestbook') {
    let list = [];
    try {
      const raw = await env[GB_PUBLIC_NS].get('gb_public_v1');
      if (raw) list = JSON.parse(raw);
    } catch (e) {
      console.error('load pub msg err', e);
    }
    return corsResponse(list, request, env);
  }

  // POST /api/guestbook - 新增留言
  if (request.method === 'POST' && path === '/api/guestbook') {
    const body = await request.json();
    const { name, text, isPrivate } = body;
    if (!text || !text.trim()) {
      return jsonResponse({ success: false, message: '留言不能为空' }, 400);
    }
    const entry = {
      name: name || '匿名访客',
      text: text.trim(),
      time: Date.now()
    };
    
    if (isPrivate) {
      // 悄悄话：存入私有 KV，不展示给他人
      try {
        let priv = [];
        const raw = await env[GB_PRIVATE_NS].get('gb_private_v1');
        if (raw) priv = JSON.parse(raw);
        priv.push(entry);
        await env[GB_PRIVATE_NS].put('gb_private_v1', JSON.stringify(priv), { ttl: 3600 * 24 * 90 });
      } catch (e) {
        console.error('save private err', e);
        return jsonResponse({ success: false, message: '保存失败' }, 500);
      }
      // 悄悄话也发邮件通知博主
      await sendEmailNotification('匿名访客', text.trim(), env);
      return jsonResponse({ success: true, message: '悄悄话已保存' });
    }
    
    // 公开留言
    try {
      let list = [];
      const raw = await env[GB_PUBLIC_NS].get('gb_public_v1');
      if (raw) list = JSON.parse(raw);
      list.push(entry);
      await env[GB_PUBLIC_NS].put('gb_public_v1', JSON.stringify(list), { ttl: 3600 * 24 * 365 });
    } catch (e) {
      console.error('save pub msg err', e);
      return jsonResponse({ success: false, message: '保存失败' }, 500);
    }
    
    // 公开留言发送邮件通知
    await sendEmailNotification(name || '匿名访客', text.trim(), env);
    return jsonResponse({ success: true, message: '留言已发布' });
  }

  return corsResponse(new Response('Not Found', { status: 404 }), request, env);
}

async function sendEmailNotification(sender, text, env) {
  // 检查是否配置了 SMTP
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.log('SMTP not configured, skipping email notification');
    return;
  }
  
  try {
    const subject = '新留言通知';
    const message = `新留言来自: ${sender}\n\n${text}\n\n时间: ${new Date().toLocaleString('zh-CN')}`;
    
    // EdgeOne 环境使用 Nodemailer-like API（通过 fetch 发送）
    // 注意：实际发送需要 EdgeOne 支持 SMTP 协议或使用第三方服务
    // 此处预留接口，用户可替换为实际发送邮件的代码
    console.log('Would send email to:', env.SMTP_USER, 'Subject:', subject, 'Body:', message);
  } catch (e) {
    console.error('sendEmailNotification err', e);
  }
}

function corsResponse(data, request, env) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  return new Response(JSON.stringify(data), { headers });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
