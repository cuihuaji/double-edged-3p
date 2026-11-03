/* 诊断监视器
 *
 * 目的：把"看不见的问题"变成屏幕上能直接看到的条目。
 * 任何模块都可以调用 window.__diag.report(code, message, detail) 上报。
 * 相同问题会累加次数，不会刷屏。
 */
(function (global) {
  "use strict";

  const items = [];          // {t, code, msg, detail, n}
  const index = new Map();   // code+msg -> item
  const T0 = Date.now();

  const NAMES = {
    desync: "逻辑偏离",
    stall: "帧闸门卡住",
    canvas: "画布尺寸不一致",
    tap: "按键丢失",
    fps: "帧率过低",
    dc: "通道异常",
    game: "游戏未就绪",
    jserr: "脚本报错",
    promise: "异步异常",
    input: "输入异常",
    slow: "处理超时"
  };

  let root = null, list = null, badge = null, panel = null, open = false, unseen = 0;

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function clock() {
    const d = new Date();
    const p = (n) => (n < 10 ? "0" : "") + n;
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function build() {
    if (root) return;
    root = h("div");
    root.id = "diag-root";
    root.innerHTML =
      '<style>' +
      '#diag-root{position:fixed;left:14px;bottom:14px;z-index:9999;font:12px/1.55 "Microsoft YaHei",system-ui,sans-serif;color:#cfd6df}' +
      '#diag-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:16px;cursor:pointer;' +
      'background:rgba(14,18,24,.92);border:1px solid #2c3846;user-select:none}' +
      '#diag-badge.ok{border-color:#2f5a41;color:#5fd08a}' +
      '#diag-badge.bad{border-color:#6b3128;color:#e8816c}' +
      '#diag-badge b{font-variant-numeric:tabular-nums}' +
      '#diag-panel{display:none;position:absolute;left:0;bottom:34px;width:460px;max-height:44vh;overflow:auto;' +
      'background:rgba(10,13,18,.97);border:1px solid #2c3846;border-radius:10px;padding:10px 12px;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.7)}' +
      '#diag-panel.show{display:block}' +
      '#diag-panel .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#8b98a8}' +
      '#diag-panel .hd button{background:#1b2430;border:1px solid #2c3846;color:#cfd6df;border-radius:5px;' +
      'padding:2px 8px;font-size:11px;cursor:pointer;margin-left:6px}' +
      '.dg{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #1a212b;align-items:baseline}' +
      '.dg .tm{color:#5a6878;font-variant-numeric:tabular-nums;flex:0 0 auto}' +
      '.dg .cd{flex:0 0 auto;padding:0 6px;border-radius:4px;background:#232a34;color:#9fb0c2;font-size:11px}' +
      '.dg.warn .cd{background:#3a2f1a;color:#e0b25a}' +
      '.dg.err .cd{background:#3d211b;color:#e8816c}' +
      '.dg .ms{flex:1 1 auto;color:#cfd6df;word-break:break-all}' +
      '.dg .ct{color:#7c8794;flex:0 0 auto}' +
      '.dg .dt{color:#5a6878;font-size:11px;padding-left:2px;word-break:break-all}' +
      '</style>' +
      '<div id="diag-badge"></div>' +
      '<div id="diag-panel"></div>';
    document.body.appendChild(root);

    badge = root.querySelector("#diag-badge");
    panel = root.querySelector("#diag-panel");
    badge.addEventListener("click", () => {
      open = !open;
      panel.classList.toggle("show", open);
      if (open) { unseen = 0; render(); }
    });
  }

  function render() {
    if (!badge) return;
    const n = items.reduce((a, b) => a + b.n, 0);
    const bad = items.some((i) => i.sev === "err");
    badge.className = (n === 0 ? "ok" : "bad");
    badge.textContent = n === 0
      ? "诊断：正常"
      : (bad ? "⚠ 诊断：" : "诊断：") + items.length + " 类 / " + n + " 次" + (unseen && !open ? "（新）" : "");

    if (!open) return;
    panel.innerHTML = "";
    const hd = h("div", "hd");
    hd.appendChild(h("span", null, "问题清单（新的在上）"));
    const box = h("span");
    const btnCopy = h("button", null, "复制全文");
    const btnClear = h("button", null, "清空");
    btnCopy.addEventListener("click", (e) => {
      e.stopPropagation();
      const txt = items.map((i) =>
        clock.call(null) && new Date(i.t).toLocaleTimeString() + "  [" + i.code + "] " + i.msg +
        (i.n > 1 ? "  ×" + i.n : "") + (i.detail ? "  " + i.detail : "")).join("\n");
      navigator.clipboard.writeText(txt || "无问题").then(
        () => { btnCopy.textContent = "已复制"; setTimeout(() => (btnCopy.textContent = "复制全文"), 1200); },
        () => { btnCopy.textContent = "复制失败"; }
      );
    });
    btnClear.addEventListener("click", (e) => { e.stopPropagation(); items.length = 0; index.clear(); render(); });
    box.appendChild(btnCopy); box.appendChild(btnClear);
    hd.appendChild(box);
    panel.appendChild(hd);

    if (!items.length) {
      panel.appendChild(h("div", "dg", "暂无问题"));
      return;
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const row = h("div", "dg " + (it.sev || "warn"));
      row.appendChild(h("span", "tm", new Date(it.t).toLocaleTimeString()));
      row.appendChild(h("span", "cd", NAMES[it.code] || it.code));
      const ms = h("span", "ms", it.msg);
      if (it.detail) ms.appendChild(h("div", "dt", it.detail));
      row.appendChild(ms);
      if (it.n > 1) row.appendChild(h("span", "ct", "×" + it.n));
      panel.appendChild(row);
    }
  }

  function report(code, msg, detail, sev) {
    const key = code + "|" + msg;
    const hit = index.get(key);
    if (hit) { hit.n++; hit.t = Date.now(); }
    else {
      const it = { t: Date.now(), code, msg, detail: detail || "", n: 1, sev: sev || "warn" };
      items.push(it);
      index.set(key, it);
      if (items.length > 60) { const gone = items.shift(); index.delete(gone.code + "|" + gone.msg); }
    }
    if (!open) unseen++;
    console.log("[diag]", code, msg, detail || "");
    try { render(); } catch (e) {}
  }

  function ready() {
    if (document.body) build(), render();
    else document.addEventListener("DOMContentLoaded", () => { build(); render(); });
  }
  ready();

  global.addEventListener("error", (e) => {
    report("jserr", e.message || "脚本错误",
      (e.filename || "") + ":" + (e.lineno || 0), "err");
  });
  global.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    report("promise", (r && r.message) ? r.message : String(r), "", "err");
  });

  global.__diag = {
    report: report,
    list: () => items.slice(),
    clear: () => { items.length = 0; index.clear(); render(); },
    summary: () => items.map((i) => "[" + i.code + "] " + i.msg + (i.n > 1 ? " ×" + i.n : "") + (i.detail ? " | " + i.detail : "")).join("\n")
  };
})(window);
