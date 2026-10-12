// 尚未執行；交指定 AI TRPG Architecture Critic 在隔離環境執行。
// 重用審查者的 Playwright Page，不安裝套件、不啟動服務、不修改正式程式。
import assert from "node:assert/strict";

/**
 * G4 最小真頁面探針：開魔術師配套，再返回原列。
 * @param {import('playwright').Page} page 已載入正式頁面的獨立 Page。
 * @param {{targetSha: string, instrument?: boolean,
 *   onEvidence: (report: object) => Promise<void>}} options
 * onEvidence 必須先保存 JSON／截圖，因為紅燈會在保存後拋出斷言。
 * 每次呼叫使用新 Page；尺寸、字級、安全區、瀏覽器版本由呼叫方固定並另記。
 */
export async function probeStarterCatalogG4(page, options) {
  assert.match(options.targetSha, /^[0-9a-f]{40}$/, "須提供實際完整 TARGET");
  assert.equal(typeof options.onEvidence, "function", "須先配置證據保存函式");
  const instrument = options.instrument !== false;
  const sheet = page.locator("dialog.starter-catalog__sheet[open]");
  assert.equal(await sheet.count(), 0, "每案從未開啟名冊的新 Page 開始");
  await page.getByRole("button", { name: "起始配套名冊", exact: true }).click();
  const row = sheet.locator("button.starter-catalog__row").filter({ hasText: "魔術師" });
  await row.waitFor({ state: "visible" });
  assert.equal(await row.count(), 1, "需正式魔術師列，不使用假 DOM");
  await row.click();
  await sheet.getByRole("heading", { name: "魔術師配套", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const dialog = document.querySelector("dialog.starter-catalog__sheet[open]");
    return dialog && dialog.getAnimations({ subtree: true }).every(animation =>
      animation.playState !== "running" && animation.playState !== "pending");
  });

  // 不攔截 scrollTop、scroll API、rAF 或正式 observer，不改來源分類。
  // 量測仍可能影響排版時序，必須配對 instrument=false 的無探針對照。
  const probeKey = "__starterG4Diagnostic";
  await sheet.evaluate((dialog, { key, enabled }) => {
    if (Object.hasOwn(window, key)) throw new Error("已有同名探針，停止覆蓋");
    const frame = dialog.querySelector(".class-catalog__frame");
    const rail = dialog.querySelector(".starter-catalog__focus-rail");
    if (!frame || !rail) throw new Error("缺少正式閱讀區／焦點區");
    const trace = [];
    let frameNumber = 0, raf = null;
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
      const active = document.activeElement;
      const contained = box ? box.top >= bounds.top && box.bottom <= bounds.bottom
        && box.left >= bounds.left && box.right <= bounds.right : null;
      // 這是按現有公式重算的預測，並非攔截到的 scrollTop 寫入值。
      const delta = !box ? null : box.height > bounds.bottom - bounds.top
        ? box.top - bounds.top : box.bottom > bounds.bottom
          ? box.bottom - bounds.bottom : box.top < bounds.top ? box.top - bounds.top : 0;
      return { reason, time: performance.now(), frameNumber,
        scrollTop: frame.scrollTop, maximumScroll: frame.scrollHeight - frame.clientHeight,
        frame: area, rail: rect(rail), bounds, row: box,
        sourcePlaceholder: rect(dialog.querySelector(".starter-catalog__focus-space")),
        overflowBottom: box ? box.bottom - bounds.bottom : null,
        contained, projectedDelta: delta,
        projectedScrollTop: delta === null ? null : frame.scrollTop + delta,
        projectedOnly: true, rowPresent: !!mage,
        docked: !!mage?.classList.contains("starter-catalog__focus-docked"),
        activeIsRow: !!mage && active === mage,
        active: active ? { tag: active.tagName, id: active.id, className: active.className } : null,
        viewport: { width: window.innerWidth, height: window.innerHeight,
          visualWidth: viewport?.width, visualHeight: viewport?.height,
          offsetTop: viewport?.offsetTop, offsetLeft: viewport?.offsetLeft,
          devicePixelRatio: window.devicePixelRatio },
        rootFontSize: getComputedStyle(document.documentElement).fontSize };
    }
    const record = reason => { if (trace.length < 400) trace.push(snapshot(reason)); };
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
      snapshot,
      stop() {
        if (raf !== null) cancelAnimationFrame(raf);
        observer?.disconnect();
        frame.removeEventListener("scroll", onScroll);
        dialog.removeEventListener("focusin", onFocus, true);
        return { trace, final: snapshot("final"), traceTruncated: trace.length >= 400 };
      },
    };
  }, { key: probeKey, enabled: instrument });

  let evidence, completed = false;
  try {
    await sheet.getByRole("button", { name: "返回四職業", exact: true }).click();
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
      : evidence.final.rowPresent && evidence.final.activeIsRow && evidence.final.contained
        && !evidence.final.docked && !seenDock ? "PASS" : "FAIL";
    await options.onEvidence({ case: "G4-mage-return", targetSha: options.targetSha,
      instrument, verdict, scope: "僅本次有限導航觀察，不是切片工程結論", ...evidence });
  }
  assert.ok(evidence.final.rowPresent, "返回後必須存在魔術師列");
  assert.ok(evidence.final.activeIsRow, "返回後必須保留原列實際焦點");
  assert.equal(evidence.traceTruncated, false, "探針紀錄截限須另列受阻");
  assert.equal(evidence.final.docked, false, "G4：返回原列不應收入焦點欄");
  assert.ok(evidence.final.contained, "正常尺寸的返回列必須留在完整可用閱讀區");
  assert.equal(evidence.trace.some(sample => sample.rowPresent && sample.docked), false,
    "G4：觀察期間不得短暫 dock 後再被重試掩蓋");
  return evidence;
}
