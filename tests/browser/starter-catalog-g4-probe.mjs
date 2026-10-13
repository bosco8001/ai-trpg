// 開發代理未執行；交指定 AI TRPG Architecture Critic 在隔離環境執行。
// 重用審查者的 Playwright Page，不安裝套件、不啟動服務、不修改正式程式。
import assert from "node:assert/strict";

/**
 * G4 最小真頁面探針：開魔術師配套，再返回原列。
 * @param {import('playwright').Page} page 已載入正式頁面的獨立 Page。
 * @param {{targetSha: string, instrument?: boolean, entryAction?: 'click' | 'enter',
 *   returnAction?: 'click' | 'enter', scrollToBottom?: boolean, reopenBeforeEntry?: boolean,
 *   onEvidence: (report: object) => Promise<void>}} options
 * onEvidence 必須先保存 JSON／截圖，因為紅燈會在保存後拋出斷言。
 * 每次呼叫使用新 Page；尺寸、字級、安全區、瀏覽器版本由呼叫方固定並另記。
 */
export async function probeStarterCatalogG4(page, options) {
  assert.match(options.targetSha, /^[0-9a-f]{40}$/, "須提供實際完整 TARGET");
  assert.equal(typeof options.onEvidence, "function", "須先配置證據保存函式");
  const instrument = options.instrument !== false;
  const entryAction = options.entryAction ?? "click", returnAction = options.returnAction ?? "click";
  assert.ok(["click", "enter"].includes(entryAction), "進入操作須為 click 或 enter");
  assert.ok(["click", "enter"].includes(returnAction), "返回操作須為 click 或 enter");
  const sheet = page.locator("dialog.starter-catalog__sheet[open]");
  const row = sheet.locator("button.starter-catalog__row").filter({ hasText: "魔術師" });
  const frame = sheet.locator(".class-catalog__frame");
  // 量測上限與原生可達位置分開記錄；沒有 frame 時立即回 null，不再等 locator。
  const capturePreparation = () => page.evaluate(() => {
    const node = document.querySelector("dialog.starter-catalog__sheet[open] .class-catalog__frame");
    if (!node) return null;
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node), viewport = window.visualViewport;
    return { scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
      maximumScroll: node.scrollHeight - node.clientHeight,
      remainingScroll: node.scrollHeight - node.clientHeight - node.scrollTop,
      frame: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
        width: rect.width, height: rect.height },
      visibleFrameHeight: Math.max(0, Math.min(rect.bottom, (viewport?.offsetTop ?? 0)
        + (viewport?.height ?? window.innerHeight)) - Math.max(rect.top, viewport?.offsetTop ?? 0)),
      scrollPaddingTop: style.scrollPaddingTop, scrollPaddingBottom: style.scrollPaddingBottom,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      viewport: { width: window.innerWidth, height: window.innerHeight,
        visualWidth: viewport?.width, visualHeight: viewport?.height,
        offsetTop: viewport?.offsetTop, offsetLeft: viewport?.offsetLeft,
        devicePixelRatio: window.devicePixelRatio } };
  });
  const settleSheet = async () => {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForFunction(() => {
      const dialog = document.querySelector("dialog.starter-catalog__sheet[open]");
      return dialog && dialog.getAnimations({ subtree: true }).every(animation =>
        animation.playState !== "running" && animation.playState !== "pending");
    });
  };
  const bottomToleranceCssPx = 1; // 僅測試準備的量測差；產品 containment 仍嚴格。
  let preparation = { requestedBottom: !!options.scrollToBottom, bottomToleranceCssPx,
    beforeBottom: null, afterBottom: null, alreadyAtBottom: false, actualMovement: null, entryCompleted: false };
  try {
    assert.equal(await sheet.count(), 0, "每案從未開啟名冊的新 Page 開始");
    await page.getByRole("button", { name: "起始配套名冊", exact: true }).click();
    await row.waitFor({ state: "visible" });
    assert.equal(await row.count(), 1, "需正式魔術師列，不使用假 DOM");
    await settleSheet();
    if (options.reopenBeforeEntry) {
      // 明確是進入配套之前關閉／重開，不冒稱重建 t75u 的全部歷史準備。
      await page.keyboard.press("Escape");
      assert.equal(await sheet.count(), 0, "準備步驟須真正關閉名冊");
      await page.getByRole("button", { name: "起始配套名冊", exact: true }).click();
      await row.waitFor({ state: "visible" });
      await settleSheet();
    }
    const before = await capturePreparation();
    preparation.beforeBottom = before;
    assert.ok(before, "準備步驟須存在正式閱讀區");
    if (options.scrollToBottom) {
      assert.ok(before.maximumScroll > 0, "底部準備須有實際捲動範圍，否則另列受阻");
      preparation.alreadyAtBottom = before.scrollTop > 0
        && Math.abs(before.remainingScroll) <= bottomToleranceCssPx;
      await frame.hover({ position: { x: 10, y: 10 } });
      await page.mouse.wheel(0, before.scrollHeight);
      // 保留一次原生 wheel 及原等待上限。到達量測邊界須有實際位移，
      // alreadyAtBottom 例外只表示原位置成立，不授予產品閱讀權限。
      await page.waitForFunction(({ before, alreadyAtBottom, tolerance }) => {
        const node = document.querySelector("dialog.starter-catalog__sheet[open] .class-catalog__frame");
        if (!node) return false;
        const rect = node.getBoundingClientRect(), viewport = window.visualViewport;
        const maximum = node.scrollHeight - node.clientHeight;
        const sameGeometry = node.scrollHeight === before.scrollHeight && node.clientHeight === before.clientHeight
          && rect.top === before.frame.top && rect.left === before.frame.left
          && rect.width === before.frame.width && rect.height === before.frame.height
          && window.innerWidth === before.viewport.width && window.innerHeight === before.viewport.height
          && viewport?.width === before.viewport.visualWidth && viewport?.height === before.viewport.visualHeight
          && viewport?.offsetTop === before.viewport.offsetTop && viewport?.offsetLeft === before.viewport.offsetLeft
          && getComputedStyle(document.documentElement).fontSize === before.rootFontSize;
        return sameGeometry && maximum > 0 && node.scrollTop > 0
          && Math.abs(maximum - node.scrollTop) <= tolerance
          && (alreadyAtBottom || node.scrollTop > before.scrollTop);
      }, { before, alreadyAtBottom: preparation.alreadyAtBottom, tolerance: bottomToleranceCssPx });
    }
    const after = await capturePreparation();
    preparation.afterBottom = after;
    assert.ok(after, "準備後閱讀區不得消失");
    preparation = { ...preparation, ...after, actualMovement: after.scrollTop - before.scrollTop };
    if (options.scrollToBottom) {
      const geometry = sample => ({ scrollHeight: sample.scrollHeight, clientHeight: sample.clientHeight,
        frame: sample.frame, rootFontSize: sample.rootFontSize, viewport: sample.viewport });
      assert.deepEqual(geometry(after), geometry(before), "底部準備前後尺寸須一致，否則另列受阻");
      assert.ok(after.maximumScroll > 0 && after.scrollTop > 0
        && Math.abs(after.remainingScroll) <= bottomToleranceCssPx, "底部準備差值須在量測界線內");
      assert.ok(preparation.alreadyAtBottom || preparation.actualMovement > 0, "尚未在底部的準備須有正向實際位移");
    }
    // locator.press 取焦後送原生 Enter；這不是從入口開始逐次 Tab 的完整鍵盤流程。
    if (entryAction === "enter") await row.press("Enter");
    else await row.click();
    await sheet.getByRole("heading", { name: "魔術師配套", exact: true }).waitFor();
    await settleSheet();
    preparation.entryCompleted = true;
  } catch (error) {
    const last = await capturePreparation().catch(() => null);
    await options.onEvidence({ case: "G4-mage-return", targetSha: options.targetSha,
      instrument, entryAction, returnAction, scrollToBottom: !!options.scrollToBottom,
      reopenBeforeEntry: !!options.reopenBeforeEntry, stage: "preparation", verdict: "BLOCKED",
      scope: "準備失敗，尚未判定 G4；不得計入產品通過或失敗", preparation, lastPreparation: last,
      error: { name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error) } });
    throw error;
  }

  // 不攔截 scrollTop、scroll API、rAF 或正式 observer，不改來源分類。
  // 量測仍可能影響排版時序，必須配對 instrument=false 的無探針對照。
  const probeKey = "__starterG4Diagnostic";
  await sheet.evaluate((dialog, { key, enabled }) => {
    if (Object.hasOwn(window, key)) throw new Error("已有同名探針，停止覆蓋");
    const frame = dialog.querySelector(".class-catalog__frame");
    const rail = dialog.querySelector(".starter-catalog__focus-rail");
    if (!frame || !rail) throw new Error("缺少正式閱讀區／焦點區");
    const trace = [];
    let frameNumber = 0, raf = null, firstReturnedInline = null;
    function rect(node) {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right,
        height: box.height, width: box.width };
    }
    function snapshot(reason) {
      const mage = Array.from(dialog.querySelectorAll("button.starter-catalog__row"))
        .find(node => node.querySelector("strong")?.textContent === "魔術師");
      const box = rect(mage), area = rect(frame), style = getComputedStyle(frame);
      const viewport = window.visualViewport;
      const bounds = {
        top: Math.max(area.top, viewport?.offsetTop ?? 0)
          + Math.max(8, Number.parseFloat(style.scrollPaddingTop) || 0),
        bottom: Math.min(area.bottom, (viewport?.offsetTop ?? 0)
          + (viewport?.height ?? window.innerHeight))
          - Math.max(8, Number.parseFloat(style.scrollPaddingBottom) || 0),
        left: Math.max(area.left, viewport?.offsetLeft ?? 0),
        right: Math.min(area.right, (viewport?.offsetLeft ?? 0)
          + (viewport?.width ?? window.innerWidth)),
      };
      const docked = !!mage?.classList.contains("starter-catalog__focus-docked");
      const previous = mage?.previousElementSibling;
      const placeholder = docked && previous?.classList.contains("starter-catalog__focus-space") ? previous : null;
      // 原位置和焦點欄位置分列；placeholder 只能作來源證據，不代替原列成功。
      const sourceBox = docked ? rect(placeholder) : box;
      const active = document.activeElement;
      const contained = box ? box.top >= bounds.top && box.bottom <= bounds.bottom
        && box.left >= bounds.left && box.right <= bounds.right : null;
      const sourceContained = sourceBox ? sourceBox.top >= bounds.top && sourceBox.bottom <= bounds.bottom
        && sourceBox.left >= bounds.left && sourceBox.right <= bounds.right : null;
      const rowInlineContained = !!mage && !docked && frame.contains(mage) && contained === true;
      // 這是按現有公式重算的預測，並非攔截到的 scrollTop 寫入值。
      const delta = !box ? null : box.height > bounds.bottom - bounds.top
        ? box.top - bounds.top : box.bottom > bounds.bottom
          ? box.bottom - bounds.bottom : box.top < bounds.top ? box.top - bounds.top : 0;
      return { reason, time: performance.now(), frameNumber,
        scrollTop: frame.scrollTop, scrollHeight: frame.scrollHeight, clientHeight: frame.clientHeight,
        maximumScroll: frame.scrollHeight - frame.clientHeight,
        visibleFrameHeight: Math.max(0, Math.min(area.bottom, (viewport?.offsetTop ?? 0)
          + (viewport?.height ?? window.innerHeight)) - Math.max(area.top, viewport?.offsetTop ?? 0)),
        frame: area, rail: rect(rail), bounds, row: box, sourceRow: sourceBox,
        sourcePlaceholder: rect(placeholder), sourceContained, rowInlineContained,
        overflowBottom: box ? box.bottom - bounds.bottom : null,
        contained, projectedDelta: delta,
        projectedScrollTop: delta === null ? null : frame.scrollTop + delta,
        projectedOnly: true, rowPresent: !!mage,
        docked,
        activeIsRow: !!mage && active === mage,
        active: active ? { tag: active.tagName, id: active.id, className: active.className } : null,
        viewport: { width: window.innerWidth, height: window.innerHeight,
          visualWidth: viewport?.width, visualHeight: viewport?.height,
          offsetTop: viewport?.offsetTop, offsetLeft: viewport?.offsetLeft,
          devicePixelRatio: window.devicePixelRatio },
        rootFontSize: getComputedStyle(document.documentElement).fontSize };
    }
    const record = reason => {
      if (trace.length >= 400) return;
      const sample = snapshot(reason);
      trace.push(sample);
      if (!firstReturnedInline && sample.rowPresent && sample.activeIsRow && !sample.docked)
        firstReturnedInline = sample;
    };
    const onScroll = () => record("scroll");
    const onFocus = () => record("focusin");
    const observer = enabled ? new MutationObserver(() => record("mutation")) : null;
    if (enabled) {
      frame.addEventListener("scroll", onScroll, { passive: true });
      dialog.addEventListener("focusin", onFocus, true);
      observer.observe(dialog, { subtree: true, childList: true, attributes: true,
        attributeFilter: ["class", "style"] });
      record("before-return");
      const tick = () => { frameNumber++; record("animation-frame"); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    window[key] = {
      snapshot, record,
      stop() {
        if (raf !== null) cancelAnimationFrame(raf);
        observer?.disconnect();
        frame.removeEventListener("scroll", onScroll);
        dialog.removeEventListener("focusin", onFocus, true);
        return { trace, firstReturnedInline, final: snapshot("final"), traceTruncated: trace.length >= 400 };
      },
    };
  }, { key: probeKey, enabled: instrument });

  let evidence, completed = false;
  try {
    const back = sheet.getByRole("button", { name: "返回四職業", exact: true });
    if (returnAction === "enter") await back.press("Enter");
    else await back.click();
    if (instrument) await page.evaluate(key => window[key].record("after-return-action"), probeKey);
    await sheet.getByRole("heading", { name: "起始配套", exact: true }).waitFor();
    // 有界觀察窗口；不改產品 timer，也不以等待／重試把短暫 dock 隱藏。
    // 24 幀只覆蓋導航及已知兩 rAF 路徑，不宣稱涵蓋所有晚到回呼。
    await page.evaluate(() => new Promise(resolve => {
      let remaining = 24;
      function next() { if (--remaining === 0) resolve(); else requestAnimationFrame(next); }
      requestAnimationFrame(next);
    }));
    completed = true;
  } finally {
    evidence = await page.evaluate(key => {
      const probe = window[key];
      if (!probe) throw new Error("探針狀態遺失");
      const result = probe.stop();
      delete window[key];
      return result;
    }, probeKey);
    const seenDock = evidence.trace.some(sample => sample.rowPresent && sample.docked);
    const verdict = !completed || evidence.traceTruncated ? "BLOCKED"
      : evidence.final.rowPresent && evidence.final.activeIsRow && evidence.final.contained && evidence.final.rowInlineContained
        && !evidence.final.docked && !seenDock ? "PASS" : "FAIL";
    await options.onEvidence({ case: "G4-mage-return", targetSha: options.targetSha,
      instrument, entryAction, returnAction, scrollToBottom: !!options.scrollToBottom,
      reopenBeforeEntry: !!options.reopenBeforeEntry, preparation,
      verdict, scope: "僅本次有限導航觀察，不是切片工程結論", ...evidence });
  }
  assert.ok(evidence.final.rowPresent, "返回後必須存在魔術師列");
  assert.ok(evidence.final.activeIsRow, "返回後必須保留原列實際焦點");
  assert.equal(evidence.traceTruncated, false, "探針紀錄截限須另列受阻");
  assert.equal(evidence.final.docked, false, "G4：返回原列不應收入焦點欄");
  assert.ok(evidence.final.contained, "正常尺寸的返回列必須留在完整可用閱讀區");
  assert.ok(evidence.final.rowInlineContained, "焦點欄或來源佔位的位置不得冒充原列在閱讀區完整可見");
  assert.equal(evidence.trace.some(sample => sample.rowPresent && sample.docked), false,
    "G4：觀察期間不得短暫 dock 後再被重試掩蓋");
  return evidence;
}
