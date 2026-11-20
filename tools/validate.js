#!/usr/bin/env node
/*
 * 単語データの検証：必須項目・重複・形式・ファイル登録漏れをチェックし、件数を集計する。
 *   使い方: node tools/validate.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");

const ctx = { console };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data/_registry.js"), "utf8"), ctx);
const files = fs.readdirSync(path.join(root, "data")).filter((f) => f.endsWith(".js") && !f.startsWith("_")).sort();
const errors = [], warns = [];
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(path.join(root, "data", f), "utf8"), ctx, { filename: f }); }
  catch (e) { errors.push(f + ": 読み込みエラー " + e.message); }
}
const items = ctx.EIKEN.items;

const KINDS = new Set(["w", "ph", "id"]);
const POS = new Set(["v", "n", "adj", "adv", "prep", "conj"]);
const CATS = new Set(["env", "sci", "edu", "soc", "eco", "med", "life", "human"]);
const ids = new Map(), heads = new Map();

for (const e of items) {
  const where = `[${e._src}] ${e.w}`;
  const err = (m) => errors.push(where + ": " + m);
  const warn = (m) => warns.push(where + ": " + m);
  if (!e.w || typeof e.w !== "string") { err("w がありません"); continue; }
  if (e.w !== e.w.trim() || /\s{2,}/.test(e.w)) err("w に余分な空白");
  if (!KINDS.has(e.k)) err("k が不正: " + e.k);
  if (ids.has(e.id)) err("ID重複（" + ids.get(e.id) + " と）");
  ids.set(e.id, e._src);
  const hk = e.k + ":" + e.w.toLowerCase();
  if (heads.has(hk) && !e.id.includes("_")) err("見出し語の重複");
  heads.set(hk, 1);
  const pos = typeof e.pos === "string" ? [e.pos] : e.pos;
  if (e.k === "w") {
    if (!Array.isArray(pos) || !pos.length) err("pos がありません");
    if (!e.ipa) err("ipa がありません");
  }
  (pos || []).forEach((p) => { if (!POS.has(p)) err("pos が不正: " + p); });
  if (!e.ja) err("ja がありません");
  if (![1, 2, 3].includes(e.lv)) err("lv は 1〜3");
  if (!Array.isArray(e.ex) || !e.ex.length) err("ex がありません");
  else e.ex.forEach((x, i) => {
    if (!Array.isArray(x) || x.length !== 2 || typeof x[0] !== "string" || typeof x[1] !== "string") return err(`ex[${i}] は [英文, 和訳]`);
    const opens = (x[0].match(/\{/g) || []).length, closes = (x[0].match(/\}/g) || []).length;
    if (opens !== closes) err(`ex[${i}] の {} が不一致`);
    if (!opens) err(`ex[${i}] に対象語の {} がありません`);
    if (e.k === "w" && opens) {
      const t = x[0].match(/\{([^}]*)\}/)[1].toLowerCase();
      if (t.slice(0, 2) !== e.w.toLowerCase().slice(0, 2)) warn(`ex[${i}] の {${t}} が見出し語と異なる形（不規則変化なら問題なし）`);
    }
    if (!/[。！？]$/.test(x[1].trim())) warn(`ex[${i}] 和訳が句点で終わっていません`);
    if (!/[.!?]["”']?$/.test(x[0].trim())) warn(`ex[${i}] 英文が終止符で終わっていません`);
  });
  ["syn", "ant", "rel", "col", "cat"].forEach((k) => {
    if (e[k] !== undefined && (!Array.isArray(e[k]) || e[k].some((s) => typeof s !== "string"))) err(k + " は文字列の配列");
  });
  (e.cat || []).forEach((c) => { if (!CATS.has(c)) err("cat が不正: " + c); });
}

// index.html / sw.js への登録漏れ
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
for (const f of files) {
  if (!idx.includes('src="data/' + f + '"')) errors.push("index.html に未登録: data/" + f + "（node tools/sync.js を実行）");
  if (!sw.includes('"data/' + f + '"')) errors.push("sw.js に未登録: data/" + f + "（node tools/sync.js を実行）");
}

// 集計
const count = (fn) => items.filter(fn).length;
const posCount = (p) => count((e) => e.k === "w" && [].concat(e.pos).includes(p));
console.log("=== 収録数 ===");
console.log("合計            :", items.length);
console.log("単語            :", count((e) => e.k === "w"));
console.log("  動詞/名詞/形容詞/副詞:", ["v", "n", "adj", "adv"].map(posCount).join(" / "));
console.log("句動詞          :", count((e) => e.k === "ph"));
console.log("熟語・重要表現  :", count((e) => e.k === "id"));
console.log("重要度 ★3/★2/★1:", [3, 2, 1].map((l) => count((e) => e.lv === l)).join(" / "));
console.log("分野:", [...CATS].map((c) => c + "=" + count((e) => (e.cat || []).includes(c))).join(" "));
console.log("ファイル:", files.length, "件");

if (warns.length) {
  console.log("\n=== 注意 (" + warns.length + ") ===");
  warns.slice(0, 60).forEach((w) => console.log("  " + w));
  if (warns.length > 60) console.log("  …ほか " + (warns.length - 60) + " 件");
}
if (errors.length) {
  console.log("\n=== エラー (" + errors.length + ") ===");
  errors.forEach((e) => console.log("  " + e));
  process.exit(1);
}
console.log("\nOK: エラーはありません");
