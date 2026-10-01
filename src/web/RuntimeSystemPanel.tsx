import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button.js';
import { Panel } from './ui/Panel.js';
import { DataHealthPanel } from './DataHealthPanel.js';
import { RawDataBackupPanel } from './RawDataBackupPanel.js';
import { SaveSlotsPanel, type SaveConfirmation } from './SaveSlotsPanel.js';
import { listSaveSlots, loadGame, saveGame } from './api.js';
import type { SaveSlotSummary, SaveSlotId } from '../shared/save-game.js';
import type { AuthoritativeGameStateResponse } from '../shared/game-state.js';
export function RuntimeSystemPanel({ state, onStateUpdate, onRetryState, onMainMenu, disabled = false }: {
    state: AuthoritativeGameStateResponse;
    onStateUpdate: (s: AuthoritativeGameStateResponse) => void;
    onRetryState: () => Promise<AuthoritativeGameStateResponse>;
    onMainMenu?: () => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false), [slots, setSlots] = useState<readonly SaveSlotSummary[] | null>(null), [confirmation, setConfirmation] = useState<SaveConfirmation | null>(null), [busy, setBusy] = useState<SaveSlotId | null>(null), [feedback, setFeedback] = useState('');
    const inFlight = useRef(false), live = useRef(true);
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    async function refresh() {
        try {
            setSlots((await listSaveSlots()).slots);
        }
        catch {
            setFeedback('存檔槽目前無法讀取。');
        }
    }
    async function run(kind: 'save' | 'load', id: SaveSlotId) {
        if (inFlight.current || disabled)
            return;
        inFlight.current = true;
        setBusy(id);
        try {
            const result = await (kind === 'save' ? saveGame(id, state.state.revision) : loadGame(id, state.state.revision));
            if (!live.current)
                return;
            if (kind === 'load' && result.authoritative)
                onStateUpdate({ ...result.authoritative, sandbox: state.sandbox });
            setConfirmation(null);
            setFeedback(kind === 'save' ? '完整玩法與已保存敘事已儲存。' : '已載入存檔。');
            await refresh();
        }
        catch (error) {
            if (live.current)
                setFeedback(error instanceof Error ? error.message : '操作狀態尚未確認。');
            try {
                const current = await onRetryState();
                if (live.current)
                    onStateUpdate(current);
            }
            catch {
                if (live.current)
                    setFeedback('目前無法恢復讀取，請稍後重新讀取。');
            }
        }
        finally {
            inFlight.current = false;
            if (live.current)
                setBusy(null);
        }
    }
    return <Panel className="combat-rail__panel"><div className="runtime-system-controls"><Button variant="secondary" disabled={disabled || busy !== null} aria-expanded={open} onClick={() => {
            setOpen(!open);
            if (!open)
                void refresh();
        }}>系統／存檔</Button>
    {onMainMenu ? <Button variant="secondary" disabled={disabled || busy !== null} onClick={onMainMenu}>主選單</Button> : null}</div>
    {open ? <><SaveSlotsPanel slots={slots} loading={slots === null} busySlotId={busy} feedback={feedback} confirmation={confirmation} onSave={slot => slot.empty ? void run('save', slot.slotId) : setConfirmation({ kind: 'overwrite', slotId: slot.slotId })} onLoad={slotId => setConfirmation({ kind: 'load', slotId })} onConfirm={() => {
                if (confirmation)
                    void run(confirmation.kind === 'load' ? 'load' : 'save', confirmation.slotId);
            }} onCancel={() => setConfirmation(null)}/><DataHealthPanel /><RawDataBackupPanel /></> : null}
  </Panel>;
}
