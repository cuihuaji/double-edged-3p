/* Double Edged 对话字幕表
 * 左边是游戏内原文（^ 是气泡里的换行），右边是中文译文。
 * 查找时会把原文与游戏传入的文本都做同一套归一化（去标签、大写、压空白），
 * 所以表里的写法不需要和源代码逐字一致。
 */
window.DE_SUBS = [
  ["HUH? SOUND THE^ALARM, IT'S THE^ENEMY!\"", "嗯？拉响警报——是敌袭！"],
  ["WATCH OUT FOR HIS^SPECIAL ATTACK...", "小心他的必杀技……"],
  ["YOU DON'T WANT^TO LOSE YOUR^SWORD!", "可别把剑弄丢了！"],
  ["PRESS BOTH JUMP^AND ATTACK TO DO^YOUR SPECIAL", "跳跃和攻击同时按，放出必杀"],
  ["CATCH ME IF YOU^CAN!", "来抓我呀——"],
  ["ME IS GONNA^BREAK YOU!\"", "我要把你捏碎！"],
  ["CHECK OUT THIS^AXE MY WIFE GAVE ME", "瞧瞧这把斧头，我老婆送的"],
  ["WHAT'S WITH^ALL THE GOLD^STATUES?\"", "这些金像是怎么回事？"],
  ["KING MIDAS HAS^GONE MAD!", "弥达斯王疯了！"],
  ["MY KINGDOM WILL LOOK EVEN MORE^BEAUTFUL...", "我的王国会更加金碧辉煌……"],
  ["WE'LL HAVE TO^THROW THESE ^STATUES AT HIM!", "只能拿这些金像砸他！"],
  ["IT'S THE ONLY^WAY!\"", "没别的办法了！"],
  ["IT'S HIM! YOU JUST DON'T GIVE UP^DO YOU?", "又是他！你可真不死心啊？"],
  ["WELL GET READY^FOR A PIT...STOP!\"", "那就准备掉坑……住手！"],
  ["QUICK LETS JUMP^ON 'STRIPES' AND^LET'S GET HIM!\"", "快，跳上“花条纹”，追上去！"],
  ["IT WOULD  BE WISE NOT TO WAKE^TALOS...", "最好别吵醒塔罗斯……"],
  ["FROM HIS^SLUMBER!!\"", "……把他从沉睡里吵醒就完了！"],
  ["TURN BACK YOU^FOOL", "回头吧，蠢货"],
  ["THE COLOSSUS IS^UPON US!\"", "巨人压过来了！"],
  ["GREAT ZEUS!!! THE^LIZARDMEN ARE^ATTACKING!\"", "宙斯在上！蜥蜴人来袭！"],
  ["OUR TIME HASSSS^COME!!!\"", "我们的时代，来了sss！"],
  ["SNORT SNORT!! RED MAKES ME REAL^ANGRY!!!", "哼哼！穿红衣服的真把我惹毛了！"],
  ["MOOOOOO...VE^ASIDE BEFORE I^CHARGE YOU!!!\"", "哞——让开，不然我撞飞你！"],
  ["ARCHERS AT THE^READY...", "弓手就位……"],
  ["LETS LICK SOME^LIZARDS!\"", "去收拾这帮蜥蜴！"],
  ["WE'VE GOT HIM^SURROUNDED...^GET HIM!!!\"", "包围他……上！"],
  ["THANKS TO THE^PRIESTS OF HECATE ^THIS WAR IS WON!", "多亏赫卡忒的祭司，这一仗赢定了！"],
  ["THE REPTILE SCUM ARE HARMLESS^CHICKENS..HA HA!!\"", "那帮爬虫就是一群软脚鸡，哈哈！"],
  ["STAND STILL...^MY FEATHERED^FRIEND MWHAHAHA\"", "站好别动……我的羽毛朋友，哈哈哈"],
  ["EXCUSE ME! ^HAVE YOU SEEN MY FRIENDSSSS?", "打扰一下——见过我的朋友们sss吗？"],
  ["DID I MISSSS^SOMETHING?\"", "我错过什么好戏了？"],
  ["DERRR...YOU MAY^GET PAST US...", "呃……你们可以过去……"],
  ["BUT YOU HAVE NO CHANCE AGAINST^HERCULES!!!\"", "但你们绝不可能赢过赫拉克勒斯！"],
  ["THATS RIGHT!^YOU ARE LOOKING AT THE ONE...^", "没错！你眼前的正是……"],
  ["THE MIGHTIEST^WARRIOR OF THEM ALL...", "有史以来最强的战士……"],
  ["CAN I GET A^ DRUMROLL^ PLEASE???...", "来点鼓声，please？"],
  ["I................AM...............^HERCULES!!\"", "我……就是……赫拉克勒斯！"],
  ["HAHAHA... I FOUND ^THIS LION HAMMER^...", "哈哈哈……我找到了这把狮头锤……"],
  ["IN THE TOMB OF^KING CECROPS.^IM INVINCIBLE!!!\"", "在刻克洛普斯王的墓里。我无敌了！"],
  ["YOU FOOL...^YOU HAVE DOOMED US ALL!!!", "蠢货……你把我们全毁了！"],
  ["THAT CURSED^HAMMER WILL^WAKE THE UNDEAD. \"", "那把被诅咒的锤子会唤醒亡灵。"],
  ["WE'LL SWALLOW^YOUR SOUL!^MWAHAHAHAH!\"", "我们会吞掉你的灵魂！哇哈哈哈！"],
  ["THE GORGON HAS^HIDDEN HERSELF...", "戈耳工藏起来了……"],
  ["DO NOT GAZE^INTO HER EYES!!\"", "千万别看她的眼睛！"],
  ["HSSSSSSSSSSSSSS...^LOOK INTO MY^EYES MY PRETTY...", "嘶————看着我的眼睛，美人……"],
  ["I'M SO BEAUTIFUL^YOU'LL NEVER^LOOK AT...", "我美得你再也移不开眼……"],
  ["ANYONE ELSE^AGAIN!!!\"", "……看别人一眼！"],
  ["HECATE!^RAISE AN ARMY^FROM THE DEAD!!", "赫卡忒！让亡者成军！"],
  ["SO THEY MAY^DESTROY THIS^NON-BELIEVER!\"", "让他们撕碎这个不信神的人！"],
  ["HUMAN!! JOIN US IF YOU WANT TO LIVE^MWAHAHAHAHA...\"", "凡人！想活命就加入我们，哈哈哈……"],
  ["IMPRESSIVE^MORTAL, YOU ^MADE IT THIS FAR!", "了不起，凡人，你居然走到这里！"],
  ["BUT YOU WILL GO^NO FURTHER,", "但到此为止了，"],
  ["FOR YOU HAVE^ANGERED THE^BEHEMOTH!!!\"", "因为你惹怒了巨兽！"]
];

