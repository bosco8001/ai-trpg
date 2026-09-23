import { createCombatState, type CombatState } from "./combat-state.js";
import { isInventory, normalizeInventory, type InventoryStack } from "./combat-items.js";

export type ExplorationLocationId = "TEST-forest-edge" | "TEST-ruin-entrance";

export interface ExplorationState {
  readonly locationId: ExplorationLocationId;
  readonly lastObservationTargetId: "TEST-stone-door" | null;
}

/** Phase 8 工程 fixture 的起點；不是正式世界初始地點。 */
export function createInitialTestExplorationState(): ExplorationState {
  return Object.freeze({ locationId: "TEST-forest-edge", lastObservationTargetId: null });
}

/** 最小權威狀態切片；TEST 探索識別碼全是工程資料，不是正式世界設定。 */
export interface GameState {
  readonly revision: number;
  readonly activity: "outside-combat" | "in-combat";
  readonly character: {
    readonly id: string;
    /** 只包含佔六格的已學主動技能；不包含種族能力與武器熟練。 */
    readonly learnedActiveSkillIds: readonly string[];
    readonly equippedSkillIds: readonly string[];
  };
  /** Authoritative item stacks; item definitions live in the static domain catalog. */
  readonly inventory: readonly InventoryStack[];
  readonly exploration: ExplorationState;
  readonly combat: CombatState | null;
}

/** Save Format v1 的既有內容；刻意不加入 Phase 11 CombatState。 */
export interface GameStateContents {
  readonly activity: "outside-combat";
  readonly character: GameState["character"];
  readonly inventory: GameState["inventory"];
  readonly exploration: ExplorationState;
}

export function gameStateContents(state: GameState): GameStateContents {
  const validated = createGameState(state);
  if (validated.activity !== "outside-combat" || validated.combat !== null) {
    throw new Error("Save Format v1 不支援 active combat。");
  }
  return Object.freeze({
    activity: "outside-combat",
    character: validated.character,
    inventory: validated.inventory,
    exploration: validated.exploration,
  });
}

export type StateReplacementResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly code: "invalid-state" | "stale-revision" | "revision-limit"; readonly message: string };

/** Load 是 system operation：恢復內容，但 revision 永遠從目前 live state 往前一格。 */
export function replaceGameStateContents(
  current: GameState,
  expectedRevision: unknown,
  contents: unknown,
): StateReplacementResult {
  if (!isRevision(expectedRevision) || expectedRevision !== current.revision) {
    return { ok: false, code: "stale-revision", message: "狀態已更新，請重新讀取後再載入存檔。" };
  }
  if (current.revision === Number.MAX_SAFE_INTEGER) {
    return { ok: false, code: "revision-limit", message: "狀態版本已達工程上限，無法載入存檔。" };
  }
  try {
    if (!isRecord(contents)) throw new Error("存檔內容不是物件。");
    const next = createGameState({ ...contents, revision: current.revision + 1, combat: null });
    if (next.character.id !== current.character.id) throw new Error("角色識別碼不一致。");
    return { ok: true, state: next };
  } catch {
    return { ok: false, code: "invalid-state", message: "存檔內容不符合目前的遊戲狀態契約。" };
  }
}

export interface SetEquippedSkillsCommand {
  readonly type: "set-equipped-skills";
  readonly expectedRevision: number;
  readonly skillIds: readonly string[];
}

export interface ApproachTargetCommand {
  readonly type: "approach-target";
  readonly expectedRevision: number;
  readonly targetId: "TEST-ruin-entrance";
}

export interface InspectTargetCommand {
  readonly type: "inspect-target";
  readonly expectedRevision: number;
  readonly targetId: "TEST-stone-door";
}

export type DomainCommand = SetEquippedSkillsCommand | ApproachTargetCommand | InspectTargetCommand;

export type CommandEffect =
  | { readonly type: "equipped-skills-updated"; readonly skillIds: readonly string[] }
  | { readonly type: "location-changed"; readonly locationId: ExplorationLocationId }
  | { readonly type: "target-inspected"; readonly targetId: "TEST-stone-door" };

export type RejectionCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "in-combat" | "target-not-found" | "too-many-skills" | "duplicate-skill" | "skill-not-learned";

export type CommandResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: CommandEffect }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };

