/* ===================== 博客应用主模块 ===================== */
const BlogApp = (() => {
  let currentPage = 'home';
  let lastViewedArticleId = null; // 记住最近查看的碎碎念文章，供返回目录时定位

  // 导航状态
  function setActiveNav(id) {
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.page === id);
    });
  }

  // 显示页面
  // opts.anchorId：返回碎碎念目录时，定位到指定文章卡片（置于视口中上方）
  function showPage(id, opts) {
    opts = opts || {};
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === id);
    });
    currentPage = id;
    setActiveNav(id);

    // 返回碎碎念目录且带 anchorId：定位到对应文章（中上方）；否则回顶
    if (id === 'articles' && opts.anchorId != null) {
      scrollToArticle(opts.anchorId);
    } else {
      window.scrollTo(0, 0);
    }

    // 触发页面特定逻辑
    if (id === 'home') {
      // 翻牌棋盘已自动初始化
    }
  }

  // 将碎碎念目录滚动定位到指定文章卡片，使其处于视口中上方
  function scrollToArticle(id) {
    // 等一帧，确保被显示的 section 已完成布局，getBoundingClientRect 才准确
    requestAnimationFrame(() => {
      const el = document.querySelector('.article-card[data-article-id="' + id + '"]');
      if (!el) { window.scrollTo(0, 0); return; }
      const rect = el.getBoundingClientRect();
      const targetTop = rect.top + window.scrollY - Math.round(window.innerHeight * 0.25);
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    });
  }

  // 渲染文章列表
  function renderArticles() {
    const container = document.getElementById('articlesGrid');
    if (!container) return;

    const articles = BLOG_DATA.articles;
    if (articles.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">暂无相关文章</p>';
      return;
    }

    container.innerHTML = articles.map(article => `
        <article class="article-card${article.placeholder ? ' placeholder' : ''}" data-article-id="${article.id}" tabindex="0" role="button" onclick="BlogApp.navigateToArticle(${article.id})">
          <div class="article-card-image">${article.emoji}</div>
          <div class="article-card-body">
            <h3 class="article-card-title">${article.title}</h3>
            <p class="article-card-excerpt">${article.excerpt}</p>
            <div class="article-card-meta">
              <span>📅 ${article.date}</span>
              <span>⏱️ ${article.readTime}</span>
              ${article.placeholder ? '<span class="placeholder-badge">✎ 待补充</span>' : ''}
            </div>
          </div>
        </article>
    `).join('');
  }

  // 渲染文章详情
  // fromDay：若本文是从「歌曲简介弹窗」的「查看碎碎念」跳转而来，则为来源天的下标(0-29)，
  // 用于在文末生成「返回歌曲简介」按钮；否则为 undefined/null（不显示该按钮）。
  function renderArticleDetail(articleId, fromDay) {
    const article = BLOG_DATA.articles.find(a => a.id === articleId);
    if (!article) return;

    const titleEl = document.getElementById('articleDetailTitle');
    const contentEl = document.getElementById('articleDetailContent');
    const metaEl = document.getElementById('articleDetailMeta');

    if (titleEl) titleEl.textContent = article.title;
    if (metaEl) {
      metaEl.innerHTML = `
        <span>📅 ${article.date}</span>
        <span>⏱️ ${article.readTime}</span>
        <span>👤 ${BLOG_DATA.blogInfo.author}</span>
      `;
    }
    // autoList：从 SONG_DATA 动态生成歌单总览（永远和棋盘同步）
    if (article.autoList) {
      const lines = ['下面这 30 天，是我这次推歌挑战的完整歌单：\n'];
      if (typeof SONG_DATA !== 'undefined') {
        SONG_DATA.forEach((d, i) => {
          lines.push('- **DAY ' + (i + 1) + '** ' + d.singer + '《' + d.song + '》');
        });
      }
      article.content = lines.join('\n');
    }
    if (contentEl) {
      let html = Markdown.render(article.content);
      if (article.placeholder) {
        html = '<div class="placeholder-note">✎ 这是预留给你的草稿模块。在 <code>blog-site/js/blog-data.js</code> 的 <code>articles</code> 数组里找到这一条，把 <code>content</code> 换成你自己的文字即可（支持 Markdown）。</div>' + html;
      }
      contentEl.innerHTML = html;
      // 结构化外链：渲染成美化的平台跳转按钮（<a> 可被方向键选中、回车/点击打开）
      if (Array.isArray(article.links) && article.links.length) {
        const wrap = document.createElement('div');
        wrap.className = 'article-links';
        const head = document.createElement('div');
        head.className = 'article-links-title';
        head.textContent = '相关视频';
        wrap.appendChild(head);
        article.links.forEach((lk) => {
          const a = document.createElement('a');
          a.className = 'article-link-btn article-link-' + (lk.platform === 'douyin' ? 'douyin' : 'bilibili');
          a.href = lk.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.setAttribute('tabindex', '0');
          const badge = document.createElement('span');
          badge.className = 'article-link-badge';
          badge.textContent = lk.platform === 'douyin' ? '抖音' : 'B站';
          const label = document.createElement('span');
          label.className = 'article-link-label';
          label.textContent = lk.label || lk.url;
          const arrow = document.createElement('span');
          arrow.className = 'article-link-arrow';
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = '↗';
          a.appendChild(badge);
          a.appendChild(label);
          a.appendChild(arrow);
          wrap.appendChild(a);
        });
        contentEl.appendChild(wrap);
      }
      // 若由歌曲简介跳转而来：文末追加「返回歌曲简介」按钮，点击重新打开该天弹窗
      if (typeof fromDay === 'number' && fromDay >= 0) {
        const back = document.createElement('div');
        back.className = 'article-back-to-song';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'back-to-song-btn';
        btn.innerHTML = '<span aria-hidden="true">←</span> 返回歌曲简介';
        btn.addEventListener('click', () => {
          if (typeof FlipBoard !== 'undefined' && FlipBoard.openModal) {
            showPage('home');
            history.pushState({ page: 'home' }, '', '#home');
            FlipBoard.openModal(fromDay);
          }
        });
        back.appendChild(btn);
        contentEl.appendChild(back);
      }
    }
    // 碎碎念评论区：在正文之后渲染（表单 + 列表，按文章 id 持久化）
    const commentsEl = document.getElementById('articleComments');
    if (commentsEl) renderComments(article.id, commentsEl);
  }

  // ===================== 碎碎念评论区 =====================
  // 仿留言区：列表展示 + 评论表单。表单交互仿漂流瓶署名弹窗的纵向展开——
  // 内容输入框右侧有「匿名提交」「署名提交」；点署名提交才在下方展开昵称输入框 + 确认/取消。
  function renderComments(articleId, container) {
    if (!container) return;
    const list = loadComments(articleId).slice().sort((a, b) => a.time - b.time);
    const count = list.length;
    let html = '<div class="article-comments-head">💬 评论（' + count + '）</div>';
    if (count === 0) {
      html += '<div class="article-comments-empty">还没有评论，来抢沙发吧～</div>';
    } else {
      html += '<div class="article-comment-list">';
      list.forEach(c => {
        const name = c.anon ? '匿名访客' : (c.name || '匿名访客');
        const avatar = (name && name !== '匿名访客') ? escapeHtml(name.slice(0, 1)) : '👤';
        html += '<div class="gb-item article-comment-item">' +
          '<div class="gb-item-head">' +
            '<span class="gb-avatar">' + avatar + '</span>' +
            '<span class="gb-item-name">' + escapeHtml(name) + '</span>' +
            '<span class="gb-item-time">' + fmtTime(c.time) + '</span>' +
          '</div>' +
          '<div class="gb-item-text">' + escapeHtml(c.text) + '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    // 评论表单
    html += '<div class="article-comment-form">' +
      '<div class="article-comment-row">' +
        '<textarea class="gb-textarea article-comment-input" id="artCommentInput" rows="2" maxlength="500" placeholder="写下你的评论…（最多 500 字）"></textarea>' +
        '<div class="article-comment-submits">' +
          '<button type="button" class="btn btn-drift art-anon-btn" id="artAnonBtn">匿名提交</button>' +
          '<button type="button" class="btn btn-primary art-name-btn" id="artNameBtn">署名提交</button>' +
        '</div>' +
      '</div>' +
      '<div class="article-comment-name-row" id="artNameRow" hidden>' +
        '<input class="gb-input article-comment-name" id="artNameInput" type="text" maxlength="24" placeholder="填写昵称" />' +
        '<div class="article-comment-name-submits">' +
          '<button type="button" class="btn btn-primary art-confirm-btn" id="artConfirmBtn">确认提交</button>' +
          '<button type="button" class="btn art-cancel-btn" id="artCancelBtn">取消</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    container.innerHTML = html;

    const input = container.querySelector('#artCommentInput');
    const anonBtn = container.querySelector('#artAnonBtn');
    const nameBtn = container.querySelector('#artNameBtn');
    const nameRow = container.querySelector('#artNameRow');
    const nameInput = container.querySelector('#artNameInput');
    const confirmBtn = container.querySelector('#artConfirmBtn');
    const cancelBtn = container.querySelector('#artCancelBtn');

    function submitComment(name, anon) {
      const text = (input && input.value || '').trim();
      if (!text) { if (input) input.focus(); return false; }
      addComment(articleId, { name: name, text: text, time: Date.now(), anon: anon });
      renderComments(articleId, container); // 重渲（含新列表 + 重置表单）
      return true;
    }

    if (anonBtn) anonBtn.addEventListener('click', () => { submitComment('匿名访客', true); });
    if (nameBtn) nameBtn.addEventListener('click', () => {
      if (nameRow) nameRow.hidden = false;
      if (nameInput) setTimeout(() => nameInput.focus(), 0);
    });
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      const nm = (nameInput && nameInput.value || '').trim();
      const ok = submitComment(nm || '匿名访客', false);
      if (ok && nameRow) { nameRow.hidden = true; if (nameInput) nameInput.value = ''; }
    });
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      if (nameRow) nameRow.hidden = true;
      if (nameInput) nameInput.value = '';
    });
    // 昵称输入框 Enter → 确认提交
    if (nameInput) nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (confirmBtn) confirmBtn.click(); }
    });
    // 评论内容框 Ctrl/Cmd+Enter → 匿名提交
    if (input) {
      input.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (anonBtn) anonBtn.click(); }
      });
      autoGrowTextarea(input);
    }
  }

  // ===================== 留言区 =====================
  // 说明：当前用 localStorage 存储，留言仅保存在访客自己的浏览器里（适合本地/演示）。
  // 待网站上线后，把 loadMessages / saveMessage / savePrivate 三处换成后端接口
  // （如 Waline / Twikoo / 自建 API）即可实现真正的多人共享留言与「悄悄话」收件箱。
  const GB_PUBLIC_KEY = 'gb_public_v1';
  const GB_PRIVATE_KEY = 'gb_private_v1';
  // 碎碎念评论：按文章 id 存 { [articleId]: [ {name, text, time, anon} ] }
  const ART_COMMENTS_KEY = 'article_comments_v1';

  // 留言点赞：直接翻该留言的 liked，likes±1，按 time 定位写回
  function toggleMsgLike(ts) {
    let list = loadPublicMessages();
    const m = list.find(x => x.time === ts);
    if (!m) return null;
    if (m.liked) { m.liked = false; m.likes = Math.max(0, (m.likes || 0) - 1); }
    else { m.liked = true; m.likes = (m.likes || 0) + 1; }
    try { localStorage.setItem(GB_PUBLIC_KEY, JSON.stringify(list)); } catch (e) {}
    return { likes: m.likes, liked: m.liked };
  }

  function loadComments(articleId) {
    let map = {};
    try { map = JSON.parse(localStorage.getItem(ART_COMMENTS_KEY) || '{}'); } catch (e) { map = {}; }
    const arr = map[articleId];
    return Array.isArray(arr) ? arr : [];
  }
  function addComment(articleId, entry) {
    let map = {};
    try { map = JSON.parse(localStorage.getItem(ART_COMMENTS_KEY) || '{}'); } catch (e) { map = {}; }
    if (!Array.isArray(map[articleId])) map[articleId] = [];
    map[articleId].push(entry);
    try { localStorage.setItem(ART_COMMENTS_KEY, JSON.stringify(map)); } catch (e) {}
  }


  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // 读取公开留言（若为空，注入一条测试评论用于展示）
  function loadPublicMessages() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(GB_PUBLIC_KEY) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list) || list.length === 0) {
      list = [{
        name: '博主',
        text: '这是一条测试留言 ~ 欢迎大家看完这 30 天后在这里留句话！可以署名、匿名，也可以发只有我能看到的悄悄话。💛',
        time: Date.now(),
        owner: true
      }];
      try { localStorage.setItem(GB_PUBLIC_KEY, JSON.stringify(list)); } catch (e) {}
    }
    return list.map(m => Object.assign({ likes: 0, liked: false }, m));
  }

  function renderGuestbook() {
    const listEl = document.getElementById('gbList');
    const countEl = document.getElementById('gbCount');
    if (!listEl) return;
    const list = loadPublicMessages().slice().sort((a, b) => b.time - a.time);
    if (countEl) countEl.textContent = list.length + ' 条留言';
    listEl.innerHTML = list.map(m => `
      <div class="gb-item${m.owner ? ' gb-item-owner' : ''}" tabindex="0" data-ts="${m.time}">
        <div class="gb-item-head">
          <span class="gb-avatar">${m.owner ? '🎵' : (m.name && m.name !== '匿名访客' ? escapeHtml(m.name.slice(0, 1)) : '👤')}</span>
          <span class="gb-item-name">${escapeHtml(m.name || '匿名访客')}${m.owner ? '<span class="gb-owner-badge">博主</span>' : ''}</span>
          <span class="gb-item-time">${fmtTime(m.time)}</span>
        </div>
        <div class="gb-item-text">${escapeHtml(m.text)}</div>
        <button type="button" class="gb-like${m.liked ? ' liked' : ''}" data-ts="${m.time}" title="点赞">
          <span class="like-heart" aria-hidden="true">❤</span><span class="gb-like-count">${m.likes || 0}</span>
        </button>
      </div>
    `).join('');
  }

  function showGbTip(msg, kind) {
    const tip = document.getElementById('gbTip');
    if (!tip) return;
    tip.textContent = msg;
    tip.className = 'gb-tip' + (kind ? ' ' + kind : '');
    tip.hidden = false;
    clearTimeout(showGbTip._t);
    showGbTip._t = setTimeout(() => { tip.hidden = true; }, 3600);
  }

  // 留言框自动撑高：输入框下限随内容向下推进，第一行始终在框内；
  // 高度不超过视口上限，超出后内部滚到最底，保证最后一行始终在画面内。
  function autoGrowTextarea(el) {
    if (!el) return;
    // 隐藏时 offsetParent 为 null，scrollHeight 不可靠，跳过（显示时再测）
    if (el.offsetParent === null) return;
    el.style.height = 'auto';
    const cs = getComputedStyle(el);
    const maxH = parseFloat(cs.maxHeight) || Infinity;
    const target = Math.min(el.scrollHeight, maxH);
    el.style.height = target + 'px';
    // 内容超过上限时，内部滚到最底，让最后一行可见（框本身在画面内）
    if (el.scrollHeight > maxH) {
      el.scrollTop = el.scrollHeight;
    }
  }

  function handleGuestbookSubmit(e) {
    e.preventDefault();
    const msgEl = document.getElementById('gbMessage');
    const nameEl = document.getElementById('gbName');
    const anonEl = document.getElementById('gbAnon');
    const privEl = document.getElementById('gbPrivate');
    const text = (msgEl && msgEl.value || '').trim();
    if (!text) { showGbTip('留言不能为空哦～', 'warn'); return; }

    const anon = anonEl && anonEl.checked;
    const name = anon ? '匿名访客' : ((nameEl && nameEl.value || '').trim() || '匿名访客');
    const isPrivate = privEl && privEl.checked;
    const entry = { name, text, time: Date.now() };

    if (isPrivate) {
      // 悄悄话：仅博主可见，不进入公开列表
      let priv = [];
      try { priv = JSON.parse(localStorage.getItem(GB_PRIVATE_KEY) || '[]'); } catch (err) { priv = []; }
      priv.push(entry);
      try { localStorage.setItem(GB_PRIVATE_KEY, JSON.stringify(priv)); } catch (err) {}
      showGbTip('🔒 悄悄话已发送，仅博主可见，不会公开展示', 'ok');
    } else {
      let pub = loadPublicMessages();
      pub.push(entry);
      try { localStorage.setItem(GB_PUBLIC_KEY, JSON.stringify(pub)); } catch (err) {}
      showGbTip('留言已发布，感谢你的分享！💛', 'ok');
      renderGuestbook();
    }

    // 重置表单
    if (msgEl) { msgEl.value = ''; autoGrowTextarea(msgEl); }
    if (nameEl) nameEl.value = '';
    if (anonEl) anonEl.checked = false;
    if (privEl) privEl.checked = false;
  }

  // ===================== 漂流瓶（玩法弹窗） =====================
  // 与留言区一致，用 localStorage 存储（仅保存在访客自己的浏览器里，适合演示）。
  // 为让游客一来就能看到「其他人留下的推荐」，内置一批预置示例瓶（DRIFT_SEED）；
  // 上线后若要真实跨用户共享，把 load/save 换成后端接口即可（同留言区注释）。
  const DRIFT_KEY = 'drift_bottles_v1';
  const DRIFT_LIKE_KEY = 'drift_likes_v1';
  const DRIFT_SEED = [
    { day: 7,  song: '夜空中最亮的星', name: '深夜电台',     reason: '每次走夜路都会想起某个人。', time: 1700000000001 },
    { day: 1,  song: '我的天空',       name: '阿绿',         reason: '高三晚自习循环过一整年。',   time: 1700000000002 },
    { day: 3,  song: '后来',           name: '星期天的猫',   reason: '听到前奏就鼻子酸。',         time: 1700000000003 },
    { day: 4,  song: '从前慢',         name: '时光旅人',     reason: '适合一个人慢慢喝杯茶。',     time: 1700000000004 },
    { day: 5,  song: '至少还有你',     name: '有心人',       reason: '送给总在身边的那个朋友。',   time: 1700000000005 },
    { day: 8,  song: '雨过天晴',       name: '双声道',       reason: '阴天听它会亮一点。',         time: 1700000000006 },
    { day: 14, song: 'K歌之王',        name: 'KTV常客',      reason: '麦霸必点，全场大合唱。',     time: 1700000000007 },
    { day: 16, song: '晴天',           name: '晒被子的午后', reason: '夏天的味道全在这首里。',     time: 1700000000008 },
    { day: 18, song: '孤勇者',         name: '深夜电台',     reason: '低谷时给自己打气。',         time: 1700000000009 },
    { day: 19, song: '生命之诗',       name: '在梦里',       reason: '歌词像在说我自己。',         time: 1700000000010 },
    { day: 21, song: '平凡之路',       name: '旅人甲',       reason: '自驾出门第一首。',           time: 1700000000011 },
    { day: 25, song: '小幸运',         name: '校服口袋',     reason: '青春回放键。',               time: 1700000000012 }
  ];

  function driftDayLabel(day) {
    if (!day || day < 1) return '这一天';
    return 'DAY ' + day;
  }
  function driftFeatureOf(day) {
    if (day && day >= 1 && typeof SONG_DATA !== 'undefined' && SONG_DATA[day - 1] && SONG_DATA[day - 1].feature) {
      return SONG_DATA[day - 1].feature;
    }
    return '';
  }
  function loadDriftUser() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(DRIFT_KEY) || '[]'); } catch (e) { list = []; }
    return Array.isArray(list) ? list : [];
  }
  function saveDriftUser(list) {
    try { localStorage.setItem(DRIFT_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function driftPublicPool() {
    return DRIFT_SEED.concat(loadDriftUser());
  }
  // 漂流瓶点赞：按「day:song:time」作为瓶子身份，存 { [identity]: {likes, liked} }
  function driftBottleId(b) {
    return (b.day || 0) + ':' + (b.song || '') + ':' + (b.time || 0);
  }
  function loadDriftLikes() {
    let map = {};
    try { map = JSON.parse(localStorage.getItem(DRIFT_LIKE_KEY) || '{}'); } catch (e) { map = {}; }
    return (map && typeof map === 'object') ? map : {};
  }
  function getDriftLike(b) {
    const map = loadDriftLikes();
    const rec = map[driftBottleId(b)];
    return rec && typeof rec === 'object' ? { likes: rec.likes || 0, liked: !!rec.liked } : { likes: 0, liked: false };
  }
  function toggleDriftLike(b) {
    const map = loadDriftLikes();
    const id = driftBottleId(b);
    const rec = map[id] || { likes: 0, liked: false };
    if (rec.liked) { rec.liked = false; rec.likes = Math.max(0, (rec.likes || 0) - 1); }
    else { rec.liked = true; rec.likes = (rec.likes || 0) + 1; }
    map[id] = rec;
    try { localStorage.setItem(DRIFT_LIKE_KEY, JSON.stringify(map)); } catch (e) {}
    return { likes: rec.likes, liked: rec.liked };
  }
  function driftBottleCardHtml(b, opts) {
    opts = opts || {};
    const by = (b.anon || !b.name || b.name === '匿名访客') ? '匿名访客' : escapeHtml(b.name);
    const mineCls = opts.mine ? ' drift-bottle-mine' : '';
    const delBtn = opts.mine ? '<button type="button" class="drift-bottle-del" data-ts="' + b.time + '" title="删除">✕</button>' : '';
    const reason = (b.reason && b.reason.trim()) ? '<div class="drift-bottle-reason">' + escapeHtml(b.reason) + '</div>' : '';
    const like = getDriftLike(b);
    const likeBtn = '<button type="button" class="drift-bottle-like' + (like.liked ? ' liked' : '') + '" data-bid="' + driftBottleId(b) + '" title="点赞">' +
        '<span class="like-heart" aria-hidden="true">❤</span><span class="like-count">' + like.likes + '</span>' +
      '</button>';
    return '' +
      '<div class="drift-bottle' + mineCls + '">' +
        delBtn +
        '<div class="drift-bottle-song">' + escapeHtml(b.song) + '</div>' +
        reason +
        '<div class="drift-bottle-foot">' +
          '<div class="drift-bottle-by">—— ' + by + ' 推荐</div>' +
          likeBtn +
        '</div>' +
      '</div>';
  }
  function isMineBottle(b) {
    return loadDriftUser().some(x => x.time === b.time);
  }
  // 打开某一天的漂流瓶弹窗（由 flipboard.js 漂流瓶玩法点击格子时调用）
  function openDriftModal(dayIndex) {
    const overlay = document.getElementById('driftModal');
    if (!overlay) return;
    const day = dayIndex + 1;
    const d = (typeof SONG_DATA !== 'undefined' && SONG_DATA[dayIndex]) || null;
    const dayEl = document.getElementById('driftModalDay');
    const featEl = document.getElementById('driftModalFeature');
    const dayValEl = document.getElementById('driftModalDayVal');
    if (dayEl) dayEl.textContent = driftDayLabel(day);
    if (featEl) {
      const feat = d && d.feature ? d.feature : '';
      const label = driftDayLabel(day);
      if (feat) { featEl.textContent = label + '   ' + feat; featEl.hidden = false; }
      else { featEl.textContent = label; featEl.hidden = false; }
    }
    if (dayValEl) dayValEl.value = String(day);
    closeDriftNameStep();
    renderDriftModalList(day);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    const songInput = document.getElementById('driftModalSong');
    if (songInput) songInput.focus();
  }
  function renderDriftModalList(day) {
    const listEl = document.getElementById('driftModalList');
    if (!listEl) return;
    const pool = driftPublicPool().filter(b => b && b.song && b.day === day);
    if (pool.length === 0) {
      listEl.innerHTML = '<p class="drift-modal-empty">这一天还没有漂流瓶，来做第一个分享的人吧～</p>';
      return;
    }
    // 随机捞一瓶：每次点开都重新随机（不缓存），只展示一条
    const pick = pool[Math.floor(Math.random() * pool.length)];
    listEl.innerHTML = driftBottleCardHtml(pick, { mine: isMineBottle(pick) });
    listEl.querySelectorAll('.drift-bottle-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const ts = parseInt(btn.dataset.ts, 10);
        saveDriftUser(loadDriftUser().filter(x => x.time !== ts));
        const cur = document.getElementById('driftModalDayVal');
        renderDriftModalList(cur ? (parseInt(cur.value, 10) || 0) : day);
      });
    });
    // 漂流瓶点赞：当前只展示一瓶，直接对该瓶 toggle
    const likeBtn = listEl.querySelector('.drift-bottle-like');
    if (likeBtn) {
      likeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const rec = toggleDriftLike(pick);
        likeBtn.classList.toggle('liked', rec.liked);
        const cnt = likeBtn.querySelector('.like-count');
        if (cnt) cnt.textContent = rec.likes;
      });
    }
  }
  function showDriftModalTip(msg, kind) {
    const tip = document.getElementById('driftModalTip');
    if (!tip) return;
    tip.textContent = msg;
    tip.className = 'gb-tip' + (kind ? ' ' + kind : '');
    tip.hidden = false;
    clearTimeout(showDriftModalTip._t);
    showDriftModalTip._t = setTimeout(() => { tip.hidden = true; }, 3600);
  }
  function closeDriftModal() {
    const overlay = document.getElementById('driftModal');
    if (!overlay) return;
    overlay.classList.add('closing');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    setTimeout(() => overlay.classList.remove('closing'), 200);
  }
  let pendingDrift = null;
  function handleDriftModalSubmit(e) {
    e.preventDefault();
    const songEl = document.getElementById('driftModalSong');
    const reasonEl = document.getElementById('driftModalReason');
    const dayValEl = document.getElementById('driftModalDayVal');
    const song = songEl ? songEl.value.trim() : '';
    if (!song) { showDriftModalTip('歌名不能为空哦～', 'warn'); return; }
    const day = dayValEl ? (parseInt(dayValEl.value, 10) || 0) : 0;
    const reason = reasonEl ? reasonEl.value.trim() : '';
    pendingDrift = { day: day, song: song, reason: reason };
    openDriftNameStep();
  }
  function openDriftNameStep() {
    const overlay = document.getElementById('driftNameModal');
    const inputWrap = document.getElementById('driftNameInputWrap');
    const nameEl = document.getElementById('driftModalName');
    const optionsEl = document.getElementById('driftNameOptions');
    const actionsEl = document.getElementById('driftNameActions');
    if (nameEl) nameEl.value = '';
    // 重置为初始状态：显示三选项行，隐藏展开区
    if (inputWrap) inputWrap.hidden = true;
    if (optionsEl) optionsEl.hidden = false;
    if (actionsEl) actionsEl.hidden = true;
    if (overlay) {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
    }
  }
  function closeDriftNameStep() {
    const overlay = document.getElementById('driftNameModal');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    pendingDrift = null;
  }
  function finalizeDrift(anon, nameVal) {
    if (!pendingDrift) return;
    const name = anon ? '匿名访客' : ((nameVal && nameVal.trim()) || '匿名访客');
    const entry = { day: pendingDrift.day, song: pendingDrift.song, reason: pendingDrift.reason, name: name, anon: anon, time: Date.now() };
    const list = loadDriftUser();
    list.push(entry);
    saveDriftUser(list);
    showDriftModalTip('漂流瓶已投出，谢谢你的分享！', 'ok');
    const songEl = document.getElementById('driftModalSong');
    const reasonEl = document.getElementById('driftModalReason');
    if (songEl) songEl.value = '';
    if (reasonEl) reasonEl.value = '';
    renderDriftModalList(pendingDrift.day);
    closeDriftNameStep();
  }
  function initDrift() {
    const form = document.getElementById('driftModalForm');
    if (form) form.addEventListener('submit', handleDriftModalSubmit);
    const closeBtn = document.getElementById('driftModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeDriftModal);
    const overlay = document.getElementById('driftModal');
    if (overlay) overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeDriftModal(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && overlay && overlay.classList.contains('open')) closeDriftModal();
    });
    // 表单输入框键盘增强：曲目框 Enter → 跳到理由框；理由框 Ctrl/Cmd+Enter → 直接投放
    const songInput = document.getElementById('driftModalSong');
    const reasonInput = document.getElementById('driftModalReason');
    if (songInput && reasonInput) {
      songInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); reasonInput.focus(); }
      });
      reasonInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (form) form.requestSubmit(); }
      });
    }
    // 署名弹窗：纵向布局，初始三选项 → 点击后展开对应操作区
    const nameOverlay = document.getElementById('driftNameModal');
    if (nameOverlay) {
      nameOverlay.addEventListener('click', (ev) => { if (ev.target === nameOverlay) closeDriftNameStep(); });
      const optionsEl = document.getElementById('driftNameOptions');
      const inputWrap = document.getElementById('driftNameInputWrap');
      const actionsEl = document.getElementById('driftNameActions');
      const nameEl = document.getElementById('driftModalName');

      // 初始三选项按钮
      if (optionsEl) {
        optionsEl.querySelectorAll('.drift-btn[data-mode]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.mode === 'anon') {
              // 点匿名：隐藏选项行，只显示操作按钮（确认投放+取消）
              if (optionsEl) optionsEl.hidden = true;
              if (inputWrap) inputWrap.hidden = true;
              if (actionsEl) actionsEl.hidden = false;
              // 记录当前模式为匿名，确认投放时直接 finalizeDrift(true)
              actionsEl.dataset.pendingMode = 'anon';
            } else {
              // 点填写昵称：隐藏选项行，显示输入框+操作按钮
              if (optionsEl) optionsEl.hidden = true;
              if (inputWrap) { inputWrap.hidden = false; }
              if (actionsEl) { actionsEl.hidden = false; }
              if (nameEl) nameEl.focus();
              actionsEl.dataset.pendingMode = 'name';
            }
          });
        });
        // 初始取消按钮
        const initCancel = document.getElementById('driftNameInitialCancel');
        if (initCancel) initCancel.addEventListener('click', closeDriftNameStep);
      }

      // 操作区确认投放按钮
      const confirmBtn = document.getElementById('driftConfirmBtn');
      if (confirmBtn) confirmBtn.addEventListener('click', () => {
        const mode = actionsEl ? actionsEl.dataset.pendingMode : '';
        if (mode === 'anon') {
          finalizeDrift(true);
        } else {
          finalizeDrift(false, nameEl ? nameEl.value : '');
        }
      });

      // 操作区取消按钮
      const actionCancel = document.getElementById('driftNameActionCancel');
      if (actionCancel) actionCancel.addEventListener('click', closeDriftNameStep);
      // 昵称输入框 Enter → 确认投放
      if (nameEl) {
        nameEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (confirmBtn) confirmBtn.click(); }
        });
      }
    }
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && nameOverlay && nameOverlay.classList.contains('open')) closeDriftNameStep();
    });
  }

  // 导航到文章详情
  // fromDay：从歌曲简介跳转时传入来源天下标，用于文末「返回歌曲简介」按钮
  function navigateToArticle(id, fromDay) {
    lastViewedArticleId = id;
    showPage('article');
    renderArticleDetail(id, fromDay);
    // 更新浏览器历史
    history.pushState({ page: 'article', id }, '', `#article-${id}`);
  }

  // 初始化
  // 导航栏自适应：检测是否需要纵向排列
  function checkNavbarOverflow() {
    const nav = document.querySelector('.navbar');
    const title = document.querySelector('.navbar-title');
    if (!nav || !title) return;
    if (title.scrollWidth > title.clientWidth) {
      nav.classList.add('navbar--vertical');
    } else {
      nav.classList.remove('navbar--vertical');
    }
  }

  function init() {
    checkNavbarOverflow();
    window.addEventListener('resize', checkNavbarOverflow);

    // 绑定导航点击
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        showPage(page);
        history.pushState({ page }, '', `#${page}`);
        // 切到留言页时，按当前内容重算输入框高度
        if (page === 'guestbook') {
          const gb = document.getElementById('gbMessage');
          autoGrowTextarea(gb);
        }
      });
    });

    // 绑定文章返回按钮：返回文章列表（碎碎念），而非首页
    const backBtn = document.getElementById('articleBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        showPage('articles', { anchorId: lastViewedArticleId });
        history.pushState({ page: 'articles', anchorId: lastViewedArticleId }, '', '#articles');
      });
    }

    // 处理浏览器后退/前进
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.page) {
        if (e.state.page === 'article' && e.state.id) {
          showPage('article');
          renderArticleDetail(e.state.id);
        } else if (e.state.page === 'articles') {
          showPage('articles', { anchorId: e.state.anchorId });
        } else {
          showPage(e.state.page);
        }
      }
    });

    // 初始化各页面
    renderArticles();
    renderGuestbook();
    initDrift();

    // 碎碎念卡片键盘可达：方向键移动光标后，Enter / 空格 打开对应文章
    const articlesGrid = document.getElementById('articlesGrid');
    if (articlesGrid) {
      articlesGrid.addEventListener('keydown', (e) => {
        const card = e.target.closest && e.target.closest('.article-card');
        if (!card) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = parseInt(card.getAttribute('data-article-id'), 10);
          if (!isNaN(id)) navigateToArticle(id);
        }
      });
    }

    // 留言表单提交
    const gbForm = document.getElementById('gbForm');
    if (gbForm) gbForm.addEventListener('submit', handleGuestbookSubmit);

    // 留言点赞：事件委托（renderGuestbook 每次重渲都会重建节点）
    const gbListEl = document.getElementById('gbList');
    if (gbListEl) {
      gbListEl.addEventListener('click', (e) => {
        const likeBtn = e.target.closest && e.target.closest('.gb-like');
        if (!likeBtn) return;
        const ts = parseInt(likeBtn.dataset.ts, 10);
        const rec = toggleMsgLike(ts);
        if (rec) {
          likeBtn.classList.toggle('liked', rec.liked);
          const cnt = likeBtn.querySelector('.gb-like-count');
          if (cnt) cnt.textContent = rec.likes;
        }
      });
    }

    // 留言框自动撑高：输入时下限随内容向下推进
    const gbMsg = document.getElementById('gbMessage');
    if (gbMsg) {
      gbMsg.addEventListener('input', () => autoGrowTextarea(gbMsg));
      // 首次聚焦也校正一次（若从「凑字」状态切回）
      gbMsg.addEventListener('focus', () => autoGrowTextarea(gbMsg));
    }

    // 匿名与署名互斥体验：勾选匿名时禁用昵称输入
    const anonEl = document.getElementById('gbAnon');
    const nameEl = document.getElementById('gbName');
    if (anonEl && nameEl) {
      anonEl.addEventListener('change', () => {
        nameEl.disabled = anonEl.checked;
        if (anonEl.checked) nameEl.value = '';
      });
    }

    // 初始化翻牌棋盘
    FlipBoard.init();
  }

  return { init, navigateToArticle, renderArticles, renderGuestbook, renderArticleDetail, openDriftModal };
})();
