/* 画面（ルーティング・描画・操作） */
(function (g) {
  "use strict";
  var esc = U.esc;
  var app = document.getElementById("app");
  var keyHandler = null;          // 現在の画面のキーボード操作
  var session = null;             // 実行中のテスト
  var lastList = [];              // 単語帳で最後に表示した一覧（前後移動用）
  var listState = { cat: "all", q: "", lv: 0, status: "all", shown: 80 };
  var STATUS_LABEL = { new: "未学習", learning: "学習中", weak: "苦手", master: "定着" };

  /* ---------- 共通部品 ---------- */
  function stars(lv) { return '<span class="stars" title="重要度">' + "★★★".slice(0, lv) + '<i>' + "★★★".slice(lv) + "</i></span>"; }
  function statusDot(id) {
    var s = Store.status(id);
    return '<span class="dot ' + s + '" title="' + STATUS_LABEL[s] + '"></span>';
  }
  function speakBtn(text, head, cls) {
    if (!Speech.available) return "";
    return '<button class="speak ' + (cls || "") + '" data-say="' + esc(text) + '"' + (head ? ' data-head="1"' : "") + ' aria-label="発音を聞く">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg></button>';
  }
  function catOptions(sel) {
    return Data.CATS.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === sel ? " selected" : "") + ">" + (c.group ? c.group + "：" : "") + c.label + "（" + Data.inCat(c.id).length + "）</option>";
    }).join("");
  }
  function href(path, params) {
    var q = [];
    for (var k in params) if (params[k] !== undefined && params[k] !== "") q.push(k + "=" + encodeURIComponent(params[k]));
    return "#/" + path + (q.length ? "?" + q.join("&") : "");
  }
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var params = {};
    if (qi >= 0) h.slice(qi + 1).split("&").forEach(function (kv) {
      var p = kv.split("=");
      if (p[0]) params[p[0]] = decodeURIComponent(p[1] || "");
    });
    var parts = path.split("/").map(decodeURIComponent);
    return { name: parts[0] || "home", arg: parts.slice(1).join("/"), params: params };
  }
  function counts(list) {
    var c = { new: 0, learning: 0, weak: 0, master: 0, total: list.length };
    for (var i = 0; i < list.length; i++) c[Store.status(list[i].id)]++;
    return c;
  }
  function progressBar(c) {
    var t = c.total || 1;
    return '<div class="pbar" role="img" aria-label="定着' + c.master + ' 学習中' + c.learning + ' 苦手' + c.weak + ' 未学習' + c.new + '">' +
      ['master', 'learning', 'weak'].map(function (k) {
        return c[k] ? '<span class="seg ' + k + '" style="width:' + (c[k] / t * 100) + '%"></span>' : "";
      }).join("") + "</div>";
  }
  function legend(c) {
    return '<div class="legend">' + ["master", "learning", "weak", "new"].map(function (k) {
      return '<span><i class="dot ' + k + '"></i>' + STATUS_LABEL[k] + " <b>" + c[k] + "</b></span>";
    }).join("") + "</div>";
  }

  /* ---------- ホーム ---------- */
  function viewHome() {
    var all = Data.items;
    var c = counts(all);
    var daily = Store.daily();
    var td = daily[U.today()] || { n: 0, c: 0 };
    var due = 0;
    all.forEach(function (e) { if (Store.isDue(e.id)) due++; });

    var days = [], max = 1;
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var r = daily[U.today(d)] || { n: 0, c: 0 };
      days.push({ d: d, r: r }); if (r.n > max) max = r.n;
    }
    var wd = "日月火水木金土";
    var chart = '<div class="chart">' + days.map(function (x) {
      return '<div class="col"><div class="bars"><span class="b" style="height:' + (x.r.n / max * 100) + '%"><span class="bc" style="height:' + U.pct(x.r.c, x.r.n) + '%"></span></span></div>' +
        '<small>' + (x.r.n || "") + "</small><em>" + wd[x.d.getDay()] + "</em></div>";
    }).join("") + "</div>";

    var modes = [
      ["list", "1", "単語帳", "一覧・検索・詳しい解説", href("list")],
      ["e2j", "2", "英語 → 日本語", "見て意味を思い出す", href("test", { mode: "e2j" })],
      ["j2e", "3", "日本語 → 英語", "意味から英語を書く", href("test", { mode: "j2e" })],
      ["mc", "4", "4択テスト", "紛らわしい選択肢で実戦練習", href("test", { mode: "mc" })],
      ["idioms", "5", "熟語集中", "熟語・句動詞・前置詞", href("idioms")],
      ["fill", "6", "例文穴埋め", "文脈から判断する", href("test", { mode: "fill" })]
    ];

    var catRows = Data.CATS.filter(function (x) { return x.group === "分野"; }).map(function (cat) {
      var cc = counts(Data.inCat(cat.id));
      return '<a class="catrow" href="' + href("list", { cat: cat.id }) + '"><span class="cl">' + cat.label + "</span>" + progressBar(cc) +
        '<span class="cn">' + cc.master + "/" + cc.total + "</span></a>";
    }).join("");

    app.innerHTML =
      '<section class="card hero">' +
      '<div class="hero-head"><h1>今日の学習</h1><span class="streak">' + (Store.streakDays() ? "🔥 " + Store.streakDays() + "日連続" : "今日から始めよう") + "</span></div>" +
      '<div class="kpis">' +
      kpi(td.n, "今日の解答") + kpi(td.n ? U.pct(td.c, td.n) + "%" : "—", "正答率") +
      kpi(due, "復習待ち") + kpi(c.weak, "苦手") +
      "</div>" +
      '<button class="btn primary big" id="startReco">おすすめ復習を始める <small>苦手・復習期限を優先して20問</small></button>' +
      "</section>" +
      '<section class="card"><h2>全体の進捗 <small>' + all.length + "項目（単語 " + Data.items.filter(function (e) { return e.k === "w"; }).length + " ／ 熟語・句動詞 " + Data.inCat("phr_all").length + "）</small></h2>" +
      progressBar(c) + legend(c) +
      '<h3>直近7日間の解答数</h3>' + chart + "</section>" +
      '<section><h2 class="sec">学習モード</h2><div class="modes">' + modes.map(function (m) {
        return '<a class="mode" href="' + m[4] + '"><span class="mn">' + m[1] + "</span><b>" + m[2] + "</b><small>" + m[3] + "</small></a>";
      }).join("") + "</div></section>" +
      '<section class="card"><h2>分野別の進捗 <small>定着数／全体</small></h2>' + catRows + "</section>";

    U.qs("#startReco").onclick = function () {
      startSession({ mode: "mix", cat: "all", status: "all", count: 20, order: "smart" });
    };
    function kpi(v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; }
  }

  /* ---------- 単語帳（一覧） ---------- */
  function viewList(params) {
    if (params.cat) listState.cat = params.cat;
    if (params.status) listState.status = params.status;
    var view = Store.settings.listView || "both";
    app.innerHTML =
      '<div class="toolbar card">' +
      '<input id="q" type="search" placeholder="英語・日本語で検索" value="' + esc(listState.q) + '" autocomplete="off">' +
      '<div class="chips" id="chips">' + Data.CATS.map(function (c) {
        return '<button class="chip' + (c.id === listState.cat ? " on" : "") + '" data-cat="' + c.id + '">' + c.label + "</button>";
      }).join("") + "</div>" +
      '<div class="filters">' +
      '<select id="lv"><option value="0">重要度：すべて</option><option value="3">★★★ 最重要</option><option value="2">★★ 重要</option><option value="1">★ 発展</option></select>' +
      '<select id="st"><option value="all">状態：すべて</option><option value="new">未学習</option><option value="learning">学習中</option><option value="weak">苦手</option><option value="master">定着</option><option value="due">復習期限</option></select>' +
      '<div class="seg-ctl" id="view" role="group" aria-label="表示切替">' +
      [["both", "英＋日"], ["en", "英語のみ"], ["ja", "日本語のみ"]].map(function (v) {
        return '<button data-v="' + v[0] + '"' + (v[0] === view ? ' class="on"' : "") + ">" + v[1] + "</button>";
      }).join("") + "</div></div></div>" +
      '<div class="listhead"><span id="cnt"></span><span class="acts"><button class="btn sm" id="toCard">カードで学習</button><button class="btn sm" id="toMc">4択テスト</button></span></div>' +
      '<div id="rows" class="rows view-' + view + '"></div>';

    U.qs("#lv").value = String(listState.lv);
    U.qs("#st").value = listState.status;

    function render(reset) {
      if (reset) listState.shown = 80;
      lastList = Data.filter(listState);
      U.qs("#cnt").textContent = lastList.length + "件";
      var html = lastList.slice(0, listState.shown).map(function (e) {
        return '<a class="row" href="#/word/' + encodeURIComponent(e.id) + '">' + statusDot(e.id) +
          '<span class="rw">' + esc(e.w) + "</span>" +
          '<span class="rp">' + esc(Data.posLabel(e)) + "</span>" +
          '<span class="rj">' + esc(e.ja) + "</span>" +
          '<span class="rl">' + stars(e.lv) + "</span></a>";
      }).join("");
      if (!lastList.length) html = '<p class="empty">該当する項目がありません。</p>';
      if (lastList.length > listState.shown) html += '<button class="btn more" id="more">さらに表示（残り ' + (lastList.length - listState.shown) + "件）</button>";
      U.qs("#rows").innerHTML = html;
      var more = U.qs("#more");
      if (more) more.onclick = function () { listState.shown += 200; render(false); };
    }
    render(false);

    var timer;
    U.qs("#q").oninput = function (ev) {
      clearTimeout(timer);
      timer = setTimeout(function () { listState.q = ev.target.value; render(true); }, 120);
    };
    U.qs("#chips").onclick = function (ev) {
      var b = ev.target.closest("[data-cat]"); if (!b) return;
      listState.cat = b.getAttribute("data-cat");
      U.qsa(".chip", this).forEach(function (x) { x.classList.toggle("on", x === b); });
      render(true);
    };
    U.qs("#lv").onchange = function () { listState.lv = +this.value; render(true); };
    U.qs("#st").onchange = function () { listState.status = this.value; render(true); };
    U.qs("#view").onclick = function (ev) {
      var b = ev.target.closest("[data-v]"); if (!b) return;
      Store.settings.listView = b.getAttribute("data-v"); Store.saveSettings();
      U.qsa("button", this).forEach(function (x) { x.classList.toggle("on", x === b); });
      U.qs("#rows").className = "rows view-" + Store.settings.listView;
    };
    var chipOn = U.qs(".chip.on"); if (chipOn) chipOn.scrollIntoView({ block: "nearest", inline: "center" });
    U.qs("#toCard").onclick = function () { fromList("e2j"); };
    U.qs("#toMc").onclick = function () { fromList("mc"); };
    function fromList(mode) {
      if (!lastList.length) return;
      startSession({ mode: mode, ids: lastList.map(function (e) { return e.id; }), count: 20, order: "smart" });
    }
  }

  /* ---------- 単語の詳細 ---------- */
  function linkWord(w) {
    var base = String(w).split(" (")[0].trim();
    var e = Data.get(base);
    return e ? '<a href="#/word/' + encodeURIComponent(e.id) + '">' + esc(w) + "</a>" : esc(w);
  }
  function viewWord(id) {
    var e = Data.get(id);
    if (!e) { app.innerHTML = '<p class="empty">項目が見つかりません。</p>'; return; }
    var p = Store.get(id) || { n: 0, c: 0, x: 0, s: 0, last: 0, weak: false };
    var idx = lastList.indexOf(e);
    var prev = idx > 0 ? lastList[idx - 1] : null;
    var next = idx >= 0 && idx < lastList.length - 1 ? lastList[idx + 1] : null;
    var st = Store.status(id);

    function sec(title, body) { return body ? '<div class="sec-b"><h3>' + title + "</h3>" + body + "</div>" : ""; }
    function chips(arr, link) {
      return arr && arr.length ? '<div class="tags">' + arr.map(function (x) { return "<span>" + (link ? linkWord(x) : esc(x)) + "</span>"; }).join("") + "</div>" : "";
    }
    function lines(arr) {
      return arr && arr.length ? "<ul class=\"lines\">" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "";
    }

    app.innerHTML =
      '<div class="wnav"><a href="#/list" class="btn sm ghost">← 一覧</a>' +
      (idx >= 0 ? "<span>" + (idx + 1) + " / " + lastList.length + "</span>" : "<span></span>") +
      '<span class="pn">' + (prev ? '<a class="btn sm" href="#/word/' + encodeURIComponent(prev.id) + '" id="prev">‹ 前</a>' : "") +
      (next ? '<a class="btn sm" href="#/word/' + encodeURIComponent(next.id) + '" id="next">次 ›</a>' : "") + "</span></div>" +
      '<article class="card word">' +
      '<div class="w-head"><h1 class="w-word">' + esc(e.w) + "</h1>" + speakBtn(e.w, true, "lg") + "</div>" +
      '<div class="w-pron">' + (e.ipa ? '<span class="ipa">/' + esc(e.ipa) + "/</span>" : "") + (e.kana ? '<span class="kana">' + esc(e.kana) + "</span>" : "") + "</div>" +
      '<div class="w-tags"><span class="tag pos">' + esc(Data.posLabel(e)) + "</span>" + stars(e.lv) +
      Data.catLabels(e).map(function (l) { return '<span class="tag">' + esc(l) + "</span>"; }).join("") +
      '<span class="tag st-' + st + '">' + STATUS_LABEL[st] + "</span></div>" +
      '<p class="w-ja">' + esc(e.ja) + "</p>" +
      (e.key ? '<p class="w-key"><b>英検2級ポイント</b>' + esc(e.key) + "</p>" : "") +
      (e.pat ? '<p class="w-pat"><b>文法パターン</b><code>' + esc(e.pat) + "</code></p>" : "") +
      sec("例文", '<ul class="exs">' + e.ex.map(function (x) {
        return "<li><p class=\"en\">" + U.markEx(x[0]) + " " + speakBtn(x[0]) + '</p><p class="jp">' + esc(x[1]) + "</p></li>";
      }).join("") + "</ul>") +
      sec(Data.isIdiom(e) ? "似た表現との違い・覚え方" : "覚えるポイント・使い分け", e.tip ? "<p>" + esc(e.tip) + "</p>" : "") +
      sec("注意点（目的語の位置など）", e.note ? "<p>" + esc(e.note) + "</p>" : "") +
      sec("よく使われる組み合わせ", lines(e.col)) +
      sec("類義語", chips(e.syn, true)) +
      sec("反対語", chips(e.ant, true)) +
      sec("関連語", chips(e.rel, true)) +
      "</article>" +
      '<section class="card stats"><h2>学習記録</h2><div class="kpis six">' +
      [[p.n, "学習回数"], [p.c, "正解"], [p.x, "間違い"], [p.s, "連続正解"], [p.n ? U.pct(p.c, p.n) + "%" : "—", "正答率"], [U.fmtDate(p.last), "最終学習日"]].map(function (k) {
        return '<div class="kpi"><b>' + k[0] + "</b><span>" + k[1] + "</span></div>";
      }).join("") + "</div>" +
      '<button class="btn" id="weakT">' + (p.weak ? "苦手から外す" : "苦手に登録する") + "</button></section>";

    U.qs("#weakT").onclick = function () { Store.setWeak(id, !p.weak); viewWord(id); };
    if (Store.settings.autoSpeak) Speech.say(e.w, true);
    keyHandler = function (ev) {
      if (ev.key === "ArrowLeft" && prev) location.hash = "#/word/" + encodeURIComponent(prev.id);
      else if (ev.key === "ArrowRight" && next) location.hash = "#/word/" + encodeURIComponent(next.id);
      else if (ev.key === " " || ev.key === "s") { ev.preventDefault(); Speech.say(e.w, true); }
    };
  }

  /* ---------- テスト設定 ---------- */
  var testOpt = { mode: "mc", cat: "all", status: "all", lv: 0, count: 20, order: "smart", dir: "e2j" };
  function viewTest(params) {
    if (params.mode && Quiz.MODES[params.mode]) testOpt.mode = params.mode;
    if (params.cat) testOpt.cat = params.cat;
    if (params.status) testOpt.status = params.status;
    var modeKeys = ["mix", "e2j", "j2e", "mc", "fill", "prep"];
    app.innerHTML =
      '<section class="card"><h1>テスト</h1>' +
      '<div class="modepick">' + modeKeys.map(function (k) {
        var m = Quiz.MODES[k];
        return '<label class="mp' + (k === testOpt.mode ? " on" : "") + '"><input type="radio" name="mode" value="' + k + '"' + (k === testOpt.mode ? " checked" : "") + "><b>" + m.label + "</b><small>" + m.desc + "</small></label>";
      }).join("") + "</div>" +
      '<div class="form">' +
      '<label>出題範囲<select id="cat">' + catOptions(testOpt.cat) + "</select></label>" +
      '<label>学習状態<select id="status"><option value="all">すべて</option><option value="new">未学習のみ</option><option value="weak">苦手のみ</option><option value="due">復習期限が来たもの</option><option value="learning">学習中</option><option value="master">定着済み（確認用）</option></select></label>' +
      '<label>重要度<select id="lv"><option value="0">すべて</option><option value="3">★★★ 最重要</option><option value="2">★★ 重要</option><option value="1">★ 発展</option></select></label>' +
      '<label>問題数<select id="count"><option>10</option><option>20</option><option>30</option><option>50</option><option>100</option></select></label>' +
      '<label>出題順<select id="order"><option value="smart">おすすめ（苦手・期限切れ優先）</option><option value="random">ランダム</option></select></label>' +
      '<label id="dirL">4択の向き<select id="dir"><option value="e2j">英語を見て意味を選ぶ</option><option value="j2e">意味を見て英語を選ぶ</option></select></label>' +
      "</div>" +
      '<p class="pool" id="pool"></p>' +
      '<button class="btn primary big" id="go">スタート</button></section>';

    U.qs("#status").value = testOpt.status;
    U.qs("#lv").value = String(testOpt.lv);
    U.qs("#count").value = String(testOpt.count);
    U.qs("#order").value = testOpt.order;
    U.qs("#dir").value = testOpt.dir;

    function sync() {
      testOpt.cat = U.qs("#cat").value;
      testOpt.status = U.qs("#status").value;
      testOpt.lv = +U.qs("#lv").value;
      testOpt.count = +U.qs("#count").value;
      testOpt.order = U.qs("#order").value;
      testOpt.dir = U.qs("#dir").value;
      U.qs("#dirL").style.display = testOpt.mode === "mc" ? "" : "none";
      var n = Quiz.poolSize(testOpt);
      U.qs("#pool").textContent = n ? "対象：" + n + "項目から " + Math.min(n, testOpt.count) + "問出題" : "この条件に当てはまる項目がありません。";
      U.qs("#go").disabled = !n;
    }
    U.qsa("select", app).forEach(function (s) { s.onchange = sync; });
    U.qs(".modepick").onchange = function (ev) {
      testOpt.mode = ev.target.value;
      U.qsa(".mp", this).forEach(function (l) { l.classList.toggle("on", l.querySelector("input").checked); });
      sync();
    };
    U.qs("#go").onclick = function () { startSession(Object.assign({}, testOpt)); };
    sync();
  }

  /* ---------- テスト実行 ---------- */
  function startSession(opt) {
    session = Quiz.buildSession(opt);
    if (!session.qs.length) { alert("出題できる項目がありません。"); return; }
    if (location.hash === "#/quiz") viewQuiz(); else location.hash = "#/quiz";
  }

  function viewQuiz() {
    if (!session) { location.hash = "#/test"; return; }
    if (session.i >= session.qs.length) return viewResult();
    var slot = session.qs[session.i];
    var e = Data.get(slot.id);
    if (!slot.q) slot.q = Quiz.makeQuestion(e, slot.type, session.dir);
    var q = slot.q;
    var total = session.qs.length;
    var okCount = session.results.filter(function (r) { return r.ok; }).length;

    var head = '<div class="qhead"><button class="btn sm ghost" id="quit">終了</button>' +
      '<div class="qprog"><span style="width:' + (session.i / total * 100) + '%"></span></div>' +
      "<span>" + (session.i + 1) + "/" + total + ' <small class="ok">○' + okCount + "</small></span></div>" +
      '<div class="qtype">' + Quiz.MODES[q.type].label + "</div>";

    var body = "";
    if (q.type === "e2j") body = qE2J(e);
    else if (q.type === "j2e") body = qJ2E(e);
    else if (q.type === "mc") body = qMC(e, q);
    else if (q.type === "fill") body = qFill(e, q);
    else if (q.type === "prep") body = qPrep(e, q);

    app.innerHTML = head + '<section class="card quiz">' + body + '</section><div id="fb"></div>';
    U.qs("#quit").onclick = function () {
      if (!session.results.length || confirm("テストを終了しますか？（ここまでの結果は記録済みです）")) {
        session.qs = session.qs.slice(0, session.results.length);
        session.i = session.results.length;
        viewResult();
      }
    };
    if (Store.settings.autoSpeak && (q.type === "e2j" || (q.type === "mc" && q.dir === "e2j"))) Speech.say(e.w, true);
    bindQuestion(e, q);
  }

  function promptWord(e) {
    return '<div class="qword">' + esc(e.w) + speakBtn(e.w, true) + "</div>" +
      '<div class="qsub">' + (e.ipa ? "/" + esc(e.ipa) + "/ " : "") + '<span class="tag pos">' + esc(Data.posLabel(e)) + "</span></div>";
  }
  function promptJa(e) {
    return '<div class="qja">' + esc(e.ja) + '</div><div class="qsub"><span class="tag pos">' + esc(Data.posLabel(e)) + "</span></div>";
  }
  function explain(e, ok, extra, usedEx) {
    // 問題文で使った例文があれば、解説では別の例文を見せる
    var ex = e.ex.filter(function (x) { return x !== usedEx; })[0];
    return '<div class="card fb ' + (ok ? "good" : "bad") + '">' +
      '<div class="fb-h">' + (ok ? "○ 正解" : "× 不正解") + "</div>" +
      (extra || "") +
      '<div class="fb-w"><a href="#/word/' + encodeURIComponent(e.id) + '" target="_self">' + esc(e.w) + "</a>" + speakBtn(e.w, true) +
      (e.ipa ? ' <span class="ipa">/' + esc(e.ipa) + "/</span>" : "") + "</div>" +
      '<div class="fb-ja">' + esc(e.ja) + "</div>" +
      (e.pat ? '<div class="fb-pat"><code>' + esc(e.pat) + "</code></div>" : "") +
      (ex ? '<p class="en">' + U.markEx(ex[0]) + '</p><p class="jp">' + esc(ex[1]) + "</p>" : "") +
      (e.tip ? '<p class="fb-tip">' + esc(e.tip) + "</p>" : "") +
      (!ok ? '<p class="fb-weak">苦手単語に登録しました。優先的に出題されます。</p>' : "") +
      '<button class="btn primary big" id="next">次へ <small>Enter</small></button></div>';
  }
  function answer(e, ok, extraHtml) {
    if (session.answered) return;
    session.answered = true;
    Store.record(e.id, ok);
    session.results.push({ id: e.id, ok: ok, type: session.qs[session.i].type });
    var fb = U.qs("#fb");
    fb.innerHTML = explain(e, ok, extraHtml, session.qs[session.i].q.ex);
    U.qs("#next").onclick = goNext;
    U.qs("#next").focus({ preventScroll: true });
    fb.scrollIntoView({ block: "nearest", behavior: "auto" });
  }
  function goNext() {
    session.answered = false;
    session.i++;
    viewQuiz();
    window.scrollTo(0, 0);
  }

  function qE2J(e) {
    return promptWord(e) +
      '<div id="reveal" class="reveal hidden"><p class="qja2">' + esc(e.ja) + "</p>" +
      (e.ex[0] ? '<p class="en">' + U.markEx(e.ex[0][0]) + '</p><p class="jp">' + esc(e.ex[0][1]) + "</p>" : "") + "</div>" +
      '<div class="qact" id="act1"><button class="btn primary big" id="show">意味を見る <small>Space</small></button></div>' +
      '<div class="qact two hidden" id="act2"><button class="btn bad big" id="ng">× わからなかった <small>1</small></button><button class="btn good big" id="ok">○ わかった <small>2</small></button></div>';
  }
  function qJ2E(e) {
    var hint = e.w.split(/\s+/).map(function (t) { return t.length <= 1 ? t : t[0] + "＿".repeat(Math.min(t.length - 1, 8)); }).join(" ");
    return promptJa(e) +
      (e.pat ? '<p class="hint">パターン：' + esc(e.pat.replace(new RegExp("\\b(" + e.w.split(/\s+/).map(function (t) { return t.replace(/[^a-z']/gi, ""); }).filter(Boolean).join("|") + ")\\b", "gi"), "＿")) + "</p>" : "") +
      '<p class="hint">ヒント：' + esc(hint) + "（" + e.w.replace(/\s/g, "").length + "文字）</p>" +
      '<form id="jf" class="jform" autocomplete="off"><input id="ans" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="英語で入力" enterkeyhint="done">' +
      '<button class="btn primary" type="submit">判定</button></form>' +
      '<button class="btn ghost sm" id="giveup">わからない</button>';
  }
  function qMC(e, q) {
    var top = q.dir === "j2e" ? promptJa(e) : promptWord(e);
    return top + '<div class="opts">' + q.options.map(function (id, i) {
      var o = Data.get(id);
      return '<button class="opt" data-id="' + esc(id) + '"><span class="on">' + (i + 1) + "</span>" + esc(q.dir === "j2e" ? o.w : o.ja) + "</button>";
    }).join("") + "</div>";
  }
  function qFill(e, q) {
    return '<p class="fill-en">' + U.blankEx(q.ex[0]) + "</p>" +
      '<details class="hintbox"><summary>ヒント：和訳を見る</summary><p class="jp">' + esc(q.ex[1]) + "</p></details>" +
      '<p class="hint">空欄に入る語句を選びましょう（選択肢は原形で表示）</p>' +
      '<div class="opts">' + q.options.map(function (id, i) {
        var o = Data.get(id);
        return '<button class="opt" data-id="' + esc(id) + '"><span class="on">' + (i + 1) + "</span>" + esc(o.w) + "</button>";
      }).join("") + "</div>";
  }
  function prepPattern(e, q) {
    return e.w.split(/\s+/).map(function (t, i) { return i === q.slot ? '<span class="blank sm">？</span>' : esc(t); }).join(" ");
  }
  function prepExample(q) {
    if (!q.ex) return "";
    var done = false;
    var parts = q.ex[0].split(/(\{[^}]*\})/);
    for (var i = parts.length - 1; i >= 0 && !done; i--) {
      if (parts[i][0] !== "{") continue;
      var inner = parts[i].slice(1, -1).split(" ");
      for (var j = inner.length - 1; j >= 0; j--) {
        if (inner[j].toLowerCase() === q.answer) { inner[j] = "\u0000"; done = true; break; }
      }
      parts[i] = "{" + inner.join(" ") + "}";
    }
    return '<p class="en">' + U.markEx(parts.join("")).replace("\u0000", '<span class="blank sm">？</span>') + "</p>";
  }
  function qPrep(e, q) {
    return '<div class="qja">' + esc(e.ja) + "</div>" +
      '<div class="qword prep">' + prepPattern(e, q) + "</div>" +
      prepExample(q) +
      '<div class="opts four">' + q.options.map(function (p, i) {
        return '<button class="opt" data-p="' + p + '"><span class="on">' + (i + 1) + "</span>" + p + "</button>";
      }).join("") + "</div>";
  }

  function bindQuestion(e, q) {
    session.answered = false;
    if (q.type === "e2j") {
      var reveal = function () {
        U.qs("#reveal").classList.remove("hidden");
        U.qs("#act1").classList.add("hidden");
        U.qs("#act2").classList.remove("hidden");
      };
      var grade = function (ok) {
        if (session.answered) return;
        U.qs("#act2").classList.add("hidden");
        answer(e, ok);
      };
      U.qs("#show").onclick = reveal;
      U.qs("#ok").onclick = function () { grade(true); };
      U.qs("#ng").onclick = function () { grade(false); };
      keyHandler = function (ev) {
        var revealed = !U.qs("#reveal").classList.contains("hidden");
        if (session.answered) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); goNext(); } return; }
        if (!revealed && (ev.key === " " || ev.key === "Enter")) { ev.preventDefault(); reveal(); }
        else if (revealed && (ev.key === "1" || ev.key === "ArrowLeft")) grade(false);
        else if (revealed && (ev.key === "2" || ev.key === "ArrowRight")) grade(true);
      };
    } else if (q.type === "j2e") {
      var inp = U.qs("#ans");
      setTimeout(function () { inp.focus(); }, 30);
      var judge = function (given) {
        var ok = given !== null && (U.normAnswer(given) === U.normAnswer(e.w) || (e.pat && U.normAnswer(given) === U.normAnswer(e.pat)));
        inp.disabled = true;
        U.qs("#giveup").disabled = true;
        var extra = given !== null && given !== "" ? '<p class="yours">あなたの解答：<b>' + esc(given) + "</b></p>" : "";
        answer(e, ok, extra);
        if (!ok && given) {
          var fix = document.createElement("button");
          fix.className = "btn sm ghost"; fix.textContent = "表記ゆれなので正解にする";
          fix.onclick = function () {
            Store.record(e.id, true); // 誤判定の補正：正解を追加記録
            session.results[session.results.length - 1].ok = true;
            fix.replaceWith(Object.assign(document.createElement("p"), { className: "fb-weak", textContent: "正解として記録しました。" }));
          };
          U.qs(".fb .fb-h").after(fix);
        }
      };
      U.qs("#jf").onsubmit = function (ev) { ev.preventDefault(); if (!session.answered && inp.value.trim()) judge(inp.value.trim()); };
      U.qs("#giveup").onclick = function () { judge(null); };
      keyHandler = function (ev) {
        if (session.answered && ev.key === "Enter" && document.activeElement !== inp) { ev.preventDefault(); goNext(); }
      };
    } else {
      var opts = U.qsa(".opt", app);
      var choose = function (btn) {
        if (session.answered) return;
        var ok, correctBtn;
        if (q.type === "prep") {
          ok = btn.getAttribute("data-p") === q.answer;
          correctBtn = opts.filter(function (b) { return b.getAttribute("data-p") === q.answer; })[0];
        } else {
          ok = btn.getAttribute("data-id") === e.id;
          correctBtn = opts.filter(function (b) { return b.getAttribute("data-id") === e.id; })[0];
        }
        opts.forEach(function (b) { b.disabled = true; });
        correctBtn.classList.add("correct");
        if (!ok) btn.classList.add("wrong");
        var extra = "";
        if (q.type === "fill") extra = '<p class="en">' + U.markEx(q.ex[0]) + '</p><p class="jp">' + esc(q.ex[1]) + "</p>";
        if (q.type === "mc" || q.type === "fill") {
          // 選んだ誤答の意味も表示して、違いを確認できるようにする
          if (!ok) {
            var o = Data.get(btn.getAttribute("data-id"));
            extra += '<p class="other">選んだ <b>' + esc(o.w) + "</b> は「" + esc(o.ja) + "」</p>";
          }
        }
        answer(e, ok, extra);
      };
      opts.forEach(function (b) { b.onclick = function () { choose(b); }; });
      keyHandler = function (ev) {
        if (session.answered) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); goNext(); } return; }
        var n = parseInt(ev.key, 10);
        if (n >= 1 && n <= opts.length) choose(opts[n - 1]);
      };
    }
  }

  function viewResult() {
    var r = session.results;
    var ok = r.filter(function (x) { return x.ok; }).length;
    var wrongIds = [];
    r.forEach(function (x) { if (!x.ok && wrongIds.indexOf(x.id) < 0) wrongIds.push(x.id); });
    app.innerHTML =
      '<section class="card result"><h1>結果</h1>' +
      '<div class="score"><b>' + ok + "</b> / " + r.length + "<span>正答率 " + U.pct(ok, r.length) + "%</span></div>" +
      (wrongIds.length ? '<button class="btn primary big" id="again">間違えた ' + wrongIds.length + " 項目をもう一度</button>" : '<p class="perfect">全問正解！この調子で続けましょう。</p>') +
      '<div class="ract"><a class="btn" href="#/test">テスト設定へ</a><button class="btn" id="same">同じ条件でもう一度</button><a class="btn ghost" href="#/">ホーム</a></div></section>' +
      (r.length ? '<section class="card"><h2>今回の解答</h2><div class="rows">' + r.map(function (x) {
        var e = Data.get(x.id);
        return '<a class="row" href="#/word/' + encodeURIComponent(e.id) + '"><span class="mark ' + (x.ok ? "good" : "bad") + '">' + (x.ok ? "○" : "×") + '</span><span class="rw">' + esc(e.w) + '</span><span class="rj">' + esc(e.ja) + "</span></a>";
      }).join("") + "</div></section>" : "");
    var again = U.qs("#again");
    var lastMode = session.mode, lastDir = session.dir, lastOpt = session.opt;
    if (again) again.onclick = function () {
      var m = lastMode === "fill" || lastMode === "prep" ? "mix" : lastMode;
      startSession({ mode: m, dir: lastDir, ids: wrongIds, count: wrongIds.length, order: "random" });
    };
    U.qs("#same").onclick = function () { startSession(lastOpt); };
    keyHandler = null;
  }

  /* ---------- 熟語集中 ---------- */
  function viewIdioms() {
    var all = Data.inCat("phr_all");
    var c = counts(all);
    var nPrep = all.filter(function (e) { return Quiz.canDo(e, "prep"); }).length;
    var next = all.slice().sort(function (a, b) { return Store.weight(b.id) - Store.weight(a.id) || b.lv - a.lv; }).slice(0, 8);
    var drills = [
      ["mc", "意味を4択で", "phr_all", "all"],
      ["prep", "前置詞・副詞を選ぶ", "phr_all", "all"],
      ["fill", "例文穴埋め", "phr_all", "all"],
      ["j2e", "意味 → 熟語を書く", "phr_all", "all"],
      ["mix", "苦手な熟語だけ", "phr_all", "weak"],
      ["e2j", "カードでざっと確認", "phr_all", "all"]
    ];
    app.innerHTML =
      '<section class="card"><h1>熟語集中モード</h1>' +
      '<p class="lead">英検2級は熟語の出題が多く、長文・リスニングでも意味を即答できることが重要です。前置詞・副詞まで正確に覚えましょう。</p>' +
      progressBar(c) + legend(c) +
      '<p class="sub">熟語・重要表現 ' + Data.inCat("idiom").length + " ／ 句動詞 " + Data.inCat("phrasal").length + " ／ 前置詞ドリル対象 " + nPrep + "</p>" +
      '<div class="drills">' + drills.map(function (d) {
        return '<button class="drill" data-m="' + d[0] + '" data-c="' + d[2] + '" data-s="' + d[3] + '"><b>' + d[1] + "</b><small>" + Quiz.MODES[d[0]].label + "</small></button>";
      }).join("") + "</div>" +
      '<div class="ract"><a class="btn sm" href="' + href("list", { cat: "phrasal" }) + '">句動詞の一覧</a><a class="btn sm" href="' + href("list", { cat: "idiom" }) + '">熟語・表現の一覧</a></div></section>' +
      '<section class="card"><h2>次に覚えたい熟語</h2><div class="rows idl">' + next.map(function (e) {
        return '<a class="row" href="#/word/' + encodeURIComponent(e.id) + '">' + statusDot(e.id) + '<span class="rw">' + esc(e.w) + '</span><span class="rj">' + esc(e.ja) + "</span>" +
          (e.pat ? '<span class="rpat">' + esc(e.pat) + "</span>" : "") + "</a>";
      }).join("") + "</div></section>";
    U.qs(".drills").onclick = function (ev) {
      var b = ev.target.closest(".drill"); if (!b) return;
      var opt = { mode: b.getAttribute("data-m"), cat: b.getAttribute("data-c"), status: b.getAttribute("data-s"), count: 20, order: "smart", dir: "e2j" };
      if (!Quiz.poolSize(opt)) { alert(opt.status === "weak" ? "苦手な熟語はまだありません。" : "出題できる熟語がありません。"); return; }
      lastList = Data.inCat("phr_all");
      startSession(opt);
    };
  }

  /* ---------- 苦手・学習記録 ---------- */
  var weakSort = "weak";
  function viewWeak() {
    var all = Data.items;
    var studied = all.filter(function (e) { var p = Store.get(e.id); return p && p.n; });
    var list;
    if (weakSort === "weak") list = all.filter(function (e) { return Store.status(e.id) === "weak"; }).sort(function (a, b) { return Store.get(b.id).x - Store.get(a.id).x; });
    else if (weakSort === "due") list = all.filter(function (e) { return Store.isDue(e.id); });
    else if (weakSort === "low") list = studied.slice().sort(function (a, b) { var p = Store.get(a.id), q = Store.get(b.id); return p.c / p.n - q.c / q.n || q.n - p.n; });
    else list = studied.slice().sort(function (a, b) { return Store.get(b.id).last - Store.get(a.id).last; });
    lastList = list;
    var tabs = [["weak", "苦手"], ["due", "復習期限"], ["low", "正答率が低い順"], ["recent", "最近学習"]];
    app.innerHTML =
      '<section class="card"><h1>苦手・学習記録</h1>' +
      '<p class="lead">間違えた語は自動で「苦手」に登録され、テストで優先的に出題されます。' + Store.WEAK_CLEAR + "回連続で正解すると苦手から卒業します。</p>" +
      '<div class="seg-ctl wide" id="ws">' + tabs.map(function (t) { return '<button data-s="' + t[0] + '"' + (t[0] === weakSort ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div>" +
      (list.length ? '<div class="ract"><button class="btn primary" id="wmix">この' + Math.min(list.length, 30) + "項目を4択・穴埋めで復習</button><button class=\"btn\" id=\"wcard\">カードで復習</button></div>" : "") +
      "</section>" +
      '<section class="card">' + (list.length ? '<table class="rec"><thead><tr><th>単語・熟語</th><th>正解</th><th>間違い</th><th>連続</th><th>回数</th><th>正答率</th><th>最終</th></tr></thead><tbody>' +
        list.slice(0, 300).map(function (e) {
          var p = Store.get(e.id);
          return '<tr><td><a href="#/word/' + encodeURIComponent(e.id) + '">' + statusDot(e.id) + "<b>" + esc(e.w) + "</b><small>" + esc(e.ja) + "</small></a></td>" +
            '<td data-l="正解">' + p.c + '</td><td data-l="間違い" class="' + (p.x ? "bad" : "") + '">' + p.x + '</td><td data-l="連続">' + p.s + '</td><td data-l="回数">' + p.n +
            '</td><td data-l="正答率">' + U.pct(p.c, p.n) + '%</td><td data-l="最終">' + U.fmtDate(p.last) + "</td></tr>";
        }).join("") + "</tbody></table>" : '<p class="empty">' + (weakSort === "weak" ? "苦手な単語はありません。テストで間違えると自動で登録されます。" : "該当する記録はありません。") + "</p>") + "</section>";
    U.qs("#ws").onclick = function (ev) { var b = ev.target.closest("[data-s]"); if (!b) return; weakSort = b.getAttribute("data-s"); viewWeak(); };
    var ids = list.slice(0, 30).map(function (e) { return e.id; });
    if (list.length) {
      U.qs("#wmix").onclick = function () { startSession({ mode: "mix", ids: ids, count: ids.length, order: "random" }); };
      U.qs("#wcard").onclick = function () { startSession({ mode: "e2j", ids: ids, count: ids.length, order: "random" }); };
    }
  }

  /* ---------- 設定 ---------- */
  function viewSettings() {
    var s = Store.settings;
    var src = (g.EIKEN.sources || []).map(function (x) { return "<li><code>" + esc(x.name) + "</code> " + x.count + "項目</li>"; }).join("");
    app.innerHTML =
      '<section class="card"><h1>設定</h1>' +
      '<label class="sw"><input type="checkbox" id="auto"' + (s.autoSpeak ? " checked" : "") + "> 単語を表示したら自動で発音する</label>" +
      '<label class="rng">発音の速さ <input type="range" id="rate" min="0.6" max="1.2" step="0.1" value="' + s.rate + '"><span id="rv">' + s.rate + "</span>" + speakBtn("The government decided to reduce plastic waste.") + "</label>" +
      (Speech.available ? "" : '<p class="sub">このブラウザは音声合成に対応していません。</p>') + "</section>" +
      '<section class="card"><h2>学習記録のバックアップ</h2><p class="sub">学習記録はこの端末のブラウザに自動保存されます。機種変更やブラウザのデータ削除に備えて、ときどき書き出してください。</p>' +
      '<div class="ract"><button class="btn" id="exp">記録を書き出す</button><label class="btn">記録を読み込む<input type="file" id="imp" accept="application/json,.json" hidden></label><button class="btn bad" id="rst">記録をすべて消去</button></div></section>' +
      '<section class="card"><h2>収録データ</h2><p>全 ' + Data.items.length + " 項目</p><ul class=\"src\">" + src + "</ul>" +
      '<p class="sub">データの追加方法は <code>docs/DATA_FORMAT.md</code> を参照してください。</p></section>';
    U.qs("#auto").onchange = function () { s.autoSpeak = this.checked; Store.saveSettings(); };
    U.qs("#rate").oninput = function () { s.rate = +this.value; U.qs("#rv").textContent = this.value; Store.saveSettings(); };
    U.qs("#exp").onclick = function () {
      var blob = new Blob([Store.exportJSON()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "eiken2-progress-" + U.today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    U.qs("#imp").onchange = function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { Store.importJSON(rd.result); alert("学習記録を読み込みました。"); location.hash = "#/"; }
        catch (err) { alert("読み込めませんでした：" + err.message); }
      };
      rd.readAsText(f);
    };
    U.qs("#rst").onclick = function () {
      if (confirm("学習記録をすべて消去します。元に戻せません。よろしいですか？")) { Store.reset(); alert("消去しました。"); location.hash = "#/"; }
    };
  }

  /* ---------- ルーター ---------- */
  var ROUTES = { home: viewHome, list: viewList, word: viewWord, test: viewTest, quiz: viewQuiz, idioms: viewIdioms, weak: viewWeak, settings: viewSettings };
  var TAB_OF = { home: "home", list: "list", word: "list", test: "test", quiz: "test", idioms: "idioms", weak: "weak", settings: "settings" };
  function route() {
    var r = parseHash();
    var fn = ROUTES[r.name] || viewHome;
    keyHandler = null;
    if (r.name === "word") fn(r.arg); else fn(r.params);
    U.qsa(".tabbar a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-tab") === TAB_OF[r.name]); });
    document.body.setAttribute("data-view", r.name);
    if (r.name !== "quiz") window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var tag = (ev.target.tagName || "").toLowerCase();
    if ((tag === "input" || tag === "select" || tag === "textarea") && ev.key !== "Enter") return;
    if (tag === "button" && (ev.key === "Enter" || ev.key === " ")) return; // ボタン自身のクリックに任せる
    if (keyHandler) keyHandler(ev);
  });
  /* 発音ボタン（全画面共通） */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest(".speak");
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    Speech.say(b.getAttribute("data-say"), !!b.getAttribute("data-head"));
  });

  if (!Data.items.length) {
    app.innerHTML = '<p class="empty">単語データが読み込めませんでした。data フォルダを確認してください。</p>';
  } else {
    route();
  }

  /* オフライン対応（http/https で開いた場合のみ） */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})(window);
