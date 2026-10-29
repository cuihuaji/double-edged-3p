/* Double Edged 锁步联机（方案 D）
 *
 * 两端各跑一份游戏，网络只传「第 N 帧按了哪些键 / 点了哪里」。
 * 游戏已被改造为可播种 + 固定步长 + 手动推进，同输入必然同画面。
 *
 * 三条铁律：
 *   1. 一帧内「先应用输入、再推进」，顺序两端完全一致
 *   2. 输入带固定延迟（默认 6 帧 = 200ms），吸收抖动
 *   3. 两端都拿到第 N 帧的输入才推进第 N 帧（帧闸门）
 */
(function (global) {
  "use strict";

  const P1 = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyN", "KeyM"];
  const P2 = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyG", "KeyH"];
  const P3 = ["KeyI", "KeyK", "KeyJ", "KeyL", "KeyO", "KeyP"];
  const ALL = P1.concat(P2, P3);
  const BIT = {};
  ALL.forEach((k, i) => (BIT[k] = 1 << i));

  const DELAY_MIN = 1;      // 33ms：理论下限。网络允许时就是它，手感最接近单人
  const DELAY_MAX = 6;      // 200ms：网络差时的兜底
  const DEFAULT_DELAY = DELAY_MIN;

  function Lock(opts) {
    this.side = opts.side;
    this.seed = opts.seed >>> 0;
    // 可用 ?delay=N 覆盖（两端要一致）
    const qd = Number(new URLSearchParams(location.search).get("delay"));
    this.delay = opts.delay || (qd > 0 && qd <= 20 ? qd : DEFAULT_DELAY);
    this.maxFps = opts.maxFps || 30;      // 硬上限：绝不自由空转
    this.delayMin = DELAY_MIN;
    this.delayMax = DELAY_MAX;
    this._waitEma = 0;                    // 平均等待对端输入的毫秒数
    this._waitSince = 0;
    this.frame = opts.frame;
    this.log = opts.log || function () {};
    this.diag = opts.diag || function () {};   // (code, msg, detail, sev)

    this.pc = null;
    this.dc = null;
    this.L = null;

    this.held = 0;
    this.prevFull = 0;
    this.pend = new Map();      // frame -> 鼠标事件
    this.own = new Map();
    this.sentUpTo = -1;        // 输入帧一旦发出就不再修改（防止两岸取值不同）
    this.rem = new Map();
    this.myHash = new Map();
    this.peerHash = new Map();
    this.crem = new Map();      // 应答方：房主下发的帧记录
    this.judged = new Set();
    this.next = 0;
    this.desync = 0;
    this.started = false;
    this.linked = false;        // 传输层是否已连通（WebRTC 或 PeerJS）
    this.transports = [];       // 多条连接（三人模式：房主接两条）
    this.expectPeers = opts.expectPeers || 1;   // 房主需要等几条连接
    this.peerNeed = 0;          // 每帧至少要收到几路对端输入
    this.peerReady = false;
    this.stats = { fps: 0, frames: 0, rtt: 0, desync: 0 };

    this._lastTick = Date.now();
    this._tickCount = 0;
    this._bind();

    // 就绪条件可能晚到（游戏载入慢、通道慢），必须轮询重试
    const self = this;
    this._readyT = setInterval(function () { self._maybeStart(); }, 300);
  }

  Lock.prototype.KEYS = function () { return this.side === "p1" ? P1 : P2; };

  /* ---------- 绑定游戏 iframe 与本机输入 ---------- */
  Lock.prototype._bind = function () {
    const self = this;
    const iframe = this.frame;
    if (!iframe) return;

    const wait = setInterval(function () {
      try {
        const w = iframe.contentWindow;
        if (w && w.__lock) {
          self.L = w.__lock;
          // 注意：这里不暂停 iframe 的自驱动——Ruffle 初始化依赖 RAF 消费，
          // 过早停转会让 RAF 注册链断掉。等锁步真正起跑时（_maybeStart）再停。
          clearInterval(wait);
          self.log("游戏已载入");
          self._maybeStart();
        }
      } catch (e) {}
    }, 150);
    setTimeout(function () {
      if (!self.L) self.diag("game", "游戏 45 秒内未就绪", "可能是资源加载失败或 iframe 被拦", "err");
    }, 45000);

    // 键盘：外层页面持焦点
    const onKey = (isDown) => (e) => {
      const code = e.code;
      if (!BIT[code]) return;
      if (self.KEYS().indexOf(code) < 0) return;
      e.preventDefault();
      const before = self.held;
      if (isDown) self.held |= BIT[code];
      else self.held &= ~BIT[code];
      if (before === self.held) return;

      if (self.started) {
        const target = self._planFrame();
        self._downAt = self._downAt || {};
        if (isDown) self._downAt[code] = target;
        else if (self._downAt[code] === target) {
          // 掩码模型只记状态，同帧内按下又松开会被吞掉
          self.diag("tap", "按键 " + code + " 在 " + (self.delay / 30 * 1000 | 0) + "ms 内按下又松开，这次输入会丢",
            "目标帧 " + target, "warn");
          delete self._downAt[code];
        }
        self._sendOwn(target);
      }
    };
    global.addEventListener("keydown", onKey(true), true);
    global.addEventListener("keyup", onKey(false), true);

    // 鼠标：覆盖层接管，坐标转成画布比例（两端分辨率不同也能对齐）
    const layer = document.getElementById("clicklayer");
    if (layer) {
      layer.addEventListener("pointerdown", (e) => self._mouse("md", e), true);
      layer.addEventListener("pointerup", (e) => self._mouse("mu", e), true);
      /* 远程同乐模式：好友不跑锁步，lock 永不 started，帧闸门不消费 pend。
       * 房主点击改为本地直注（applyEvents），立即生效；好友输入由 host3 转发注入。 */
      layer.addEventListener("pointerdown", (e) => {
        try {
          const d = self.frame.contentDocument, w = self.frame.contentWindow;
          const cv = d.querySelector("canvas");
          const r = cv.getBoundingClientRect();
          const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          const L = self.L;
          if (L && L.applyEvents) {
            L.applyEvents([["md", +fx.toFixed(4), +fy.toFixed(4)]]);
            setTimeout(() => { try { L.applyEvents([["mu", +fx.toFixed(4), +fy.toFixed(4)]]); } catch (e2) {} }, 60);
          }
        } catch (err) {}
      }, false);
    }
  };

  Lock.prototype._mouse = function (type, e) {
    // 只允许房主操作菜单，避免两端各点各的造成分歧
    if (this.side !== "p1") return;
    var cv = null;
    try { cv = this.frame.contentDocument && this.frame.contentDocument.querySelector("canvas"); } catch (e) {}
    const r = (cv || this.frame).getBoundingClientRect();   // 坐标基准与 play3p fireMouse 一致（canvas），否则两端错位
    if (!r.width || !r.height) return;   // 未布局：坐标必为 NaN，丢弃（否则毒帧卡死全房）
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (!isFinite(fx) || !isFinite(fy)) return;
    // 连点也要各占一帧，否则第二次点击会被定版规则丢掉
    const f = Math.max(this._planFrame(), (this._lastMouseF || 0) + 1);
    this._lastMouseF = f;
    if (!this.pend.has(f)) this.pend.set(f, []);
    this.pend.get(f).push([type, +fx.toFixed(4), +fy.toFixed(4)]);
    this.stats.clicks = (this.stats.clicks || 0) + 1;
    if (this.started) this._sendOwn(f);
  };

  /* ---------- WebRTC ---------- */
  Lock.prototype._pc = function () {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({
      iceServers: global.Net ? global.Net.ICE : [],
      bundlePolicy: "max-bundle"
    });
    // 只有发起方（房主）建通道；应答方走 ondatachannel。
    // 两端各自 createDataChannel 会产生两条互不相通的 SCTP 流，消息永远收不到。
    pc.ondatachannel = (e) => { this._wireDC(e.channel); this._maybeStart(); };
    if (this.side === "p1") {
      this._wireDC(pc.createDataChannel("lock", { ordered: true }));
    }
    this.pc = pc;
    return pc;
  };

  Lock.prototype._wireDC = function (dc) {
    const self = this;
    this.dc = dc;
    dc.onopen = function () { self._onOpen(); };
    dc.onclose = function () { self.diag("dc", "数据通道已断开", "readyState=" + dc.readyState, "err"); };
    dc.onerror = function (e) { self.diag("dc", "数据通道出错", (e && e.message) || "", "err"); };
    dc.onmessage = function (ev) {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      self._onMsg(m);
    };
  };

  Lock.prototype._onOpen = function () {
    if (this._readyCount() < this.expectPeers) return;   // 三人模式要等两条连接
    this.linked = true;
    this.log("点对点已连通");
    this._maybeStart();
  };

  Lock.prototype._onMsg = function (m, sid) {
    const self = this;
    if (m.t === "m") {
      sid = sid || "peer0";   // 单连接路径（无 attachTransport 的 sid）也能归档
      // 多条连接：同一帧的输入要合并（三人模式下来自两个好友）
      const cur = self.rem.get(m.f);
      if (cur) {
        cur.bySid[sid] = { m: m.m, e: m.e || [] };
        cur.m = cur.m | m.m;
        cur.senders.add(sid);
      } else {
        const bySid = {};
        bySid[sid] = { m: m.m, e: m.e || [] };
        self.rem.set(m.f, { m: m.m, bySid: bySid, senders: new Set([sid]) });
      }
      // 不在这里推进：由 30Hz 节拍器统一驱动，否则本机零延迟时会疯狂空转
    } else if (m.t === "rd") {
      self.peerReady = true;
      self._maybeStart();
    } else if (m.t === "c") {
      self.crem.set(m.f, { full: m.full, ev: m.ev || [], r: m.r });
      if (m.d) self.delay = m.d;          // 延迟由房主统一决定，两端必须一致
    } else if (m.t === "h") {
      self.peerHash.set(m.f, { h: m.h, fm: m.fm });
      self._judge(m.f);
    } else if (m.t === "ping") {
      self._send({ t: "pong", ts: m.ts });
    } else if (m.t === "pong") {
      self.stats.rtt = Date.now() - m.ts;
    }
    if (m.cs) {
      const mine = self.canvasSize();
      if (mine !== "—" && m.cs !== "—" && mine !== m.cs && !self._csWarned) {
        self._csWarned = true;
        self.diag("canvas", "两端画布尺寸不同", "本端 " + mine + " / 对端 " + m.cs +
          "；画面比例不同，观感会有差异（不影响逻辑）", "warn");
      }
    }
  };

  /* 用现成传输层（PeerJS 等）代替内置 WebRTC 握手 */
  Lock.prototype.attachTransport = function (t, sid) {
    const self = this;
    sid = sid || ("peer" + this.transports.length);
    if (this.transports.length === 0) this.transport = t;   // 兼容旧的单连接路径
    const rec = { sid: sid, send: t.send, ready: !!t.ready };
    this.transports.push(rec);
    this.peerNeed = Math.max(this.peerNeed, this.transports.length);

    t.onmessage = function (obj) { self._onMsg(obj, sid); };
    t.onopen = function () { rec.ready = true; self._onOpen(); };
    t.onclose = function () { rec.ready = false; self.diag("dc", "连接 " + sid + " 断开", "", "err"); };
    if (t.ready) setTimeout(function () { rec.ready = true; self._onOpen(); }, 0);
  };

  Lock.prototype._readyCount = function () {
    let n = 0;
    for (const r of this.transports) if (r.ready) n++;
    return n;
  };

  Lock.prototype.createOffer = async function () {
    const pc = this._pc();
    await pc.setLocalDescription(await pc.createOffer());
    await global.Net.waitIce(pc, 6000);
    return await global.Net.pack(pc.localDescription.sdp);
  };

  Lock.prototype.acceptAnswer = async function (code) {
    await this.pc.setRemoteDescription({ type: "answer", sdp: await global.Net.unpack(code) });
  };

  Lock.prototype.acceptOffer = async function (code) {
    const pc = this._pc();
    await pc.setRemoteDescription({ type: "offer", sdp: await global.Net.unpack(code) });
    await pc.setLocalDescription(await pc.createAnswer());
    await global.Net.waitIce(pc, 6000);
    return await global.Net.pack(pc.localDescription.sdp);
  };

  /* ---------- 起跑同步 ---------- */
  Lock.prototype._maybeStart = function () {
    if (this.started) return;
    if (!this.L || !this.L.started) return;
    // Ruffle 版：必须等游戏真的渲染出首帧画面（解码完成）才能起跑，
    // 否则 stepOnce() 空转、三端菜单/加载进度不一致，后续必然分叉。
    if (this.L.canvasReady === false) return;
    if (!this.linked && !(this.dc && this.dc.readyState === "open")) return;
    // 先无条件宣告一次「我准备好了」，再等对方宣告。
    // 反过来写会死锁：先收到对方宣告的一方会跳过自己的宣告。
    if (!this._rdSent) { this._send({ t: "rd" }); this._rdSent = true; }
    if (!this.peerReady) return;

    clearInterval(this._readyT);
    this.started = true;
    // 起跑即对齐随机数序号：进关卡前的菜单动画在两端消耗次数可能不同，
    // 这里归零后，两边从同一起点开始抽随机数。
    try { if (this.L && this.L.resetRng) this.L.resetRng(); } catch (e) {}
    this.log("锁步开始");
    // 关键：锁步真正起跑时才停掉 iframe 的自驱动帧循环。不能提前（__lock 一出现就停）——
    // Ruffle 需要靠自驱动消费 RAF 来完成内部初始化（符号解码等），过早停转会让它的
    // RAF 注册链断掉，之后 stepOnce() 永远无帧可推（监听实测 A 端 Lf 恒为 1）。
    try {
      const w = this.frame && this.frame.contentWindow;
      if (w && w.__pauseAuto) w.__pauseAuto();
    } catch (e) {}
    // 补齐到 delay（含），否则第 delay 帧没人发，闸门会永久停在这里
    for (let i = 0; i <= this.delay; i++) this._sendOwn(i);
    this._lastTick = performance.now();
    this._startPacing();
  };

  Lock.prototype._send = function (obj) {
    if (this.transports.length) {
      for (const r of this.transports) { try { r.send(obj); } catch (e) {} }
      return;
    }
    if (this.transport) { try { this.transport.send(obj); } catch (e) {} return; }
    if (this.dc && this.dc.readyState === "open") this.dc.send(JSON.stringify(obj));
  };

  /* 下一个还能写入的帧号（帧输入一经发出即定版，永不回改） */
  Lock.prototype._planFrame = function () {
    return Math.max(this.next + this.delay, this.sentUpTo + 1);
  };

  Lock.prototype._sendOwn = function (f) {
    if (f < this.next) return;      // 已经过去的帧
    if (f <= this.sentUpTo) return; // 已定版，不再回改
    // slice：本地留快照，之后往 pend 里追加也不会改变已发出的内容
    const e = (this.pend.get(f) || []).slice();
    this.own.set(f, { m: this.held, e: e });
    this._send({ t: "m", f: f, m: this.held, e: e });
    this.sentUpTo = f;
  };

  /* ---------- 帧闸门：一次只推进一帧 ---------- */
  /* 应用一批事件并推进一步，两端走同一条路径，保证完全一致 */
  Lock.prototype._applyAndStep = function (f, evts, full) {
    this.prevFull = full;
    try {
      if (evts && evts.length) this.L.applyEvents(evts);
    } catch (err) {
      // 事件回放失败不能拖死全房：跳过事件继续推帧（少一次点击 << 全房冻结）
      this.diag("input", "第 " + f + " 帧事件回放失败，已跳过", (err && err.message) || String(err), "warn");
    }
    try {
      this.L.stepOnce();
    } catch (err) {
      this.diag("input", "推进第 " + f + " 帧时抛错", (err && err.message) || String(err), "err");
      return false;
    }
    this.next++;
    this.stats.frames = this.next;
    this.lastQLen = this.L.qLen;

    // 两端都要持续上报自己的输入帧：房主要用它们合成，好友要供给房主
    // 兜底：delay 波动或消息丢失可能让某帧的输入永远缺位（三人模式死锁实证），
    // 这里把 next..next+delay 之间所有未定版的帧全部补发一遍。
    for (let i = this.next; i <= this.next + this.delay; i++) {
      if (!this.own.has(i) || i > this.sentUpTo) this._sendOwn(i);
    }

    if (f % 30 === 0 && this.expectPeers <= 1) {   // 三人模式不做像素比对（多路哈希会互相覆盖）
      const h = this.L.hash();
      this.myHash.set(f, { h: h, fm: full, qn: this.L.qLen });
      this._send({ t: "h", f: f, h: h, fm: full, qn: this.L.qLen });
      this._judge(f - 1); this._judge(f); this._judge(f + 1);
      if (this.myHash.size > 16) {
        const cut = f - 16;
        for (const k of this.myHash.keys()) if (k < cut) this.myHash.delete(k);
        for (const k of this.peerHash.keys()) if (k < cut) this.peerHash.delete(k);
        for (const k of this.judged) if (k < cut) this.judged.delete(k);
      }
    }
    if (f % 120 === 0) {
      for (const k of this.own.keys()) if (k < this.next - 2) this.own.delete(k);
      for (const k of this.rem.keys()) if (k < this.next - 2) this.rem.delete(k);
      for (const k of this.crem.keys()) if (k < this.next - 2) this.crem.delete(k);
      for (const k of this.pend.keys()) if (k < this.next - 2) this.pend.delete(k);
    }
    return true;
  };

  Lock.prototype._pumpOnce = function () {
    if (!this.started) return false;
    const f = this.next;

    /* 好友：只照抄房主下发的记录，不自己算，杜绝两端算出不同结果 */
    if (this.side === "p2") {
      const rec = this.crem.get(f);
      if (!rec) {
        if (!this._waitSince) this._waitSince = performance.now();
        return false;
      }
      if (this._waitSince) {
        const w = performance.now() - this._waitSince;
        this._waitEma = this._waitEma * 0.85 + w * 0.15;
        this._waitSince = 0;
      }
      // 关键：本帧开始前把随机数序号对齐到房主的数值
      if (rec.r !== undefined && this.L && typeof this.L.randCalls === "number") {
        this.L.randCalls = rec.r;
      }
      return this._applyAndStep(f, rec.ev, rec.full);
    }

    /* 房主：收集各方输入（自己 + 所有好友），合成这一帧的记录并下发 */
    const rec0 = this.rem.get(f);
    const need = Math.max(1, this.peerNeed);
    if (!this.own.has(f) || !rec0 || rec0.senders.size < need) {
      if (!this.own.has(f)) this._ownMiss = (this._ownMiss || 0) + 1;
      else if (!this._waitSince) this._waitSince = performance.now();
      return false;
    }
    if (this._waitSince) {
      const w = performance.now() - this._waitSince;
      this._waitEma = this._waitEma * 0.85 + w * 0.15;
      this._waitSince = 0;
    }
    const a = this.own.get(f);
    const b = rec0;
    const full = a.m | b.m;

    const evts = [];
    let mouse = a.e.slice();
    const sids = Object.keys(b.bySid || {}).sort();     // 固定顺序，避免到达顺序不同
    for (const k of sids) mouse = mouse.concat(b.bySid[k].e || []);
    for (let i = 0; i < mouse.length; i++) evts.push(mouse[i]);
    for (let i = 0; i < ALL.length; i++) {
      const bit = 1 << i;
      const was = !!(this.prevFull & bit);
      const now = !!(full & bit);
      if (was !== now) evts.push([now ? "d" : "u", ALL[i]]);
    }

    this._send({ t: "c", f: f, full: full, ev: evts, r: (this.L ? this.L.randCalls : 0), d: this.delay });
    return this._applyAndStep(f, evts, full);
  };

  /* 节拍器：固定 30 帧/秒，一帧都不许超。这是防止 CPU 被吃满的关键。 */
  Lock.prototype._startPacing = function () {
    if (this._paceOn) return;
    this._paceOn = true;
    const self = this;
    const maxFps = this.maxFps || 30;
    const interval = 1000 / maxFps;

    /* 用累加器而不是「now - last ≥ interval」：
       后者一旦某次 rAF 晚了 40ms，就会跳过这一帧、永不补偿，表现为规律性顿挫。
       累加器会把这 40ms 记在账上，下一帧补回来（最多补 2 帧，防止雪崩）。 */
    let acc = 0;
    let prev = performance.now();
    this._lastTick = prev;

    function tick() {
      if (!self._paceOn) return;
      const now = performance.now();
      let dt = now - prev;
      prev = now;
      if (dt > 200) dt = interval;      // 切标签页/长时间卡顿后不追赶
      acc += dt;

      let stepped = false;
      let guard = 0;
      while (acc >= interval && guard < 2) {
        acc -= interval;
        guard++;
        if (self._pumpOnce()) {
          stepped = true;
        } else {
          acc = 0;                       // 闸门没开，别空转
          break;
        }
      }

      // 帧闸门卡住：只有"已经开始锁步"才算问题
      if (stepped) { self._stallFrom = 0; self._stallReported = false; }
      else if (self.started) {
        if (!self._stallFrom) self._stallFrom = now;
        else if (now - self._stallFrom > 600 && !self._stallReported) {
          self._stallReported = true;
          let why = "未知";
          if (!self.own.has(self.next)) why = "本端第 " + self.next + " 帧输入还没生成";
          else if (!self.rem.has(self.next)) why = "等对端第 " + self.next + " 帧输入（对端可能卡住或掉线）";
          self.diag("stall", "帧闸门卡住 " + Math.round(now - self._stallFrom) + "ms", why, "warn");
        }
      }

      /* 自适应延迟：等待时间长了就加一帧。
         只由房主决策，好友通过帧记录里的 d 字段跟随，保证两端一致。
         注意：只增不减——实测 delay 回调会让各端 _sendOwn(next+delay) 的帧序出现
         跳档/回退，sentUpTo 与 own 脱节后帧闸门死锁（三人模式监听实证）。 */
      if (self.side === "p1" && now - (self._lastAdj || 0) > 2000) {
        self._lastAdj = now;
        const w = self._waitEma;
        if (w > 25 && self.delay < self.delayMax) {
          self.delay++;
          self.log("延迟上调 -> " + self.delay + " 帧（平均等待 " + Math.round(w) + "ms）");
        }
        self._waitEma = w * 0.5;
      }

      // 统计与心跳（每秒一次）
      self._tickCount++;
      if (now - self._lastTick >= 1000) {
        self.stats.fps = Math.round((self._tickCount * 1000) / (now - self._lastTick));
        self._tickCount = 0;
        self._lastTick = now;
        self._send({ t: "ping", ts: Date.now(), cs: self.canvasSize() });
        if (self.stats.fps < 20) self._lowFps = (self._lowFps || 0) + 1;
        else self._lowFps = 0;
        if (self._lowFps === 3) {
          self.diag("fps", "帧率偏低：" + self.stats.fps + " fps",
            "游戏原生 30 fps；低于 20 会明显卡顿", "warn");
        }
      }

      /* 节拍源：Web Worker 的 setInterval 不受后台标签 1Hz 节流影响。
         主线程 setInterval 在标签切后台会被 Chrome 压到 1Hz，锁步直接掉到 1fps
         （线上实测：房主切窗口回消息，全房跟着卡成幻灯片）。Worker 不受限。 */
    }
    try {
      const workerCode =
        "let t=null;" +
        "onmessage=function(e){" +
        "  if(e.data==='start'){ if(!t) t=setInterval(()=>postMessage(1), " + interval + "); }" +
        "  else if(e.data==='stop'){ if(t){clearInterval(t);t=null;} }" +
        "};";
      const blob = new Blob([workerCode], { type: "application/javascript" });
      this._paceWorker = new Worker(URL.createObjectURL(blob));
      this._paceWorker.onmessage = function () { tick(); };
      this._paceWorker.postMessage("start");
      this._paceTimer = null;   // Worker 模式下不用主线程定时器
    } catch (e) {
      // Worker 不可用（file:// 等极端环境）：退回主线程 setInterval
      this._paceTimer = setInterval(tick, interval);
    }
  };

  Lock.prototype.stop = function () {
    this._paceOn = false;
    clearInterval(this._readyT);
    if (this._paceTimer) clearInterval(this._paceTimer);
    if (this._paceWorker) { try { this._paceWorker.postMessage("stop"); this._paceWorker.terminate(); } catch (e) {} }
    if (this.pc) { try { this.pc.close(); } catch (e) {} }
  };

  /* ---------- 一致性判定 ----------
   * 两侧的画面各自独立渲染，很可能相差一帧（同一逻辑状态，渲染时刻差一拍）。
   * 静止画面下这种偏移看不出来，有动画就会表现为「部分帧对不上」。
   * 所以只在 f-1 / f / f+1 都对不上时才记为真偏离。
   */
  Lock.prototype._judge = function (f) {
    if (this.judged.has(f)) return;
    const peer = this.peerHash.get(f);
    if (!peer) return;
    const cand = [f - 1, f, f + 1].filter((k) => this.myHash.has(k));
    if (cand.length < 3) return;                 // 我这边的邻帧还没算出来，等

    for (const k of cand) {
      if (this.myHash.get(k).h === peer.h) { this.judged.add(f); return; }
    }
    this.judged.add(f);
    this.desync++;
    this.stats.desync = this.desync;

    const mineFm = this.myHash.get(f).fm;
    let kind;
    if (peer.fm === undefined) { kind = "对端未上报输入掩码"; this.desyncKind = "?"; }
    else if (peer.fm === mineFm) { kind = "输入一致 → 模拟分叉"; this.desyncKind = "模拟"; }
    else { kind = "输入不一致 → 同步层问题"; this.desyncKind = "输入"; }
    const mineQ = (this.myHash.get(f) || {}).qn;
    this.lastDesync = f + "：" + kind;
    this.diag("pixel", "第 " + f + " 帧画面像素不同（可能是渲染相位，未必影响逻辑）",
      kind + "｜掩码 " + mineFm + "/" + peer.fm + "｜单步回调数 " + mineQ + "/" + peer.qn, "warn");
  };

  /* 画布尺寸（两端应一致，不一致说明窗口大小不同） */
  Lock.prototype.canvasSize = function () {
    const c = this.L && this.L.canvas();
    return c ? c.width + "×" + c.height : "—";
  };

  /* 外部手动比对（测试用） */
  Lock.prototype.hashNow = function () {
    return { frame: this.next - 1, h: this.L ? this.L.hash() : 0 };
  };

  global.Lock = Lock;
})(window);
