/* 共通ユーティリティ */
(function (g) {
  "use strict";
  var U = {};

  U.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* 例文中の {対象語} を強調表示 */
  U.markEx = function (s) {
    return U.esc(s).replace(/\{([^}]*)\}/g, '<b class="hl">$1</b>');
  };
  /* 例文中の {対象語} を空欄にする */
  U.blankEx = function (s) {
    return U.esc(s).replace(/\{([^}]*)\}/g, '<span class="blank">　　　</span>');
  };
  U.plainEx = function (s) { return String(s).replace(/[{}]/g, ""); };
  U.hasTarget = function (s) { return /\{[^}]+\}/.test(s); };

  U.shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  U.pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };

  U.today = function (d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  };
  U.fmtDate = function (ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "/" + d.getDate();
  };
  U.pct = function (a, b) { return b ? Math.round((a / b) * 100) : 0; };

  /* 解答の比較用：小文字化・記号除去・A/B/doing などのプレースホルダー除去 */
  var PH = { a: 1, b: 1, "one's": 1, oneself: 1, doing: 1, someone: 1, something: 1, sb: 1, sth: 1, "~": 1, "〜": 1 };
  U.normAnswer = function (s) {
    return String(s || "").toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/[^a-z' ~〜-]/g, " ")
      .split(/\s+/).filter(function (t) { return t && !PH[t]; }).join(" ");
  };

  U.qs = function (sel, root) { return (root || document).querySelector(sel); };
  U.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  g.U = U;
})(window);
