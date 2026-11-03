/* ============ 手机端「自动横屏 + 全屏」管理器 ============
 * host-phone.html / phone.html 共用。
 *
 * 为什么必须进 Fullscreen：地址栏和状态栏是页面上唯一没法用 CSS 去掉的东西——它们占的就是
 * 「横屏时浏览器边框」那一条。只有 Fullscreen API 能把它们收起来；随后才能 lock("landscape")。
 *
 * 几条硬约束（都是浏览器定的，不是我们能改的）：
 *  1) 全屏必须由用户手势触发。所以不在 load 时硬试，而是等第一次「抬起」（pointerup /
 *     touchend / click）——用抬起而不是按下，是为了不打断正在进行的那一次按键或点击。
 *  2) 方向锁只在全屏里有效，且只有 Android Chrome 支持；iOS Safari 不支持元素全屏，
 *     只提示「添加到主屏幕」。
 *  3) 用户手动退出全屏后不再自动进（记 localStorage de_fs_auto=0）；点按钮可恢复自动。
 *
 * 入口：
 *   DEFs.request() / DEFs.exit() / DEFs.toggle() / DEFs.isFull()
 *   DEFs.attach(btn)     把一个按钮接成「全屏 / 退出全屏」开关
 *   DEFs.hint()          不支持全屏时给出人话提示
 * 参数：?fs=0 关自动，?fs=1 加载后就试一次
 */
(function () {
  "use strict";
  if (window.DEFs) return;

  var Q = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { Q[k] = v; }); } catch (e) {}

  var el = document.documentElement;
  var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  var exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  var supported = !!req;

  var AKEY = "de_fs_auto";
  var autoOn = true;
  try { if (localStorage.getItem(AKEY) === "0") autoOn = false; } catch (e) {}
  if (Q.fs === "0") autoOn = false;

  var standalone = false;
  try {
    standalone = (window.navigator.standalone === true) ||
      !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  } catch (e) {}

  function isFull() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  function lock() {
    try {
      var so = screen.orientation;
      if (so && so.lock) {
        var p = so.lock("landscape");
        if (p && p.catch) p.catch(function () {});
      } else if (screen.lockOrientation) {
        screen.lockOrientation("landscape");
      } else if (screen.mozLockOrientation) {
        screen.mozLockOrientation("landscape");
      }
    } catch (e) {}
  }

  function unlock() {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
  }

  function request() {
    if (!supported) { hint(); return Promise.resolve(false); }
    if (isFull()) { lock(); return Promise.resolve(true); }
    var p = null;
    try { p = req.call(el, { navigationUI: "hide" }); }
    catch (e) { try { p = req.call(el); } catch (e2) { p = null; } }
    if (p && p.then) {
      return p.then(function () { lock(); return true; }, function () { return false; });
    }
    lock();
    return Promise.resolve(isFull());
  }

  function exit() {
    try { if (isFull() && exitFn) exitFn.call(document); } catch (e) {}
  }

  function toggle() { return isFull() ? (exit(), Promise.resolve(false)) : request(); }

  function setAuto(v) {
    autoOn = !!v;
    try { localStorage.setItem(AKEY, autoOn ? "1" : "0"); } catch (e) {}
  }

  /* 全屏不可用（iOS Safari）时的一次性提示 */
  function hint() {
    try {
      if (hint.shown) return;
      hint.shown = true;
      var d = document.createElement("div");
      d.id = "de-fs-hint";
      d.textContent = standalone
        ? "已经是全屏显示了"
        : "这版 Safari 不支持网页全屏：点「分享」→ 添加到主屏幕，从桌面图标打开就没有地址栏了";
      d.style.cssText =
        "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom, 0px) + 82px);transform:translateX(-50%);" +
        "z-index:10060;max-width:86vw;padding:9px 14px;border-radius:10px;background:rgba(8,12,18,.92);" +
        "color:#dfe8f2;font:12.5px/1.55 'Microsoft YaHei',system-ui,sans-serif;text-align:center;" +
        "border:1px solid rgba(120,190,255,.35);pointer-events:none;transition:opacity .35s linear";
      document.body.appendChild(d);
      setTimeout(function () { d.style.opacity = "0"; }, 5600);
      setTimeout(function () { try { d.parentNode.removeChild(d); } catch (e) {} }, 6200);
    } catch (e) {}
  }

  /* ---- 第一次抬手后自动进全屏 ---- */
  var armed = autoOn && supported && !isFull();
  function onUp() {
    if (!armed) return;
    armed = false;
    request().then(function (ok) {
      if (!ok) setTimeout(function () { armed = true; }, 500);   /* 失败就等下一次抬手 */
    });
  }
  ["pointerup", "touchend", "click"].forEach(function (t) {
    try { window.addEventListener(t, onUp, { capture: true, passive: true }); } catch (e) {}
  });

  function onChange() {
    if (isFull()) {
      lock();
    } else {
      unlock();
      /* 用户自己退出的，就不要每次抬手又弹回去 */
      if (!window.__deFsManual) setAuto(false);
    }
  }
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);

  try {
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", function () { if (isFull()) lock(); });
    }
  } catch (e) {}

  function attach(btn) {
    if (!btn) return btn;
    btn.addEventListener("click", function (e) {
      try { e.stopPropagation(); } catch (e2) {}
      window.__deFsManual = true;
      if (!isFull()) setAuto(true);
      toggle();
      setTimeout(function () { window.__deFsManual = false; }, 900);
      /* 让按钮图标跟状态走 */
      setTimeout(paint, 260); setTimeout(paint, 900);
    });
    function paint() {
      btn.textContent = isFull() ? "⛉" : "⛶";
      btn.title = isFull() ? "退出全屏" : "全屏并锁定横屏";
    }
    paint();
    document.addEventListener("fullscreenchange", paint);
    document.addEventListener("webkitfullscreenchange", paint);
    return btn;
  }

  window.DEFs = {
    request: request, exit: exit, toggle: toggle, isFull: isFull,
    supported: supported, standalone: standalone,
    auto: function () { return autoOn; }, setAuto: setAuto,
    attach: attach, hint: hint, lock: lock
  };

  if (Q.fs === "1") setTimeout(function () { request(); }, 700);
})();
