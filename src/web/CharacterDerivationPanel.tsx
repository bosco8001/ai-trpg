import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CONTENT_ATTRIBUTES, CONTENT_ATTRIBUTE_LABELS, CONTENT_APTITUDES, CONTENT_APTITUDE_LABELS } from "../shared/content-catalog.js";
import { DERIVATION_MESSAGES, type DerivationAptitude, type DerivationResult, type DerivationSample, type SampleResources } from "../shared/character-derivation.js";
import { readDerivationCatalogs, readDerivationPreview } from "./character-derivation-client.js";
import { initialDerivationRequest, derivationDraftError, previewMatchesDraft } from "./character-derivation-ui.js";

type Catalogs = Awaited<ReturnType<typeof readDerivationCatalogs>>;
type View = "overview" | "edit" | "details";
const sign = (n: number) => n > 0 ? `+${n}` : String(n).replace("-", "−");
const numberValue = (n: number) => Number.isFinite(n) ? n : "";
const failureText = "目前無法完成核對，請重試；原樣本仍保留。";

export function CharacterDerivationPanel() {
  const id = useId(), titleId = `${id}-title`, introId = `${id}-intro`, errorId = `${id}-error`, formId = `${id}-form`;
  const [open, setOpen] = useState(false), [view, setView] = useState<View>("overview");
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null), [result, setResult] = useState<DerivationResult | null>(null);
  const [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0), [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<DerivationSample>(() => initialDerivationRequest().sample);
  const [resources, setResources] = useState<SampleResources>(() => initialDerivationRequest().resources);
  const [preview, setPreview] = useState<DerivationResult | null>(null), [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState(""), [feedback, setFeedback] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null), headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null), errorRef = useRef<HTMLParagraphElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null), editRef = useRef<HTMLButtonElement>(null), detailsRef = useRef<HTMLButtonElement>(null);
  const priorView = useRef<View>("overview"), serial = useRef(0), pending = useRef<AbortController | null>(null);
  const retainedResult = useRef<DerivationResult | null>(null);
  const draftError = catalogs ? derivationDraftError(draft, resources, catalogs.races, catalogs.classes) : "";
  const error = draftError || requestError;
  const ready = previewMatchesDraft(preview, draft, resources) && !error && !busy;

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current, opener = openerRef.current;
    if (!dialog) return;
    dialog.showModal(); headingRef.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dialog.open) {
        event.preventDefault(); event.stopPropagation(); setOpen(false);
      }
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Tab") event.stopPropagation(); };
    window.addEventListener("keydown", escape, true); dialog.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("keydown", escape, true); dialog.removeEventListener("keydown", keyboard);
      serial.current++; pending.current?.abort();
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (view === "overview" && priorView.current !== "overview") {
      (priorView.current === "edit" ? editRef : detailsRef).current?.focus({ preventScroll: true });
    } else headingRef.current?.focus({ preventScroll: true });
    priorView.current = view;
  }, [view, open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    setLoading(true); setLoadError(""); setCatalogs(null);
    void (async () => {
      const loaded = await readDerivationCatalogs(controller.signal);
      const initial = retainedResult.current ?? await readDerivationPreview(initialDerivationRequest(), controller.signal);
      if (!disposed) { retainedResult.current = initial; setCatalogs(loaded); setResult(initial); }
    })().catch(() => { if (!disposed) setLoadError("目前無法讀取核對資料，請重新讀取；原樣本仍保留。"); })
      .finally(() => { window.clearTimeout(timer); if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); };
    // Retained memory sample is separate from the open/retry loading lifecycle.
  }, [open, attempt]);

  function invalidatePreview() {
    serial.current++; pending.current?.abort(); pending.current = null;
    setPreview(null); setBusy(false); setRequestError("");
  }
  function edit() {
    if (!result || !catalogs || loading) return;
    invalidatePreview(); setDraft(structuredClone(result.sample)); setResources({ ...result.after }); setView("edit");
  }
  function updateDraft(next: DerivationSample) { invalidatePreview(); setDraft(next); }
  function changeRace(raceId: string) {
    if (!catalogs) return;
    const race = catalogs.races.races.find(r => r.id === raceId);
    if (!race) return;
    const aptitude = race.aptitudePercent[draft.aptitude] > 0 ? draft.aptitude
      : CONTENT_APTITUDES.find(a => race.aptitudePercent[a] > 0)!;
    const raceAllocation = race.freeAttributePoints === 2
      ? draft.raceId === race.id ? [...draft.raceAllocation] : [2, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0];
    updateDraft({ ...draft, raceId, aptitude, raceAllocation });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!catalogs || !result || busy) return;
    if (error) {
      if (draftError) { errorRef.current?.focus(); return; }
      setRequestError("");
    }
    if (ready && preview) {
      retainedResult.current = preview;
      setResult(preview); setView("overview"); setPreview(null);
      setFeedback("核對樣本已更新，遊戲角色與存檔沒有變更。"); return;
    }
    const controller = new AbortController(), requestSerial = ++serial.current;
    pending.current?.abort(); pending.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 5000);
    setBusy(true); setRequestError("");
    try {
      const next = await readDerivationPreview({ schemaVersion: 1, raceCatalogVersion: 2, classCatalogVersion: 1,
        sample: draft, resources }, controller.signal);
      if (serial.current === requestSerial && !controller.signal.aborted) setPreview(next);
    } catch (e) {
      if (serial.current === requestSerial) {
        setRequestError(e instanceof Error && !controller.signal.aborted
          && Object.values(DERIVATION_MESSAGES).some(message => message === e.message) ? e.message : failureText);
        requestAnimationFrame(() => { if (serial.current === requestSerial && dialogRef.current?.open) errorRef.current?.focus(); });
      }
    } finally {
      window.clearTimeout(timer);
      if (serial.current === requestSerial) { setBusy(false); pending.current = null; }
    }
  }
  const title = view === "edit" ? "調整核對樣本" : view === "details" ? "計算來源" : "角色屬性核對";
  const race = catalogs?.races.races.find(r => r.id === draft.raceId);
  const humanPoints = draft.raceAllocation.flatMap((n, i) => Array.from({ length: n }, () => i));

  return <section className="derivation-entry">
    <button ref={openerRef} className="derivation-button derivation-button--secondary" type="button" aria-haspopup="dialog"
      onClick={() => { invalidatePreview(); setView("overview"); priorView.current = "overview"; setFeedback(""); setLoading(true); setOpen(true); }}>角色屬性核對</button>
    <p>正式五族與四職業，僅調整核對樣本。</p>
    {open ? createPortal(<dialog ref={dialogRef} className="derivation-sheet" aria-labelledby={titleId} aria-describedby={introId}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}>
      <div className="derivation-frame">
        <header className="derivation-header"><div><p className="derivation-eyebrow">規則核對 · 記憶體樣本</p>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2></div>
          <button className="derivation-close" type="button" aria-label="關閉角色屬性核對，保留原樣本" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="derivation-body" ref={bodyRef} aria-busy={loading}>
          <p id={introId} className="derivation-muted">Lv.1 · 無裝備／技能加成 · 不建立或修改遊戲角色</p>
          <p role="status" className="derivation-feedback">{loading ? "正在讀取正式名冊與核對結果……" : feedback}</p>
          {loadError ? <p className="derivation-error" role="alert">{loadError}</p> : null}
          {!loading && catalogs && result ? <>
            {view === "overview" ? <>
              <p className="derivation-identity">{result.identity.raceName} · {result.identity.className}</p>
              <div className="derivation-resources">{(["hp", "mp"] as const).map(kind => {
                const current = kind === "hp" ? result.after.currentHp : result.after.currentMp;
                const max = kind === "hp" ? result.after.maxHp : result.after.maxMp;
                return <section className="derivation-card" key={kind} aria-label={`${kind.toUpperCase()} ${current}／${max}`}>
                  <h3>{kind.toUpperCase()}</h3><p className="derivation-resource-value"><strong>{current}</strong><span>／{max}</span></p>
                  <progress value={current} max={Math.max(1, max)} aria-label={`${kind.toUpperCase()} 樣本資源`} aria-valuetext={`${current}／${max}`} />
                </section>;
              })}</div>
              <dl className="derivation-stats">{result.attributes.map(row => <div key={row.attribute}>
                <dt>{CONTENT_ATTRIBUTE_LABELS[row.attribute]}</dt><dd>{row.final}</dd><small>修正 {sign(row.modifier)}</small>
              </div>)}</dl>
              <p className="derivation-note">上限提高不補血／回魔；降低時只截掉超過新上限的部分。</p>
              <p className="derivation-muted">五族 v{result.raceCatalogVersion} · 四職業 v{result.classCatalogVersion} · 資質：{CONTENT_APTITUDE_LABELS[result.sample.aptitude]}</p>
            </> : null}
            {view === "edit" ? <form id={formId} onSubmit={submit} noValidate className="derivation-fields" aria-busy={busy}>
              <p className="derivation-muted">資質是已知樣本，並非玩家可選或在創角前揭曉。職業清單不代表角色已開放全部職業。</p>
              <p id={errorId} ref={errorRef} tabIndex={-1} className="derivation-error" role="alert">{error}
                {draftError ? <span>請核對下方欄位：<a href={`#${id}-allocation`}>創角分配</a>、<a href={`#${id}-resources`}>目前資源</a>。</span> : null}</p>
              <label>樣本種族<select value={draft.raceId} aria-describedby={errorId} onChange={e => changeRace(e.target.value)}>{catalogs.races.races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <label>樣本職業<select value={draft.classId} onChange={e => updateDraft({ ...draft, classId: e.target.value })}>{catalogs.classes.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>樣本魔力資質<select value={draft.aptitude} onChange={e => updateDraft({ ...draft, aptitude: e.target.value as DerivationAptitude })}>
                {CONTENT_APTITUDES.filter(a => race && race.aptitudePercent[a] > 0).map(a => <option key={a} value={a}>{CONTENT_APTITUDE_LABELS[a]}</option>)}
              </select></label>
              <fieldset id={`${id}-allocation`} tabIndex={-1}><legend>12 點創角分配</legend><p className="derivation-muted">每項基礎 8，分配 0～6 點；合計 {draft.allocation.every(Number.isFinite) ? draft.allocation.reduce((s, n) => s + n, 0) : "未完成"}／12。</p>
                <div className="derivation-allocation">{CONTENT_ATTRIBUTES.map((key, i) => <label key={key}>{CONTENT_ATTRIBUTE_LABELS[key]}
                  <input type="number" inputMode="numeric" min="0" max="6" step="1" required value={numberValue(draft.allocation[i]!)} aria-describedby={errorId}
                    aria-invalid={!Number.isSafeInteger(draft.allocation[i]) || draft.allocation[i]! < 0 || draft.allocation[i]! > 6
                      || draft.allocation.reduce((s, n) => s + n, 0) !== 12}
                    onChange={e => { const allocation = [...draft.allocation]; allocation[i] = e.target.valueAsNumber; updateDraft({ ...draft, allocation }); }} />
                </label>)}</div>
              </fieldset>
              {race?.freeAttributePoints === 2 ? <fieldset><legend>人類另有 2 點種族加成</legend>
                {[0, 1].map(point => <label key={point}>第 {point + 1} 點<select value={humanPoints[point] ?? 0} onChange={e => {
                  const indices = [humanPoints[0] ?? 0, humanPoints[1] ?? 0]; indices[point] = Number(e.target.value);
                  updateDraft({ ...draft, raceAllocation: CONTENT_ATTRIBUTES.map((_, i) => indices.filter(n => n === i).length) });
                }}>{CONTENT_ATTRIBUTES.map((key, i) => <option key={key} value={i}>{CONTENT_ATTRIBUTE_LABELS[key]}</option>)}</select></label>)}
              </fieldset> : null}
              <fieldset id={`${id}-resources`} tabIndex={-1}><legend>變更前的目前資源（核對樣本）</legend><p className="derivation-muted">上限使用原樣本的 HP {resources.maxHp}／MP {resources.maxMp}，不是新配置的上限。</p>
                <div className="derivation-allocation">{(["currentHp", "currentMp"] as const).map(key => <label key={key}>{key === "currentHp" ? "目前 HP" : "目前 MP"}
                  <input type="number" inputMode="numeric" min="0" max={key === "currentHp" ? resources.maxHp : resources.maxMp} step="1" required
                    aria-invalid={!Number.isSafeInteger(resources[key]) || resources[key] < 0 || resources[key] > (key === "currentHp" ? resources.maxHp : resources.maxMp)}
                    value={numberValue(resources[key])} aria-describedby={errorId} onChange={e => { invalidatePreview(); setResources({ ...resources, [key]: e.target.valueAsNumber }); }} />
                </label>)}</div>
              </fieldset>
              <div className="derivation-preview" role="status" aria-live="polite" aria-atomic="true">{busy ? "正在計算，尚未更新總覽……" : ready && preview ? <>
                <strong>確認前只看預覽</strong><p>HP {preview.before.currentHp}／{preview.before.maxHp} → {preview.after.currentHp}／{preview.after.maxHp}</p>
                <p>MP {preview.before.currentMp}／{preview.before.maxMp} → {preview.after.currentMp}／{preview.after.maxMp}</p>
                {preview.after.currentHp < preview.before.currentHp || preview.after.currentMp < preview.before.currentMp
                  ? <p>新上限較低，超出的資源會被截掉；換回較高上限也不會自動補回。</p> : <p>上限提高不會額外補血或回魔。</p>}
              </> : "修改後先預覽，再更新核對樣本；總覽仍保留原樣本。"}</div>
            </form> : null}
            {view === "details" ? <>
              <p className="derivation-muted">順序：基礎分配 → 種族 → 職業 → 生效裝備 → 生效技能。本切片裝備與技能加成均為 0。</p>
              <ul className="derivation-details">{result.attributes.map(row => <li key={row.attribute}><h3>{CONTENT_ATTRIBUTE_LABELS[row.attribute]} {row.final} · 修正 {sign(row.modifier)}</h3>
                <p>基礎分配 {row.base} ＋種族固定 {sign(row.raceFixed)} ＋種族自由 {sign(row.raceFree)} ＝固有 {row.intrinsic}</p>
                <p>floor（{row.intrinsic} × {row.multiplier}）＝資格 {row.qualification}；裝備 +0、技能 +0 → 最終 {row.final}</p>
              </li>)}</ul>
              <section className="derivation-card"><h3>最大 HP／MP</h3><p>HP：20 ＋ 1 × 5 ＋ {result.attributes[2]!.final} × 3 ＝ {result.after.maxHp}</p>
                <p>MP：{result.attributes[3]!.final} × 4 ＋ {result.aptitudeBonus} ＝ {result.after.maxMp}</p>
                <p>魔力資質與魔術師職業不自動賦予直接施法資格。</p></section>
              <section className="derivation-card"><h3>容量規則</h3><p>新目前值 = min（原目前值，新上限）。HP 為 0 維持 0。</p>
                <p>算法例子：40／40 → 40／54；50／54 → 40／40 → 40／54。例子不代表新增正式裝備。</p></section>
              <p className="derivation-muted">正式來源：五族名冊 v2／四職業名冊 v1。這裡不提供正式創角、轉職、配裝或資源恢復。</p>
            </> : null}
          </> : null}
        </div>
        <footer className="derivation-footer">
          {loading || loadError ? <button className="derivation-button derivation-button--secondary" type="button" aria-disabled={loading}
            onClick={() => { if (!loading) setAttempt(n => n + 1); }}>重新讀取核對資料</button>
          : view === "overview" ? <>
            <button ref={editRef} className="derivation-button derivation-button--primary" type="button" onClick={edit}>調整樣本</button>
            <button ref={detailsRef} className="derivation-button derivation-button--secondary" type="button" onClick={() => { if (result) setView("details"); }}>計算明細</button>
          </> : <>
            <button className="derivation-button derivation-button--secondary" type="button" onClick={() => {
              invalidatePreview(); setView("overview"); setFeedback(view === "edit" ? "已取消，原樣本保留。" : "");
            }}>{view === "edit" ? "取消" : "返回總覽"}</button>
            {view === "edit" ? <button className="derivation-button derivation-button--primary" type="submit" form={formId} aria-disabled={!!draftError || busy}>
              {busy ? "正在核對……" : ready ? "更新核對樣本" : "預覽數值"}</button> : null}
          </>}
        </footer>
      </div>
    </dialog>, document.body) : null}
  </section>;
}
