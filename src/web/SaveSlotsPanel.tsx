import type { SaveSlotId, SaveSlotSummary } from "../shared/save-game.js";
import { Button } from "./ui/Button.js";

export interface SaveConfirmation {
  readonly kind: "overwrite" | "load";
  readonly slotId: SaveSlotId;
}

export function formatSavedAt(savedAt: string): string {
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(savedAt));
}

export function SaveSlotsPanel({
  slots,
  loading,
  busySlotId,
  feedback,
  confirmation,
  onSave,
  onLoad,
  onConfirm,
  onCancel,
}: {
  readonly slots: readonly SaveSlotSummary[] | null;
  readonly loading: boolean;
  readonly busySlotId: SaveSlotId | null;
  readonly feedback: string;
  readonly confirmation: SaveConfirmation | null;
  readonly onSave: (slot: SaveSlotSummary) => void;
  readonly onLoad: (slotId: SaveSlotId) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <section className="save-slots" aria-labelledby="save-slots-heading" aria-busy={loading || busySlotId !== null || undefined}>
      <div className="save-slots__intro">
        <h3 id="save-slots-heading">手動存檔</h3>
        <p>只保存 authoritative GameState。探索紀錄、敘事與輸入文字不在存檔內。</p>
      </div>
      {loading ? <p role="status">正在讀取存檔槽……</p> : null}
      {!loading && slots ? (
        <ol className="save-slot-list">
          {slots.map((slot) => {
            const isBusy = busySlotId === slot.slotId;
            const confirming = confirmation?.slotId === slot.slotId ? confirmation : null;
            return (
              <li key={slot.slotId} className="save-slot" data-empty={slot.empty}>
                <div className="save-slot__heading">
                  <h4>存檔 {slot.slotId}</h4>
                  <span>{slot.empty ? "尚無存檔" : `格式 v${slot.formatVersion}`}</span>
                </div>
                {slot.empty ? <p>這個存檔槽目前是空的。</p> : (
                  <dl>
                    <div><dt>位置</dt><dd>{slot.locationId}</dd></div>
                    <div><dt>保存時間</dt><dd><time dateTime={slot.savedAt}>{formatSavedAt(slot.savedAt)}</time></dd></div>
                    <div><dt>來源版本</dt><dd>{slot.sourceRevision}</dd></div>
                  </dl>
                )}
                {confirming ? (
                  <div className="save-slot__confirmation" role="alert">
                    <p>{confirming.kind === "overwrite"
                      ? `存檔 ${slot.slotId} 已有資料。確定要覆蓋嗎？`
                      : "載入會取代目前尚未保存的進度。確定載入嗎？"}</p>
                    <div>
                      <Button loading={isBusy} loadingLabel="處理中……" onClick={onConfirm}>
                        {confirming.kind === "overwrite" ? "確認覆蓋" : "確認載入"}
                      </Button>
                      <Button variant="secondary" disabled={isBusy} onClick={onCancel}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="save-slot__actions">
                    <Button variant={slot.empty ? "primary" : "secondary"} disabled={busySlotId !== null}
                      onClick={() => onSave(slot)}>{slot.empty ? "儲存" : "覆蓋"}</Button>
                    {!slot.empty ? (
                      <Button variant="secondary" disabled={busySlotId !== null}
                        onClick={() => onLoad(slot.slotId)}>載入</Button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="save-slots__feedback" role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
      <div className="save-slots__placeholder">
        <h3>顯示設定</h3>
        <p>尚未接入。</p>
      </div>
    </section>
  );
}