(function () {
  function norm(s) {
    return String(s || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\^/g, " ")
      .replace(/&quot;/g, "\"")
      .replace(/&amp;/g, "&")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }
  var map = {};
  for (var i = 0; i < window.DE_SUBS.length; i++) {
    map[norm(window.DE_SUBS[i][0])] = window.DE_SUBS[i][1];
  }
  window.DE_LOOKUP = function (raw) { return map[norm(raw)] || ""; };
  window.DE_NORM = norm;
})();

/* ---- 运行时采集：把 AVM 里所有可见文本框的内容读出来 ----
 * 实测：游戏里能读到的文字都在 TextField 的 $Bg_text 上（舞台树 → 属性）。
 * 遍历深度 9 足够覆盖 441 个节点，每 300ms 跑一次开销可忽略。 */
/* 从一个 TextField 包装对象里取字符串。
 * 实测两种存法：
 *   1) 代码创建的文本框 → 包装对象上的 $Bg_text
 *   2) 元件里嵌的文本框（对话气泡就是这种）→ 包装对象._adaptee._text
 * 只读 _text 不够，_iText 在部分状态下才是最新的。 */
function deFieldText(o) {
  try {
    var a = o._adaptee || o;
    if (typeof a._text === "string" && a._text) return a._text;
    if (typeof a._iText === "string" && a._iText) return a._iText;
    if (typeof a.text === "string" && a.text) return a.text;
  } catch (e) {}
  return "";
}

/* 设计期占位文字，气泡没说话时留着它，不能当字幕 */
function dePlaceholder(s) {
  return /^(\s*speech text\s*)+$/i.test(s);
}

/* ---- 运行时采集 ----
 * 沿舞台树下降时累计「有效透明度」和可见性：气泡隐藏时 alpha 归零，
 * 文本却还留着上一句，只看文本会一直显示过期字幕。
 * 实测 441 个节点，一次遍历约 0.3ms，300ms 轮询没有压力。 */
