/* 双人游戏中继服务（零依赖，Node 18+）
 * 用法：node relay.js [端口]
 * 协议：同一「房间」的 WebSocket 客户端互相广播文本消息。
 * 消息格式：客户端发 {room:"xxx", data:...}，服务端转发 {from:"会话id", data:...}
 *           给同房间其他所有客户端。
 * Funnel 把 https://desktop-a9unfi5.tailb30fe3.ts.net 指到本进程端口。
 */
"use strict";
const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.argv[2] || 9000);
const ROOMS = new Map();   // room -> Set<ws>
const CONNS = new Map();   // ws  -> { room, id }

function guid() { return crypto.randomBytes(6).toString("hex"); }

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/ws" || u.pathname === "/") {
    // 探活
    if (u.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("de-relay alive " + new Date().toISOString() + "\nrooms=" + ROOMS.size);
    }
    res.writeHead(400); return res.end("websocket only");
  }
  // 静态托管：ROOT=boxhead，页面里 ../html5/... 需要逃一级到仓库根
  const fs = require("fs");
  const path = require("path");
  const ROOT = path.join(__dirname);
  const PARENT = path.dirname(ROOT);
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
  if (!rel) rel = "fun-host.html";
  let file = path.normalize(path.join(ROOT, rel));
  let base = ROOT;
  if (!fs.existsSync(file)) {             // boxhead 下没有 → 试仓库根（../html5 等上级资源）
    file = path.normalize(path.join(PARENT, rel));
    base = PARENT;
  }
  if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end("not found");
  }
  const ext = path.extname(file).toLowerCase();
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css", ".json": "application/json", ".swf": "application/x-shockwave-flash",
    ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  fs.createReadStream(file).pipe(res);
});

server.on("upgrade", (req, socket, head) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: " + accept + "\r\n\r\n");
  socket.setNoDelay(true);

  const ws = makeWs(socket);
  ws.id = guid();
  CONNS.set(ws, { room: null, id: ws.id });

  ws.onmessage = (obj) => {
    const st = CONNS.get(ws);
    if (!st) return;
    if (obj && typeof obj.room === "string" && obj.join) {
      st.room = obj.room;
      if (!ROOMS.has(obj.room)) ROOMS.set(obj.room, new Set());
      const set = ROOMS.get(obj.room);
      // 通知房里已有的人「有人进来了」
      broadcast(obj.room, { from: st.id, sys: "join" }, ws);
      // 告诉新人房里已有几个人（>0 时新人可主动发起建连，解决后加入者看不到先到者的问题）
      try { ws.sendText(JSON.stringify({ sys: "room", peers: set.size })); } catch (e2) {}
      set.add(ws);
      return;
    }
    if (st.room) {
      // 二进制消息（图帧）加 1 字节类型头后原样广播；文本走 JSON
      if (obj && obj.__bin) broadcastBin(st.room, obj.__bin, ws);
      else broadcast(st.room, { from: st.id, data: obj.data }, ws);
    }
  };
  ws.onclose = () => {
    const st = CONNS.get(ws);
    if (st && st.room && ROOMS.has(st.room)) {
      ROOMS.get(st.room).delete(ws);
      if (!ROOMS.get(st.room).size) ROOMS.delete(st.room);
      else broadcast(st.room, { from: st.id, sys: "leave" }, null);
    }
    CONNS.delete(ws);
  };
});

function broadcast(room, obj, except) {
  const set = ROOMS.get(room);
  if (!set) return;
  const text = JSON.stringify(obj);
  for (const c of set) {
    if (c === except || c.readyState !== 1) continue;
    try { c.sendText(text); } catch (e) {}
  }
}

function broadcastBin(room, payload, except) {
  const set = ROOMS.get(room);
  if (!set) return;
  for (const c of set) {
    if (c === except || c.readyState !== 1) continue;
    try { c.sendBin(payload); } catch (e) {}
  }
}

/* 极简 WebSocket 封装：服务端必然收到 MASKED 帧，文本帧才处理 */
function makeWs(socket) {
  const ws = { readyState: 1, onmessage: null, onclose: null, id: null, _buf: Buffer.alloc(0) };
  ws.sendText = (t) => sendFrame(socket, 0x1, Buffer.from(t, "utf8"));
  ws.sendBin = (b) => sendFrame(socket, 0x2, b);
  socket.on("data", (chunk) => {
    ws._buf = Buffer.concat([ws._buf, chunk]);
    for (;;) {
      const f = parseFrame(ws._buf);
      if (!f) break;
      ws._buf = ws._buf.subarray(f.total);
      if (f.op === 0x8) { try { socket.end(); } catch (e) {} ws.readyState = 3; ws.onclose && ws.onclose(); return; }
      if (f.op === 0x9) { try { sendFrame(socket, 0xA, f.payload); } catch (e) {} continue; }   // ping→pong
      if (f.op === 0xA) continue;
      if (f.op === 0x2 && ws.onmessage) { ws.onmessage({ __bin: f.payload }); continue; }  // 二进制帧
      if (f.op === 0x1 && ws.onmessage) {
        let obj = null;
        try { obj = JSON.parse(f.payload.toString("utf8")); } catch (e) {}
        if (obj) ws.onmessage(obj);
      }
    }
  });
  socket.on("close", () => { if (ws.readyState !== 3) { ws.readyState = 3; ws.onclose && ws.onclose(); } });
  socket.on("error", () => { if (ws.readyState !== 3) { ws.readyState = 3; ws.onclose && ws.onclose(); } });
  return ws;
}

function parseFrame(buf) {
  if (buf.length < 2) return null;
  const op = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  let mask = null;
  if (masked) { if (buf.length < off + 4) return null; mask = buf.subarray(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  const payload = Buffer.from(buf.subarray(off, off + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return { op, payload, total: off + len };
}

function sendFrame(socket, op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.from([0x80 | op, len]); }
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  try { socket.write(Buffer.concat([head, payload])); } catch (e) {}
}

server.listen(PORT, "127.0.0.1", () => console.log("relay on 127.0.0.1:" + PORT));
