import { orderedHistory } from "../shared/narrative.js";
import type { AuthoritativeGameStateResponse } from "../shared/game-state.js";
import { loadAuthoritativeGameState } from "./api.js";
import { useEffect, useReducer, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./ui/Button.js";
import { Icon, type IconName } from "./ui/Icon.js";
import { Panel } from "./ui/Panel.js";
import { DataHealthPanel } from "./DataHealthPanel.js";
import { ContentCatalogPanel } from "./ContentCatalogPanel.js";
import { ClassCatalogPanel } from "./ClassCatalogPanel.js";
import { RawDataBackupPanel } from "./RawDataBackupPanel.js";
import { RepairPreviewPanel } from "./RepairPreviewPanel.js";
import { executeExplorationAction, listSaveSlots, loadExplorationState, loadGame, saveGame } from "./api.js";
import { SaveSlotsPanel, type SaveConfirmation } from "./SaveSlotsPanel.js";
import { MAX_PLAYER_TEXT_LENGTH } from "../shared/interpretation.js";
import type { ExplorationStateSummary } from "../shared/exploration-action.js";
import type { SaveSlotId, SaveSlotSummary } from "../shared/save-game.js";
import {
  actionComposerReducer,
  getSuggestedActions,
  initialActionComposerState,
  isUtilityDismissKey,
  utilityPanelReducer,
  utilityPanels,
  type UtilityPanelId,
} from "./exploration-ui.js";
import {
  initialNarrativeEntries,
  narrativeEntriesAfterLoad,
  describeCandidate,
  describeRuling,
  isSubmittableAction,
  shouldSubmitOnEnter,
  submitLocalExplorationAction,
  type NarrativeEntry,
} from "./exploration.js";

export type ConnectionState = "checking" | "connected" | "unavailable";

const connectionLabels: Record<ConnectionState, string> = {
  checking: "正在確認服務連線",
  connected: "服務已連線",
  unavailable: "服務目前無法連線",
};

const utilityTools: readonly { id: UtilityPanelId; label: string; icon: IconName }[] = [
  { id: "inventory", label: "背包", icon: "backpack" },
  { id: "equipment", label: "裝備", icon: "equipment" },
  { id: "party", label: "隊伍", icon: "party" },
  { id: "system", label: "系統", icon: "settings" },
];

function NarrativeHistory({ entries }: { entries: readonly NarrativeEntry[] }) {
  return (
    <ol className="narrative-history" aria-label="探索紀錄">
      {entries.map((entry) => (
        <li key={entry.id} className="narrative-entry" data-source={entry.source}>
          <p className="narrative-entry__label">{entry.label}</p>
          <p className="narrative-entry__text reading-copy">{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}

function trapDrawerFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    "button:not([disabled]), [href], textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  ));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function ExplorationPage({
  connectionState,
  onRetryConnection, authoritativeState, onStateUpdate, onRetryState, presentation, onHistoryEntry,
}: {
  connectionState: ConnectionState;
  onRetryConnection?: () => void;
  authoritativeState?:AuthoritativeGameStateResponse;
  onStateUpdate?:(state:AuthoritativeGameStateResponse)=>void;
  onHistoryEntry?:(entry:import("../shared/narrative.js").NarrativeEntry,generation:string)=>void;
  onRetryState?:()=>Promise<AuthoritativeGameStateResponse>;
  presentation?:{text:string|null;warning:string}|null;
}) {
  const [entries, setEntries] = useState<readonly NarrativeEntry[]>(authoritativeState ? [] : initialNarrativeEntries);
  const [composer, dispatchComposer] = useReducer(actionComposerReducer, initialActionComposerState);
  const [activeUtility, dispatchUtility] = useReducer(utilityPanelReducer, null);
  const [feedback, setFeedback] = useState("介面測試模式：輸入只會暫存在這個頁面。 ");
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameState, setGameState] = useState<ExplorationStateSummary | null>(null);
  const [saveSlots, setSaveSlots] = useState<readonly SaveSlotSummary[] | null>(null);
  const [saveSlotsLoading, setSaveSlotsLoading] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [saveConfirmation, setSaveConfirmation] = useState<SaveConfirmation | null>(null);
  const [busySlotId, setBusySlotId] = useState<SaveSlotId | null>(null);
  const entryId = useRef(0);
  const live=useRef(true);
  useEffect(()=>{live.current=true;document.getElementById('main-content')?.focus();return()=>{live.current=false;};},[]);
  useEffect(()=>{if(authoritativeState) setGameState({revision:authoritativeState.state.revision,...authoritativeState.state.exploration,storage:authoritativeState.storage});},[authoritativeState]);
  const formalEntries:readonly NarrativeEntry[] = orderedHistory(authoritativeState?.state.phase26?.history ?? []).map(e=>({id:e.id,source:'narration',label:e.type === 'post-combat' ? '戰後敘事' : '探索敘事',text:e.text}));
  const legacyEntries:readonly NarrativeEntry[] = (authoritativeState?.state.phase26?.history ?? []).filter(e=>e.category === 'legacy-unplaced').map(e=>({id:e.id,source:'narration',label:'舊版紀錄',text:e.text}));
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const utilityTriggerRef = useRef<HTMLButtonElement>(null);
  const processingRef = useRef(false);
  const saveOperationRef = useRef(false);
  const submittedCount = entries.length - initialNarrativeEntries.length;
  const suggestedActions = getSuggestedActions(gameState?.locationId ?? "TEST-forest-edge");

  useEffect(() => {
    if(authoritativeState) return;
    let disposed = false;
    void loadExplorationState()
      .then((state) => { if (!disposed) setGameState(state); })
      .catch(() => { if (!disposed) setFeedback("暫時無法讀取權威探索狀態。"); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (submittedCount > 0) historyEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [submittedCount]);

  useEffect(() => {
    if (!composer.isOpen) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [composer.isOpen]);

  useEffect(() => {
    if (!activeUtility) return;
    const opener = utilityTriggerRef.current;
    const frame = requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isUtilityDismissKey(event.key)) return;
      event.preventDefault();
      dispatchUtility({ type: "close" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [activeUtility]);

  useEffect(() => {
    if (activeUtility !== "system") return;
    let disposed = false;
    setSaveSlotsLoading(true);
    setSaveFeedback("");
    void listSaveSlots()
      .then((response) => { if (!disposed) setSaveSlots(response.slots); })
      .catch((error: unknown) => {
        if (!disposed) setSaveFeedback(error instanceof Error ? error.message : "存檔列表暫時無法使用。");
      })
      .finally(() => { if (!disposed) setSaveSlotsLoading(false); });
    return () => { disposed = true; };
  }, [activeUtility]);

  function closeUtilityPanel() {
    setSaveConfirmation(null);
    dispatchUtility({ type: "close" });
  }

  function updateSlot(updated: Extract<SaveSlotSummary, { empty: false }>) {
    setSaveSlots((current) => current?.map((slot) => slot.slotId === updated.slotId ? updated : slot) ?? null);
  }

  function refreshSaveStateAfterFailure() {
    void loadExplorationState().then(setGameState).catch(() => undefined);
    void listSaveSlots().then((response) => setSaveSlots(response.slots)).catch(() => undefined);
  }

  function runSaveOperation(kind: "save" | "load", slotId: SaveSlotId) {
    if (!gameState || saveOperationRef.current) return;
    saveOperationRef.current = true;
    setBusySlotId(slotId);
    setSaveFeedback(kind === "save" ? `正在儲存存檔 ${slotId}……` : `正在載入存檔 ${slotId}……`);
    const operation = kind === "save"
      ? saveGame(slotId, gameState.revision)
      : loadGame(slotId, gameState.revision);
    void operation.then((response) => {
      if(!live.current) return;
      updateSlot(response.slot);
      setGameState(response.state);
      setSaveConfirmation(null);
      if (kind === "load") {
        if(response.authoritative && onStateUpdate) onStateUpdate({...response.authoritative,sandbox:authoritativeState?.sandbox ?? false});
        setEntries(authoritativeState ? [] : narrativeEntriesAfterLoad(slotId));
        dispatchComposer({ type: "submitted" });
        setFeedback(`已載入存檔 ${slotId}；已恢復存檔中的探索紀錄。`);
        setSaveFeedback(`已載入存檔 ${slotId}。權威狀態版本現在是 ${response.state.revision}。`);
      } else {
        setSaveFeedback(`存檔 ${slotId} 已儲存；live revision 維持 ${response.state.revision}。`);
      }
    }).catch((error: unknown) => {
      setSaveFeedback(error instanceof Error ? error.message : "存檔操作暫時無法完成。");
      refreshSaveStateAfterFailure();
    }).finally(() => {
      saveOperationRef.current = false;
      setBusySlotId(null);
    });
  }

  function submitAction(rawText: string, source: "composer" | "suggestion") {
    if (!isSubmittableAction(rawText) || isProcessing || processingRef.current || !gameState) return;
    const text = rawText.trim();
    const next = submitLocalExplorationAction(entries, text);
    setEntries(next.entries);
    if (source === "composer") dispatchComposer({ type: "submitted" });
    setFeedback(next.feedback ?? "正在解析、裁定並整理敘事……");
    processingRef.current = true;
    setIsProcessing(true);
    void executeExplorationAction(text, gameState.revision).then(async (response) => {
      if(response.narrativeDelivery?.status === "saved") onHistoryEntry?.(response.narrativeDelivery.entry,response.narrativeDelivery.generation);
      if(!live.current) return;
      entryId.current += 1;
      const id = entryId.current;
      const additions: NarrativeEntry[] = [
        { id: `interpretation-${id}`, source: "interpretation", label: "候選解析（固定測試）", text: describeCandidate(response.candidate) },
        { id: `ruling-${id}`, source: "ruling", label: "系統裁定（權威）", text: describeRuling(response.ruling) },
      ];
      if (!authoritativeState && response.narration.status === "ready") {
        additions.push({ id: `narration-${id}`, source: "narration", label: "探索敘事（固定測試）", text: response.narration.text });
      } else if (!authoritativeState && response.narration.status !== "not-requested") {
        additions.push({ id: `narration-${id}`, source: "system", label: "探索敘事暫時不可用", text: response.narration.text });
      }
      if(authoritativeState && response.narrativeDelivery?.status === "unsaved" && response.narration.text) additions.push({id:`unsaved-${id}`,source:"narration",label:"探索文字（未保存）",text:response.narration.text});
      setEntries((current) => [...current, ...additions]);
      setGameState(current=>current && current.revision > response.state.revision ? current : response.state);
      if(onStateUpdate) {try {const state=await loadAuthoritativeGameState();if(live.current) onStateUpdate(state);} catch {setFeedback("行動回應已收到；完整狀態目前無法重新讀取。");return;}}
      setFeedback(response.narrativeDelivery?.status === "unsaved" ? "行動已完成；本次探索文字未保存。" : response.ruling.accepted && response.narration.status === "ready"
        ? "權威狀態已更新，探索敘事已整理完成。"
        : response.ruling.accepted
          ? "權威狀態已更新；探索敘事暫時不可用。"
          : "行動未執行；權威狀態未被這次請求修改。");
    }).catch(() => {
      if(!live.current) return;
      entryId.current += 1;
      setEntries((current) => [...current, {
        id: `interpretation-${entryId.current}`,
        source: "system",
        label: "解析暫時不可用",
        text: "探索回應尚未確認；正在重新讀取目前狀態。",
      }]);
      setFeedback("探索回應尚未確認，請重新讀取目前狀態；不會自動重送行動。");
      if(onRetryState) void onRetryState().catch(()=>undefined);
    }).finally(() => {
      processingRef.current = false;
      setIsProcessing(false);
    });
    if (source === "composer") requestAnimationFrame(() => inputRef.current?.focus());
  }

  const activePanel = activeUtility ? utilityPanels[activeUtility] : null;

  return (
    <main id="main-content" className="exploration-shell" tabIndex={-1}>
      <div className="exploration-shell__inner">
        <header className="exploration-header">
          <div>
            <p className="exploration-header__eyebrow">探索</p>
            <h1>AI TRPG</h1>
            <p className="exploration-header__lede reading-copy">文字探索介面</p>
          </div>
          <div className="connection-brief" data-state={connectionState}>
            <p role="status" aria-live="polite"><span aria-hidden="true" className="connection-brief__marker" />{connectionLabels[connectionState]}</p>
            {onRetryConnection ? (
              <Button className="connection-brief__retry" variant="secondary" loading={connectionState === "checking"} loadingLabel="確認連線中……" onClick={onRetryConnection}>重新檢查連線</Button>
            ) : null}
          </div>
        </header>

        <Panel className="exploration-panel" aria-labelledby="history-heading">
          <div className="exploration-panel__heading">
            <div>
              <p className="exploration-panel__eyebrow">故事紀錄</p>
              <h2 id="history-heading">旅程尚待書寫</h2>
            </div>
            <p className="exploration-panel__mode">固定敘事測試</p>
          </div>
          <p className="exploration-panel__notice">裁判先更新權威 TEST 狀態，說書人才描述已確定的結果。敘事失敗不會撤銷成功行動。</p>

          <section className="exploration-state" aria-labelledby="exploration-state-heading">
            <h3 id="exploration-state-heading">Phase 8 工程測試狀態</h3>
            {gameState ? (
              <dl>
                <div><dt>目前位置</dt><dd>{gameState.locationId}</dd></div>
                <div><dt>版本</dt><dd>{gameState.revision}</dd></div>
                <div><dt>最近觀察</dt><dd>{gameState.lastObservationTargetId ?? "尚無"}</dd></div>
                <div><dt>保存方式</dt><dd>{gameState.storage === "postgres" ? "PostgreSQL" : "記憶體（API 重啟即重設）"}</dd></div>
              </dl>
            ) : <p role="status">正在讀取權威探索狀態……</p>}
          </section>

          <NarrativeHistory entries={formalEntries} />
              {legacyEntries.length ? <section aria-label="舊版紀錄"><h3>舊版紀錄</h3><NarrativeHistory entries={legacyEntries}/></section> : null}
              {presentation ? <div role="status">{presentation.text ? <p>{presentation.text}</p> : null}<p>{presentation.warning}</p></div> : null}
              <NarrativeHistory entries={entries} />
          <div ref={historyEndRef} aria-hidden="true" />

          <section className="suggested-actions" aria-labelledby="suggested-actions-heading" aria-busy={isProcessing || undefined}>
            <div className="suggested-actions__heading">
              <div>
                <p className="exploration-panel__eyebrow">下一步</p>
                <h3 id="suggested-actions-heading">可採取的行動方向</h3>
              </div>
              <p>固定測試建議</p>
            </div>
            <p className="suggested-actions__hint">這五項只是可點選的自然語言 fixture；每次仍會經候選解析、權威裁定與探索敘事。</p>
            <div className="suggested-actions__grid">
              {suggestedActions.map((suggestion) => (
                <Button key={suggestion.id} variant="secondary" className="suggested-action" disabled={isProcessing || !gameState}
                  onClick={() => submitAction(suggestion.text, "suggestion")}>{suggestion.text}</Button>
              ))}
            </div>
          </section>

          <section className="utility-toolbar" aria-label="探索工具">
            <button className="utility-tool" type="button" aria-label="自行描述行動" aria-expanded={composer.isOpen}
              aria-controls="free-action-composer" disabled={isProcessing} onClick={() => dispatchComposer({ type: "open" })}>
              <span className="utility-tool__icon"><Icon name="quill" /></span><span>行動</span>
            </button>
            {utilityTools.map((tool) => (
              <button key={tool.id} className="utility-tool" type="button" aria-label={`開啟${tool.label}面板`}
                aria-expanded={activeUtility === tool.id} aria-controls="utility-panel"
                onClick={(event) => { utilityTriggerRef.current = event.currentTarget; dispatchUtility({ type: "open", panel: tool.id }); }}>
                <span className="utility-tool__icon"><Icon name={tool.icon} /></span><span>{tool.label}</span>
              </button>
            ))}
          </section>

          {composer.isOpen ? (
            <form id="free-action-composer" className="action-form" onSubmit={(event) => { event.preventDefault(); submitAction(composer.text, "composer"); }}>
              <div className="action-form__heading">
                <label htmlFor="exploration-action">自行描述行動</label>
                <button className="action-form__close" type="button" aria-label="收起自行描述行動輸入區" title="收起" disabled={isProcessing}
                  onClick={() => dispatchComposer({ type: "close" })}><Icon name="close" /><span aria-hidden="true">收起</span></button>
              </div>
              <p id="exploration-action-help" className="action-form__hint">Enter 送出，Shift+Enter 換行。最多 {MAX_PLAYER_TEXT_LENGTH} 字；目前只有文件列出的固定測試句可解析。</p>
              <textarea ref={inputRef} id="exploration-action" name="exploration-action" value={composer.text} rows={4}
                maxLength={MAX_PLAYER_TEXT_LENGTH} placeholder="描述你想做的事情……" aria-describedby="exploration-action-help" disabled={isProcessing}
                onChange={(event) => dispatchComposer({ type: "change", text: event.target.value })}
                onKeyDown={(event) => {
                  if (shouldSubmitOnEnter(event.key, event.shiftKey)) {
                    event.preventDefault();
                    submitAction(composer.text, "composer");
                  }
                }} />
              <div className="action-form__footer">
                <p className="action-form__feedback" {...(submittedCount > 0 ? { role: "status", "aria-live": "polite", "aria-atomic": "true" } : {})}>{feedback}</p>
                <Button type="submit" loading={isProcessing} loadingLabel="正在整理敘事……" disabled={!isSubmittableAction(composer.text) || isProcessing || !gameState}>送出行動</Button>
              </div>
            </form>
          ) : null}
        </Panel>
      </div>

      {activeUtility && activePanel ? (
        <div className="utility-drawer-layer">
          <button className="utility-drawer__backdrop" type="button" aria-label={`關閉${activePanel.title}面板`} onClick={closeUtilityPanel} />
          <aside id="utility-panel" className="utility-drawer" role="dialog" aria-modal="true" aria-labelledby="utility-panel-heading" onKeyDown={trapDrawerFocus}>
            <div className="utility-drawer__heading">
              <div><p className="exploration-panel__eyebrow">工具面板</p><h2 id="utility-panel-heading">{activePanel.title}</h2></div>
              <button ref={drawerCloseRef} className="utility-drawer__close" type="button" aria-label={`關閉${activePanel.title}面板`} title="關閉" onClick={closeUtilityPanel}><Icon name="close" /></button>
            </div>
            {activeUtility === "system" ? (
              <>
                <SaveSlotsPanel
                  slots={saveSlots}
                  loading={saveSlotsLoading}
                  busySlotId={busySlotId}
                  feedback={saveFeedback}
                  confirmation={saveConfirmation}
                  onSave={(slot) => {
                    if (slot.empty) runSaveOperation("save", slot.slotId);
                    else setSaveConfirmation({ kind: "overwrite", slotId: slot.slotId });
                  }}
                  onLoad={(slotId) => setSaveConfirmation({ kind: "load", slotId })}
                  onConfirm={() => {
                    if (!saveConfirmation) return;
                    runSaveOperation(saveConfirmation.kind === "overwrite" ? "save" : "load", saveConfirmation.slotId);
                  }}
                  onCancel={() => setSaveConfirmation(null)}
                />
                <ContentCatalogPanel />
                <ClassCatalogPanel />
                <DataHealthPanel />
                <RawDataBackupPanel />
                <RepairPreviewPanel currentState={authoritativeState?.state} />
              </>
            ) : (
              <>
                <p>{activePanel.description}</p>
                <ul className="utility-drawer__list">{activePanel.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
