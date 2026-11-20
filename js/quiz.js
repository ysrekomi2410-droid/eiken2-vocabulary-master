/* 出題ロジック：セッション作成・選択肢生成 */
(function (g) {
  "use strict";

  var PARTICLES = ["about", "across", "after", "against", "along", "around", "as", "at", "away", "back",
    "by", "down", "for", "from", "in", "into", "of", "off", "on", "out", "over", "through", "to", "up", "with"];
  var COMMON = ["in", "on", "at", "to", "for", "with", "from", "of", "by", "up", "out", "off", "into", "about", "down", "over", "away"];
  var isParticle = {};
  PARTICLES.forEach(function (p) { isParticle[p] = 1; });

  var MODES = {
    e2j: { label: "英語 → 日本語", desc: "単語を見て意味を思い出す（自己採点）" },
    j2e: { label: "日本語 → 英語", desc: "意味を見て英語を入力する" },
    mc: { label: "4択テスト", desc: "似た意味の選択肢から正しいものを選ぶ" },
    fill: { label: "例文穴埋め", desc: "文脈から空欄に入る語を選ぶ" },
    prep: { label: "前置詞・副詞を選ぶ", desc: "熟語の前置詞・副詞を正確に覚える" },
    mix: { label: "おすすめミックス", desc: "4択・穴埋め・前置詞を混ぜて出題" }
  };

  function exWithTarget(e) {
    return e.ex.filter(function (x) { return U.hasTarget(x[0]); });
  }
  /* 前置詞・副詞の空欄候補の位置 */
  function particleSlots(e) {
    if (e.k === "w") return [];
    var t = e.w.split(/\s+/), slots = [];
    for (var i = 0; i < t.length; i++) {
      if (!isParticle[t[i]]) continue;
      if (i === 0 && e.k === "ph") continue;
      slots.push(i);
    }
    return slots;
  }

  /* 紛らわしい選択肢を選ぶ（同じ品詞・同じ分野を優先、意味が重なるものは除外） */
  function distractors(e, n, mode) {
    var idiom = Data.isIdiom(e);
    var pool = Data.items.filter(function (o) {
      if (o === e || o.w === e.w) return false;
      if (idiom) return Data.isIdiom(o);
      return o.k === "w" && o.pos.some(function (p) { return e.pos.indexOf(p) >= 0; });
    });
    if (pool.length < n) pool = Data.items.filter(function (o) { return o !== e; });

    var gt = Data.glossTokens(e);
    var syn = {}; (e.syn || []).forEach(function (s) { syn[s.toLowerCase()] = 1; });
    var scored = [];
    pool.forEach(function (o) {
      var og = Data.glossTokens(o);
      var overlap = og.some(function (t) { return gt.some(function (u) { return t === u || (t.length >= 3 && u.indexOf(t) >= 0) || (u.length >= 3 && t.indexOf(u) >= 0); }); });
      if (overlap) return;
      if (mode === "fill" && (syn[o.w.toLowerCase()] || (o.syn || []).indexOf(e.w) >= 0)) return; // 文脈で正解になり得る語は除外
      var s = Math.random() * 2.5;
      o.cat.forEach(function (c) { if (e.cat.indexOf(c) >= 0) s += 1.5; });
      if (o.pos[0] === e.pos[0]) s += 1;
      if (o.lv === e.lv) s += 0.5;
      if (mode !== "fill" && syn[o.w.toLowerCase()]) s += 2; // 意味が近い語は良い引っかけ
      scored.push([s, o]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    var out = [], seen = {};
    for (var i = 0; i < scored.length && out.length < n; i++) {
      var o = scored[i][1];
      if (seen[o.ja] || seen[o.w]) continue;
      seen[o.ja] = seen[o.w] = 1;
      out.push(o);
    }
    return out;
  }

  function makeQuestion(e, type, dir) {
    var q = { type: type, id: e.id, dir: dir || "e2j" };
    if (type === "mc") {
      q.options = U.shuffle([e].concat(distractors(e, 3, "mc"))).map(function (o) { return o.id; });
    } else if (type === "fill") {
      var exs = exWithTarget(e);
      q.ex = U.pick(exs);
      q.options = U.shuffle([e].concat(distractors(e, 3, "fill"))).map(function (o) { return o.id; });
    } else if (type === "prep") {
      var slots = particleSlots(e);
      var si = U.pick(slots);
      var tokens = e.w.split(/\s+/);
      var ans = tokens[si];
      var others = U.shuffle(COMMON.filter(function (p) { return p !== ans && tokens.indexOf(p) < 0; })).slice(0, 3);
      q.slot = si;
      q.answer = ans;
      q.options = U.shuffle([ans].concat(others));
      q.ex = exWithTarget(e)[0] || e.ex[0];
    }
    return q;
  }

  function canDo(e, type) {
    if (type === "fill") return exWithTarget(e).length > 0;
    if (type === "prep") return particleSlots(e).length > 0;
    return true;
  }

  /* 重み付きランダム抽出（重みが大きい語ほど選ばれやすい） */
  function weightedPick(list, n) {
    return list.map(function (e) {
      var w = Math.max(Store.weight(e.id), 0.01);
      return [Math.pow(Math.random(), 1 / w), e];
    }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, n).map(function (x) { return x[1]; });
  }

  /*
   * opt: {mode, cat, status, lv, count, order(smart|random|list), dir(e2j|j2e), ids}
   */
  function buildSession(opt) {
    var mode = opt.mode || "mc";
    var pool = opt.ids ? opt.ids.map(Data.get).filter(Boolean) : Data.filter(opt);
    if (mode === "fill" || mode === "prep") pool = pool.filter(function (e) { return canDo(e, mode); });
    var count = Math.min(opt.count || 20, pool.length);
    var chosen;
    if (opt.order === "list") chosen = pool.slice(0, count);
    else if (opt.order === "random") chosen = U.shuffle(pool.slice()).slice(0, count);
    else chosen = weightedPick(pool, count);

    var qs = chosen.map(function (e) {
      var type = mode;
      if (mode === "mix") {
        var r = Math.random();
        if (canDo(e, "prep") && r < 0.3) type = "prep";
        else if (canDo(e, "fill") && r < 0.65) type = "fill";
        else type = "mc";
      }
      return { type: type, id: e.id };
    });
    return { mode: mode, dir: opt.dir || "e2j", opt: opt, qs: qs, i: 0, results: [], started: Date.now() };
  }

  g.Quiz = {
    MODES: MODES,
    buildSession: buildSession,
    makeQuestion: makeQuestion,
    canDo: canDo,
    particleSlots: particleSlots,
    poolSize: function (opt) {
      var pool = Data.filter(opt);
      if (opt.mode === "fill" || opt.mode === "prep") pool = pool.filter(function (e) { return canDo(e, opt.mode); });
      return pool.length;
    }
  };
})(window);
