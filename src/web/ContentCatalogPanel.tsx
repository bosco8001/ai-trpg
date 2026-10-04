import { useEffect, useId, useState } from "react";
import { CONTENT_ATTRIBUTES, CONTENT_ATTRIBUTE_LABELS, CONTENT_APTITUDES, CONTENT_APTITUDE_LABELS,
  isOfficialContentCatalog, type OfficialContentCatalog } from "../shared/content-catalog.js";
import { receive } from "./repair-preparation.js";
import { Button } from "./ui/Button.js";

export function ContentCatalogPanel() {
  const id = useId(), [open, setOpen] = useState(false), [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState<OfficialContentCatalog | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    setBusy(true); setCatalog(null); setError("");
    void (async () => {
      const response = await fetch("/api/content-catalog", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error();
      const value: unknown = JSON.parse(await receive(response, controller.signal, 32 * 1024));
      if (!isOfficialContentCatalog(value)) throw new Error();
      if (!disposed) setCatalog(value);
    })().catch(() => { if (!disposed) setError("目前無法讀取正式內容名冊，請稍後重試。"); })
      .finally(() => { window.clearTimeout(timer); if (!disposed) setBusy(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); };
  }, [open, attempt]);
  return <section className="data-health content-catalog">
    <Button variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>正式內容名冊</Button>
    {open ? <div id={id} aria-busy={busy} className="data-health__report content-catalog__report">
      <header className="content-catalog__heading">
        <h3>正式內容名冊</h3>
        {catalog ? <span className="content-catalog__version">正式內容版本：{catalog.catalogVersion}</span> : null}
      </header>
      <p className="content-catalog__intro">五種族的已定創角資料，供你查看與比較。</p>
      <aside className="content-catalog__rule">
        <strong>所有角色的資質在創角完成後揭曉。</strong>
        <p>生成後固定，不重新隨機。<br />魔力資質不代表直接施法資格。</p>
      </aside>
      <p className="content-catalog__feedback" role="status" aria-live="polite">{busy ? "正在讀取名冊……" : catalog ? "正式內容名冊已讀取。" : ""}</p>
      {error ? <p className="content-catalog__error" role="alert">{error}</p> : null}
      {catalog ? <>
        <nav className="content-catalog__jump" aria-label="跳到種族">
          {catalog.races.map(race => <a href={`#${id}-${race.id}`} key={race.id}>{race.name}</a>)}
        </nav>
        <ul className="content-catalog__races">{catalog.races.map((race, index) => <li className="content-catalog__race" id={`${id}-${race.id}`} tabIndex={-1} key={race.id}>
          <header className="content-catalog__race-heading">
            <div className="content-catalog__race-name">
              <span className="content-catalog__ordinal" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h4>{race.name}</h4>
            </div>
            {race.aptitudeReveal === "after-creation" ? <span className="content-catalog__reveal">創角後揭曉</span> : null}
          </header>
          <p className="content-catalog__label">固定屬性加成</p>
          <dl className="content-catalog__attributes">{CONTENT_ATTRIBUTES.map(key => {
            const modifier = race.attributeModifiers[key];
            return <div className="content-catalog__attribute" key={key}>
              <dt>{CONTENT_ATTRIBUTE_LABELS[key]}</dt>
              <dd data-sign={modifier > 0 ? "positive" : modifier < 0 ? "negative" : "zero"}>
                {modifier > 0 ? `+${modifier}` : modifier < 0 ? `−${Math.abs(modifier)}` : modifier}
              </dd>
            </div>;
          })}</dl>
          {race.freeAttributePoints > 0 ? <p className="content-catalog__free-points"><span>自由種族屬性點</span><strong>+{race.freeAttributePoints} 點</strong></p> : null}
          <section className="content-catalog__aptitude" aria-label={`${race.name}魔力資質分布`}>
            <p className="content-catalog__label">魔力資質分布</p>
            <div className="content-catalog__aptitude-bar" aria-hidden="true">
              {CONTENT_APTITUDES.filter(key => race.aptitudePercent[key] > 0).map(key =>
                <span data-aptitude={key} style={{ flexGrow: race.aptitudePercent[key] }} key={key} />)}
            </div>
            <dl className="content-catalog__distribution">
              {CONTENT_APTITUDES.filter(key => race.aptitudePercent[key] > 0).map(key => <div key={key}>
                <dt><span className="content-catalog__dot" data-aptitude={key} aria-hidden="true" />{CONTENT_APTITUDE_LABELS[key]}</dt>
                <dd>{race.aptitudePercent[key]}%</dd>
              </div>)}
            </dl>
          </section>
        </li>)}</ul>
      </> : null}
      <p className="content-catalog__footnote">種族天生能力、職業、物品及技能尚未在此名冊接入。查看不會建立角色或改動遊戲。</p>
      <Button variant="secondary" disabled={busy} onClick={() => setAttempt(v => v + 1)}>重新讀取名冊</Button>
    </div> : null}
  </section>;
}
