/** 最小權威狀態切片；尚未表示完整角色、探索或戰鬥狀態。 */
export interface GameState {
  readonly revision: number;
  readonly activity: "outside-combat" | "in-combat";
  readonly character: {
    readonly id: string;
    /** 只包含佔六格的已學主動技能；不包含種族能力與武器熟練。 */
    readonly learnedActiveSkillIds: readonly string[];
    readonly equippedSkillIds: readonly string[];
  };
}

export interface SetEquippedSkillsCommand {
  readonly type: "set-equipped-skills";
  readonly expectedRevision: number;
  readonly skillIds: readonly string[];
}

export type RejectionCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "in-combat" | "too-many-skills" | "duplicate-skill" | "skill-not-learned";

export type CommandResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };

const rejectionMessages: Record<RejectionCode, string> = {
  "invalid-command": "命令格式不符；只接受技能配置命令，不接受直接修改權威狀態。",
  "stale-revision": "狀態已更新，請重新讀取後再送出命令。",
  "revision-limit": "狀態版本已達工程上限，無法接受新命令。",
  "in-combat": "戰鬥中不能更換裝備技能。",
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

/** 不做型別轉換，也不移除多餘欄位後偷偷接受請求。 */
export function parseCommand(value: unknown): SetEquippedSkillsCommand | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 3
    || value.type !== "set-equipped-skills" || !isRevision(value.expectedRevision)
    || !isIds(value.skillIds)) return undefined;
  return {
    type: "set-equipped-skills",
    expectedRevision: value.expectedRevision,
    skillIds: [...value.skillIds],
  };
}

function loadoutError(learned: readonly string[], equipped: readonly string[]): RejectionCode | undefined {
  if (equipped.length > 6) return "too-many-skills";
  if (new Set(equipped).size !== equipped.length) return "duplicate-skill";
  if (equipped.some((id) => !learned.includes(id))) return "skill-not-learned";
  return undefined;
}

/** 伺服器建立初始狀態的入口；不是玩家命令，也不是創角規則。 */
export function createGameState(seed: unknown): GameState {
  if (!hasExactKeys(seed, ["revision", "activity", "character"])
    || !hasExactKeys(seed.character, ["id", "learnedActiveSkillIds", "equippedSkillIds"])) {
    throw new Error("初始 domain 狀態不符合技能配置契約。");
  }
  const character = seed.character;
  if (!isRevision(seed.revision)
    || (seed.activity !== "outside-combat" && seed.activity !== "in-combat")
    || !isId(character.id)
    || !isIds(character.learnedActiveSkillIds)
    || !isIds(character.equippedSkillIds)
    || new Set(character.learnedActiveSkillIds).size !== character.learnedActiveSkillIds.length
    || loadoutError(character.learnedActiveSkillIds, character.equippedSkillIds)) {
    throw new Error("初始 domain 狀態不符合技能配置契約。");
  }
  return Object.freeze({
    revision: seed.revision,
    activity: seed.activity,
    character: Object.freeze({
      id: character.id,
      learnedActiveSkillIds: Object.freeze([...character.learnedActiveSkillIds]),
      equippedSkillIds: Object.freeze([...character.equippedSkillIds]),
    }),
  });
}

/** 純狀態轉換：無 I/O、不修改輸入。所有呼叫端都必須經過相同驗證。 */
export function applyCommand(state: GameState, input: unknown): CommandResult {
  const command = parseCommand(input);
  if (!command) return reject("invalid-command");
  if (command.expectedRevision !== state.revision) return reject("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");
  if (state.activity === "in-combat") return reject("in-combat");
  const error = loadoutError(state.character.learnedActiveSkillIds, command.skillIds);
  if (error) return reject(error);
  return {
    ok: true,
    state: createGameState({
      ...state,
      revision: state.revision + 1,
      character: { ...state.character, equippedSkillIds: command.skillIds },
    }),
  };
}
