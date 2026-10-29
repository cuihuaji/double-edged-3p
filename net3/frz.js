/* 冻结取证监视器（纯测量，不改变任何行为）
 * 房主：采样 iframe 内 __lock.frames（帧驱动器实际推帧数）+ phase/qLen
 * 好友：采样 <video id=rv> 的 getVideoPlaybackQuality().totalVideoFrames（实际渲染帧数）
 * 连续 2 秒没有新帧 → 角标变红并打印一行精确状态（含时间戳），便于抓现行。
 * 判定依据说明：
 *   - 用 totalVideoFrames 而不是 currentTime：MediaStream 的 currentTime 按墙钟走，
 *     即使没有新帧也会增长，不能用它判断卡顿。
 *   - 房主侧 __lock.frames 只在 stepOnce 真正跑一帧时自增，停转立刻可见。
 */
(function () {
  "use strict";
  if (window.__frzMonitor) return;
  window.__frzMonitor = true;

  var el = document.createElement("div");
  el.id = "frz";
  el.style.cssText =
    "position:fixed;left:8px;bottom:40px;z-index:99999;" +
    "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;" +
    "color:#39d353;background:rgba(0,0,0,.74);padding:4px 8px;" +
    "border-radius:6px;pointer-events:none;max-width:48vw;white-space:pre-wrap";
  el.textContent = "冻结监视: 启动…";
  (document.body || document.documentElement).appendChild(el);

  var hostIfr = document.getElementById("game");
  var vid = document.getElementById("rv");
  var isHost = !!hostIfr && !vid;

  var last = -1, stall = 0, loggedAt = -1;
  var encLast = -1, encStall = 0, encNow = -1;
  /* 编码器细分指标：区分「捕获没产帧」和「产了但被带宽压住不编」 */
  var encSent = -1, encBytes = -1, encQlr = "?", encRes = "?";
  /* 版本标记：写在角标最前面，一眼确认浏览器跑的是不是最新代码 */
  var VERSION = "v7";
  var recovAt = 0, recovCount = 0;
  /* 自愈已停用：实测它会反复重建呼叫，导致好友端 video 元素 srcObject 被反复替换、
   * play() 被打断、rs 一直是 0（画面彻底接不上）。在根因未明前不再自动重连。 */
  var RECAPTURE_ENABLED = false;
  /* 好友侧：接收端统计，用来区分「网络没送到」和「送到了但解不出来」 */
  var inFrames = -1, inDecoded = -1, inLost = -1, inJitter = -1;

  function sampleInbound() {
    try {
      var call = window.__npCall;
      var pc = call && call.peerConnection;
      if (!pc || !pc.getStats) return;
      pc.getStats().then(function (s) {
        s.forEach(function (r) {
          if (r.type === "inbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
            if (typeof r.framesReceived === "number") inFrames = r.framesReceived;
            if (typeof r.framesDecoded === "number") inDecoded = r.framesDecoded;
            if (typeof r.packetsLost === "number") inLost = r.packetsLost;
            if (typeof r.jitter === "number") inJitter = Math.round(r.jitter * 1000);
          }
        });
      }).catch(function () {});
    } catch (e) {}
  }

  /* 房主侧：读 WebRTC 发送端实际编出的帧数。
   * framesEncoded 停滞而 __lock.frames 继续增长 = 游戏在跑但 canvas 捕获不再产帧
   * （典型原因：标签页不可见/被遮挡时 Chrome 暂停 canvas 合成捕获）。
   * 两者同时停滞 = 房主进程本身卡住。这是区分两种冻结的决定性指标。 */
  function sampleEncoded() {
    try {
      var call = window.__npCall;
      var pc = call && call.peerConnection;
      if (!pc) return;
      pc.getStats().then(function (s) {
        s.forEach(function (r) {
          if (r.type === "outbound-rtp" && typeof r.framesEncoded === "number") {
            encNow = r.framesEncoded;
            if (typeof r.framesSent === "number") encSent = r.framesSent;
            if (typeof r.bytesSent === "number") encBytes = r.bytesSent;
            if (r.qualityLimitationReason) encQlr = r.qualityLimitationReason;
            if (r.frameWidth && r.frameHeight) encRes = r.frameWidth + "x" + r.frameHeight;
          }
        });
      }).catch(function () {});
    } catch (e) {}
  }

  function sampleHost() {
    try {
      var f = hostIfr.contentWindow;
      if (!f || !f.__lock) return null;
      /* 载入阶段帧计数本来就是 0，不能当冻结 —— 必须等 boot 完成（started） */
      if (f.__lock.phase === "loading" || !f.__lock.started) return null;
      return {
        k: f.__lock.frames,
        extra: "phase=" + f.__lock.phase + " q=" + f.__lock.qLen +
               " rafErr=" + ((f.__rafErrs && f.__rafErrs.length) || 0) +
            " cc=" + (f.__npContained || 0) +
            " np=" + (f.__npNumPlayers || 0) +
               " cap=" + encNow + " sent=" + encSent + " B=" + encBytes +
               " qlr=" + encQlr + " res=" + encRes +
               " re=" + (typeof window.__npRecapture === "function" ? 1 : 0) +
               " vis=" + document.visibilityState
      };
    } catch (e) { return null; }
  }

  function sampleGuest() {
    try {
      if (!vid || !vid.srcObject) return null;
      var q = null;
      if (vid.getVideoPlaybackQuality) q = vid.getVideoPlaybackQuality();
      var frames = q && typeof q.totalVideoFrames === "number"
        ? q.totalVideoFrames
        : -2; /* 浏览器不支持时退化：用 -2 表示未知 */
      return {
        k: frames,
        extra: "rs=" + vid.readyState +
               " t=" + (vid.currentTime || 0).toFixed(2) +
               " dropped=" + (q ? q.droppedVideoFrames : "?") +
               " vw=" + vid.videoWidth +
               " rx=" + inFrames + " dec=" + inDecoded +
               " lost=" + inLost + " jit=" + inJitter
      };
    } catch (e) { return null; }
  }

  setInterval(function () {
    if (isHost) sampleEncoded(); else sampleInbound();
    var s = isHost ? sampleHost() : sampleGuest();
    var who = isHost ? "房主" : "好友";

    /* 编码端独立停滞计数：区分「游戏卡」和「捕获卡」 */
    if (isHost) {
      if (encNow >= 0 && encNow === encLast) encStall++; else encStall = 0;
      encLast = encNow;
    }

    if (!s) {
      el.style.color = "#c9d1d9";
      el.textContent = VERSION + " " + who + " · 等待数据…";
      last = -1; stall = 0;
      return;
    }

    if (s.k === last) stall++; else { stall = 0; last = s.k; }

    if (stall >= 2) {
      el.style.color = "#ff5252";
      el.textContent = VERSION + " " + who + " 冻结! 帧=" + s.k + " " + s.extra + " " + (stall + 1) + "s";
      if (loggedAt !== s.k) {
        loggedAt = s.k;
        try {
          console.log("[FRZ] " + JSON.stringify({
            who: who, t: new Date().toISOString(), frames: s.k,
            stallSec: stall + 1, extra: s.extra, href: location.href
          }));
        } catch (e) {}
      }
    } else {
      /* 游戏帧在涨、但编码帧不涨 → 视频链路单独卡住（最可能：标签页不可见/被遮挡，
       * Chrome 暂停 canvas 捕获）。这是「好友看到定格、房主其实还在跑」的指纹。 */
      var capWarn = isHost && encStall >= 2 ? " ⚠cap停" + (encStall + 1) + "s" : "";
      el.style.color = capWarn ? "#ffa657" : "#39d353";
      el.textContent = VERSION + " " + who + (isHost ? " 帧=" : " 视频帧=") + s.k + " · " + s.extra + capWarn;
      loggedAt = -1;
    }

    /* 自愈：房主游戏还在跑、但捕获/编码停住 → 重建捕获流并重新呼叫（限频限次）。
     * 不依赖对根因的猜测：只要是「上游不再产帧」，重连就能把画面接回来。 */
    if (RECAPTURE_ENABLED && isHost && stall < 2 && encStall >= 3 && recovCount < 5) {
      var now = Date.now();
      if (now - recovAt > 10000 && typeof window.__npRecapture === "function") {
        recovAt = now; recovCount++;
        var ok = false;
        try { ok = window.__npRecapture(); } catch (e) {}
        try { console.log("[FRZ] recapture #" + recovCount + " -> " + ok); } catch (e) {}
        el.textContent += " ↻重建" + recovCount;
        encStall = 0;
      }
    }
  }, 1000);
})();
