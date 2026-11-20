/*
 * 学習記録の保存（localStorage）と復習スケジュール（間隔反復）
 *
 * 1語ごとの記録 p:
 *   n: 学習回数  c: 正解数  x: 不正解数  s: 連続正解数
 *   b: 習熟ボックス(0-5)  due: 次回復習の目安時刻  last: 最終学習時刻
 *   weak: 苦手フラグ（1度でも間違えると true、3回連続正解で卒業）
 */
(function (g) {
  "use strict";
  var KEY = "eiken2.progress.v1";
  var SKEY = "eiken2.settings.v1";
  var DAY = 86400000;
  /* ボックスごとの次回復習までの間隔 */
  var INTERVAL = [10 * 60000, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
  var WEAK_CLEAR = 3; // 苦手卒業に必要な連続正解数
  var MASTER_BOX = 3; // このボックス以上を「定着」とみなす

  var state = load(KEY, { items: {}, daily: {}, v: 1 });
  var settings = load(SKEY, { autoSpeak: false, rate: 0.9, listView: "both" });

  function load(k, def) {
    try {
      var s = localStorage.getItem(k);
      if (s) {
        var o = JSON.parse(s);
        for (var key in def) if (!(key in o)) o[key] = def[key];
        return o;
      }
    } catch (e) { /* 読めない場合は初期値 */ }
    return JSON.parse(JSON.stringify(def));
  }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 200);
  }
  function flush() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("保存に失敗", e); }
  }
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);

  var S = {
    MASTER_BOX: MASTER_BOX,
    WEAK_CLEAR: WEAK_CLEAR,
    get: function (id) { return state.items[id] || null; },
    all: function () { return state.items; },
    daily: function () { return state.daily; },

    /* 解答結果を記録する */
    record: function (id, ok) {
      var now = Date.now();
      var p = state.items[id] || (state.items[id] = { n: 0, c: 0, x: 0, s: 0, b: 0, due: 0, last: 0, weak: false });
      p.n++; p.last = now;
      if (ok) {
        p.c++; p.s++;
        p.b = Math.min(p.b + 1, INTERVAL.length - 1);
        if (p.weak && p.s >= WEAK_CLEAR) p.weak = false;
      } else {
        p.x++; p.s = 0;
        p.b = 0;
        p.weak = true;
      }
      p.due = now + INTERVAL[p.b];
      var d = U.today();
      var day = state.daily[d] || (state.daily[d] = { n: 0, c: 0 });
      day.n++; if (ok) day.c++;
      save();
      return p;
    },

    setWeak: function (id, flag) {
      var p = state.items[id] || (state.items[id] = { n: 0, c: 0, x: 0, s: 0, b: 0, due: 0, last: 0, weak: false });
      p.weak = !!flag;
      if (flag) p.s = 0;
      save();
    },

    status: function (id) {
      var p = state.items[id];
      if (!p || !p.n) return "new";
      if (p.weak) return "weak";
      if (p.b >= MASTER_BOX) return "master";
      return "learning";
    },

    /*
     * 出題の優先度（重み）。苦手・復習期限切れは高く、
     * 何度も正解して定着した語は低くする。
     */
    weight: function (id) {
      var p = state.items[id];
      if (!p || !p.n) return 1.2;               // 未学習
      var now = Date.now();
      var w;
      if (p.weak) w = 6 + Math.min(p.x, 5);      // 苦手
      else if (p.due <= now) w = 3 + Math.min((now - p.due) / DAY, 7) * 0.5; // 復習期限切れ
      else w = 0.6 / (p.b + 1);                 // まだ期限前
      return w;
    },
    isDue: function (id) {
      var p = state.items[id];
      return !!p && p.n > 0 && (p.weak || p.due <= Date.now());
    },

    streakDays: function () {
      var n = 0, d = new Date();
      if (!state.daily[U.today(d)]) d.setDate(d.getDate() - 1); // 今日まだなら昨日から数える
      while (state.daily[U.today(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },

    settings: settings,
    saveSettings: function () {
      try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* noop */ }
    },

    exportJSON: function () {
      flush();
      return JSON.stringify({ app: "eiken2-vocab", exported: new Date().toISOString(), progress: state, settings: settings });
    },
    importJSON: function (text) {
      var o = JSON.parse(text);
      if (!o || !o.progress || typeof o.progress.items !== "object") throw new Error("形式が正しくありません");
      state = o.progress;
      if (!state.daily) state.daily = {};
      flush();
    },
    reset: function () {
      state = { items: {}, daily: {}, v: 1 };
      flush();
    }
  };

  g.Store = S;
})(window);
