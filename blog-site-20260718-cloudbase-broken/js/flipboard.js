/* ===================== 翻牌棋盘模块 ===================== */
const FlipBoard = (() => {
  const COLS = 5;
  const ROWS = 6;
  const TOTAL = ROWS * COLS;

  // 极速连点去抖（毫秒）：小于该间隔的重复点击只给按压反馈，不切换状态
  const DEBOUNCE_MS = 120;
  // 单次动画时长（需与 CSS transition 时长一致）
  const ANIM_MS = 420;

  // 图片路径配置 - 修改这里替换为你的图片
  // 支持相对路径（如 imagesB/01.jpg）或完整 URL
  const IMAGE_PATHS = { b: [] };
  for (let i = 1; i <= TOTAL; i++) {
    const n = String(i).padStart(2, '0');
    IMAGE_PATHS.b.push(`imagesB/${n}.jpg`);
  }

  // 平台图标（网易云 / B站）；单文件打包时会替换为 Data URI
  const ICON_NETEASE = 'images/wyy.png';
  const ICON_BILI = 'images/bili.webp';

  // 音频配置
  const AUDIO_DURATION = 10;
  // 替换为你的音频文件路径（相对路径或 Base64 嵌入的 wav/mp3）
  // 示例：const AUDIO_SRC = 'audio/bgm.mp3';
  const AUDIO_SRC = '';
  // 占位用的极短静音 wav（Base64），仅为演示音频通道；替换为真实音频即生效
  const AUDIO_BASE64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  let cells = [];
  let modalOpen = false;
  let modalIndex = -1;
  let audioCtx = null;
  let audioBuffer = null;
  let audioSource = null;
  let gainNode = null;
  let audioTimer = null;
  let audioPlaying = false;
  let userInteracted = false;
  let bc = null;
  // 播放槽（点击某天即播放 / 随机播放）
  let randomOn = false;
  let randomTimer = null;
  // 猜一猜模式
  let guessMode = false;
  let guessTargetDay = -1;
  // 漂流瓶玩法模式：开启后点格子打开该天的推荐弹窗
  let driftMode = false;
  let currentDayIndex = null;   // 当前正在播放的天（用于暂停后续播）
  let orbPlaying = false;       // 旋转圆是否处于播放中（false = 已暂停）
  let focusedIndex = -1;        // 键盘导航：当前聚焦的格子索引
  const RANDOM_INTERVAL = 210000; // 随机播放每首停留时长（毫秒），约 3.5 分钟

  function buildBoard() {
    const board = document.getElementById('board');
    if (!board) return;
    board.innerHTML = '';
    cells = [];

    for (let i = 0; i < TOTAL; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `方格 ${i + 1}`);
      cell.dataset.index = i;

      const inner = document.createElement('div');
      inner.className = 'cell-inner';

      // A 面 - 文字（白底黑字）
      const faceA = document.createElement('div');
      faceA.className = 'face face-a';
      const cd = (typeof CELL_TEXTS !== 'undefined' && CELL_TEXTS[i]) || { day: String(i + 1), desc: '' };
      const dayEl = document.createElement('div');
      dayEl.className = 'cell-day';
      dayEl.textContent = 'DAY ' + cd.day;
      const descEl = document.createElement('div');
      descEl.className = 'cell-desc';
      descEl.textContent = cd.desc || '';
      faceA.appendChild(dayEl);
      faceA.appendChild(descEl);

      // B 面 - 彩色图片（弹簧弹出）
      const faceB = document.createElement('div');
      faceB.className = 'face face-b';
      const imgB = document.createElement('img');
      imgB.alt = `格子 ${i + 1} B面`;
      imgB.loading = 'lazy';
      imgB.onerror = function () {
        this.style.display = 'none';
        faceB.classList.add('img-failed');
        faceB.textContent = (i + 1).toString();
      };
      imgB.src = IMAGE_PATHS.b[i];
      faceB.appendChild(imgB);

      inner.appendChild(faceA);
      inner.appendChild(faceB);
      cell.appendChild(inner);

      cell.addEventListener('click', () => handleCellClick(i));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCellClick(i);
        }
      });

      board.appendChild(cell);
      cells.push({ flipped: false, animating: false, lastClick: 0, animTimer: null, el: cell });
    }
  }

  function pressFeedback(el) {
    el.classList.add('pressing');
    setTimeout(() => el.classList.remove('pressing'), 140);
  }

  function handleCellClick(index) {
    ensureAudioPlay();
    const c = cells[index];
    if (!c) return;
    const now = Date.now();
    // 极速连点：仅按压反馈，不切换（避免动画期间抖动）
    if (now - c.lastClick < DEBOUNCE_MS) {
      pressFeedback(c.el);
      return;
    }
    c.lastClick = now;

    // 猜一猜模式：走专属判定逻辑（翻错只闪一下 B 面，翻对才弹详情）
    if (guessMode) {
      handleGuessClick(index);
      focusedIndex = index;
      return;
    }

    // 漂流瓶玩法：点格子打开该天的推荐弹窗（不翻牌、不播歌）
    if (driftMode) {
      handleDriftClick(index);
      focusedIndex = index;
      return;
    }

    const wasFlipped = c.flipped;
    toggleCell(index);
    // 单击 A 面 → 翻到 B：弹出歌曲弹窗 + 更新听歌按钮
    if (!wasFlipped && c.flipped) {
      openModal(index);
    } else if (wasFlipped && !c.flipped) {
      // 翻回 A：确保弹窗已关闭（一般不会在此分支触发，保险用）
      closeModalIfOpen();
    }
    focusedIndex = index;
  }

  // ===================== 猜一猜模式 =====================
  function toggleGuess() {
    if (guessMode) {
      // 进行中再次点击：揭晓答案（定位并翻开对应天数，弹出简介）
      revealAnswer();
      return;
    }
    if (driftMode) exitDriftMode();   // 互斥：进入猜一猜前先退出漂流瓶
    const days = listPlayableDays();
    if (!days.length) {
      showGuessToast('暂时没有可播放的歌曲用于猜猜看');
      return;
    }
    guessTargetDay = days[Math.floor(Math.random() * days.length)];
    guessMode = true;
    // 先让棋盘回到一致状态（所有格子 A 面朝上）
    flipAllBack();
    // 随机播放目标歌曲（作为「神秘曲目」）
    playDay(guessTargetDay);
    const btn = document.getElementById('guessBtn');
    if (btn) {
      btn.classList.add('active');
      btn.textContent = '揭晓答案';
    }
    showGuessBanner();
  }

  // 揭晓答案：定位到正确天数，翻开对应格子并弹出简介
  function revealAnswer() {
    const idx = guessTargetDay;
    if (idx < 0) return;
    exitGuessMode();
    const c = cells[idx];
    if (c) {
      c.flipped = true;
      c.el.classList.add('flipped');
    }
    openModal(idx, { replay: true });
  }

  function exitGuessMode() {
    guessMode = false;
    guessTargetDay = -1;
    const btn = document.getElementById('guessBtn');
    if (btn) {
      btn.classList.remove('active');
      btn.textContent = '猜一猜';
    }
    hideGuessBanner();
    hideGuessToast();
  }

  function handleGuessClick(index) {
    if (index === guessTargetDay) {
      // 猜对了：先放烟花 + 恭喜提示，再弹详情（带「再来一轮」）
      exitGuessMode();
      const c = cells[index];
      if (c) { c.flipped = true; c.el.classList.add('flipped'); }
      celebrateCorrect(() => openModal(index, { replay: true }));
      return;
    }
    // 猜错了：B 面闪一下再翻回，不给详情
    flashCell(index);
    showGuessToast('不是这一天，再听听看～');
  }

  // 翻出 B 面，短暂停留后翻回（「闪一下」反馈）
  function flashCell(index) {
    const c = cells[index];
    if (!c) return;
    c.flipped = true;
    c.el.classList.add('flipped', 'flash-wrong');
    setTimeout(() => {
      c.flipped = false;
      c.el.classList.remove('flipped', 'flash-wrong');
    }, 600);
  }

  function showGuessBanner() {
    const b = document.getElementById('guessBanner');
    if (b) b.hidden = false;
  }
  function hideGuessBanner() {
    const b = document.getElementById('guessBanner');
    if (b) b.hidden = true;
  }

  function showGuessToast(msg) {
    let t = document.getElementById('guessToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'guessToast';
      t.className = 'guess-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    if (t._timer) clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1400);
  }
  function hideGuessToast() {
    const t = document.getElementById('guessToast');
    if (t) t.classList.remove('show');
  }

  // ===================== 漂流瓶玩法 =====================
  function handleDriftClick(index) {
    // 点格子 → 打开该天的推荐弹窗（不翻牌、不播歌）
    if (typeof BlogApp !== 'undefined' && BlogApp.openDriftModal) {
      BlogApp.openDriftModal(index);
    }
  }
  function toggleDrift() {
    if (driftMode) { exitDriftMode(); return; }
    if (guessMode) exitGuessMode();   // 互斥：进入漂流瓶前先退出猜一猜
    driftMode = true;
    flipAllBack();
    const btn = document.getElementById('driftBtn');
    if (btn) { btn.classList.add('active'); btn.textContent = '退出漂流瓶'; }
    showDriftBanner();
  }
  function exitDriftMode() {
    driftMode = false;
    const btn = document.getElementById('driftBtn');
    if (btn) { btn.classList.remove('active'); btn.textContent = '漂流瓶'; }
    hideDriftBanner();
  }
  function showDriftBanner() {
    const b = document.getElementById('driftBanner');
    if (b) b.hidden = false;
  }
  function hideDriftBanner() {
    const b = document.getElementById('driftBanner');
    if (b) b.hidden = true;
  }

  // 猜中后：烟花绽放动画 + 「恭喜你猜对了」提示框，结束后回调弹出简介
  function celebrateCorrect(done) {
    const overlay = document.createElement('div');
    overlay.className = 'celebrate-overlay';
    const msg = document.createElement('div');
    msg.className = 'celebrate-msg';
    msg.textContent = '🎉 恭喜你猜对了！';
    overlay.appendChild(msg);
    const colors = ['#ff5e5e', '#ffd166', '#06d6a0', '#4cc9f0', '#b5179e', '#f72585'];
    const fwCount = 5;
    for (let f = 0; f < fwCount; f++) {
      const fw = document.createElement('div');
      fw.className = 'firework';
      fw.style.left = (15 + Math.random() * 70) + '%';
      fw.style.top = (18 + Math.random() * 55) + '%';
      const color = colors[f % colors.length];
      const n = 14;
      for (let s = 0; s < n; s++) {
        const sp = document.createElement('span');
        sp.className = 'spark';
        const ang = (Math.PI * 2 * s) / n + Math.random() * 0.3;
        const dist = 70 + Math.random() * 60;
        sp.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
        sp.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
        sp.style.background = color;
        sp.style.animationDelay = (Math.random() * 0.3).toFixed(2) + 's';
        fw.appendChild(sp);
      }
      overlay.appendChild(fw);
    }
    document.body.appendChild(overlay);
    // 1.3s 后整体淡出，1.7s 后移除并弹出简介
    setTimeout(() => overlay.classList.add('fade-out'), 1300);
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
      if (typeof done === 'function') done();
    }, 1700);
  }

  // 键盘导航：基于空间坐标的方向导航。若顶部有弹窗打开，则只在弹窗内导航。
  function collectNavNodes() {
    const nodes = [];
    cells.forEach(c => { if (c.el) nodes.push(c.el); });
    document.querySelectorAll('nav a, nav button, #guessBtn, #driftBtn, #flipBackBtn, #listenBtn, #howtoHint, .netease-btn').forEach(el => {
      if (el.offsetParent !== null) nodes.push(el);
    });
    return nodes;
  }

  // 返回当前最上层、已打开的弹窗（栈顶）。按 z-index 取最高，平手取 DOM 靠后者。
  function getTopModal() {
    const modals = Array.from(document.querySelectorAll('.modal-overlay.open'));
    if (!modals.length) return null;
    let top = null, topZ = -Infinity;
    for (const m of modals) {
      const raw = parseInt(getComputedStyle(m).zIndex, 10);
      const z = isNaN(raw) ? 0 : raw;
      if (z > topZ || (z === topZ && top && (m.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        top = m; topZ = z;
      }
    }
    return top;
  }

  // 返回当前激活的页面区块（.page-section.active）
  function getActiveSection() {
    return document.querySelector('.page-section.active');
  }

  // 收集「当前激活页面」内的可聚焦元素 + 常驻顶部导航，供方向键在页面内部导航
  function collectPageNavNodes() {
    const nodes = [];
    const sec = getActiveSection();
    if (sec) {
      sec.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])').forEach(el => {
        if (el.offsetParent === null) return;
        if (el.disabled) return;
        if (el.type === 'hidden') return;
        if (el.hasAttribute('hidden')) return;
        nodes.push(el);
      });
    }
    document.querySelectorAll('nav a, nav button').forEach(el => {
      if (el.offsetParent !== null) nodes.push(el);
    });
    return nodes;
  }

  // 收集某作用域内「可见且可聚焦」的元素；scope 为空时退回当前页面导航节点
  function focusableEls(scope) {
    if (!scope) return collectPageNavNodes();
    const sel = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(scope.querySelectorAll(sel)).filter(el => {
      if (el.disabled) return false;
      if (el.type === 'hidden') return false;
      if (el.hasAttribute('hidden')) return false;
      if (el.offsetParent === null) return false; // 不可见
      return true;
    });
  }

  // 把焦点移到作用域内第一个可聚焦元素（弹窗刚弹出时调用）
  function focusFirstInModal(scope) {
    const els = focusableEls(scope);
    if (els.length) els[0].focus();
  }

  // 判断元素是否可作滚动容器（overflow 允许滚动且有溢出内容）
  function isScrollable(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const s = getComputedStyle(el);
    const yScroll = (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    const xScroll = (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    return yScroll || xScroll;
  }
  // 从元素向上找最近的可滚动祖先（不超过 scope）
  function nearestScrollableAncestor(el, scope) {
    let n = el ? el.parentElement : null;
    const limit = scope || null;
    while (n && n !== limit && n !== document.documentElement) {
      if (isScrollable(n)) return n;
      n = n.parentElement;
    }
    if (scope && isScrollable(scope)) return scope;
    return null;
  }
  function canScrollInDir(sc, dir) {
    if (dir === 'down') return sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1;
    if (dir === 'up') return sc.scrollTop > 1;
    if (dir === 'left') return sc.scrollLeft > 1;
    if (dir === 'right') return sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1;
    return false;
  }
  // target 是否完全落在 scrollRect 在 dir 方向之外的不可见区域
  function targetFullyOutside(scRect, tRect, dir) {
    if (dir === 'down') return tRect.top >= scRect.bottom - 1;
    if (dir === 'up') return tRect.bottom <= scRect.top + 1;
    if (dir === 'left') return tRect.right <= scRect.left + 1;
    if (dir === 'right') return tRect.left >= scRect.right - 1;
    return false;
  }
  // 决定本次方向键是否应先滚动容器（而非直接移焦）；返回需滚动的容器或 null
  function scrollContainerForMove(cur, best, dir, scope) {
    const tSc = nearestScrollableAncestor(best, scope);
    if (tSc && canScrollInDir(tSc, dir)) {
      const scR = tSc.getBoundingClientRect();
      const tR = best.getBoundingClientRect();
      if (targetFullyOutside(scR, tR, dir)) return tSc;
    }
    const curSc = nearestScrollableAncestor(cur, scope);
    if (curSc && curSc !== tSc && canScrollInDir(curSc, dir)) {
      const scR = curSc.getBoundingClientRect();
      const tR = best.getBoundingClientRect();
      if (targetFullyOutside(scR, tR, dir)) return curSc;
    }
    return null;
  }
  function scrollContainerBy(sc, dir) {
    const step = Math.max(70, Math.min(Math.round(sc.clientHeight * 0.8), 240));
    const top = dir === 'down' ? step : dir === 'up' ? -step : 0;
    const left = dir === 'left' ? -step : dir === 'right' ? step : 0;
    sc.scrollBy({ top, left, behavior: 'auto' });
  }

  // 返回实际可滚动容器：优先内部可滚动祖先，否则退回整页(window / documentElement)。
  function getScroller(el, scope) {
    const inner = nearestScrollableAncestor(el, scope);
    if (inner) return inner;
    return document.documentElement; // 整页滚动
  }
  function isScrollerWindow(sc) {
    return sc === document.documentElement || sc === document.body;
  }
  // 该滚动容器是否还能继续向上滚（用于「先滚动页面、到顶再移焦到导航栏」）
  function scrollerCanScrollUp(sc) {
    if (isScrollerWindow(sc)) {
      const y = window.scrollY || sc.scrollTop || document.body.scrollTop || 0;
      return y > 1;
    }
    return canScrollInDir(sc, 'up');
  }
  function scrollScrollerUp(sc) {
    const h = isScrollerWindow(sc) ? window.innerHeight : sc.clientHeight;
    const step = Math.max(70, Math.min(Math.round(h * 0.8), 240));
    if (isScrollerWindow(sc)) {
      window.scrollBy({ top: -step, behavior: 'auto' });
    } else {
      sc.scrollBy({ top: -step, behavior: 'auto' });
    }
  }

  function focusInDirection(dir, scope) {
    const nodes = focusableEls(scope);
    if (!nodes.length) return;
    const cur = document.activeElement;
    const curInNodes = cur && nodes.includes(cur);
    if (!curInNodes) {
      // 当前焦点不在导航节点内：弹窗场景聚焦第一个按钮，否则聚焦首页首格 / 当前页首节点
      if (scope) { if (nodes.length) nodes[0].focus(); }
      else if (cells[0] && cells[0].el) cells[0].el.focus();
      else if (nodes.length) nodes[0].focus();
      return;
    }
    const curR = cur.getBoundingClientRect();
    const cx = curR.left + curR.width / 2;
    const cy = curR.top + curR.height / 2;
    // 横向（左右）移动：不在「导航栏」与其它区域之间跨行切换，
    // 否则顶端按钮被固定导航栏遮挡时，左右切换会误跳到导航栏某一项。
    const curInNav = !!(cur && cur.closest && cur.closest('nav'));
    // 纵向（向上）移动：若光标在页面内容区（非导航栏）且页面尚未翻到顶端，
    // 则「先向上滚动页面、光标留在当前元素」，而不是直接跳到固定导航栏；
    // 只有页面翻到顶端（scrollTop≈0）时，向上才允许把焦点移到导航栏。
    let pageScroller = null, pageAtTop = true;
    if (dir === 'up' && !curInNav) {
      pageScroller = getScroller(cur, scope);
      pageAtTop = !scrollerCanScrollUp(pageScroller);
    }
    let best = null, bestScore = Infinity;
    for (const el of nodes) {
      if (el === cur) continue;
      if ((dir === 'left' || dir === 'right') && curInNav !== !!(el.closest && el.closest('nav'))) continue;
      // 向上且页面未到顶端：禁止焦点跨到导航栏（先滚动页面，见下方兜底分支）
      if (dir === 'up' && !curInNav && !pageAtTop && (el.closest && el.closest('nav'))) continue;
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - cx;
      const dy = (r.top + r.height / 2) - cy;
      let primary, secondary;
      if (dir === 'up') { if (dy >= -1) continue; primary = -dy; secondary = Math.abs(dx); }
      else if (dir === 'down') { if (dy <= 1) continue; primary = dy; secondary = Math.abs(dx); }
      else if (dir === 'left') { if (dx >= -1) continue; primary = -dx; secondary = Math.abs(dy); }
      else { if (dx <= 1) continue; primary = dx; secondary = Math.abs(dy); }
      const score = primary + secondary * 1.5; // 优先方向上的距离，其次对齐程度
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      // 输入框 / 文本域：保持「方向键直接移动焦点」的原行为，不拦截滚动
      const curTag = cur && (cur.tagName === 'INPUT' || cur.tagName === 'TEXTAREA' || cur.isContentEditable);
      if (!curTag) {
        // 若两个交互键之间夹着超长文本（目标在滚动容器可视区之外），
        // 先滚动容器把文本移到可见区，焦点留在当前键；滚到尽头再移到目标键
        const sc = scrollContainerForMove(cur, best, dir, scope);
        if (sc) { scrollContainerBy(sc, dir); return; }
      }
      best.focus();
      const idx = cells.findIndex(c => c.el === best);
      if (idx >= 0) focusedIndex = idx;
    } else if (dir === 'up' && !curInNav && pageScroller && isScrollerWindow(pageScroller) && !pageAtTop) {
      // 内容区已无更靠上的可聚焦元素（导航栏被上方守卫屏蔽），且整页未翻到顶端：
      // 向上滚动页面，把上方文本 / 内容移入视野，光标保持在当前元素。
      scrollScrollerUp(pageScroller);
    }
  }

  // 切换目标状态：即使动画进行中也会平滑反转（双击可正常收起 B 面）
  function toggleCell(index) {
    const c = cells[index];
    if (!c) return;
    const target = !c.flipped;
    c.flipped = target;
    c.el.classList.toggle('flipped', target);
    c.animating = true;
    if (c.animTimer) clearTimeout(c.animTimer);
    c.animTimer = setTimeout(() => { c.animating = false; }, ANIM_MS);
  }

  // 动画收起单个方格
  function flipBackAnimated(index) {
    const c = cells[index];
    if (!c || !c.flipped) return;
    c.flipped = false;
    c.el.classList.remove('flipped');
    c.animating = true;
    if (c.animTimer) clearTimeout(c.animTimer);
    c.animTimer = setTimeout(() => { c.animating = false; }, ANIM_MS);
  }

  // 瞬间翻回 A 面（Esc 用，无动画）
  function flipAllBackInstant() {
    for (let i = 0; i < TOTAL; i++) {
      const c = cells[i];
      if (c.flipped) {
        c.el.classList.add('no-anim');
        c.el.classList.remove('flipped');
        c.flipped = false;
        void c.el.offsetWidth; // 强制重排，使下一帧立即生效
      }
    }
    requestAnimationFrame(() => {
      for (let i = 0; i < TOTAL; i++) cells[i].el.classList.remove('no-anim');
    });
  }

  function flipAllBack() {
    for (let i = 0; i < TOTAL; i++) flipBackAnimated(i);
    closeModalIfOpen();
    resetListenButton();
  }

  // ===================== 歌曲弹窗 =====================
  function neteaseSearch(singer, song) {
    return 'https://music.163.com/#/search/m/?s=' +
      encodeURIComponent(((singer || '') + ' ' + (song || '')).trim());
  }

  function updateListenButton(index) {
    const btn = document.getElementById('listenBtn');
    const text = document.getElementById('listenText');
    const icon = document.getElementById('listenIcon');
    const d = (typeof SONG_DATA !== 'undefined' && SONG_DATA[index]) || null;
    if (!btn || !text) return;
    if (!d) { resetListenButton(); return; }
    // jump 字段决定「跳转去听」的平台：显式 'bilibili' 才去 B站，否则（缺省）回网易云。
    // 注意：bvid 只管「播放（内嵌）」，不再强制跳转也去 B站。
    const jump = d.jump || 'netease';
    let label, link, iconUrl;
    if (jump === 'bilibili') {
      link = d.bvid ? ('https://www.bilibili.com/video/' + d.bvid) : (d.link || '');
      label = '去 B 站看视频';
      iconUrl = ICON_BILI;
    } else {
      const firstLink = (Array.isArray(d.links) && d.links[0]) ? d.links[0].url : null;
      link = d.link || firstLink || neteaseSearch(d.singer, d.song);
      label = d.playlist ? '去网易云听歌单' : '去网易云听《' + d.song + '》';
      iconUrl = ICON_NETEASE;
    }
    if (icon) icon.style.backgroundImage = "url('" + iconUrl + "')";
    btn._link = link;
    btn._platform = jump;
    btn.classList.add('active');
    btn.title = link ? '点击打开' : '链接稍后补充';
    text.textContent = label;
  }

  function resetListenButton() {
    const btn = document.getElementById('listenBtn');
    const text = document.getElementById('listenText');
    const icon = document.getElementById('listenIcon');
    if (btn) { btn.classList.remove('active'); btn._link = ''; btn._platform = ''; btn.title = ''; }
    if (text) text.textContent = '去听听这首';
    if (icon) icon.style.backgroundImage = "url('" + ICON_NETEASE + "')";
  }

  // 弹窗右侧下半部分：渲染「去网易云 / 去 B 站」听歌（或歌单）按钮
  // 支持单链接、多链接（如 DAY14 两个婚礼歌单）、无链接（B站待补充 / 网易云搜索）等情况
  function renderModalLinks(d) {
    const box = document.getElementById('modalLinks');
    if (!box) return;
    box.innerHTML = '';
    if (!d) return;
    const jump = d.jump || 'netease';

    // ① 碎碎念跳转：始终置于最上方，避免被下方醒目的网易云按钮抢走视线
    if (d.note) {
      const nb = document.createElement('button');
      nb.type = 'button';
      nb.className = 'modal-note-link';
      nb.innerHTML = '查看碎碎念 <span aria-hidden="true">→</span>';
      nb.addEventListener('click', () => {
        if (typeof BlogApp !== 'undefined' && BlogApp.navigateToArticle) {
          const fromDay = modalIndex;   // 记住来源天，供文章末尾「返回歌曲简介」用
          closeModal();                 // 关掉简介弹窗，但歌曲继续播放
          BlogApp.navigateToArticle(d.note, fromDay);
        }
      });
      box.appendChild(nb);
    }

    // ② 去网易云 / 去 B 站 听歌（或歌单）按钮
    const items = [];
    if (Array.isArray(d.links) && d.links.length) {
      d.links.forEach((l) => items.push({
        label: l.label, url: l.url, platform: l.platform || jump
      }));
    } else if (jump === 'bilibili') {
      // B站-only 天：跳转去 B站
      if (d.bvid) {
        items.push({ label: '去 B 站看视频', url: 'https://www.bilibili.com/video/' + d.bvid, platform: 'bilibili' });
      } else if (d.link) {
        items.push({ label: '去 B 站看视频', url: d.link, platform: 'bilibili' });
      } else {
        const note = document.createElement('div');
        note.className = 'modal-link-note';
        note.textContent = 'B站链接稍后补充';
        box.appendChild(note);
        return;
      }
    } else if (d.link) {
      const label = d.playlist ? '去网易云听歌单' : '去网易云听《' + d.song + '》';
      items.push({ label: label, url: d.link, platform: 'netease' });
    } else {
      items.push({ label: '去网易云搜索', url: neteaseSearch(d.singer, d.song), platform: 'netease' });
    }
    items.forEach((it) => {
      const a = document.createElement('a');
      a.className = 'modal-link-btn ' + (it.platform === 'bilibili' ? 'bili' : 'netease');
      const img = document.createElement('img');
      img.className = 'modal-link-icon';
      img.src = it.platform === 'bilibili' ? ICON_BILI : ICON_NETEASE;
      img.alt = '';
      a.appendChild(img);
      const t = document.createElement('span');
      t.textContent = it.label;
      a.appendChild(t);
      a.href = it.url;
      a.target = '_blank';
      a.rel = 'noopener';
      box.appendChild(a);
    });
  }

  // 渲染歌曲简介：支持用独占一行的 --- 作为分割线（原创简介 / 用户文案之间），
  // 其余按纯文本处理（\n 由 CSS white-space:pre-line 变成换行），并转义 HTML 防注入。
  function escapeIntro(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderIntro(text) {
    if (!text) return '';
    return text.split(/\n?---\n?/).map(function (seg) {
      var esc = escapeIntro(seg);
      // 支持简介里的图片 markdown：![alt](url) —— 仅对受控模式插入 <img>，
      // 文本先经 escapeIntro 转义，故其余内容里的 < > & 已被中和，安全。
      var html = esc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
        return '<img class="intro-img" alt="' + alt + '" src="' + url + '" />';
      });
      // 支持 **文字** 加粗（inline，安全：先转义再替换，且不会进入 <img> 标签内）
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return html;
    }).join('<hr class="modal-intro-hr">');
  }

  function openModal(index, opts) {
    opts = opts || {};
    const overlay = document.getElementById('songModal');
    const imgEl = document.getElementById('modalImg');
    const songEl = document.getElementById('modalSong');
    const singerEl = document.getElementById('modalSinger');
    const introEl = document.getElementById('modalIntro');
    if (!overlay) return;
    const d = (typeof SONG_DATA !== 'undefined' && SONG_DATA[index]) || null;

    if (imgEl) imgEl.src = IMAGE_PATHS.b[index];
    if (songEl) songEl.textContent = d ? d.song : ('第 ' + (index + 1) + ' 天');
    if (singerEl) singerEl.textContent = d ? d.singer : '';
    if (introEl) introEl.innerHTML = d ? renderIntro(d.intro) : '';
    const featEl = document.getElementById('modalFeature');
    if (featEl) {
      if (d && d.feature) { featEl.textContent = d.feature; featEl.hidden = false; }
      else { featEl.textContent = ''; featEl.hidden = true; }
    }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    modalOpen = true;
    modalIndex = index;
    renderModalLinks(d);
    // 猜一猜场景：跳转按钮下方追加「再来一轮」
    if (opts.replay) {
      const box = document.getElementById('modalLinks');
      if (box) {
        const replay = document.createElement('button');
        replay.className = 'modal-replay-btn';
        replay.innerHTML =
          '<svg class="replay-svg" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="#fff" d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5H5c0 3.87 3.13 7 7 7s7-3.13 7-7-3.13-7-7-7z"/>' +
          '</svg>' +
          '<span>再来一轮</span>';
        replay.addEventListener('click', () => {
          closeModal();
          toggleGuess();   // 关闭弹窗并自动开始新一轮猜一猜
        });
        box.appendChild(replay);
      }
    }
    updateListenButton(index);
    playDay(index);
    broadcastNotify();
  }

  // 飞回动画：克隆弹窗图片，缩小并移动到对应格子 B 面图片的位置，其余淡出
  function closeModal() {
    if (!modalOpen) return;
    const overlay = document.getElementById('songModal');
    const imgEl = document.getElementById('modalImg');
    const idx = modalIndex;
    modalOpen = false;
    modalIndex = -1;

    if (overlay) overlay.classList.add('closing');

    const targetImg = cells[idx] && cells[idx].el.querySelector('.face-b img');
    if (imgEl && targetImg && targetImg.getBoundingClientRect().width > 2) {
      const r1 = imgEl.getBoundingClientRect();
      const r2 = targetImg.getBoundingClientRect();
      const clone = document.createElement('img');
      clone.src = imgEl.src;
      // 用 left/top/width/height 做动画：四个角各自沿直线飞向棋盘对应 B 面图的四个角，
      // 缩放位移后完全重合（不做 opacity 渐隐，重合后直接移除）。
      clone.style.position = 'fixed';
      clone.style.left = r1.left + 'px';
      clone.style.top = r1.top + 'px';
      clone.style.width = r1.width + 'px';
      clone.style.height = r1.height + 'px';
      clone.style.objectFit = 'cover';
      clone.style.borderRadius = '6px';
      clone.style.margin = '0';
      clone.style.zIndex = '99999';
      clone.style.pointerEvents = 'none';
      clone.style.transition =
        'left .2s cubic-bezier(.22,1,.36,1),' +
        'top .2s cubic-bezier(.22,1,.36,1),' +
        'width .2s cubic-bezier(.22,1,.36,1),' +
        'height .2s cubic-bezier(.22,1,.36,1)';
      document.body.appendChild(clone);
      imgEl.style.visibility = 'hidden';
      // 触发一次重排，让初始位置先生效，再开始位移/缩放
      void clone.offsetWidth;
      requestAnimationFrame(() => {
        clone.style.left = r2.left + 'px';
        clone.style.top = r2.top + 'px';
        clone.style.width = r2.width + 'px';
        clone.style.height = r2.height + 'px';
      });
      clone.addEventListener('transitionend', () => clone.remove(), { once: true });
      setTimeout(() => { if (clone.parentNode) clone.remove(); }, 400);
    }

    setTimeout(() => {
      if (overlay) {
        overlay.classList.remove('closing', 'open');
        overlay.setAttribute('aria-hidden', 'true');
      }
      if (imgEl) imgEl.style.visibility = '';
    }, 220);

    // 关闭简介弹窗【不】销毁内嵌播放器，歌曲继续播放（用户要求）。
    // 真正「关掉链接 / 停止播放」由播放器自身的关闭按钮（#musicOrbClose → closeMusicBar）负责。
    // 注意：关闭弹窗时【不】重置外置听歌按钮，
    // 使其保留最近一次翻开格子对应的链接（用户要求）
  }

  function closeModalIfOpen() {
    if (modalOpen) closeModal();
  }

  // ===================== 歌曲播放槽位（点击某天即播放 / 随机播放） =====================
  // 从网易云链接里解析歌曲/歌单 id 与类型
  function neteaseInfo(url) {
    if (!url) return null;
    const m = url.match(/music\.163\.com\/(?:m\/)?(?:song|playlist)\?id=(\d+)/);
    if (!m) return null;
    const type = /playlist/.test(url) ? 1 : 2;
    return { id: m[1], type: type };
  }

  // 为某一天生成可内嵌的播放器 HTML
  function buildEmbedHtml(d) {
    // 1) 优先内嵌 B站 bvid（用户主选：点哪天播哪天的 B站音源）
    if (d && d.bvid) {
      // 用 B站桌面端 player.html：在 56px 窄框下它会自动变成「点画面=播放/暂停」的
      // 窄播放器，红色 ⏯ 引导按钮的点击穿透才能真正暂停/继续（移动端 html5mobileplayer
      // 点中心只切换控制条、不暂停，会导致红钮点了没反应）。
      // 从头播放：附 t=0 + _ts 时间戳（每次重建都用新时间戳，避免浏览器/平台缓存）。
      // 注意：B站「记忆播放」是按【登录账号】服务端记录的（设置→播放器设置→视频记忆功能），
      // 官方嵌入参数里没有可关闭它的开关；博主本人(登录态)浏览器里「看过」的视频重开仍会续播，
      // 但访客(未登录本账号)没有进度记录，永远从头播。这是平台行为，非本代码能改。
      const ts = Date.now();
      const src = 'https://player.bilibili.com/player.html?bvid=' +
                  encodeURIComponent(d.bvid) +
                  '&page=1&high_quality=1&danmaku=0&autoplay=1&t=0&_ts=' + ts;
      return '<iframe class="music-iframe" src="' + src +
             '" frameborder="0" scrolling="no" ' +
             'allow="autoplay; encrypted-media; fullscreen" ' +
             'referrerpolicy="no-referrer-when-downgrade"></iframe>';
    }
    const items = [];
    if (Array.isArray(d.links) && d.links.length) {
      d.links.forEach(it => items.push({ url: it.url, platform: it.platform }));
    } else if (d.link) {
      items.push({ url: d.link, platform: d.platform });
    }
    // 2) 否则优先内嵌可播放的网易云（单曲或歌单）
    const ne = items.find(it => it.platform === 'netease' && neteaseInfo(it.url));
    if (ne) {
      const info = neteaseInfo(ne.url);
      const src = 'https://music.163.com/outchain/player?type=' + info.type +
                  '&id=' + info.id + '&auto=1';
      return '<iframe class="music-iframe" src="' + src +
             '" frameborder="0" scrolling="no" allow="autoplay; encrypted-media"></iframe>';
    }
    // 3) 否则（B站短链 / 无内嵌源）：全部作为外链按钮
    if (items.length) {
      return items.map(it => {
        const icon = it.platform === 'bilibili' ? ICON_BILI : ICON_NETEASE;
        const txt = it.platform === 'bilibili' ? '去 B 站聆听' : '去网易云聆听';
        return '<a class="music-link-btn" href="' + it.url +
               '" target="_blank" rel="noopener"><img src="' + icon + '" alt=""/>' + txt + '</a>';
      }).join('');
    }
    return '<span class="music-empty">暂无可播放链接</span>';
  }

  // 为某一天挑选用于内嵌的 B站 bvid：
  // 若该天有多个带 bvid 的链接（如 DAY17 的 DUO / 沙龙），则随机挑一首；否则用主 bvid。
  function pickEmbedBvid(d) {
    if (!d) return null;
    const cands = [];
    if (d.bvid) cands.push(d.bvid);
    if (Array.isArray(d.links)) {
      d.links.forEach((l) => { if (l.bvid) cands.push(l.bvid); });
    }
    if (!cands.length) return null;
    return cands[Math.floor(Math.random() * cands.length)];
  }

  // 点击某一天 → 载入旋转圆播放器（封面用对应 B 面图，音频用常驻内嵌播放器）
  function playDay(index) {
    const d = (typeof SONG_DATA !== 'undefined' && SONG_DATA[index]) || null;
    const wrap = document.getElementById('musicOrbWrap');
    const orbImg = document.getElementById('musicOrbImg');
    const hidden = document.getElementById('musicHidden');
    if (!wrap || !hidden) return;
    // 同一天已在播放（关闭弹窗 / 切到碎碎念后又点回同一天）：不重建 iframe，
    // 保留当前播放进度，仅确保旋转圆展开——歌曲继续、不切歌、不从开头重播。
    if (currentDayIndex === index && hidden.querySelector('iframe')) {
      wrap.classList.add('open');
      wrap.setAttribute('aria-hidden', 'false');
      setOrbPaused(false);
      return;
    }
    // 否则重建内嵌 iframe（带 t=0），从开头播放（即「切歌」）。
    currentDayIndex = index;
    if (orbImg && typeof IMAGE_PATHS !== 'undefined') orbImg.src = IMAGE_PATHS.b[index];
    // 多 bvid 天：随机挑一首用于内嵌；网易云天（无 bvid）走原分支
    const embedBvid = pickEmbedBvid(d);
    const isBili = !!(embedBvid || (d && d.platform === 'bilibili'));
    wrap.dataset.platform = isBili ? 'bilibili' : 'netease';
    const embed = d ? buildEmbedHtml(Object.assign({}, d, { bvid: embedBvid })) : '';
    if (embed.indexOf('<iframe') >= 0) {
      // 醒目测试版迷你播放器：平台真实控件始终可见，上面叠一个明显的 ⏯ 引导按钮。
      // 引导按钮 pointer-events:none，点击会穿透到平台真实的播放 / 暂停键。
      const caption = d ? (d.singer + '《' + d.song + '》') : '';
      hidden.innerHTML =
        '<div class="mini-player">' +
          '<div class="mini-iframe-wrap">' + embed + '</div>' +
          '<div class="mini-cover"></div>' +
          '<div class="mini-blocker blk-top"></div>' +
          '<div class="mini-blocker blk-bottom"></div>' +
          '<div class="mini-blocker blk-left"></div>' +
          '<div class="mini-blocker blk-right"></div>' +
          '<div class="mini-hint">' +
            '<div class="hint-btn">' +
              '<svg class="hint-svg" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path d="M9 6.8 L17.2 12 L9 17.2 Z" fill="#fff" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>' +
              '</svg>' +
            '</div>' +
          '</div>' +
          '<div class="mini-caption">' + caption + '</div>' +
          '<div class="mini-loading-shield"></div>' +
        '</div>';
    } else {
      // 无可内嵌源（外链按钮 / 空）：直接展示，不做遮罩
      hidden.innerHTML = embed;
    }
    wrap.classList.add('open');
    wrap.setAttribute('aria-hidden', 'false');
    // B站：加载前 2 秒屏蔽点击穿透，避免点到未就绪的 iframe 而跳转到 B站页面
    if (isBili) {
      wrap.classList.add('loading');
      setTimeout(function () { wrap.classList.remove('loading'); }, 2000);
    }
    setOrbPaused(false);
    // 随机模式下手动选歌：重置随机计时，让当前这首播满
    if (randomOn) scheduleRandom();
  }

  // 旋转圆：仅表示「播放器已加载、正在转」的视觉状态（真正的暂停/继续在平台控件里）
  function setOrbPaused(paused) {
    const orb = document.getElementById('musicOrb');
    if (orb) orb.classList.toggle('paused', paused);
    orbPlaying = !paused;
  }

  // 点击旋转圆：展开 / 收起播放器面板（不销毁 iframe，故暂停/继续状态得以保留）
  function toggleOrb() {
    const wrap = document.getElementById('musicOrbWrap');
    if (!wrap || !wrap.classList.contains('open')) return;
    wrap.classList.toggle('expanded');
  }

  // 收集可作随机播放的天：优先 B站 bvid，其次可内嵌的网易云单曲/歌单
  function listPlayableDays() {
    const days = [];
    if (typeof SONG_DATA === 'undefined') return days;
    for (let i = 0; i < SONG_DATA.length; i++) {
      const d = SONG_DATA[i];
      if (d.bvid) { days.push(i); continue; }
      const items = [];
      if (Array.isArray(d.links) && d.links.length) d.links.forEach(it => items.push(it));
      else if (d.link) items.push({ url: d.link, platform: d.platform });
      if (items.some(it => it.platform === 'netease' && neteaseInfo(it.url))) days.push(i);
    }
    return days;
  }

  function scheduleRandom() {
    if (randomTimer) clearTimeout(randomTimer);
    randomTimer = setTimeout(() => {
      if (!randomOn) return;
      const days = listPlayableDays();
      if (days.length) playDay(days[Math.floor(Math.random() * days.length)]);
      scheduleRandom();
    }, RANDOM_INTERVAL);
  }

  function toggleRandom() {
    randomOn = !randomOn;
    const btn = document.getElementById('randomPlayBtn');
    if (btn) btn.classList.toggle('active', randomOn);
    if (randomOn) {
      const days = listPlayableDays();
      if (days.length) playDay(days[Math.floor(Math.random() * days.length)]);
      scheduleRandom();
    } else if (randomTimer) {
      clearTimeout(randomTimer);
      randomTimer = null;
    }
  }

  function closeMusicBar() {
    const wrap = document.getElementById('musicOrbWrap');
    const hidden = document.getElementById('musicHidden');
    const orb = document.getElementById('musicOrb');
    if (wrap) { wrap.classList.remove('open'); wrap.setAttribute('aria-hidden', 'true'); }
    if (hidden) hidden.innerHTML = '';
    if (orb) orb.classList.remove('paused');
    orbPlaying = false;
    currentDayIndex = null;
    randomOn = false;
    guessMode = false;
    guessTargetDay = -1;
    const btn = document.getElementById('guessBtn');
    if (btn) { btn.classList.remove('active'); btn.textContent = '猜一猜'; }
    hideGuessBanner();
    hideGuessToast();
    if (randomTimer) { clearTimeout(randomTimer); randomTimer = null; }
  }

  function wireModal() {
    const overlay = document.getElementById('songModal');
    const card = document.getElementById('songModalCard');
    const closeBtn = document.getElementById('modalClose');
    if (!overlay) return;
    // 点击弹窗以外的区域 → 关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    // 点击卡片内部不关闭
    if (card) card.addEventListener('click', (e) => e.stopPropagation());
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // 听歌按钮：打开当前歌曲链接
    const listenBtn = document.getElementById('listenBtn');
    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        if (listenBtn._link) {
          window.open(listenBtn._link, '_blank', 'noopener');
        }
      });
    }
  }

  // ===================== 音频 =====================
  function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const buf = new ArrayBuffer(len);
    const view = new Uint8Array(buf);
    for (let i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buf;
  }

  async function initAudio() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.5;
      gainNode.connect(audioCtx.destination);

      let arrayBuf = null;
      if (AUDIO_SRC) {
        const resp = await fetch(AUDIO_SRC);
        arrayBuf = await resp.arrayBuffer();
      } else if (AUDIO_BASE64) {
        const wavData = AUDIO_BASE64.replace(/^data:audio\/\w+;base64,/, '');
        arrayBuf = base64ToArrayBuffer(wavData);
      }
      if (arrayBuf) {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
      }
    } catch (err) {
      // 背景点击音初始化失败：静默忽略（界面不再显示音频状态提示）
    }
  }

  function startAudio() {
    if (!audioCtx || !audioBuffer || audioPlaying) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(gainNode);
    audioSource.start(0);
    audioPlaying = true;

    if (audioTimer) clearTimeout(audioTimer);
    audioTimer = setTimeout(() => stopAudio(), AUDIO_DURATION * 1000);
  }

  function stopAudio() {
    try {
      if (audioSource) {
        audioSource.stop();
        audioSource.disconnect();
        audioSource = null;
      }
    } catch (e) {}
    audioPlaying = false;
    if (audioTimer) {
      clearTimeout(audioTimer);
      audioTimer = null;
    }
  }

  function ensureAudioPlay() {
    if (!userInteracted) {
      userInteracted = true;
      startAudio();
    }
  }

  // ===================== BroadcastChannel =====================
  try {
    bc = new BroadcastChannel('blog-flip-audio');
    bc.onmessage = (e) => {
      if (e.data === 'play') stopAudio();
    };
  } catch (e) {}

  function broadcastNotify() {
    if (bc) bc.postMessage('play');
  }

  // ===================== 自动播放 =====================
  async function tryAutoPlay() {
    await initAudio();
    if (!audioCtx || !audioBuffer) return;
    try {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      startAudio();
      broadcastNotify();
    } catch (e) {
      // 浏览器阻止自动播放 - 等待用户首次交互
    }
  }

  // ===================== 键盘 =====================
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // 若漂流瓶 / 署名 / 玩法说明等其它弹窗已打开，交给它们各自的 Esc 处理，不翻回棋盘
        const otherOpen = ['driftModal', 'driftNameModal', 'howtoModal'].some(id => {
          const el = document.getElementById(id);
          return el && el.classList.contains('open');
        });
        if (otherOpen) return;
        e.preventDefault();
        if (modalOpen) {
          closeModal();
        } else {
          flipAllBackInstant();
        }
        return;
      }
      // 方向键：始终做空间焦点导航（含输入框内——输入框会保留闪烁光标，但方向键继续移动焦点，到边界即移出输入框）
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const dir = e.key === 'ArrowRight' ? 'right'
          : e.key === 'ArrowLeft' ? 'left'
          : e.key === 'ArrowDown' ? 'down' : 'up';
        const top = getTopModal();
        if (top) {
          // 有弹窗打开：方向键始终只在「最新弹出的弹窗」内导航其按钮
          e.preventDefault();
          focusInDirection(dir, top);
          return;
        }
        // 无弹窗：在当前激活页面（首页棋盘 / 碎碎念 / 留言区 / 文章详情）内移动光标
        e.preventDefault();
        focusInDirection(dir);
      }
    });
  }

  // ===================== 弹窗焦点收拢 =====================
  // 任一弹窗弹出时，把方向键光标自动收拢到「最新弹窗」的按钮上；
  // 顶层弹窗关闭后，焦点回到仍打开的下层弹窗（若有），否则回到触发它的元素。
  let modalFocusStack = [];
  function installModalFocusGuard() {
    const modals = document.querySelectorAll('.modal-overlay');
    if (!modals.length) return;
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (!t.classList || !t.classList.contains('modal-overlay')) continue;
        const wasOpen = m.oldValue ? m.oldValue.split(' ').indexOf('open') !== -1 : false;
        const nowOpen = t.classList.contains('open');
        if (nowOpen && !wasOpen) {
          modalFocusStack.push({ id: t.id, trigger: document.activeElement });
          focusFirstInModal(t);
        } else if (!nowOpen && wasOpen) {
          modalFocusStack.pop();
          const top = getTopModal();
          if (top) {
            focusFirstInModal(top);
          } else {
            const item = modalFocusStack.length ? modalFocusStack[modalFocusStack.length - 1] : null;
            const trig = item ? item.trigger : null;
            if (trig && trig.offsetParent !== null && typeof trig.focus === 'function') trig.focus();
            else if (cells[focusedIndex] && cells[focusedIndex].el) cells[focusedIndex].el.focus();
          }
        }
      }
    });
    modals.forEach(m => obs.observe(m, { attributes: true, attributeFilter: ['class'] }));
  }

  // ===================== 页面切换焦点收拢 =====================
  // 切到某个页面（碎碎念 / 留言区 / 文章详情 等）时，把光标放到该页面首个可聚焦元素上，
  // 让方向键 / 空格能直接在页面内部交互（首页则落到首格）。
  function installPageFocusGuard() {
    const secs = document.querySelectorAll('.page-section');
    if (!secs.length) return;
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (!t.classList || !t.classList.contains('page-section')) continue;
        const wasActive = m.oldValue ? m.oldValue.split(' ').indexOf('active') !== -1 : false;
        const nowActive = t.classList.contains('active');
        if (nowActive && !wasActive) {
          setTimeout(() => {
            if (getTopModal()) return; // 若同时有弹窗打开，焦点收拢交给弹窗守卫，避免抢焦点
            if (t.id === 'home') {
              if (cells[0] && cells[0].el) cells[0].el.focus();
            } else {
              const nodes = collectPageNavNodes().filter(n => t.contains(n));
              if (nodes.length) nodes[0].focus();
            }
          }, 0);
        }
      }
    });
    secs.forEach(s => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
  }

  // ===================== 公共方法 =====================
  return {
    init() {
      buildBoard();
      bindKeyboard();
      installModalFocusGuard();
      installPageFocusGuard();
      wireModal();
      tryAutoPlay();
      // 默认显示网易云图标
      const ic = document.getElementById('listenIcon');
      if (ic) ic.style.backgroundImage = "url('" + ICON_NETEASE + "')";
      // 若自动播放被阻止，首次点击/按键时开始
      document.addEventListener('click', () => ensureAudioPlay(), { once: true });
      document.addEventListener('keydown', () => ensureAudioPlay(), { once: true });

      // 播放槽（左上角旋转圆）：猜一猜 / 关闭 / 点击圆暂停继续
      const guessBtn = document.getElementById('guessBtn');
      if (guessBtn) guessBtn.addEventListener('click', toggleGuess);
      const driftBtn = document.getElementById('driftBtn');
      if (driftBtn) driftBtn.addEventListener('click', toggleDrift);
      const orbClose = document.getElementById('musicOrbClose');
      if (orbClose) orbClose.addEventListener('click', closeMusicBar);
      const orb = document.getElementById('musicOrb');
      if (orb) orb.addEventListener('click', toggleOrb);
    },
    flipAllBack,
    stopAudio,
    playDay,
    openModal,
    toggleGuess,
    toggleDrift,
    closeMusicBar,
    playAudio() {
      ensureAudioPlay();
      broadcastNotify();
    }
  };
})();
