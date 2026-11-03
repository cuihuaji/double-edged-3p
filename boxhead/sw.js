/* 盒子头的远端输入通道。
   网页把「好友按了哪些键」postMessage 给这里；SWF 端用 loadVariables 轮询
   dsh_in.txt，本 Service Worker 在本地直接把最新状态回给它——不出网、不落盘。 */

const NAMES = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'FIRE', 'NEXT_WEAPON', 'PREV_WEAPON'];
let keys = {};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  const d = e.data;
  if (d && d.type === 'dsh-keys' && d.keys) keys = d.keys;
});

self.addEventListener('fetch', (e) => {
  let url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (!url.pathname.endsWith('/dsh_in.txt')) return;

  const parts = NAMES.map((n) => n + '=' + (keys[n] ? 1 : 0));
  parts.push('T=' + Date.now());
  e.respondWith(new Response(parts.join('&'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  }));
});
