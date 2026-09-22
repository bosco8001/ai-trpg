import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app.js";
import { createActionInterpreter } from "../src/server/interpretation/interpreter.js";
import { FixtureInterpretationAdapter } from "../src/server/interpretation/fixture-adapter.js";
import { createLanguageModel } from "../src/server/llm/language-model.js";
import {
  actionComposerReducer,
  getSuggestedActions,
  initialActionComposerState,
  isUtilityDismissKey,
  utilityPanelReducer,
  utilityPanels,
} from "../src/web/exploration-ui.js";

test("每個目前位置都提供五個只有 id 與自然語言的建議", () => {
  for (const locationId of ["TEST-forest-edge", "TEST-ruin-entrance"] as const) {
    const suggestions = getSuggestedActions(locationId);
    assert.equal(suggestions.length, 5);
    for (const suggestion of suggestions) {
      assert.deepEqual(Object.keys(suggestion).sort(), ["id", "text"]);
      assert.ok(suggestion.id.length > 0);
      assert.ok(suggestion.text.length > 0);
    }
  }
});

test("第一個建議仍經 Phase 7 與 Phase 8 action API，不是直接 command", async (t) => {
  const app = await buildApp({
    interpreter: createActionInterpreter(createLanguageModel(new FixtureInterpretationAdapter(), { timeoutMs: 100 })),
  });
  t.after(() => app.close());
  const moveText = getSuggestedActions("TEST-forest-edge")[0]?.text;
  assert.equal(moveText, "我慢慢走向森林裡的廢墟。");
  const moved = await app.inject({
    method: "POST", url: "/api/exploration/actions", payload: { text: moveText, expectedRevision: 0 },
  });
  assert.equal(moved.statusCode, 200);
  assert.equal(moved.json().candidate.originalText, moveText);
  assert.equal(moved.json().ruling.accepted, true);
  assert.equal(moved.json().state.revision, 1);
  const inspectText = getSuggestedActions(moved.json().state.locationId)[0]?.text;
  assert.equal(inspectText, "我仔細查看門上的符號。");
  const inspected = await app.inject({
    method: "POST", url: "/api/exploration/actions", payload: { text: inspectText, expectedRevision: 1 },
  });
  assert.equal(inspected.json().candidate.originalText, inspectText);
  assert.equal(inspected.json().ruling.accepted, true);
  assert.equal(inspected.json().state.revision, 2);
});

test("自由輸入預設收起；送出只清空文字，不會自動收起", () => {
  assert.deepEqual(initialActionComposerState, { isOpen: false, text: "" });
  const open = actionComposerReducer(initialActionComposerState, { type: "open" });
  assert.deepEqual(open, { isOpen: true, text: "" });
  const typed = actionComposerReducer(open, { type: "change", text: "我慢慢走向森林裡的廢墟。" });
  const submitted = actionComposerReducer(typed, { type: "submitted" });
  assert.deepEqual(submitted, { isOpen: true, text: "" });
  assert.deepEqual(actionComposerReducer(submitted, { type: "close" }), { isOpen: false, text: "" });
});

test("工具面板可個別開關，Escape 是明確關閉按鍵，placeholder 沒有遊戲狀態欄位", () => {
  let active = utilityPanelReducer(null, { type: "open", panel: "inventory" });
  assert.equal(active, "inventory");
  active = utilityPanelReducer(active, { type: "open", panel: "equipment" });
  assert.equal(active, "equipment");
  assert.equal(utilityPanelReducer(active, { type: "close" }), null);
  assert.equal(isUtilityDismissKey("Escape"), true);
  assert.equal(isUtilityDismissKey("Enter"), false);
  for (const panel of Object.values(utilityPanels)) {
    assert.deepEqual(Object.keys(panel).sort(), ["description", "items", "title"]);
    assert.equal("revision" in panel, false);
    assert.equal("locationId" in panel, false);
  }
});
