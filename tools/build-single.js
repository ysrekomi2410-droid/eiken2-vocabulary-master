#!/usr/bin/env node
/*
 * 1ファイル版を作る：CSS・JavaScript・単語データをすべて index.html に埋め込み、
 * dist/eiken2-vocab.html を出力する。このファイル1つをスマホやPCで開くだけで使える。
 *   使い方: node tools/build-single.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let html = read("index.html");
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, p) => "<style>\n" + read(p) + "\n</style>");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, p) => "<script>\n" + read(p).replace(/<\/script/gi, "<\\/script") + "\n</script>");
html = html.replace(/<link rel="manifest"[^>]*>\n?/, "");
const icon = "data:image/svg+xml;base64," + Buffer.from(read("icons/icon.svg")).toString("base64");
html = html.replace(/href="icons\/icon\.svg"/g, 'href="' + icon + '"');
// 1ファイル版では Service Worker を使わない
html = html.replace("<script>", "<script>window.EIKEN_SINGLE_FILE=true;</script>\n<script>");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const out = path.join(root, "dist", "eiken2-vocab.html");
fs.writeFileSync(out, html);
console.log("作成しました: dist/eiken2-vocab.html（" + Math.round(html.length / 1024) + " KB）");

// --artifact 出力先 : claude.ai で公開する用（外枠のタグを除いた版）
const ai = process.argv.indexOf("--artifact");
if (ai > 0) {
  const body = html
    .replace(/<!doctype html>\s*/i, "")
    .replace(/<\/?html[^>]*>\s*/g, "")
    .replace(/<\/?head>\s*/g, "")
    .replace(/<\/?body>\s*/g, "")
    .replace(/<meta charset="utf-8">\s*/, "")
    .replace(/<meta name="viewport"[^>]*>\s*/, "");
  fs.writeFileSync(process.argv[ai + 1], body);
  console.log("公開用: " + process.argv[ai + 1]);
}