window.DE_collect = function (w) {
  try {
    var pg = w.AVMPlayerPoki && w.AVMPlayerPoki._avmHandler && w.AVMPlayerPoki._avmHandler._playerglobal;
    var st = pg && pg._stage && pg._stage._stage;
    if (!st) return [];
    /* 舞台的 numChildren 不可靠（实测直接走 Stage 会一个节点都进不去），
     * 所以显式枚举它的子节点作为起点；枚举不到才退回舞台本身。 */
    var roots = [];
    /* 实测：Stage 的 numChildren 恒为 0，而 getChildAt(0) 正常（能摸到 433 个文本节点）。
     * 所以不信 numChildren，按索引探到 null 为止。 */
    for (var si = 0; si < 16; si++) {
      var sc = null; try { sc = st.getChildAt(si); } catch (e) { sc = null; }
      if (!sc) break;
      roots.push(sc);
    }
    if (!roots.length) roots.push(st);
    var out = [], seen = new Set();
    (function walk(o, d, effAlpha, vis) {
      if (!o || d > 10 || seen.has(o)) return;
      seen.add(o);
      var al = 1; try { if (typeof o.alpha === "number") al = o.alpha; } catch (e) {}
      var v = vis; try { if (o.visible === false) v = false; } catch (e) {}
      var ea = effAlpha * (al >= 0 && al <= 1 ? al : 1);
      var shown = v && ea > 0.05;

      var pushed = false;
      var ns; try { ns = Object.getOwnPropertyNames(o); } catch (e) { ns = []; }
      // 1) 代码创建的文本框
      if (ns.indexOf("$Bg_text") >= 0) {
        var t1 = ""; try { t1 = o.$Bg_text; } catch (e) {}
        if (typeof t1 === "string" && t1.trim() && shown) { out.push(t1.trim()); pushed = true; }
      }
      // 2) 元件里的文本框 / 气泡（直接扫 _adaptee._text，不依赖包装对象叫什么）
      if (!pushed && ns.indexOf("_adaptee") >= 0) {
        var t2 = deFieldText(o);
        if (t2 && t2.trim() && shown && !dePlaceholder(t2)) out.push(t2.trim());
      }
      // 3) 气泡外壳上的 speechText 字段（外壳自身可能没有 _adaptee）
      if (ns.indexOf("$BgspeechText") >= 0) {
        var f = null; try { f = o.$BgspeechText; } catch (e) {}
        var t3 = f ? deFieldText(f) : "";
        if (t3 && t3.trim() && shown && !dePlaceholder(t3)) out.push(t3.trim());
      }

      var n = 0; try { n = o.numChildren || 0; } catch (e) {}
      for (var i = 0; i < n; i++) {
        var c = null; try { c = o.getChildAt(i); } catch (e) {}
        if (c) walk(c, d + 1, ea, v);
      }
    })(roots[0], 0, 1, true);
    for (var ri = 1; ri < roots.length; ri++) (function (rz) {
      (function walk(o, d, effAlpha, vis) {
        if (!o || d > 10 || seen.has(o)) return;
        seen.add(o);
        var al = 1; try { if (typeof o.alpha === "number") al = o.alpha; } catch (e) {}
        var v = vis; try { if (o.visible === false) v = false; } catch (e) {}
        var ea = effAlpha * (al >= 0 && al <= 1 ? al : 1);
        var shown = v && ea > 0.05;
        var pushed = false;
        var ns; try { ns = Object.getOwnPropertyNames(o); } catch (e) { ns = []; }
        if (ns.indexOf("$Bg_text") >= 0) {
          var t1 = ""; try { t1 = o.$Bg_text; } catch (e) {}
          if (typeof t1 === "string" && t1.trim() && shown) { out.push(t1.trim()); pushed = true; }
        }
        if (!pushed && ns.indexOf("_adaptee") >= 0) {
          var t2 = deFieldText(o);
          if (t2 && t2.trim() && shown && !dePlaceholder(t2)) out.push(t2.trim());
        }
        if (ns.indexOf("$BgspeechText") >= 0) {
          var f2 = null; try { f2 = o.$BgspeechText; } catch (e) {}
          var t3 = f2 ? deFieldText(f2) : "";
          if (t3 && t3.trim() && shown && !dePlaceholder(t3)) out.push(t3.trim());
        }
        var n2 = 0; try { n2 = o.numChildren || 0; } catch (e) {}
        for (var i2 = 0; i2 < n2; i2++) {
          var c2 = null; try { c2 = o.getChildAt(i2); } catch (e) {}
          if (c2) walk(c2, d + 1, ea, v);
        }
      })(rz, 0, 1, true);
    })(roots[ri]);
    // 去重并按长度排序，长的（台词）优先
    var uniq = [];
    for (var i = 0; i < out.length; i++) if (uniq.indexOf(out[i]) < 0) uniq.push(out[i]);
    uniq.sort(function (x, y) { return y.length - x.length; });
    return uniq;
  } catch (e) { return []; }
};
/* ---- 匹配：支持打字机（气泡逐字出现）----
 * 屏幕上只有半句时，用「屏幕文本是词条前缀」来认定是同一条台词。 */
