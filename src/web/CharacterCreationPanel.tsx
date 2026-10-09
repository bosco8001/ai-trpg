import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_ATTRIBUTES, CONTENT_ATTRIBUTE_LABELS, CONTENT_APTITUDE_LABELS } from "../shared/content-catalog.js";
import { CREATION_MESSAGES, type CreationRequest, type CreationRecord } from "../shared/character-creation.js";
import { readDerivationCatalogs } from "./character-derivation-client.js";
import { readCreationState, submitCreation, CreationClientFailure, creationMatchesCatalogs } from "./character-creation-client.js";
import { emptyCreationDraft, creationDraftError, requestFromDraft, readPendingCreation, retainPendingCreation,
  clearPendingCreation, type CreationDraft } from "./character-creation-ui.js";

type Catalogs = Awaited<ReturnType<typeof readDerivationCatalogs>>;
type Step = "select" | "allocate" | "confirm" | "pending" | "result";
const sign = (n: number) => n > 0 ? `+${n}` : String(n).replace("-", "−");
const title = { select: "種族與職業", allocate: "分配屬性", confirm: "最後確認", pending: "核對保存", result: "已保存角色" };
const breathNames = { fire: "火", ice: "冰", lightning: "雷" };

export function CharacterCreationPanel() {
  const id = useId(), titleId = `${id}-creation-title`, introId = `${id}-creation-intro`, errorId = `${id}-creation-error`;
  const [open, setOpen] = useState(false), [step, setStep] = useState<Step>("select"), [reload, setReload] = useState(0);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null), [record, setRecord] = useState<CreationRecord | null>(null);
  const [draft, setDraft] = useState<CreationDraft>(emptyCreationDraft), [pendingRequest, setPendingRequest] = useState<CreationRequest | null>(null);
  const [loading, setLoading] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [rejected, setRejected] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null), body = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null), errorRef = useRef<HTMLDivElement>(null);
  const serial = useRef(0), operation = useRef<AbortController | null>(null), inFlight = useRef(false);
  const requestRef = useRef<CreationRequest | null>(null);
  const draftError = catalogs ? creationDraftError(draft, catalogs.races, catalogs.classes) : "";
  const selectedRace = catalogs?.races.races.find(r => r.id === draft.raceId);
  const selectedClass = catalogs?.classes.classes.find(c => c.id === draft.classId);
  const sum = (points: readonly number[]) => points.every(Number.isFinite) ? points.reduce((a, b) => a + b, 0) : null;

  useLayoutEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current, returnTo = opener.current;
    node.showModal(); heading.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && node.open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    };
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("keydown", escape, true);
      serial.current++; operation.current?.abort(); inFlight.current = false;
      if (node.open) node.close();
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    // Short screens scroll the frame; taller screens scroll the body.
    if (frame.current) frame.current.scrollTop = 0;
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [open, step, ready]);
  useLayoutEffect(() => { if (open && error) errorRef.current?.focus({ preventScroll: false }); }, [open, error]);
  useEffect(() => {
    if (!open) return;
    const current = ++serial.current, controller = new AbortController(); operation.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    let disposed = false;
    setLoading(true); setReady(false); setError(""); setRejected(false);
    void (async () => {
      const saved = await readCreationState(controller.signal);
      const loaded = await readDerivationCatalogs(controller.signal);
      if (saved.record && !creationMatchesCatalogs(saved.record, loaded.races, loaded.classes)) throw new CreationClientFailure("invalid-record");
      let retained: CreationRequest | null = null;
      if (!saved.record) retained = readPendingCreation(window.sessionStorage);
      else { try { clearPendingCreation(window.sessionStorage); } catch { /* Saved server record takes precedence. */ } }
      if (disposed || serial.current !== current) return;
      setCatalogs(loaded); setRecord(saved.record); requestRef.current = retained; setPendingRequest(retained);
      if (retained) setDraft({ raceId: retained.raceId, classId: retained.classId,
        allocation: [...retained.allocation], raceAllocation: [...retained.raceAllocation] });
      setStep(saved.record ? "result" : retained ? "pending" : "select"); setReady(true);
    })().catch((e: unknown) => {
      if (!disposed && serial.current === current) setError(e instanceof CreationClientFailure ? CREATION_MESSAGES[e.code]
        : "目前無法讀取建立狀態或原建立識別，請重新讀取；不要清除網站資料或重新抽取。");
    }).finally(() => {
      window.clearTimeout(timer);
      if (!disposed && serial.current === current) setLoading(false);
    });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); };
  }, [open, reload]);

  async function establish() {
    if (!ready || !catalogs || record || inFlight.current || (step !== "confirm" && step !== "pending")) return;
    let request: CreationRequest;
    try {
      request = requestRef.current ?? requestFromDraft(draft, window.crypto.randomUUID());
      retainPendingCreation(window.sessionStorage, request); // Must survive refresh before any POST is sent.
    } catch {
      setError("瀏覽器無法保留建立識別，尚未送出建立；請允許網站儲存後再試。");
      errorRef.current?.focus(); return;
    }
    requestRef.current = request; setPendingRequest(request); setStep("pending");
    const current = ++serial.current, controller = new AbortController(); operation.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    inFlight.current = true; setBusy(true); setError(""); setRejected(false);
    try {
      const saved = await submitCreation(request, controller.signal);
      if (!saved.record || !creationMatchesCatalogs(saved.record, catalogs.races, catalogs.classes))
        throw new CreationClientFailure("unavailable");
      if (serial.current !== current || controller.signal.aborted) return;
      setRecord(saved.record); requestRef.current = null; setPendingRequest(null); setStep("result");
      try { clearPendingCreation(window.sessionStorage); } catch { /* A subsequent GET still selects the saved record. */ }
    } catch (e: unknown) {
      if (serial.current === current) {
        setError(e instanceof CreationClientFailure ? CREATION_MESSAGES[e.code] : CREATION_MESSAGES.unavailable);
        setRejected(e instanceof CreationClientFailure && ["invalid-request", "invalid-allocation", "unknown-content"].includes(e.code));
      }
    } finally {
      window.clearTimeout(timer);
      if (operation.current === controller) { inFlight.current = false; setBusy(false); }
    }
  }
  const readAgain = () => {
    if (loading || inFlight.current) return;
    setBusy(false); setReload(n => n + 1);
  };
  const updatePoint = (kind: "allocation" | "raceAllocation", i: number, n: number) => {
    setError(""); setDraft(d => ({ ...d, [kind]: d[kind].map((old, j) => j === i ? n : old) }));
  };
  const editRejectedDraft = () => {
    if (!rejected || inFlight.current) return;
    try { clearPendingCreation(window.sessionStorage); }
    catch { setError("瀏覽器無法更新建立識別，請先允許網站儲存。" ); return; }
    requestRef.current = null; setPendingRequest(null); setRejected(false); setError(""); setStep("allocate");
  };
  function advance() {
    if (step === "select") { setError(""); setStep("allocate"); }
    else if (step === "allocate") {
      if (draftError) { setError(draftError); errorRef.current?.focus(); return; }
      setError(""); setStep("confirm");
    }
  }

  return <section className="derivation-entry creation-entry">
    <button ref={opener} type="button" className="catalog-reload" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setBusy(false); setOpen(true); }}>角色建立與核對</button>
    <p>建立並保存一名角色；正式冒險尚未接入。</p>
    {open ? createPortal(<dialog ref={dialog} className="derivation-sheet creation-sheet" aria-labelledby={titleId} aria-describedby={introId}
      onKeyDown={e => { if (e.key === "Tab") e.stopPropagation(); }}
      onCancel={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}>
      <div ref={frame} className="derivation-frame">
        <header className="derivation-header"><div><p className="derivation-eyebrow">角色卡 · PostgreSQL 保存</p>
          <h2 ref={heading} id={titleId} tabIndex={-1}>{ready ? title[step] : "角色建立與核對"}</h2></div>
          <button className="derivation-close" type="button" aria-label="關閉角色建立畫面" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button></header>
        <div ref={body} className="derivation-body" aria-busy={loading || busy}>
          <p id={introId} className="derivation-muted">Lv.1 角色建立紀錄 · 起始行囊與冒險留待後續</p>
          <p className="derivation-feedback" role="status">{loading ? "正在讀取保存狀態與正式名冊……" : busy ? "正在保存。關閉畫面不等於取消建立；再次開啟可核對結果。" : ""}</p>
          <div ref={errorRef} id={errorId} className="derivation-error" role="alert" tabIndex={-1}>{error}
            {error && step === "allocate" ? <a href={`#${id}-allocation-0`}>前往屬性分配</a> : null}</div>
          {ready && catalogs ? <>
            {step !== "result" && step !== "pending" ? <ol className="creation-steps" aria-label="建立步驟">
              {["種族／職業", "屬性分配", "最後確認"].map((label, i) => <li key={label}
                aria-current={i === (step === "select" ? 0 : step === "allocate" ? 1 : 2) ? "step" : undefined}>{i + 1} · {label}</li>)}</ol> : null}
            {step === "select" ? <div className="derivation-fields">
              <label>種族<select value={draft.raceId} onChange={e => {
                setError(""); setDraft(d => ({ ...d, raceId: e.target.value, raceAllocation: [0, 0, 0, 0, 0, 0] }));
              }}>{catalogs.races.races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <label>初始職業<select value={draft.classId} onChange={e => { setError(""); setDraft(d => ({ ...d, classId: e.target.value })); }}>
                {catalogs.classes.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <section className="derivation-card"><h3>{selectedClass?.name}</h3><p>主要屬性：{selectedClass ? CONTENT_ATTRIBUTE_LABELS[selectedClass.primaryAttribute] : ""} ×1.25</p>
                <p>初始只開放這個職業。職業被動與正式戰鬥尚未接入。</p></section>
              <details className="creation-details"><summary>種族加成與資質分布</summary>
                <p>{CONTENT_ATTRIBUTES.map(k => `${CONTENT_ATTRIBUTE_LABELS[k]} ${sign(selectedRace?.attributeModifiers[k] ?? 0)}`).join("、")}</p>
                <p>自由種族點：{selectedRace?.freeAttributePoints}</p>
                <p>{selectedRace ? Object.entries(selectedRace.aptitudePercent).map(([k, n]) => `${CONTENT_APTITUDE_LABELS[k as keyof typeof CONTENT_APTITUDE_LABELS]} ${n}%`).join("、") : ""}</p>
              </details>
              <p className="derivation-note">個別資質、施法資格及龍息元素會在保存成功後揭曉。</p>
            </div> : null}
            {step === "allocate" ? <div className="derivation-fields">
              <p role="status">自由屬性：已分配 {sum(draft.allocation) ?? "—"}／12 點；每項基礎 8，最多再加 6 點。</p>
              <fieldset><legend>12 點自由屬性</legend><div className="derivation-allocation">{CONTENT_ATTRIBUTES.map((k, i) =>
                <label key={k}>{CONTENT_ATTRIBUTE_LABELS[k]}<input type="number" min="0" max="6" step="1" inputMode="numeric"
                  id={`${id}-allocation-${i}`} aria-describedby={`${id}-allocation-hint`} aria-invalid={!Number.isSafeInteger(draft.allocation[i]) || draft.allocation[i]! < 0 || draft.allocation[i]! > 6}
                  value={Number.isFinite(draft.allocation[i]) ? draft.allocation[i] : ""}
                  onChange={e => updatePoint("allocation", i, e.target.valueAsNumber)} /><span className="creation-helper">分配後 {Number.isFinite(draft.allocation[i]) ? 8 + draft.allocation[i]! : "—"}</span></label>)}</div></fieldset>
              {selectedRace?.freeAttributePoints === 2 ? <fieldset><legend>人類另 2 點種族加成 · 已分配 {sum(draft.raceAllocation) ?? "—"}／2</legend>
                <div className="derivation-allocation">{CONTENT_ATTRIBUTES.map((k, i) => <label key={k}>{CONTENT_ATTRIBUTE_LABELS[k]}<input type="number"
                  min="0" max="2" step="1" inputMode="numeric" aria-describedby={`${id}-allocation-hint`}
                  aria-invalid={!Number.isSafeInteger(draft.raceAllocation[i]) || draft.raceAllocation[i]! < 0 || draft.raceAllocation[i]! > 2}
                  value={Number.isFinite(draft.raceAllocation[i]) ? draft.raceAllocation[i] : ""}
                  onChange={e => updatePoint("raceAllocation", i, e.target.valueAsNumber)} /></label>)}</div></fieldset> : null}
              <p className="derivation-muted">種族加成後再乘職業倍率；人類種族點可以突破自由分配的 14 上限。</p>
              <p id={`${id}-allocation-hint`} className="creation-helper">{draftError || "分配完整，可以繼續核對。"}</p>
            </div> : null}
            {step === "confirm" ? <>
              <p className="derivation-identity">{selectedRace?.name} · {selectedClass?.name}</p>
              <dl className="derivation-stats">{CONTENT_ATTRIBUTES.map((k, i) => <div key={k}><dt>{CONTENT_ATTRIBUTE_LABELS[k]}</dt>
                <dd>{8 + draft.allocation[i]!}</dd><small>種族自由 +{draft.raceAllocation[i]}</small></div>)}</dl>
              <p className="derivation-note">確認後系統會生成並保存角色。完成後本切片不提供覆寫、刪除或重新抽取。</p>
              <p>資質依種族分布生成；直接施法資格獨立抽取，機率 1%。龍裔龍息火／冰／雷各 1／3。</p>
              <p>建立時滿 HP／MP。保存成功後才顯示個別結果，資格不代表已學會法術。</p>
            </> : null}
            {step === "pending" ? <>
              <section className="derivation-card"><h3>{busy ? "正在保存角色" : "保留同一次建立"}</h3>
                <p>尚未確認保存成功，個別生成結果不會在這裡提前揭曉。</p>
                <p>查詢只讀取狀態；手動重試會沿用原建立識別與輸入，不重新建立第二名角色。</p>
                {pendingRequest ? <p className="creation-code">建立識別：{pendingRequest.requestId}</p> : null}</section>
              {rejected ? <><p>系統已明確拒絕這份輸入，沒有建立角色；原輸入仍保留。</p>
                <button className="derivation-button derivation-button--secondary" type="button" onClick={editRejectedDraft}>返回修改草稿</button></> : null}
            </> : null}
            {step === "result" && record ? <>
              <p className="derivation-feedback" role="status">已保存；這份創角紀錄固定保留。</p>
              <p className="derivation-identity">{record.race.name} · {record.profession.name}</p>
              <div className="derivation-resources">{(["hp", "mp"] as const).map(kind => {
                const max = kind === "hp" ? record.resources.maxHp : record.resources.maxMp;
                return <section className="derivation-card" key={kind}><h3>初始 {kind.toUpperCase()}</h3>
                  <p className="derivation-resource-value"><strong>{max}</strong><span>／{max}</span></p>
                  <progress max={Math.max(1, max)} value={max} aria-label={`初始 ${kind.toUpperCase()}`} aria-valuetext={`${max}／${max}`} /></section>;
              })}</div>
              <dl className="derivation-stats">{record.attributes.map(row => <div key={row.attribute}><dt>{CONTENT_ATTRIBUTE_LABELS[row.attribute]}</dt>
                <dd>{row.final}</dd><small>修正 {sign(row.modifier)}</small></div>)}</dl>
              <section className="derivation-card"><h3>固定生成結果</h3><p>魔力資質：{CONTENT_APTITUDE_LABELS[record.aptitude]}</p>
                <p>直接施法資格：{record.directCasting ? "具有" : "不具有"}</p><p>血脈來源：尚未揭露</p>
                {record.breath ? <p>龍息元素：{breathNames[record.breath]}</p> : null}
                <p className="creation-helper">資格不代表已學法術；正式冒險、技能、裝備及武器熟練尚未接入。</p></section>
              <details className="creation-details"><summary>建立資訊與計算明細</summary>
                <p className="creation-code">角色識別：{record.characterId}</p><p>建立時間：{record.createdAt}</p>
                <p>五族 v{record.request.raceCatalogVersion} · 四職業 v{record.request.classCatalogVersion} · 推導 v{record.rulesVersion}</p>
                {record.attributes.map(row => <p key={row.attribute}>{CONTENT_ATTRIBUTE_LABELS[row.attribute]}：floor（({row.base} ＋ {row.raceFixed} ＋ {row.raceFree}) × {row.multiplier}）＝ {row.final}</p>)}
                <p>HP：20 ＋ 1 × 5 ＋ {record.attributes[2]!.final} × 3 ＝ {record.resources.maxHp}</p>
                <p>MP：{record.attributes[3]!.final} × 4 ＋ {record.aptitudeBonus} ＝ {record.resources.maxMp}</p>
              </details>
            </> : null}
          </> : null}
        </div>
        <footer className="derivation-footer">
          {!ready ? <button className="derivation-button derivation-button--secondary" type="button" aria-disabled={loading} onClick={readAgain}>重新讀取保存狀態</button>
            : step === "pending" ? <>
              <button className="derivation-button derivation-button--secondary" type="button" aria-disabled={busy} onClick={readAgain}>查詢結果</button>
              <button className="derivation-button derivation-button--primary" type="button" aria-disabled={busy || !pendingRequest}
                onClick={() => { if (pendingRequest) void establish(); }}>{busy ? "正在保存……" : "重試建立"}</button>
            </> : step === "result" ? <>
              <button className="derivation-button derivation-button--secondary" type="button" onClick={readAgain}>重新核對</button>
              <button className="derivation-button derivation-button--primary" type="button" onClick={() => setOpen(false)}>完成</button>
            </> : <>
              <button className="derivation-button derivation-button--secondary" type="button" onClick={() => {
                setError(""); if (step === "select") setOpen(false); else setStep(step === "allocate" ? "select" : "allocate");
              }}>{step === "select" ? "取消" : "上一步"}</button>
              <button className="derivation-button derivation-button--primary" type="button"
                aria-disabled={step === "allocate" && !!draftError}
                onClick={() => { if (step === "confirm") void establish(); else advance(); }}>{step === "confirm" ? "確認並保存" : "下一步"}</button>
            </>}
        </footer>
      </div>
    </dialog>, document.body) : null}
  </section>;
}
