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

  function sampleHost() {
    try {
      var f = hostIfr.contentWindow;
      if (!f || !f.__lock) return null;
      return {
        k: f.__lock.frames,
        extra: "phase=" + f.__lock.phase + " q=" + f.__lock.qLen +
               " rafErr=" + ((f.__rafErrs && f.__rafErrs.length) || 0)
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
               " vw=" + vid.videoWidth
      };
    } catch (e) { return null; }
  }

  setInterval(function () {
    var s = isHost ? sampleHost() : sampleGuest();
    var who = isHost ? "房主" : "好友";

    if (!s) {
      el.style.color = "#c9d1d9";
      el.textContent = who + " · 等待数据…";
      last = -1; stall = 0;
      return;
    }

    if (s.k === last) stall++; else { stall = 0; last = s.k; }

    if (stall >= 2) {
      el.style.color = "#ff5252";
      el.textContent = who + " 冻结! 帧=" + s.k + " " + s.extra + " " + (stall + 1) + "s";
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
      el.style.color = "#39d353";
      el.textContent = who + (isHost ? " 帧=" : " 视频帧=") + s.k + " · " + s.extra;
      loggedAt = -1;
    }
  }, 1000);
})();
