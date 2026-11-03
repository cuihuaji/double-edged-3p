/* ============ 虚拟摇杆（替代十字键） ============
 * host-phone.html / phone.html 共用。库（ruffle-touch）只有十字热区
 * （dpad-btn / dpad-diag / dpad-center），摇杆要的是「任意落点 + 连续拖动」，
 * 热区模型不一样，所以另起一层；但按键分发通道和库一模一样：
 *   window.dispatchEvent(new KeyboardEvent("keydown"|"keyup", { code, key, keyCode, which }))
 * 房主页由自己的 P1KEYS 监听接走，好友端由自己的转发层接走 —— 既有逻辑一行不改。
 *
 * 手感约定：
 *   - 死区 22% 半径：手指轻搭在中间不触发方向（防止误走）
 *   - 8 扇区：正方向 ±22.5° 只按一个键；斜向同时按两个键（游戏用 customDown 读，两个键=斜走）
 *   - 换向只发「变化」：先松后按，不会把已经按住的键重复擦一遍
 *   - 滑动半径夹到 1.0R，手指滑出圆外仍然保持方向；抬起/取消全部松开
 *   - 落点即生效（不用先找到圆心），和 Nitrome Touchy 的 snap 思路一致
 *
 * 开关：?stick=0 用回十字键，?stick=1 强制摇杆；选择记在 localStorage de_stick
 */
