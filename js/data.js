/* 単語データの索引・カテゴリ・検索 */
(function (g) {
  "use strict";
  var items = (g.EIKEN && g.EIKEN.items) || [];
  var byId = {};
  items.forEach(function (e, i) {
    e._i = i;
    if (typeof e.pos === "string") e.pos = [e.pos];
    e.pos = e.pos || [];
    e.cat = e.cat || [];
    e.ex = e.ex || [];
    if (byId[e.id]) console.warn("ID重複:", e.id);
    byId[e.id] = e;
    e._search = (e.w + " " + e.ja + " " + (e.syn || []).join(" ") + " " + (e.pat || "")).toLowerCase();
  });

  var POS_LABEL = { v: "動", n: "名", adj: "形", adv: "副", prep: "前", conj: "接" };
  var KIND_LABEL = { w: "単語", ph: "句動詞", id: "熟語" };

  function hasPos(p) { return function (e) { return e.k === "w" && e.pos.indexOf(p) >= 0; }; }
  function hasCat(c) { return function (e) { return e.cat.indexOf(c) >= 0; }; }

  var CATS = [
    { id: "all", label: "全単語", group: "", test: function () { return true; } },
    { id: "v", label: "動詞", group: "品詞", test: hasPos("v") },
    { id: "n", label: "名詞", group: "品詞", test: hasPos("n") },
    { id: "adj", label: "形容詞", group: "品詞", test: hasPos("adj") },
    { id: "adv", label: "副詞", group: "品詞", test: hasPos("adv") },
    { id: "phr_all", label: "熟語すべて", group: "熟語", test: function (e) { return e.k === "id" || e.k === "ph"; } },
    { id: "idiom", label: "熟語・表現", group: "熟語", test: function (e) { return e.k === "id"; } },
    { id: "phrasal", label: "句動詞", group: "熟語", test: function (e) { return e.k === "ph"; } },
    { id: "env", label: "環境", group: "分野", test: hasCat("env") },
    { id: "sci", label: "科学・テクノロジー", group: "分野", test: hasCat("sci") },
    { id: "edu", label: "教育", group: "分野", test: hasCat("edu") },
    { id: "soc", label: "社会・政治", group: "分野", test: hasCat("soc") },
    { id: "eco", label: "経済", group: "分野", test: hasCat("eco") },
    { id: "med", label: "医療・健康", group: "分野", test: hasCat("med") },
    { id: "life", label: "生活", group: "分野", test: hasCat("life") },
    { id: "human", label: "人間関係", group: "分野", test: hasCat("human") }
  ];
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  /* 種類ごとに事前計算（数千語でも高速に絞り込めるように） */
  var catIndex = {};
  CATS.forEach(function (c) { catIndex[c.id] = items.filter(c.test); });

  var D = {
    items: items,
    get: function (id) { return byId[id]; },
    CATS: CATS,
    cat: function (id) { return catById[id] || catById.all; },
    inCat: function (id) { return catIndex[id] || items; },
    isIdiom: function (e) { return e.k === "ph" || e.k === "id"; },
    posLabel: function (e) {
      if (e.k !== "w") return KIND_LABEL[e.k];
      return e.pos.map(function (p) { return POS_LABEL[p] || p; }).join("・");
    },
    kindLabel: function (e) { return KIND_LABEL[e.k] || ""; },
    catLabels: function (e) {
      return e.cat.map(function (c) { return catById[c] ? catById[c].label : c; });
    },
    /*
     * 絞り込み
     * opt: {cat, q, lv, status}  status = all|new|weak|learning|master|due
     */
    filter: function (opt) {
      var list = D.inCat(opt.cat || "all");
      var q = (opt.q || "").trim().toLowerCase();
      var lv = +opt.lv || 0;
      var st = opt.status || "all";
      if (!q && !lv && st === "all") return list;
      var out = list.filter(function (e) {
        if (lv && e.lv !== lv) return false;
        if (q && e._search.indexOf(q) < 0) return false;
        if (st !== "all") {
          if (st === "due") { if (!Store.isDue(e.id)) return false; }
          else if (Store.status(e.id) !== st) return false;
        }
        return true;
      });
      if (q) {
        // 見出し語が検索語で始まるものを先頭に
        var head = [], rest = [];
        out.forEach(function (e) { (e.w.toLowerCase().indexOf(q) === 0 ? head : rest).push(e); });
        out = head.concat(rest);
      }
      return out;
    },
    /* 意味の主要部分（選択肢の重複判定用） */
    glossTokens: function (e) {
      return String(e.ja).split(/[、,，;；／\/①-⑨()（）\s]+/)
        .map(function (t) { return t.replace(/^[〜~]?(を|に|が|は|と|で|の)?/, "").replace(/[〜~]/g, "").trim(); })
        .filter(function (t) { return t.length >= 2; });
    }
  };

  g.Data = D;
})(window);
