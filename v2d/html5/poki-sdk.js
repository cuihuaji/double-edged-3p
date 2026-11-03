/* ============================================================================
 * Double Edged · 本地 Poki SDK 桩（已去界面锁 / sitelock）
 * ----------------------------------------------------------------------------
 * 原版 poki-sdk.js 会从 game-cdn.poki.com 拉取 poki-sdk-core-<hash>.js，
 * 那段远程脚本里写死了「只有 location.hostname === "localhost" 才运行」的域名锁，
 * 非 localhost（127.0.0.1 / 局域网 IP / 公网域名）整页跳 poki.com/sitelock。
 *
 * 这里替换成纯本地桩：同步定义 window.PokiSDK，不再发起任何远程请求，
 * 因此界面锁被彻底拆除 —— 游戏在任意来源（localhost、局域网 IP、公网）都能直接开。
 *
 * Flash 侧 com.poki.PokiFlashSDK 只通过 ExternalInterface.call("eval","PokiSDK.xxx()")
 * 与通过 window.initPokiBridge 建立桥接来使用 PokiSDK；本桩全部满足，不影响游戏运行。
 * ==========================================================================*/
(function () {
  "use strict";

  function noop() {}
  var poki = {
    adBlocked: false,
    init: function () { return Promise.resolve(); },
    setDebug: noop,
    getDebug: noop,
    isAdBlocked: function () { return false; },
    gameLoadingStart: noop,
    gameLoadingProgress: noop,
    gameLoadingFinished: noop,
    gameplayStart: noop,
    gameplayStop: noop,
    happyTime: noop,
    commercialBreak: function () { return Promise.resolve(); },
    rewardedBreak: function () { return Promise.resolve(false); },
    displayAd: function () { return Promise.resolve(); },
    shareableID: function () { return ""; },
    captureError: noop,
    log: noop,
    trackEvent: noop,
    sendUsageTime: noop
  };

  // 暴露到全局，供 loader 的 STUB 兜底逻辑以及 Flash 侧 eval 调用使用
  window.PokiSDK = poki;

  // Flash 侧 PokiFlashSDK.Init() 会用 ExternalInterface 注册 Ready/AdBlocked 等回调，
  // 然后调 window.initPokiBridge(objectID) 建立桥接。这里直接回应桥接已就绪。
  window.initPokiBridge = function () {
    try {
      // 若 Flash 端已暴露实例的 Ready 回调，则直接标记初始化完成
      if (window.PokiFlashSDK && typeof window.PokiFlashSDK.Ready === "function") {
        window.PokiFlashSDK.Ready();
      }
    } catch (e) {}
  };

  // 兼容部分页面用 window.pokiSDK（小写）访问
  window.pokiSDK = poki;
})();
