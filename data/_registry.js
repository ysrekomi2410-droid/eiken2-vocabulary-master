/*
 * 単語データの登録口。各データファイルは EIKEN.add([...]) を呼ぶだけ。
 * フィールド仕様は docs/DATA_FORMAT.md を参照。
 */
(function (g) {
  "use strict";
  var EIKEN = g.EIKEN || { items: [], sources: [] };
  EIKEN.add = function (list, source) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      e.k = e.k || "w";
      e.id = e.id || e.w;
      e._src = source || "";
      EIKEN.items.push(e);
    }
    EIKEN.sources.push({ name: source || "", count: list.length });
  };
  g.EIKEN = EIKEN;
})(typeof window !== "undefined" ? window : globalThis);
