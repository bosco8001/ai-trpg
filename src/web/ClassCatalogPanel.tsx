import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_ATTRIBUTES, CONTENT_ATTRIBUTE_LABELS } from "../shared/content-catalog.js";
import type { InitialClassId, OfficialClassCatalog } from "../shared/class-catalog.js";
import { readClassCatalog } from "./class-catalog-client.js";

function ClassGlyph({ id }: { id: InitialClassId }) {
  const paths = {
    "class.swordsman": "M5 19l4-4m-3-3 6 6m-3-3L19 5l-4 1-9 9M3 21l3-3",
    "class.archer": "M5 3c12 3 12 15 0 18M5 3v18M3 12h18m-4-4 4 4-4 4",
    "class.scout": "M12 3l7 6-4 3-3 9-3-9-4-3 7-6z",
    "class.mage": "M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7z",
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[id]} /></svg>;
}
export function ClassCatalogPanel() {
  const titleId = useId(), introId = useId();
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<InitialClassId | null>(null);
  const [catalog, setCatalog] = useState<OfficialClassCatalog | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null), headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null), openerRef = useRef<HTMLButtonElement>(null);
  const lastRowRef = useRef<HTMLButtonElement | null>(null);
  const lastViewedRef = useRef<InitialClassId | null>(null);
  const entry = catalog?.classes.find(c => c.id === selected);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = openerRef.current;
    dialog.showModal();
    // Keep Tab within the native dialog's event path. Escape is captured at
    // window while this modal is open, including if the browser moves focus to BODY.
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab") event.stopPropagation();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dialog.open) return;
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    };
    dialog.addEventListener("keydown", keyboard);
    window.addEventListener("keydown", escape, true);
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.removeEventListener("keydown", keyboard);
      window.removeEventListener("keydown", escape, true);
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (selected) headingRef.current?.focus({ preventScroll: true });
    else if (lastRowRef.current?.isConnected) {
      const row = lastRowRef.current, body = bodyRef.current;
      row.focus({ preventScroll: true });
      if (body) {
        const rowBounds = row.getBoundingClientRect(), bodyBounds = body.getBoundingClientRect();
        if (rowBounds.bottom > bodyBounds.bottom) body.scrollTop += rowBounds.bottom - bodyBounds.bottom + 8;
        else if (rowBounds.top < bodyBounds.top) body.scrollTop -= bodyBounds.top - rowBounds.top + 8;
      }
    }
  }, [selected, open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    setBusy(true); setCatalog(null); setError("");
    void readClassCatalog(controller.signal)
      .then(value => { if (!disposed) setCatalog(value); })
      .catch(() => { if (!disposed) setError("目前無法讀取正式職業名冊，請稍後重試。"); })
      .finally(() => { window.clearTimeout(timer); if (!disposed) setBusy(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); };
  }, [open, attempt]);
  function show() {
    lastRowRef.current = null;
    lastViewedRef.current = null;
    setSelected(null); setCatalog(null); setError(""); setBusy(true); setOpen(true);
  }
  return <section className="class-catalog-entry">
    <button className="class-catalog__button class-catalog__button--secondary" type="button" ref={openerRef}
      aria-haspopup="dialog" onClick={show}>初階職業名冊</button>
    <p>四個正式職業，唯讀核對。</p>
    {open ? createPortal(<dialog ref={dialogRef} className="class-catalog__sheet" aria-labelledby={titleId}
      aria-describedby={introId} onCancel={event => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}>
      <div className="class-catalog__frame">
        <header className="class-catalog__header">
          <div><p className="class-catalog__eyebrow">職業圖鑑 · 唯讀</p>
            <h2 id={titleId} ref={headingRef} tabIndex={-1}>{entry?.name ?? "初階職業"}</h2></div>
          <button className="class-catalog__close" type="button" aria-label="關閉職業名冊" onClick={() => setOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="class-catalog__body" ref={bodyRef} aria-busy={busy}>
          <p id={introId} className="class-catalog__intro">{entry ? "查看職業資料，不會切換目前職業。" : "選一個職業查看倍率與被動說明。"}</p>
          <p className="class-catalog__feedback" role="status">{busy ? "正在讀取名冊……" : catalog ? `四個職業 · 職業名冊 v${catalog.catalogVersion}` : ""}</p>
          {error ? <p className="class-catalog__error" role="alert">{error}</p> : null}
          {catalog && !entry ? <ul className="class-catalog__list">{catalog.classes.map(c => <li key={c.id}>
            <button className="class-catalog__row" type="button" ref={element => {
              if (lastViewedRef.current === c.id) lastRowRef.current = element;
            }} onClick={event => {
              lastViewedRef.current = c.id; lastRowRef.current = event.currentTarget; setSelected(c.id);
            }} aria-label={`查看${c.name}，${CONTENT_ATTRIBUTE_LABELS[c.primaryAttribute]}倍率 1.25，${c.passive.name}`}>
              <span className="class-catalog__glyph"><ClassGlyph id={c.id} /></span>
              <span className="class-catalog__row-copy"><strong>{c.name}</strong><span>{c.passive.name}</span></span>
              <span className="class-catalog__multiplier">{CONTENT_ATTRIBUTE_LABELS[c.primaryAttribute]}<b>×1.25</b></span>
            </button>
          </li>)}</ul> : null}
          {entry ? <>
            <section className="class-catalog__card" aria-label="六項屬性倍率">
              <h3>屬性倍率</h3><dl className="class-catalog__attributes">{CONTENT_ATTRIBUTES.map(key => <div key={key} data-primary={key === entry.primaryAttribute}>
                <dt>{CONTENT_ATTRIBUTE_LABELS[key]}</dt><dd>×{entry.attributeMultipliers[key]}</dd>
              </div>)}</dl>
              <p>只有目前職業的倍率生效，其他職業不疊加。</p>
            </section>
            <section className="class-catalog__card"><p className="class-catalog__eyebrow">職業被動</p>
              <h3>{entry.passive.name}</h3><p>{entry.passive.description}</p>
              <p className="class-catalog__muted">本切片收錄規則說明，尚未接入戰鬥計算。</p>
            </section>
            {entry.id === "class.mage" ? <aside className="class-catalog__notice"><strong>職業不等於施法資格</strong>
              <p>成為魔術師不會自動取得直接施法資格。魔法書也須另行符合使用條件。</p></aside> : null}
          </> : null}
          <details className="class-catalog__rules"><summary>共通規則與收錄範圍</summary>
            <p>已開放的初階與進階職業可在戰鬥外切換，共用角色等級。職業不限制技能種類；技能仍須滿足屬性等需求。</p>
            <p>固有屬性先乘職業倍率並向下取整，再加生效裝備，作為資格數值。生效技能加成只加入最終數值，不參與技能或裝備門檻。</p>
            <p>本畫面不代表角色已開放這四個職業，也不提供創角、轉職或配裝。起始技能、裝備、熟練與進階解鎖條件仍待定。</p>
            <p>職業名冊 v1 與五族名冊 v2 分別管理版本。</p>
          </details>
        </div>
        <footer className="class-catalog__footer">
          {entry ? <button className="class-catalog__button class-catalog__button--secondary" type="button" onClick={() => setSelected(null)}>返回四職業</button>
            : <button className="class-catalog__button class-catalog__button--primary" type="button" aria-disabled={busy}
              onClick={() => {
                if (busy) return;
                lastViewedRef.current = null; lastRowRef.current = null; setCatalog(null); setError(""); setBusy(true); setAttempt(v => v + 1);
              }}>重新讀取名冊</button>}
        </footer>
      </div>
    </dialog>, document.body) : null}
  </section>;
}
