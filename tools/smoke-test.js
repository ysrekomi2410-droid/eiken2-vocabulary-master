#!/usr/bin/env node
/*
 * ブラウザでの動作確認（Playwright が入っている環境用）
 * 全画面を開き、各テストモードを数問ずつ解いて、JavaScriptエラーが出ないか確認する。
 *   使い方: node tools/smoke-test.js [--shots 出力フォルダ]
 */
"use strict";
const path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..");
const url = "file://" + path.join(root, "index.html");
const shotIdx = process.argv.indexOf("--shots");
const shotDir = shotIdx > 0 ? process.argv[shotIdx + 1] : null;

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const vp of [{ name: "mobile", width: 390, height: 844 }, { name: "pc", width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on("pageerror", (e) => errors.push(vp.name + ": " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(vp.name + " console: " + m.text()); });
    page.on("dialog", (d) => d.accept());
    const shot = async (n) => { if (shotDir) await page.screenshot({ path: path.join(shotDir, vp.name + "-" + n + ".png") }); };
    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await shot("home");

    // 単語帳
    await page.goto(url + "#/list"); await page.waitForSelector(".row");
    await page.fill("#q", "re"); await page.waitForTimeout(300);
    await shot("list");
    await page.click(".row");
    await page.waitForSelector(".w-word");
    await shot("word");

    // 各テストモードを5問ずつ
    for (const mode of ["e2j", "j2e", "mc", "fill", "prep", "mix"]) {
      await page.goto(url + "#/test?mode=" + mode);
      await page.waitForSelector("#go");
      if (await page.isDisabled("#go")) { console.log("  skip " + mode + "（対象なし）"); continue; }
      await page.selectOption("#count", "10");
      await page.click("#go");
      for (let i = 0; i < 5; i++) {
        await page.waitForSelector(".quiz");
        if (await page.$("#show")) { await page.click("#show"); await page.click(i % 2 ? "#ok" : "#ng"); }
        else if (await page.$("#ans")) {
          if (i % 2) await page.click("#giveup");
          else { await page.fill("#ans", "test"); await page.press("#ans", "Enter"); }
        } else { const opts = await page.$$(".opt"); await opts[i % opts.length].click(); }
        await page.waitForSelector("#next");
        if (i === 0) await shot("quiz-" + mode);
        await page.click("#next");
      }
      await page.click("#quit");
      await page.waitForSelector(".result");
    }
    await shot("result");
    for (const r of ["#/weak", "#/idioms", "#/settings", "#/"]) {
      await page.goto(url + r); await page.waitForTimeout(150);
      await shot(r.replace(/[#/]/g, "") || "home2");
    }
    const weak = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("eiken2.progress.v1")).items).filter((p) => p.weak).length);
    console.log(vp.name + ": OK（苦手登録 " + weak + " 件）");
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log("エラー:\n" + errors.join("\n")); process.exit(1); }
  console.log("ブラウザ動作確認: エラーなし");
})();