(function () {
  "use strict";
  if (window.DEStick) return;

  var Q = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { Q[k] = v; }); } catch (e) {}

  /* 扇区表：0=右，顺时针每 45° 一格（屏幕坐标 y 向下） */
  var SECT = [
    ["right"], ["down", "right"], ["down"], ["down", "left"],
    ["left"], ["up", "left"], ["up"], ["up", "right"]
  ];

  var DEFAULTS = {
    up:    { key: "ArrowUp",    code: "ArrowUp",    keyCode: 38 },
    down:  { key: "ArrowDown",  code: "ArrowDown",  keyCode: 40 },
    left:  { key: "ArrowLeft",  code: "ArrowLeft",  keyCode: 37 },
    right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 }
  };

  var S = {
    el: null, knob: null, keys: DEFAULTS,
    down: { up: 0, down: 0, left: 0, right: 0 },
    pid: null, cx: 0, cy: 0, r: 0, on: true, dead: 0.22
  };

  var AKEY = "de_stick";
  function stored() {
    try { var v = localStorage.getItem(AKEY); return v === null ? null : v !== "0"; } catch (e) { return null; }
  }
  var pre = Q.stick === "0" ? false : Q.stick === "1" ? true : stored();
  S.on = pre === null ? true : pre;

  function evt(type, d) {
    if (!d) return;
    var opt = {
      key: d.key, code: d.code, keyCode: d.keyCode, which: d.keyCode,
      bubbles: true, cancelable: true, composed: true
    };
    try { window.dispatchEvent(new KeyboardEvent(type, opt)); } catch (e) {}
  }

  function setDirs(list) {
    var want = {};
    for (var i = 0; i < list.length; i++) want[list[i]] = 1;
    /* 先松后按：斜向切向斜向时不会出现「一直按着」的残留 */
    for (var k in S.down) {
      if (S.down[k] && !want[k]) { S.down[k] = 0; evt("keyup", S.keys[k]); }
    }
    for (var k2 in want) {
      if (!S.down[k2]) { S.down[k2] = 1; evt("keydown", S.keys[k2]); }
    }
  }

  function releaseAll() { setDirs([]); S.pid = null; if (S.el) S.el.classList.remove("active"); knobTo(0, 0); }

  function knobTo(dx, dy) {
    if (!S.knob) return;
    S.knob.style.transform = "translate(calc(-50% + " + dx.toFixed(1) + "px), calc(-50% + " + dy.toFixed(1) + "px))";
  }

  function geom() {
    var b = S.el.getBoundingClientRect();
    S.cx = b.left + b.width / 2;
    S.cy = b.top + b.height / 2;
    S.r = Math.min(b.width, b.height) / 2;
  }

  function track(x, y) {
    if (!S.el) return;
    var dx = x - S.cx, dy = y - S.cy;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    /* 角标：拖动过远时视觉上夹住，方向仍然有效 */
    var vis = Math.min(dist, S.r * 0.62);
    knobTo(dx / dist * vis, dy / dist * vis);

    if (dist < S.r * S.dead) { setDirs([]); return; }
    var deg = Math.atan2(dy, dx) * 180 / Math.PI;      /* -180..180，0=右 */
    var sec = Math.round(deg / 45);
    if (sec < 0) sec += 8;
    if (sec > 7) sec -= 8;
    setDirs(SECT[sec]);
  }

  function onDown(e) {
    if (!S.on || S.pid !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    S.pid = e.pointerId;
    S.el.classList.add("active");
    try { S.el.setPointerCapture(e.pointerId); } catch (e2) {}
    geom();
    track(e.clientX, e.clientY);
  }
  function onMove(e) {
    if (S.pid === null || e.pointerId !== S.pid) return;
    geom();
    track(e.clientX, e.clientY);
  }
  function onUp(e) {
    if (S.pid === null) return;
    if (e && e.pointerId !== undefined && e.pointerId !== S.pid) return;
    releaseAll();
  }

  function build() {
    if (S.el) return S.el;
    var el = document.createElement("div");
    el.id = "de-stick";
    var knob = document.createElement("div");
    knob.id = "de-stick-knob";
    el.appendChild(knob);
    document.body.appendChild(el);
    S.el = el; S.knob = knob;
    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });

    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", function () { if (document.hidden) releaseAll(); });
    return el;
  }

  function css() {
    if (document.getElementById("de-stick-css")) return;
    var s = document.createElement("style");
    s.id = "de-stick-css";
    s.textContent = [
      ":root{--de-stick-s:min(34vh,17vw)}",
      "@media (orientation:portrait){:root{--de-stick-s:min(24vh,30vw)}}",
      "#de-stick{position:fixed;left:max(10px,env(safe-area-inset-left));bottom:max(6px,env(safe-area-inset-bottom));",
      "width:var(--de-stick-s);height:var(--de-stick-s);border-radius:50%;z-index:10000;touch-action:none;",
      "box-sizing:border-box;border:1px solid rgba(120,190,255,.26);",
      "background:radial-gradient(circle at 50% 50%,rgba(18,24,32,.62) 0 61%,rgba(34,44,56,.34) 62% 100%);",
      "box-shadow:inset 0 0 22px rgba(0,0,0,.5),0 6px 18px rgba(0,0,0,.35);",
      "transition:border-color .15s linear}",
      "#de-stick.active{border-color:rgba(150,215,255,.6)}",
      "#de-stick::before,#de-stick::after{content:'';position:absolute;pointer-events:none;background:rgba(150,200,255,.13)}",
      "#de-stick::before{left:50%;top:13%;width:1px;height:74%;transform:translateX(-.5px)}",
      "#de-stick::after{top:50%;left:13%;height:1px;width:74%;transform:translateY(-.5px)}",
      "#de-stick-knob{position:absolute;left:50%;top:50%;width:46%;height:46%;border-radius:50%;",
      "transform:translate(-50%,-50%);pointer-events:none;opacity:.9;transition:opacity .12s linear;",
      "background:radial-gradient(circle at 38% 32%,#eef6ff,#a8cbea 46%,#4a7fae 100%);",
      "box-shadow:0 4px 12px rgba(0,0,0,.5),inset 0 -2px 7px rgba(0,0,0,.3)}",
      "#de-stick.active #de-stick-knob{opacity:1}",
      /* 摇杆模式下把库的十字键藏掉。注意只能用 visibility，不能 display:none ——
       * 库的 .ruffle-touch-actions 是 flex 布局，十字键一旦不占位，攻/跳会整体滑到左边
       * （实测攻从 x=1120 掉到 x=67，正好压在摇杆下面，导致按攻变成摇杆的方向指令）。 */
      "html.de-stick-on .ruffle-touch-dpad{visibility:hidden !important;pointer-events:none !important}"
    ].join("");
    document.head.appendChild(s);
  }

  function apply() {
    if (!document.body) return;
    build();
    css();
    S.el.style.display = S.on ? "block" : "none";
    document.documentElement.classList.toggle("de-stick-on", S.on);
    if (!S.on) releaseAll();
  }

  window.DEStick = {
    /* keys 可只覆盖部分方向：{left:{key,code,keyCode}, ...} */
    mount: function (opt) {
      opt = opt || {};
      if (opt.keys) for (var k in opt.keys) if (opt.keys[k]) S.keys[k] = opt.keys[k];
      if (opt.deadzone) S.dead = Math.max(0.08, Math.min(0.45, opt.deadzone));
      apply();
      return this;
    },
    setEnabled: function (v, persist) {
      S.on = !!v;
      if (persist !== false) { try { localStorage.setItem(AKEY, S.on ? "1" : "0"); } catch (e) {} }
      apply();
      return S.on;
    },
    enabled: function () { return S.on; },
    releaseAll: releaseAll
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