window.DE_MATCH = function (raw) {
  try {
    var n = window.DE_NORM(raw);
    if (!n || n.length < 3) return "";
    var exact = window.DE_LOOKUP(raw);
    if (exact) return exact;
    if (n.length < 4) return "";
    var best = "", bestLen = 0;
    for (var i = 0; i < window.DE_SUBS.length; i++) {
      var k = window.DE_NORM(window.DE_SUBS[i][0]);
      if (k.indexOf(n) === 0 && n.length > bestLen) { best = window.DE_SUBS[i][1]; bestLen = n.length; }
    }
    return best;
  } catch (e) { return ""; }
};

/* ---- 字幕条（房主、好友共用）---- */
window.DE_bar = (function () {
  var el = null, inner = null, hideTimer = 0, enabled = true;
  function ensure() {
    if (el && el.parentNode) return;
    el = document.createElement("div");
    el.id = "de-sub";
    el.style.cssText = "position:fixed;left:0;right:0;bottom:16px;z-index:9999;display:none;" +
      "pointer-events:none;text-align:center;" +
      "font:600 16px/1.45 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;" +
      "color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.85)";
    inner = document.createElement("span");
    inner.style.cssText = "display:inline-block;max-width:min(92vw,860px);padding:5px 14px;" +
      "border-radius:10px;background:rgba(0,0,0,.62)";
    el.appendChild(inner);
    document.body.appendChild(el);
  }
  function set(text, holdMs) {
    ensure();
    if (!enabled || !text) { el.style.display = "none"; return; }
    inner.textContent = text;
    el.style.display = "block";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { el.style.display = "none"; }, holdMs || 7000);
  }
  set.toggle = function () {
    enabled = !enabled;
    if (!enabled) { try { el.style.display = "none"; } catch (e) {} }
    window.__diag && window.__diag.report("sub", enabled ? "字幕已开" : "字幕已关", "", "info");
    return enabled;
  };
  set.enabled = function () { return enabled; };
  return set;
})();

/* ---- 常见界面词（不是台词，但屏幕上会出现）---- */
window.DE_UI = {
  "PLAY": "开始游戏",
  "HELP": "玩法说明",
  "CREDITS": "制作名单",
  "REDEFINE KEYS": "重新设置按键",
  "1 PLAYER": "单人玩",
  "2 PLAYERS": "双人玩",
  "BACK": "返回",
  "PLAYER SELECT": "选择人数",
  "BACK TO MAP": "返回地图",
  "NEXT STAGE": "下一关",
  "TRY AGAIN": "再试一次",
  "LOADING LEVEL": "关卡加载中…",
  "LEVEL CLEAR": "过关",
  "STAGE COMPLETE!": "关卡完成！",
  "GAME OVER!": "游戏结束",
  "PLAYER 1 WINS!": "玩家 1 获胜！",
  "ENTER YOUR NAME": "输入你的名字",
  "ENTER TEXT": "输入文字",
  "NO LEADERBOARD DATA": "暂无排行榜数据",
  "SCORE SUBMITTED": "分数已提交",
  "HELP ME!": "救命啊！"
};

/* 界面词索引：键统一归一化，否则 STAGE COMPLETE! 这类带标点的查不到 */
window.DE_UI_N = (function () {
  var m = {};
  for (var k in window.DE_UI) m[window.DE_NORM(k)] = window.DE_UI[k];
  return m;
})();

/* 一行字幕：优先台词，其次界面词；纯数字忽略 */
window.DE_TRANSLATE = function (texts) {
  var dialogue = [], ui = [];
  for (var i = 0; i < texts.length; i++) {
    var raw = texts[i];
    if (/^[\d\s:,.%+\-]+$/.test(raw)) continue;
    var zh = window.DE_MATCH(raw);
    if (zh) { if (dialogue.indexOf(zh) < 0) dialogue.push(zh); continue; }
    var k = window.DE_NORM(raw);
    var u = window.DE_UI_N[k];
    if (u && ui.indexOf(u) < 0) ui.push(u);
  }
  /* 台词优先：气泡在说话时只显示台词，别把 REDEFINE KEYS 这类界面词混进字幕 */
  var pick = dialogue.length ? dialogue : ui;
  return pick.join("　");
};