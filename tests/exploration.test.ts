import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExplorationPage } from "../src/web/ExplorationPage.js";
import {
  initialNarrativeEntries,
  isSubmittableAction,
  shouldSubmitOnEnter,
  submitLocalExplorationAction,
} from "../src/web/exploration.js";

test("探索介面可以 render，並呈現固定測試紀錄、label 與送出按鈕", () => {
  const page = renderToStaticMarkup(createElement(ExplorationPage, { connectionState: "connected" }));
  assert.match(page, /故事紀錄/);
  assert.match(page, /這是探索介面的固定測試敘事/);
  assert.match(page, /測試玩家行動/);
  assert.match(page, /for="exploration-action"/);
  assert.match(page, /placeholder="描述你想做的事情……"/);
  assert.match(page, /送出行動/);
  assert.match(page, /disabled=""/);
});

test("空白文字不能送出，也不建立 history entry", () => {
  for (const value of ["", "   ", "\n\t"]) {
    assert.equal(isSubmittableAction(value), false);
    const next = submitLocalExplorationAction(initialNarrativeEntries, value);
    assert.equal(next.entries, initialNarrativeEntries);
    assert.equal(next.input, value);
    assert.equal(next.feedback, undefined);
  }
});

test("有效行動加入玩家紀錄與固定回覆，然後清空輸入", () => {
  const before = structuredClone(initialNarrativeEntries);
  const next = submitLocalExplorationAction(initialNarrativeEntries, "  我慢慢走向測試路徑。  ");
  assert.equal(next.input, "");
  assert.match(next.feedback ?? "", /正在取得候選解析/);
  assert.equal(next.entries.length, initialNarrativeEntries.length + 2);
  assert.deepEqual(next.entries.at(-2), {
    id: "local-4-action", source: "action", label: "你的行動", text: "我慢慢走向測試路徑。",
  });
  assert.match(next.entries.at(-1)?.text ?? "", /尚未進行規則驗證或狀態更新/);
  assert.deepEqual(initialNarrativeEntries, before);
});

test("Enter 送出，Shift+Enter 保留多行輸入", () => {
  assert.equal(shouldSubmitOnEnter("Enter", false), true);
  assert.equal(shouldSubmitOnEnter("Enter", true), false);
  assert.equal(shouldSubmitOnEnter("a", false), false);
});

test("探索 UI 不匯入 authoritative domain 或 LLM，輸入無法直接改變權威狀態", async () => {
  for (const file of ["exploration.ts", "ExplorationPage.tsx", "App.tsx"]) {
    const webSource = await readFile(new URL(`../src/web/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(webSource, /from\s+["'][^"']*(?:\/domain\/|\/server\/llm\/|game-state-repository)/);
  }
  const next = submitLocalExplorationAction(initialNarrativeEntries, "寫入 HP 999");
  assert.equal(next.entries.length, initialNarrativeEntries.length + 2);
  assert.match(next.entries.at(-1)?.text ?? "", /尚未進行/);
});
