// t78 A 新案例尚未執行。真實 async 錯誤交接 seam；不冒充 Playwright／CSS 驗證。
import assert from "node:assert/strict";
import test from "node:test";
import { probeFailureReport, saveProbeEvidence } from "./starter-catalog-probe-evidence.mjs";

for (const stage of ["preparation", "return"])
for (const savedFirst of [false, true])
test(`${stage}: callback failure ${savedFirst ? 'after' : 'before'} saving retains the original error instance`, async () => {
  const primary = Object.freeze(new Error("original timeout/navigation"));
  const saveError = new Error("injected save failure");
  const saved = [];
  const report = { stage, verdict: "BLOCKED", error: { name: primary.name, message: primary.message } };
  let received;
  try {
    await saveProbeEvidence(report, async value => {
      if (savedFirst) saved.push(JSON.stringify(value));
      throw saveError;
    }, { error: primary });
  } catch (error) { received = error; }
  assert.equal(received, primary);
  assert.equal(saved.length, savedFirst ? 1 : 0);
  const details = probeFailureReport(received);
  assert.equal(details, report);
  assert.equal(details.secondaryErrors[0].stage, "evidence-save");
  assert.equal(details.secondaryErrors[0].message, saveError.message);
  assert.equal(details.evidenceSaveCompleted, false);
});

test("navigation plus cleanup plus save failure keeps all secondary evidence and the primary", async () => {
  const primary = new Error("navigation failed");
  const report = { verdict: "BLOCKED", secondaryErrors: [{ stage: "probe-stop", name: "Error", message: "page closed" }] };
  await assert.rejects(saveProbeEvidence(report, async () => { throw new Error("save failed"); }, { error: primary }),
    error => error === primary);
  assert.deepEqual(probeFailureReport(primary).secondaryErrors.map(item => item.stage), ["probe-stop", "evidence-save"]);
});

test("a product assertion failure cannot be replaced by an evidence callback failure", async () => {
  const primary = new assert.AssertionError({ message: "row outside actual bounds" });
  const report = { verdict: "FAIL", stage: "return" };
  await assert.rejects(saveProbeEvidence(report, async () => { throw new Error("writer has no trace"); }, { error: primary }),
    error => error === primary);
  assert.equal(probeFailureReport(primary).productVerdict, "FAIL");
  assert.equal(probeFailureReport(primary).verdict, "BLOCKED");
});

test("without a primary, failed evidence saving blocks an otherwise passing result", async () => {
  const saveError = new Error("disk failure");
  const report = { stage: "return", verdict: "PASS" };
  await assert.rejects(saveProbeEvidence(report, async () => { throw saveError; }), error => error === saveError);
  assert.equal(probeFailureReport(saveError).verdict, "BLOCKED");
  assert.equal(probeFailureReport(saveError).productVerdict, "PASS");
});

test("successful saving of a blocked preparation report needs no trace or final", async () => {
  const primary = new Error("no actual range");
  let saved;
  await assert.rejects(saveProbeEvidence({ stage: "preparation", verdict: "BLOCKED" }, async report => { saved = JSON.stringify(report); },
    { error: primary }), error => error === primary);
  assert.equal(JSON.parse(saved).stage, "preparation");
  assert.equal(JSON.parse(saved).trace, undefined);
  assert.equal(JSON.parse(saved).final, undefined);
});

test("saving a passing report resolves and does not invent a primary error", async () => {
  const reports = [];
  await saveProbeEvidence({ stage: "return", verdict: "PASS" }, async report => { reports.push(report); });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].verdict, "PASS");
  assert.deepEqual(reports[0].secondaryErrors, []);
});

test("throw undefined remains a failure rather than being treated as success", async () => {
  let caught = false;
  try { await saveProbeEvidence({ verdict: "BLOCKED" }, async () => {}, { error: undefined }); }
  catch (error) { caught = true; assert.equal(error, undefined); }
  assert.equal(caught, true);
});
