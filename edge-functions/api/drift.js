/**
 * EdgeOne Pages 边缘函数 — 漂流瓶 API
 * 路由：GET  /api/drift -> 获取漂流瓶列表
 *       POST /api/drift -> 新增漂流瓶
 *       DELETE /api/drift/{timestamp} -> 删除自己的漂流瓶
 */

const DRIFT_NS = 'DRIFT_KV';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return corsResponse({}, request, env);
  }

  // GET /api/drift - 获取所有漂流瓶
  if (request.method === 'GET' && path === '/api/drift') {
    let list = [];
    try {
      const raw = await env[DRIFT_NS].get('drift_bottles_v1');
      if (raw) list = JSON.parse(raw);
    } catch (e) {
      console.error('load drift err', e);
    }
    return corsResponse(list, request, env);
  }

  // POST /api/drift - 新增漂流瓶
  if (request.method === 'POST' && path === '/api/drift') {
    const body = await request.json();
    const { day, song, reason, name, anon, senderName } = body;
    if (!song || !song.trim()) {
      return jsonResponse({ success: false, message: '歌名不能为空' }, 400);
    }
    const entry = {
      day: parseInt(day, 10) || 0,
      song: song.trim(),
      reason: reason || '',
      name: senderName || '匿名访客',
      anon: !!anon,
      time: Date.now()
    };
    try {
      let list = [];
      const raw = await env[DRIFT_NS].get('drift_bottles_v1');
      if (raw) list = JSON.parse(raw);
      list.push(entry);
      await env[DRIFT_NS].put('drift_bottles_v1', JSON.stringify(list), { ttl: 3600 * 24 * 365 });
    } catch (e) {
      console.error('save drift err', e);
      return jsonResponse({ success: false, message: '保存失败' }, 500);
    }
    return jsonResponse({ success: true, message: '漂流瓶已投出' });
  }

  // DELETE /api/drift/{timestamp} - 删除漂流瓶
  if (request.method === 'DELETE' && path.startsWith('/api/drift/')) {
    const tsStr = path.split('/').pop();
    const ts = parseInt(tsStr, 10);
    if (isNaN(ts)) {
      return jsonResponse({ success: false, message: '无效的瓶子ID' }, 400);
    }
    try {
      let list = [];
      const raw = await env[DRIFT_NS].get('drift_bottles_v1');
      if (raw) list = JSON.parse(raw);
      list = list.filter(x => x.time !== ts);
      await env[DRIFT_NS].put('drift_bottles_v1', JSON.stringify(list));
    } catch (e) {
      console.error('delete drift err', e);
      return jsonResponse({ success: false, message: '删除失败' }, 500);
    }
    return jsonResponse({ success: true });
  }

  return jsonResponse({ success: false, message: 'Not Found' }, 404);
}

function corsResponse(data, request, env) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
