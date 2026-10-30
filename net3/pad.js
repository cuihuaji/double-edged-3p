/* 手机触屏手柄
 * ------------------------------------------------------------------
 * 布局照 Nitrome 官方 Touchy 版 Double Edged：
 *   左手边一个十字方向键；右手边两个圆钮 —— 下面那颗是攻击，上面那颗是跳，
 *   两颗一起按 = 必杀（游戏里本来就是「攻击+跳同时按下」触发，不用特判）。
 * 机制照 Clay.io 的 html5-virtual-game-controller：
 *   不给每个按钮单独绑事件，而是每来一次触摸就把它和「各区域矩形」做命中判定。
 *   这样手指从「左」滑到「右」会先松左再按右，和实体十字键一致；
 *   多指也天然正确（每个 pointerId 各记各的）。
 * 只有在触摸设备上才出现，`?pad=1` 可强制显示（桌面调试用）。
 */
(function () {
  "use strict";

  var CSS = [
    "#de-pad{position:fixed;inset:0;z-index:9998;touch-action:none;-webkit-user-select:none;user-select:none;",
    "  -webkit-tap-highlight-color:transparent;overflow:hidden}",
    "#de-pad .z{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;",
    "  background:rgba(12,18,26,.34);border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.82);",
    "  font:600 clamp(14px,3.1vmin,26px)/1 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;",
    "  text-shadow:0 1px 3px rgba(0,0,0,.75);transition:background .06s linear,transform .06s linear}",
    "#de-pad .z.on{background:rgba(120,190,255,.55);border-color:rgba(255,255,255,.7);transform:scale(.96)}",
    "#de-pad .rnd{border-radius:50%}",
    "#de-pad .glow{position:absolute;width:88px;height:88px;margin:-44px 0 0 -44px;border-radius:50%;",
    "  pointer-events:none;background:radial-gradient(circle,rgba(140,200,255,.34),rgba(140,200,255,0) 70%);",
    "  opacity:0;transition:opacity .12s linear}",
    "#de-pad .hint{position:absolute;left:50%;top:6px;transform:translateX(-50%);padding:4px 10px;",
    "  border-radius:8px;background:rgba(0,0,0,.55);color:#dfe8f2;font:12px/1.4 'Microsoft YaHei',sans-serif;",
    "  white-space:nowrap;opacity:.9;pointer-events:none}"
  ].join("");

  function isTouch() {
    try {
      return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    } catch (e) { return false; }
  }

  /* 把「元素里的实际画面区」换成 0..1 坐标。
   * 视频是 object-fit:contain、iframe 里画布是 880×640，都会留黑边，
   * 所以按宽高比算内接矩形，不能直接用元素矩形（否则点菜单会偏）。 */
  function containRect(el, aspect) {
    var r = el.getBoundingClientRect();
    var w = r.width, h = r.height;
    if (!(w > 0 && h > 0)) return null;
    if (!aspect || !(aspect > 0)) return { left: r.left, top: r.top, width: w, height: h };
    var boxA = w / h;
    if (boxA > aspect) {
      var w2 = h * aspect;
      return { left: r.left + (w - w2) / 2, top: r.top, width: w2, height: h };
    }
    var h2 = w / aspect;
    return { left: r.left, top: r.top + (h - h2) / 2, width: w, height: h2 };
  }

  window.DE_PAD = function (opts) {
    opts = opts || {};
    var force = /[?&]pad=1/.test(location.search);
    if (!force && !isTouch()) return null;
    if (document.getElementById("de-pad")) return window.__dePad || null;

    var keys = {
      up: opts.up || "ArrowUp",
      down: opts.down || "ArrowDown",
      left: opts.left || "ArrowLeft",
      right: opts.right || "ArrowRight",
      attack: opts.attack || "KeyN",
      jump: opts.jump || "KeyM"
    };
    var labels = opts.labels || { attack: "攻", jump: "跳" };

    var st = document.createElement("style");
    st.id = "de-pad-style";
    st.textContent = CSS;
    document.head.appendChild(st);

    var root = document.createElement("div");
    root.id = "de-pad";

    /* 尺寸都按 vmin 走：横屏手机 vmin=高度，换机型不用改代码 */
    var defs = [
      { id: "up", text: "▲", css: "left:14vmin;bottom:28vmin;width:14vmin;height:14vmin;border-radius:4vmin 4vmin 0 0" },
      { id: "down", text: "▼", css: "left:14vmin;bottom:0;width:14vmin;height:14vmin;border-radius:0 0 4vmin 4vmin" },
      { id: "left", text: "◀", css: "left:0;bottom:14vmin;width:14vmin;height:14vmin;border-radius:4vmin 0 0 4vmin" },
      { id: "right", text: "▶", css: "left:28vmin;bottom:14vmin;width:14vmin;height:14vmin;border-radius:0 4vmin 4vmin 0" },
      { id: "attack", text: labels.attack, css: "right:4vmin;bottom:4vmin;width:22vmin;height:22vmin", rnd: true },
      { id: "jump", text: labels.jump, css: "right:28vmin;bottom:18vmin;width:22vmin;height:22vmin", rnd: true }
    ];
    var els = {};
    defs.forEach(function (d) {
      var el = document.createElement("div");
      el.className = "z" + (d.rnd ? " rnd" : "");
      el.style.cssText = d.css;
      el.textContent = d.text;
      root.appendChild(el);
      els[d.id] = el;
    });
    var glow = document.createElement("div");
    glow.className = "glow";
    root.appendChild(glow);
    if (opts.hint) {
      var h = document.createElement("div");
      h.className = "hint";
      h.textContent = opts.hint;
      root.appendChild(h);
      setTimeout(function () { try { h.remove(); } catch (e) {} }, 6000);
    }
    document.body.appendChild(root);

    /* 区域矩形：只算一次 + 尺寸变化时重算（命中判定用它，不用元素事件） */
    var rects = {};
    function measure() {
      Object.keys(els).forEach(function (k) {
        var r = els[k].getBoundingClientRect();
        rects[k] = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      });
    }
    measure();
    var remeasured = 0;
    window.addEventListener("resize", function () {
      measure();
      if (++remeasured < 20) setTimeout(measure, 250);
    });
    window.addEventListener("orientationchange", function () { setTimeout(measure, 350); });

    function hit(x, y) {
      var found = null;
      Object.keys(rects).forEach(function (k) {
        var r = rects[k];
        if (x >= r.l && x <= r.r && y >= r.t && y <= r.b) found = k;
      });
      return found;
    }

    var down = {};       /* pointerId -> zone */
    var started = {};    /* pointerId -> {x,y,t,zone} */

    function setZone(pid, zone) {
      var prev = down[pid] || null;
      if (prev === zone) return;
      if (prev) {
        try { els[prev].classList.remove("on"); } catch (e) {}
        if (opts.onKey) opts.onKey(keys[prev], false);
      }
      if (zone) {
        try { els[zone].classList.add("on"); } catch (e) {}
        if (opts.onKey) opts.onKey(keys[zone], true);
        down[pid] = zone;
      } else {
        delete down[pid];
      }
    }

    function onDown(e) {
      var x = e.clientX, y = e.clientY;
      var zone = hit(x, y);
      down[e.pointerId] = null;
      started[e.pointerId] = { x: x, y: y, t: Date.now(), zone: zone, moved: 0 };
      if (zone) {
        down[e.pointerId] = zone;
        try { els[zone].classList.add("on"); } catch (e2) {}
        if (opts.onKey) opts.onKey(keys[zone], true);
      }
      glow.style.left = x + "px";
      glow.style.top = y + "px";
      glow.style.opacity = "1";
      try { root.setPointerCapture(e.pointerId); } catch (e3) {}
      e.preventDefault();
    }

    function onMove(e) {
      var s = started[e.pointerId];
      if (!s) return;
      var dx = e.clientX - s.x, dy = e.clientY - s.y;
      s.moved = Math.max(s.moved, Math.sqrt(dx * dx + dy * dy));
      setZone(e.pointerId, hit(e.clientX, e.clientY));
      glow.style.left = e.clientX + "px";
      glow.style.top = e.clientY + "px";
      e.preventDefault();
    }

    function onUp(e) {
      var s = started[e.pointerId];
      setZone(e.pointerId, null);
      delete started[e.pointerId];
      glow.style.opacity = "0";
      /* 没落在任何按钮上、没怎么动、按得短 → 当作一次「点击」，
       * 交给 onTap 换算成游戏画面里的 0..1 坐标（菜单要点） */
      if (s && !s.zone && s.moved < 14 && Date.now() - s.t < 450 && opts.onTap) {
        var area = null;
        try { area = opts.area ? opts.area() : null; } catch (e2) { area = null; }
        var box = area ? containRect(area, opts.aspect || 0) : null;
        if (box && box.width > 0) {
          var fx = (e.clientX - box.left) / box.width;
          var fy = (e.clientY - box.top) / box.height;
          if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) opts.onTap(fx, fy);
        }
      }
      e.preventDefault();
    }

    root.addEventListener("pointerdown", onDown, { passive: false });
    root.addEventListener("pointermove", onMove, { passive: false });
    root.addEventListener("pointerup", onUp, { passive: false });
    root.addEventListener("pointercancel", function (e) {
      setZone(e.pointerId, null);
      delete started[e.pointerId];
      glow.style.opacity = "0";
    }, { passive: false });
    root.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    /* 顺手把页面的滚动/缩放/长按菜单掐掉，否则搓方向键会把页面拖走 */
    try {
      document.documentElement.style.touchAction = "none";
      document.body.style.touchAction = "none";
      document.body.style.overscrollBehavior = "none";
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) {
        vp = document.createElement("meta");
        vp.name = "viewport";
        document.head.appendChild(vp);
      }
      vp.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    } catch (e) {}

    var api = {
      el: root,
      measure: measure,
      releaseAll: function () {
        Object.keys(down).forEach(function (pid) { setZone(pid, null); });
      },
      hide: function () { root.style.display = "none"; },
      show: function () { root.style.display = "block"; measure(); },
      visible: true
    };
    window.__dePad = api;
    return api;
  };
})();
