import { useEffect, useRef } from "react";
import type { CombatPartyOptionsResponse } from "../shared/game-state.js";
import { Button } from "./ui/Button.js";

export function CombatPartyDialog({
  open,
  party,
  loading,
  error,
  busy,
  status,
  onClose,
  onClosed,
  onRetry,
  onPreferenceChange,
}: {
  open: boolean;
  party: CombatPartyOptionsResponse | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  status: string;
  onClose: () => void;
  onClosed: () => void;
  onRetry: () => void;
  onPreferenceChange: (companionId: string, tacticPreferenceId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      heading.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id="combat-party-dialog"
      className="combat-party-dialog"
      role="dialog"
      aria-labelledby="combat-party-heading"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClosed}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="combat-party-dialog__frame">
        <header className="combat-party-dialog__header">
          <div>
            <p className="combat-eyebrow">隊伍資訊</p>
            <h2 id="combat-party-heading" ref={heading} tabIndex={-1}>隊伍</h2>
          </div>
          <Button variant="secondary" className="combat-party-dialog__close" onClick={onClose}>
            關閉
          </Button>
        </header>
        <p className="combat-party-dialog__intro">查看資訊與調整戰術偏好不消耗回合。</p>
        <div className="combat-party-dialog__body">
          {loading ? <p role="status">正在讀取隊伍資料……</p> : null}
          {error ? <div className="combat-party-dialog__error" role="alert">
            <p>{error}</p>
            <Button variant="secondary" onClick={onRetry}>重新讀取隊伍資料</Button>
          </div> : null}
          {party?.context === "ended-combat"
            ? <p className="combat-party-dialog__notice">戰鬥已結束；隊伍資訊仍可查看，偏好調整目前停用。</p> : null}
          {party?.context === "outside-combat"
            ? <p className="combat-party-dialog__notice">目前不在戰鬥中；隊伍偏好調整尚未接入。</p> : null}
          {party && party.companions.length === 0 && !loading
            ? <p className="combat-party-dialog__notice">目前沒有可顯示的隊友資料。</p> : null}
          {party && party.companions.length > 0 ? <ul className="combat-party-list">
            {party.companions.map((companion) => {
              const currentOption = party.tacticPreferences.find((option) => option.id === companion.tacticPreferenceId);
              const currentPreferenceMissing = companion.tacticPreferenceId !== null && !currentOption;
              return <li key={companion.id} className="combat-party-member">
                <div className="combat-party-member__heading">
                  <h3>{companion.displayName}</h3>
                  {currentOption?.engineeringOnly
                    ? <span className="combat-party-member__badge">工程測試選項</span> : null}
                </div>
                <dl className="combat-party-member__facts">
                  <div><dt>等級</dt><dd>{companion.level ?? "尚未接入權威隊伍資料"}</dd></div>
                  <div><dt>站位</dt><dd>{companion.row === null ? "尚未接入權威隊伍站位" : companion.row === "front" ? "前排" : "後排"}</dd></div>
                  <div><dt>HP</dt><dd>{companion.hp ? `${companion.hp.current} / ${companion.hp.maximum}` : "尚未接入權威戰鬥狀態"}</dd></div>
                  <div><dt>MP</dt><dd>{companion.mp ? `${companion.mp.current} / ${companion.mp.maximum}` : "尚未接入權威戰鬥狀態"}</dd></div>
                </dl>
                <div className="combat-party-member__preference">
                  <label htmlFor={`party-tactic-${companion.id}`}>戰術偏好</label>
                  <select
                    id={`party-tactic-${companion.id}`}
                    value={companion.tacticPreferenceId ?? ""}
                    disabled={!party.canChangeTacticPreference || busy}
                    onChange={(event) => onPreferenceChange(companion.id, event.currentTarget.value)}
                  >
                    <option value="" disabled={companion.tacticPreferenceId !== null}>尚未設定</option>
                    {currentPreferenceMissing
                      ? <option value={companion.tacticPreferenceId!}>目前偏好（此選項未提供）</option> : null}
                    {party.tacticPreferences.map((option) => <option key={option.id} value={option.id}>
                      {option.displayName}{option.engineeringOnly ? "・工程測試" : ""}
                    </option>)}
                  </select>
                  <p>
                    {currentOption?.description
                      ?? (companion.tacticPreferenceId ? "目前偏好仍保留；此識別碼未出現在現有選項中。" : "偏好尚未設定。")}
                  </p>
                </div>
              </li>;
            })}
          </ul> : null}
          {party?.tacticPreferences.length && party.tacticPreferences.every((option) => option.engineeringOnly)
            ? <p className="combat-party-dialog__notice">目前選項只用於工程測試，尚未定義隊友行為。</p> : null}
        </div>
        <p className="combat-party-dialog__status" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      </div>
    </dialog>
  );
}
