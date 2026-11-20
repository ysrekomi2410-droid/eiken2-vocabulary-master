/* 発音（ブラウザ標準の音声合成。ネット接続・APIキー不要） */
(function (g) {
  "use strict";
  var synth = g.speechSynthesis;
  var voice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices().filter(function (v) { return /^en[-_]/i.test(v.lang); });
    voice = vs.filter(function (v) { return /en[-_]US/i.test(v.lang) && /Samantha|Google|Microsoft|Natural/i.test(v.name); })[0] ||
      vs.filter(function (v) { return /en[-_]US/i.test(v.lang); })[0] || vs[0] || null;
  }
  if (synth) {
    pickVoice();
    if (typeof synth.onvoiceschanged !== "undefined") synth.onvoiceschanged = pickVoice;
  }
  g.Speech = {
    available: !!synth,
    /* head=true のときは見出し語として A / B などの記号を読み飛ばす */
    say: function (text, head) {
      if (!synth || !text) return;
      synth.cancel();
      var t = U.plainEx(text);
      if (head) t = t.replace(/(^|\s)(A|B)(?=\s|$)/g, " ").replace(/[〜~]/g, "");
      var u = new SpeechSynthesisUtterance(t);
      u.lang = "en-US";
      if (voice) u.voice = voice;
      u.rate = Store.settings.rate || 0.9;
      synth.speak(u);
    }
  };
})(window);
