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
    // 碎碎念评论区：由 Twikoo 接管，每篇文章用独立 path（/article/<id>）
    const commentsEl = document.getElementById('articleComments');
    if (commentsEl) initTwikooArticle(article.id, commentsEl);
  }

  // ===================== 碎碎念评论区 =====================
  // 已交由 Twikoo 接管（见 initTwikooArticle），原本地评论逻辑已移除。

  // ===================== 评论区（Twikoo 评论系统） =====================
  // 后端：腾讯云 CloudBase（云开发）云函数，数据存 CloudBase 自带数据库（无需 MongoDB Atlas）。
  // 前端 envId 在 index.html 的 window.TWIKOO_ENV_ID 中配置。
  const TWIKOO_ENV = window.TWIKOO_ENV_ID;

  // 是否就绪：CDN 已加载 且 envId 已配置（非占位符）
  function twikooReady() {
    return !!window.twikoo && !!TWIKOO_ENV && TWIKOO_ENV.indexOf('REPLACE') === -1;
  }

  // 留言区评论（固定 path: /guestbook）
  function initTwikooGuestbook() {
    if (!twikooReady()) return;
    try {
      twikoo.init({ envId: TWIKOO_ENV, el: '#tcomment', path: '/guestbook', lang: 'zh-CN', region: window.TWIKOO_REGION });
    } catch (e) {
      console.warn('Twikoo 留言区初始化失败:', e);
    }
  }

  // 文章评论：每篇文章独立 path（/article/<id>），每次打开文章时挂载
  function initTwikooArticle(articleId, container) {
    if (!container || !twikooReady()) return;
    try {
      container.innerHTML = '<div class="tcomment-article"></div>';
      twikoo.init({
        envId: TWIKOO_ENV,
        el: container.querySelector('.tcomment-article'),
        path: '/article/' + articleId,
        lang: 'zh-CN',
        region: window.TWIKOO_REGION
      });
    } catch (e) {
      console.warn('Twikoo 文章评论初始化失败:', e);
    }
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

  // 留言区渲染已交由 Twikoo 接管（见 initTwikooGuestbook）。

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

  // 留言提交已交由 Twikoo 接管（无需本地逻辑）。

  // ===================== 漂流瓶（localStorage 纯前端存储） =====================
  // 漂流瓶共享池：当前存于访客自己浏览器的 localStorage（DRIFT_KEY）。
  const DRIFT_KEY = 'drift_bottles_v1';

  function readDriftStore() {
    try {
      const arr = JSON.parse(localStorage.getItem(DRIFT_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeDriftStore(list) {
    try { localStorage.setItem(DRIFT_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // 从 localStorage 获取漂流瓶列表（按时间倒序）
  async function loadDriftBottles() {
    return readDriftStore().slice().sort((a, b) => b.time - a.time);
  }

  // 投放漂流瓶到 localStorage（"我的瓶子"记录由调用方写入 DRIFT_USER_KEY）
  async function submitDriftBottle(day, song, reason, name, anon) {
    const list = readDriftStore();
    list.push({
      day: parseInt(day, 10) || 0,
      song: song.trim(),
      reason: reason || '',
      name: name || '匿名访客',
      anon: !!anon,
      time: Date.now()
    });
    writeDriftStore(list);
    return true;
  }

  // 删除漂流瓶（"我的瓶子"记录由调用方同步删除）
  async function deleteDriftBottle(time) {
    const list = readDriftStore().filter(b => b.time !== time);
    writeDriftStore(list);
    return true;
  }

  // 获取用户自己投的瓶子（本地存储，用于删除）
  function loadDriftUser() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(DRIFT_USER_KEY) || '[]'); } catch (e) { list = []; }
    return Array.isArray(list) ? list : [];
  }
  function saveDriftUser(list) {
    try { localStorage.setItem(DRIFT_USER_KEY, JSON.stringify(list)); } catch (e) {}
  }
  const DRIFT_USER_KEY = 'drift_user_local_v1';

  function driftPublicPool() {
    // 合并本地漂流瓶池 + 用户本地投递记录（按 time 去重）
    return loadDriftBottles().then(list => {
      const local = loadDriftUser();
      const existingTimes = new Set(list.map(x => x.time));
      local.forEach(l => {
        if (!existingTimes.has(l.time)) list.push(l);
      });
      return list;
    });
  }

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
  // 漂流瓶点赞（KV 暂存用户点赞记录到 localStorage，后续可迁入）
  const DRIFT_LIKE_KEY = 'drift_likes_v1';
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
    renderDriftModalListAsync(day);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    const songInput = document.getElementById('driftModalSong');
    if (songInput) songInput.focus();
  }

  // 渲染漂流瓶列表（从 KV + 本地）
  async function renderDriftModalListAsync(day) {
    const listEl = document.getElementById('driftModalList');
    if (!listEl) return;
    const pool = await driftPublicPool();
    const filtered = pool.filter(b => b && b.song && b.day === day);
    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="drift-modal-empty">这一天还没有漂流瓶，来做第一个分享的人吧～</p>';
      return;
    }
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    const html = driftBottleCardHtml(pick, { mine: isMineBottle(pick) });
    listEl.innerHTML = html;
    listEl.querySelectorAll('.drift-bottle-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ts = parseInt(btn.dataset.ts, 10);
        await deleteDriftBottle(ts);
        // 更新本地列表
        const users = loadDriftUser().filter(x => x.time !== ts);
        saveDriftUser(users);
        const cur = document.getElementById('driftModalDayVal');
        renderDriftModalListAsync(cur ? (parseInt(cur.value, 10) || 0) : day);
      });
    });
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
    // 投放到 KV
    submitDriftBottle(pendingDrift.day, pendingDrift.song, pendingDrift.reason, name, anon).then(async (ok) => {
      if (!ok) { showDriftModalTip('投放失败，请检查网络', 'warn'); return; }
      // 同时存一份到 localStorage（用于删除和自己查看）
      const list = loadDriftUser();
      list.push(entry);
      saveDriftUser(list);
      showDriftModalTip('漂流瓶已投出，谢谢你的分享！', 'ok');
      const songEl = document.getElementById('driftModalSong');
      const reasonEl = document.getElementById('driftModalReason');
      if (songEl) songEl.value = '';
      if (reasonEl) reasonEl.value = '';
      renderDriftModalListAsync(pendingDrift.day);
      closeDriftNameStep();
    });
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
    initTwikooGuestbook();
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

    // 留言区已由 Twikoo 接管，无需本地事件绑定。

    // 初始化翻牌棋盘
    FlipBoard.init();
  }

  return { init, navigateToArticle, renderArticles, renderArticleDetail, openDriftModal };
})();
