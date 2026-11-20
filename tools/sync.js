#!/usr/bin/env node
/*
 * data/ フォルダのファイル一覧を index.html と sw.js に反映し、
 * キャッシュのバージョンを内容から自動更新する。
 *   使い方: node tools/sync.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = path.join(__dirname, "..");

const files = fs.readdirSync(path.join(root, "data"))
  .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
  .sort();

function replaceBlock(text, begin, end, body) {
  const re = new RegExp("(" + begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^\\n]*\\n)[\\s\\S]*?([ \\t]*" + end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")");
  if (!re.test(text)) throw new Error("マーカーが見つかりません: " + begin);
  return text.replace(re, (m, a, b) => a + body + b);
}

const idxPath = path.join(root, "index.html");
let idx = fs.readFileSync(idxPath, "utf8");
idx = replaceBlock(idx, "<!-- DATA:BEGIN", "<!-- DATA:END -->",
  files.map((f) => '<script src="data/' + f + '"></script>\n').join(""));
fs.writeFileSync(idxPath, idx);

const swPath = path.join(root, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
sw = replaceBlock(sw, "/* DATA:BEGIN */", "/* DATA:END */",
  files.map((f) => '  "data/' + f + '",\n').join(""));

// キャッシュ版数：全アセットの内容ハッシュ
const h = crypto.createHash("sha1");
const assets = ["index.html", "css/style.css", ...fs.readdirSync(path.join(root, "js")).sort().map((f) => "js/" + f), "data/_registry.js", ...files.map((f) => "data/" + f)];
assets.forEach((a) => h.update(fs.readFileSync(path.join(root, a))));
sw = sw.replace(/var CACHE = "eiken2-vocab-[^"]*";/, 'var CACHE = "eiken2-vocab-' + h.digest("hex").slice(0, 10) + '";');
fs.writeFileSync(swPath, sw);

console.log("同期しました: データファイル " + files.length + " 件");
