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