const rejectionMessages: Record<RejectionCode, string> = {
  "invalid-command": "命令格式不符；不接受直接修改權威狀態。",
  "stale-revision": "狀態已更新，請重新讀取後再送出命令。",
  "revision-limit": "狀態版本已達工程上限，無法接受新命令。",
  "in-combat": "戰鬥中不能執行這項操作。",
  "target-not-found": "目前位置沒有可執行這項操作的目標。",
  "too-many-skills": "最多只能裝備六個主動技能。",
  "duplicate-skill": "同一技能不能重複選取。",
  "skill-not-learned": "只能裝備技能庫中的已學主動技能。",
};

function reject(code: RejectionCode): CommandResult {
  return { ok: false, code, message: rejectionMessages[code] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isIds(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(isId);
}

/** 不做型別轉換，也不移除多餘欄位後偷偷接受命令。 */
export function parseCommand(value: unknown): DomainCommand | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 3 || !isRevision(value.expectedRevision)) return undefined;
  if (value.type === "set-equipped-skills" && isIds(value.skillIds)) {
    return { type: value.type, expectedRevision: value.expectedRevision, skillIds: [...value.skillIds] };
  }
  if (value.type === "approach-target" && value.targetId === "TEST-ruin-entrance") {
    return { type: value.type, expectedRevision: value.expectedRevision, targetId: value.targetId };
  }
  if (value.type === "inspect-target" && value.targetId === "TEST-stone-door") {
    return { type: value.type, expectedRevision: value.expectedRevision, targetId: value.targetId };
  }
  return undefined;
}

function loadoutError(learned: readonly string[], equipped: readonly string[]): RejectionCode | undefined {
  if (equipped.length > 6) return "too-many-skills";
  if (new Set(equipped).size !== equipped.length) return "duplicate-skill";
  if (equipped.some((id) => !learned.includes(id))) return "skill-not-learned";
  return undefined;
}

/** 伺服器建立初始狀態的入口；不是玩家命令，也不是創角規則。 */
export function createGameState(seed: unknown): GameState {
  if (!hasExactKeys(seed, ["revision", "activity", "character", "inventory", "exploration", "combat"])
    || !hasExactKeys(seed.character, ["id", "learnedActiveSkillIds", "equippedSkillIds"])
    || !hasExactKeys(seed.exploration, ["locationId", "lastObservationTargetId"])) {
    throw new Error("初始 domain 狀態不符合契約。");
  }
  const character = seed.character;
  const exploration = seed.exploration;
  let combat: CombatState | null;
  try {
    combat = seed.combat === null ? null : createCombatState(seed.combat);
  } catch {
    throw new Error("初始 domain 狀態不符合契約。");
  }
  if (!isRevision(seed.revision)
    || (seed.activity !== "outside-combat" && seed.activity !== "in-combat")
    || (seed.activity === "outside-combat" ? combat !== null : combat === null)
    || !isId(character.id)
    || !isIds(character.learnedActiveSkillIds)
    || !isIds(character.equippedSkillIds)
    || !isInventory(seed.inventory)
    || new Set(character.learnedActiveSkillIds).size !== character.learnedActiveSkillIds.length
    || loadoutError(character.learnedActiveSkillIds, character.equippedSkillIds)
    || (exploration.locationId !== "TEST-forest-edge" && exploration.locationId !== "TEST-ruin-entrance")
    || (exploration.lastObservationTargetId !== null
      && exploration.lastObservationTargetId !== "TEST-stone-door")) {
    throw new Error("初始 domain 狀態不符合契約。");
  }
  const lastAction = combat?.lastAction;
  if (lastAction?.type === "item-use"
    && seed.inventory.find((stack) => stack.itemId === lastAction.itemId)?.quantity !== lastAction.quantityAfter) {
    throw new Error("CombatState 最近物品行動與權威 inventory 數量不一致。");
  }
  return Object.freeze({
    revision: seed.revision,
    activity: seed.activity,
    character: Object.freeze({
      id: character.id,
      learnedActiveSkillIds: Object.freeze([...character.learnedActiveSkillIds]),
      equippedSkillIds: Object.freeze([...character.equippedSkillIds]),
    }),
    inventory: normalizeInventory(seed.inventory),
    exploration: Object.freeze({
      locationId: exploration.locationId,
      lastObservationTargetId: exploration.lastObservationTargetId,
    }),
    combat,
  });
}

export type CandidateRejectionCode = "invalid-candidate" | "clarification-required"
  | "unsupported-action" | "target-not-found" | "stale-revision";

export type CandidateValidationResult =
  | { readonly ok: true; readonly command: ApproachTargetCommand | InspectTargetCommand }
  | { readonly ok: false; readonly code: CandidateRejectionCode; readonly message: string };

