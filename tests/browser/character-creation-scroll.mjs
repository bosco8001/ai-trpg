// 尚未執行；由 Grok 在隔離驗收環境，以正式 build 與已開啟的空創角 Sheet 執行。
// 接收審查者現有 Playwright Page；不安裝套件、不啟動服務、不建立或刪除角色。
import assert from "node:assert/strict";

/**
 * @param {import('playwright').Page} page 審查者已開啟「種族與職業」的隔離 Page。
 * @returns {Promise<object[]>} 三次前進／返回的捲動及焦點量測。
 */
export async function checkCreationStepScroll(page) {
  const sheet = page.locator(".creation-sheet[open]");
  assert.equal(await sheet.count(), 1, "需要已開啟的獨立創角 Sheet");
  assert.equal(await sheet.locator("h2").innerText(), "種族與職業", "樣本必須尚未建立角色");
  const metrics = [];

  async function transition(from, button, to) {
    assert.equal(await sheet.locator("h2").innerText(), from);
    const before = await sheet.evaluate(node => {
      const frame = node.querySelector(".derivation-frame");
      const body = node.querySelector(".derivation-body");
      if (!frame || !body) throw new Error("缺少創角捲動區");
      frame.scrollTop = frame.scrollHeight;
      body.scrollTop = body.scrollHeight;
      return { frame: frame.scrollTop, body: body.scrollTop };
    });
    assert.ok(before.frame > 4 || before.body > 4, "案例必須真的從捲到底部開始");
    // 按鈕原本就在底部；點擊不應替產品自動把標題帶回頂部。
    await sheet.getByRole("button", { name: button, exact: true }).click();
    await page.waitForFunction(expected => {
      const heading = document.querySelector(".creation-sheet[open] h2");
      return heading?.textContent === expected && document.activeElement === heading;
    }, to);
    const after = await sheet.evaluate(node => {
      const frame = node.querySelector(".derivation-frame");
      const body = node.querySelector(".derivation-body");
      const heading = node.querySelector("h2");
      if (!frame || !body || !heading) throw new Error("缺少創角畫面");
      const box = heading.getBoundingClientRect();
      const viewport = node.getBoundingClientRect();
      return { frame: frame.scrollTop, body: body.scrollTop,
        focused: document.activeElement === heading,
        titleVisible: box.top >= Math.max(0, viewport.top) - 1
          && box.bottom <= Math.min(window.innerHeight, viewport.bottom) + 1 };
    });
    assert.ok(after.frame <= 1 && after.body <= 1, `${from} → ${to} 必須回到頂部`);
    assert.ok(after.focused && after.titleVisible, `${to} 標題必須獲焦點且完整可見`);
    metrics.push({ from, to, before, after });
  }

  await sheet.getByLabel("種族", { exact: true }).selectOption("race.elf");
  await sheet.getByLabel("初始職業", { exact: true }).selectOption("class.archer");
  await transition("種族與職業", "下一步", "分配屬性");
  const fields = sheet.locator('input[type="number"]');
  assert.equal(await fields.count(), 6);
  for (let i = 0; i < 6; i++) await fields.nth(i).fill("2");
  await transition("分配屬性", "下一步", "最後確認");
  await transition("最後確認", "上一步", "分配屬性");
  // 故意停在草稿，不按「確認並保存」。呼叫方另核對 POST 數為零並負責關閉。
  return metrics;
}
