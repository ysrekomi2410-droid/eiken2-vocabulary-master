/* オフライン対応：アプリ本体と単語データをキャッシュする */
var CACHE = "eiken2-vocab-d208f8ea77";
var ASSETS = [
  "./", "index.html", "css/style.css", "manifest.webmanifest", "icons/icon.svg",
  "js/util.js", "js/store.js", "js/data.js", "js/speech.js", "js/quiz.js", "js/app.js",
  "data/_registry.js",
  /* DATA:BEGIN */
  "data/phrasal-01.js",
  "data/words-verbs-01.js",
  /* DATA:END */
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* ネット優先（更新をすぐ反映）→ 失敗したらキャッシュ */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