const candidateMessages: Record<CandidateRejectionCode, string> = {
  "invalid-candidate": "候選行動格式不正確。",
  "clarification-required": "候選行動仍需玩家澄清。",
  "unsupported-action": "目前的權威探索規則尚未支援這項行動。",
  "target-not-found": "目前位置找不到可唯一對應的目標。",
  "stale-revision": "狀態已更新，請依最新狀態重新送出行動。",
};

function rejectCandidate(code: CandidateRejectionCode): CandidateValidationResult {
  return { ok: false, code, message: candidateMessages[code] };
}

function validCandidateText(value: unknown, nullable = false): boolean {
  return (nullable && value === null) || (typeof value === "string" && value.trim() === value
    && value.length > 0 && Array.from(value).length <= 500);
}

/** 把不可信 candidate 解析成有限的 domain command；自由文字永遠不直接成為 state ID。 */
export function validateCandidateAction(
  state: GameState,
  candidate: unknown,
  expectedRevision: unknown,
): CandidateValidationResult {
  if (!isRevision(expectedRevision) || !hasExactKeys(candidate,
    ["status", "kind", "target", "manner", "clarificationQuestion", "originalText"])
    || (candidate.status !== "candidate" && candidate.status !== "clarification-needed"
      && candidate.status !== "unsupported")
    || (candidate.kind !== "move" && candidate.kind !== "inspect" && candidate.kind !== "interact"
      && candidate.kind !== "speak" && candidate.kind !== "other")
    || !validCandidateText(candidate.target, true) || !validCandidateText(candidate.manner, true)
    || !validCandidateText(candidate.clarificationQuestion, true)
    || !validCandidateText(candidate.originalText)) return rejectCandidate("invalid-candidate");
  if (expectedRevision !== state.revision) return rejectCandidate("stale-revision");
  if (candidate.status === "clarification-needed") return candidate.clarificationQuestion === null
    ? rejectCandidate("invalid-candidate") : rejectCandidate("clarification-required");
  if (candidate.status === "unsupported") return candidate.kind === "other"
    && candidate.clarificationQuestion === null
    ? rejectCandidate("unsupported-action") : rejectCandidate("invalid-candidate");
  if (candidate.clarificationQuestion !== null) return rejectCandidate("invalid-candidate");
  if (candidate.kind === "move") {
    if (state.exploration.locationId === "TEST-forest-edge" && candidate.target === "森林裡的廢墟") {
      return { ok: true, command: { type: "approach-target", expectedRevision, targetId: "TEST-ruin-entrance" } };
    }
    return rejectCandidate("target-not-found");
  }
  if (candidate.kind === "inspect") {
    if (state.exploration.locationId === "TEST-ruin-entrance" && candidate.target === "門上的符號") {
      return { ok: true, command: { type: "inspect-target", expectedRevision, targetId: "TEST-stone-door" } };
    }
    return rejectCandidate("target-not-found");
  }
  return rejectCandidate("unsupported-action");
}

/** 純狀態轉換：無 I/O、不修改輸入。所有呼叫端都必須經過相同驗證。 */
export function applyCommand(state: GameState, input: unknown): CommandResult {
  const command = parseCommand(input);
  if (!command) return reject("invalid-command");
  if (command.expectedRevision !== state.revision) return reject("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");
  if (state.activity === "in-combat") return reject("in-combat");
  if (command.type === "approach-target") {
    if (state.exploration.locationId !== "TEST-forest-edge") return reject("target-not-found");
    const next = createGameState({
      ...state, revision: state.revision + 1,
      exploration: { locationId: command.targetId, lastObservationTargetId: null },
    });
    return { ok: true, state: next, effect: { type: "location-changed", locationId: command.targetId } };
  }
  if (command.type === "inspect-target") {
    if (state.exploration.locationId !== "TEST-ruin-entrance") return reject("target-not-found");
    const next = createGameState({
      ...state, revision: state.revision + 1,
      exploration: { ...state.exploration, lastObservationTargetId: command.targetId },
    });
    return { ok: true, state: next, effect: { type: "target-inspected", targetId: command.targetId } };
  }
  const error = loadoutError(state.character.learnedActiveSkillIds, command.skillIds);
  if (error) return reject(error);
  const skillIds = [...command.skillIds];
  return {
    ok: true,
    state: createGameState({
      ...state,
      revision: state.revision + 1,
      character: { ...state.character, equippedSkillIds: skillIds },
    }),
    effect: { type: "equipped-skills-updated", skillIds },
  };
}
