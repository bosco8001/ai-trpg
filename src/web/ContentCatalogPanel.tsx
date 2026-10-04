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
  return <section className="data-health">
    <Button variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>正式內容名冊</Button>
    {open ? <div id={id} aria-busy={busy} className="data-health__report">
      <h3>正式內容名冊</h3>
      <p>目前收錄五個種族的已定創角資料。種族天生能力、職業、物品及技能尚未在此名冊接入。查看不會建立角色或改動遊戲。</p>
      <p>玩家可以是普通人或代行者；魔力資質不代表直接施法資格。</p>
      <p role="status" aria-live="polite">{busy ? "正在讀取名冊……" : catalog ? "正式內容名冊已讀取。" : ""}</p>
      {error ? <p role="alert">{error}</p> : null}
      {catalog ? <>
        <p>正式內容版本：{catalog.catalogVersion}。</p>
        <ul className="data-health__results">{catalog.races.map(race => <li className="data-health__item" key={race.id}>
          <h4>{race.name}</h4>
          <p>固定屬性加成：{CONTENT_ATTRIBUTES.map(k => `${CONTENT_ATTRIBUTE_LABELS[k]} ${race.attributeModifiers[k] > 0 ? "+" : ""}${race.attributeModifiers[k]}`).join("、")}。</p>
          {race.freeAttributePoints > 0 ? <p>另有 {race.freeAttributePoints} 點自由種族屬性點。</p> : null}
          <p>魔力資質分布：{CONTENT_APTITUDES.filter(k => race.aptitudePercent[k] > 0)
            .map(k => `${CONTENT_APTITUDE_LABELS[k]} ${race.aptitudePercent[k]}%`).join("、")}。</p>
          {race.aptitudeReveal === "after-creation" ? <p>個別角色的資質在創角完成後才揭曉，生成後固定。</p> : null}
        </li>)}</ul>
      </> : null}
      <Button variant="secondary" disabled={busy} onClick={() => setAttempt(v => v + 1)}>重新讀取名冊</Button>
    </div> : null}
  </section>;
}
