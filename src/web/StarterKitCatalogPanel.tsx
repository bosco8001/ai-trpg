import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_ATTRIBUTES, CONTENT_ATTRIBUTE_LABELS } from "../shared/content-catalog.js";
import type { OfficialClassCatalog } from "../shared/class-catalog.js";
import type { OfficialStarterKitCatalog, OfficialStarterItem, StarterKitId, StarterRequirement, StarterWeaponFamily } from "../shared/starter-kit-catalog.js";
import { readStarterKitCatalog } from "./starter-kit-catalog-client.js";
import { readClassCatalog } from "./class-catalog-client.js";
import { observeStarterReading } from "./starter-catalog-reading.js";

const familyNames: Record<StarterWeaponFamily, string> = { sword: "劍類", bow: "弓類", dagger: "匕首類", staff: "杖類" };
const requirementText = (r: StarterRequirement) => `${CONTENT_ATTRIBUTE_LABELS[r.attribute]} ${r.minimum}`;
function bonusText(bonuses: OfficialStarterItem["attributeBonuses"]): string {
  return CONTENT_ATTRIBUTES.filter(key => bonuses[key] !== 0)
    .map(key => `${CONTENT_ATTRIBUTE_LABELS[key]} +${bonuses[key]}`).join("、") || "無";
}
function ItemCard({ item }: { item: OfficialStarterItem }) {
  const kind = item.kind === "weapon" ? "武器" : item.kind === "body-armor" ? "身體防具" : "魔法書";
  return <details className="starter-catalog__item">
    <summary><span>{item.name}</span><span className="starter-catalog__kind">{kind}</span></summary>
    <dl className="starter-catalog__facts">
      <div><dt>裝備需求</dt><dd>{requirementText(item.requirement)}</dd></div>
      <div><dt>生效加成</dt><dd>{bonusText(item.attributeBonuses)}</dd></div>
      <div><dt>護甲值</dt><dd>{item.armor}</dd></div>
      {item.kind === "weapon" ? <div><dt>武器分類</dt><dd>{familyNames[item.weaponFamily]}</dd></div> : null}
    </dl>
    {item.kind === "spellbook" ? <p>綁定火焰箭技能格時作為裝備來源；持書不等於永久學會法術。</p> : null}
  </details>;
}
type Catalogs = { starter: OfficialStarterKitCatalog; classes: OfficialClassCatalog };
export function StarterKitCatalogPanel() {
  const titleId = useId(), introId = useId();
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<StarterKitId | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null), headingRef = useRef<HTMLHeadingElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null), openerRef = useRef<HTMLButtonElement>(null);
  const readingRef = useRef<ReturnType<typeof observeStarterReading> | null>(null);
  const lastViewedRef = useRef<StarterKitId | null>(null), lastRowRef = useRef<HTMLButtonElement | null>(null);
  const kit = catalogs?.starter.kits.find(k => k.id === selected);
  const ability = catalogs?.starter.abilities.find(a => a.id === kit?.ability.id);
  const className = (classId: string) => catalogs?.classes.classes.find(c => c.id === classId)?.name ?? classId;

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current, opener = openerRef.current;
    if (!dialog) return;
    dialog.showModal();
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Tab") event.stopPropagation(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dialog.open) return;
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    };
    dialog.addEventListener("keydown", keyboard);
    window.addEventListener("keydown", escape, true);
    headingRef.current?.focus({ preventScroll: true });
    let resizeFrame: number | null = null;
    let focusRepairPending = false;
    let reading: ReturnType<typeof observeStarterReading> | null = null;
    const measureFocus = () => {
      const active = document.activeElement;
      if (!dialog.open || !(active instanceof HTMLElement) || active === dialog || !dialog.contains(active)) return null;
      const frame = frameRef.current, body = bodyRef.current;
      const viewport = frame && frame.scrollHeight > frame.clientHeight ? frame
        : body?.contains(active) ? body : frame;
      if (!viewport) return null;
      const bounds = active.getBoundingClientRect(), layout = viewport.getBoundingClientRect();
      const style = window.getComputedStyle(viewport);
      const top = layout.top + Math.max(8, Number.parseFloat(style.scrollPaddingTop) || 0);
      const bottom = layout.bottom - Math.max(8, Number.parseFloat(style.scrollPaddingBottom) || 0);
      return { active, viewport,
        visible: bounds.bottom > top && bounds.top < bottom && bounds.right > layout.left && bounds.left < layout.right,
        contained: bounds.top >= top && bounds.bottom <= bottom && bounds.left >= layout.left && bounds.right <= layout.right };
    };
    let previousFocus = measureFocus();
    const recordFocus = () => { previousFocus = measureFocus(); };
    const recordScroll = (reading: boolean) => {
      const next = measureFocus();
      // Reflow can clamp against an intermediate maximum. It must not erase an anchor.
      // Native focus scrolling may make a new focus visible; explicit reading can hide it.
      if (reading || next?.visible) previousFocus = next;
      if (reading) {
        // Reading after a queued resize takes ownership; its end is not a reason
        // to snap a partially visible control back into view.
        focusRepairPending = false;
        if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
      }
    };
    const keepFocusVisible = () => {
      // Sample each intermediate range now, rather than compare an old position
      // against only the final maximum in a later scroll event.
      focusRepairPending = true;
      reading?.observeLayout();
      if (!focusRepairPending) return;
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        // Allow first-frame browser/unwrapped programmatic scroll to arrive before
        // correcting focus. This is two bounded frames, not a polling loop.
        reading?.observeLayout();
        if (!focusRepairPending) { resizeFrame = null; return; }
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = null;
          reading?.observeLayout();
          if (!focusRepairPending) return;
          const next = measureFocus();
          if (reading?.isReading()) return;
          focusRepairPending = false;
          if (next && previousFocus?.active === next.active && previousFocus.visible && !next.contained)
            reading?.repair(() => next.active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" }));
          previousFocus = measureFocus();
        });
      });
    };
    reading = observeStarterReading(dialog,
      [frameRef.current, bodyRef.current].filter((element): element is HTMLDivElement => element !== null),
      recordScroll, () => {
        // Keep the baseline from the last actual reading movement. A later clamp
        // must not overwrite it, even if this session had moved earlier.
        if (focusRepairPending) keepFocusVisible();
      });
    readingRef.current = reading;
    dialog.addEventListener("focusin", recordFocus);
    // Reflow can move an existing focus between the body and whole-sheet scroll areas.
    const observer = new ResizeObserver(keepFocusVisible);
    for (const target of [dialog, frameRef.current, bodyRef.current,
      dialog.querySelector("header"), dialog.querySelector("footer")])
      if (target) observer.observe(target);
    window.addEventListener("resize", keepFocusVisible);
    window.visualViewport?.addEventListener("resize", keepFocusVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepFocusVisible);
      window.visualViewport?.removeEventListener("resize", keepFocusVisible);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      reading?.dispose();
      if (readingRef.current === reading) readingRef.current = null;
      dialog.removeEventListener("focusin", recordFocus);
      dialog.removeEventListener("keydown", keyboard);
      window.removeEventListener("keydown", escape, true);
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const frame = frameRef.current, body = bodyRef.current;
    const restoreScreen = () => {
      if (frame) frame.scrollTop = 0;
      if (body) body.scrollTop = 0;
      // Short or enlarged layouts scroll the whole sheet instead of a squeezed body.
      const viewport = frame && frame.scrollHeight > frame.clientHeight ? frame : body;
      if (selected) headingRef.current?.focus({ preventScroll: true });
      else if (lastRowRef.current?.isConnected) {
        const row = lastRowRef.current;
        row.focus({ preventScroll: true });
        if (viewport) {
          const bounds = row.getBoundingClientRect(), visible = viewport.getBoundingClientRect();
          if (bounds.bottom > visible.bottom) viewport.scrollTop += bounds.bottom - visible.bottom + 8;
          else if (bounds.top < visible.top) viewport.scrollTop -= visible.top - bounds.top + 8;
        }
      }
    };
    if (readingRef.current) readingRef.current.repair(restoreScreen);
    else restoreScreen();
  }, [selected, open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    setBusy(true); setCatalogs(null); setError("");
    void Promise.all([readStarterKitCatalog(controller.signal), readClassCatalog(controller.signal)])
      .then(([starter, classes]) => {
        if (starter.classCatalogVersion !== classes.catalogVersion) throw new Error("職業版本不一致。");
        if (!disposed) setCatalogs({ starter, classes });
      })
      .catch(() => {
        controller.abort();
        if (!disposed) setError("目前無法讀取正式起始配套名冊，請稍後重試。");
      })
      .finally(() => { window.clearTimeout(timer); if (!disposed) setBusy(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); };
  }, [open, attempt]);
  function show() {
    lastRowRef.current = null; lastViewedRef.current = null;
    setSelected(null); setCatalogs(null); setError(""); setBusy(true); setOpen(true);
  }
  return <section className="class-catalog-entry starter-catalog-entry">
    <button className="class-catalog__button class-catalog__button--secondary" type="button" ref={openerRef}
      aria-haspopup="dialog" onClick={show}>起始配套名冊</button>
    <p>查看四職業的起始裝備、能力與熟練。</p>
    {open ? createPortal(<dialog ref={dialogRef} className="class-catalog__sheet starter-catalog__sheet"
      aria-labelledby={titleId} aria-describedby={introId}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}>
      <div className="class-catalog__frame" ref={frameRef}>
        <header className="class-catalog__header">
          <div><p className="class-catalog__eyebrow">起始配套 · 唯讀</p>
            <h2 id={titleId} ref={headingRef} tabIndex={-1}>{kit ? `${className(kit.classId)}配套` : "起始配套"}</h2></div>
          <button className="class-catalog__close" type="button" aria-label="關閉起始配套名冊" onClick={() => setOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="class-catalog__body" ref={bodyRef} aria-busy={busy}>
          <p id={introId} className="class-catalog__intro">{kit ? "查看資料不會發放或穿戴裝備。" : "選一個職業查看起始配套。"}</p>
          <p className="class-catalog__feedback" role="status">{busy ? "正在讀取名冊……" : catalogs
            ? `配套名冊 v${catalogs.starter.catalogVersion} · 八件裝備 · 四項能力` : ""}</p>
          {error ? <p className="class-catalog__error" role="alert">{error}</p> : null}
          {catalogs && !kit ? <ul className="class-catalog__list">{catalogs.starter.kits.map(k => <li key={k.id}>
            <button className="class-catalog__row starter-catalog__row" type="button" ref={element => {
              if (lastViewedRef.current === k.id) lastRowRef.current = element;
            }} onClick={event => { lastViewedRef.current = k.id; lastRowRef.current = event.currentTarget; setSelected(k.id); }}>
              <span className="class-catalog__row-copy"><strong>{className(k.classId)}</strong>
                <span>{k.itemIds.map(id => catalogs.starter.items.find(i => i.id === id)!.name).join("、")}</span></span>
            </button>
          </li>)}</ul> : null}
          {catalogs && kit && ability ? <div key={kit.id}>
            <section className="class-catalog__card"><h3>起始裝備</h3>
              <p className="class-catalog__muted">各一件，點選查看需求與加成。</p>
              {kit.itemIds.map(id => <ItemCard key={id} item={catalogs.starter.items.find(i => i.id === id)!} />)}
            </section>
            <section className="class-catalog__card"><p className="class-catalog__eyebrow">起始主動能力</p>
              <h3>{ability.name}</h3><p>{ability.description}</p>
              <dl className="starter-catalog__facts">
                <div><dt>取得來源</dt><dd>{kit.ability.acquisition === "learned" ? "永久已學物理技能" : "魔法書提供，尚未永久學會"}</dd></div>
                <div><dt>技能需求</dt><dd>{requirementText(ability.requirement)}</dd></div>
                <div><dt>生效加成</dt><dd>{bonusText(ability.attributeBonuses)}</dd></div>
                <div><dt>使用來源</dt><dd>{ability.source.kind === "learned-with-active-weapon"
                  ? `已學會，且裝備生效的${familyNames[ability.source.weaponFamily]}武器`
                  : "合法綁定火焰箭魔法書；或永久已學且具有直接施法資格"}</dd></div>
              </dl>
              <p>佔六格主動技能之一。只有生效時提供技能加成。</p>
              {ability.kind === "spell" ? <aside className="class-catalog__notice"><strong>持書不等於直接施法資格</strong>
                <p>火焰箭不需要木杖；魔術師職業也不自動賦予直接施法資格。</p></aside> : null}
              <p className="class-catalog__muted">傷害、命中加成、消耗、詠唱及冷卻數值尚待確認。</p>
            </section>
            <section className="class-catalog__card"><h3>起始武器熟練</h3><p>{familyNames[kit.weaponProficiency]}熟練，不佔技能格。</p>
              <p className="class-catalog__muted">熟練時命中正常、傷害 +2；未熟練仍可使用，攻擊判定 −2，沒有熟練傷害加成。</p>
            </section>
          </div> : null}
          {catalogs ? <details className="class-catalog__rules"><summary>需求判斷與收錄範圍</summary>
            <p>裝備需求以固有屬性先乘目前職業倍率、向下取整後核對，不加入任何裝備或技能加成。</p>
            <p>技能需求再加入生效裝備加成，不加入技能加成。職業不限制技能種類；仍須符合武器或施法來源條件。</p>
            <p>最大 HP／MP 隨最終屬性改變；上限提高不補充目前值，降低時只截掉超出部分。HP 為零不因此復活。</p>
            <p>起始配套種類與數值已確認。發放、保存、換裝與戰鬥接入仍分階段製作；本畫面不改動角色或存檔。</p>
          </details> : null}
        </div>
        <footer className="class-catalog__footer">
          {kit ? <button className="class-catalog__button class-catalog__button--secondary" type="button" onClick={() => setSelected(null)}>返回四職業</button>
            : <button className="class-catalog__button class-catalog__button--primary" type="button" aria-disabled={busy}
              onClick={() => {
                if (busy) return;
                lastViewedRef.current = null; lastRowRef.current = null; setCatalogs(null); setError(""); setBusy(true); setAttempt(v => v + 1);
              }}>重新讀取名冊</button>}
        </footer>
      </div>
    </dialog>, document.body) : null}
  </section>;
}
