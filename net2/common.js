/* Double Edged 联机（纯网页版）公共逻辑
 * 信令：手动交换两段连接码（deflate + base64），不需要任何服务器
 */
(function (global) {
  "use strict";

  const ICE = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.miwifi.com:3478" },
    { urls: "stun:stun.qq.com:3478" }
  ];

  /* ---------- 连接码编解码 ---------- */
  async function pack(sdp) {
    const data = new TextEncoder().encode(sdp);
    if (typeof CompressionStream === "function") {
      const cs = new CompressionStream("deflate-raw");
      const w = cs.writable.getWriter();
      w.write(data); w.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return b64(new Uint8Array(buf));
    }
    return b64(data);
  }

  async function unpack(str) {
    let bytes = unb64(str.trim().replace(/\s+/g, ""));
    if (typeof DecompressionStream === "function") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const w = ds.writable.getWriter();
        w.write(bytes); w.close();
        const buf = await new Response(ds.readable).arrayBuffer();
        bytes = new Uint8Array(buf);
      } catch (e) { /* 没压缩过，原样用 */ }
    }
    return new TextDecoder().decode(bytes);
  }

  function b64(u8) {
    let s = "";
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s).replace(/=+$/, "");
  }
  function unb64(s) {
    const raw = atob(s);
    const u8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    return u8;
  }

  /* ---------- ICE 收集完成 ---------- */
  function waitIce(pc, ms) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const t = setTimeout(resolve, ms || 6000);
      const check = () => {
        if (pc.iceGatheringState === "complete") { clearTimeout(t); resolve(); }
      };
      pc.addEventListener("icegatheringstatechange", check);
      pc.addEventListener("icecandidate", (e) => { if (!e.candidate) { clearTimeout(t); resolve(); } });
    });
  }

  /* ---------- 按键映射 ---------- */
  const CODE2KEY = {
    ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
    Space: " ", Enter: "Enter", Escape: "Escape", Period: ".", Comma: ",", Semicolon: ";",
    ShiftLeft: "Shift", ControlLeft: "Control", Tab: "Tab", Backspace: "Backspace"
  };
  const KEYCODE = {
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Space: 32,
    Enter: 13, Escape: 27, Period: 190, Comma: 188, ShiftLeft: 16, ControlLeft: 17,
    KeyA: 65, KeyB: 66, KeyC: 67, KeyD: 68, KeyE: 69, KeyF: 70, KeyG: 71, KeyH: 72,
    KeyI: 73, KeyJ: 74, KeyK: 75, KeyL: 76, KeyM: 77, KeyN: 78, KeyO: 79, KeyP: 80,
    KeyQ: 81, KeyR: 82, KeyS: 83, KeyT: 84, KeyU: 85, KeyV: 86, KeyW: 87, KeyX: 88,
    KeyY: 89, KeyZ: 90
  };
  function toKey(code, key) {
    if (CODE2KEY[code]) return CODE2KEY[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    return key && key.length === 1 ? key.toLowerCase() : null;
  }

  /* ---------- 把按键送进游戏 ---------- */
  function makeInjector(getWin, getDoc) {
    return function inject(m) {
      const win = getWin(), doc = getDoc();
      if (!win || !doc) return false;
      const key = toKey(m.code, m.key);
      if (!key) return false;
      const code = KEYCODE[m.code] || 0;
      const type = m.type === "down" ? "keydown" : "keyup";
      const ev = new KeyboardEvent(type, {
        key, code, keyCode: code, which: code,
        bubbles: true, cancelable: true, composed: true
      });
      let ok = false;
      for (const target of [doc, doc.body, win]) {
        try { target && target.dispatchEvent(ev) && (ok = true); } catch (e) {}
      }
      return ok;
    };
  }

  global.Net = { ICE, pack, unpack, waitIce, toKey, makeInjector, KEYCODE };
})(window);
