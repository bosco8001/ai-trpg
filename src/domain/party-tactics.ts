/** Phase 21/22 工程 fixture；catalog 不定義最終 canonical 戰術選項或行為。 */
export const TEST_PARTY_COMPANION_ID = "TEST-companion-1";

export interface PartyMemberState {
  readonly id: string;
  readonly displayName: string;
  /** Opaque preference identifier; Phase 22 engineering policy interprets only known TEST IDs. */
  readonly tacticPreferenceId: string | null;
}

export interface TacticPreferenceDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly engineeringOnly: boolean;
}

/** These are engineering fixtures only. They do not define final canonical tactic presets or behavior. */
/** 這些 TEST catalog 項目只定義顯示資料；Phase 22 行為只存在於可替換的工程 policy。 */
export const ENGINEERING_TEST_TACTIC_PREFERENCES: readonly TacticPreferenceDefinition[] = Object.freeze([
  Object.freeze({
    id: "TEST-tactic-a",
    displayName: "TEST：戰術偏好 A",
    description: "工程測試選項；只保存偏好識別碼，不定義隊友行為。",
    engineeringOnly: true,
  }),
  Object.freeze({
    id: "TEST-tactic-b",
    displayName: "TEST：戰術偏好 B",
    description: "工程測試選項；只保存偏好識別碼，不定義隊友行為。",
    engineeringOnly: true,
  }),
]);

/** 只供 TEST-character 建立及升級舊 snapshot 使用；正式角色不會取得此隊友或預設偏好。 */
export function createLegacyPartyMembers(characterId: string): readonly PartyMemberState[] {
  if (characterId !== "TEST-character") return Object.freeze([]);
  return Object.freeze([Object.freeze({
    id: TEST_PARTY_COMPANION_ID,
    displayName: "TEST 隊友",
    tacticPreferenceId: "TEST-tactic-a",
  })]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

export function isPartyMemberState(value: unknown): value is PartyMemberState {
  return isRecord(value) && Object.keys(value).length === 3
    && Object.hasOwn(value, "id") && Object.hasOwn(value, "displayName")
    && Object.hasOwn(value, "tacticPreferenceId")
    && isId(value.id) && isId(value.displayName)
    && (value.tacticPreferenceId === null || isId(value.tacticPreferenceId));
}

/** Unknown saved preference IDs remain opaque so catalog changes do not corrupt runtime state. */
export function isPartyMemberStates(value: unknown): value is readonly PartyMemberState[] {
  return Array.isArray(value) && value.every(isPartyMemberState)
    && new Set(value.map((member) => member.id)).size === value.length;
}

export function isKnownTacticPreference(id: string): boolean {
  return ENGINEERING_TEST_TACTIC_PREFERENCES.some((entry) => entry.id === id);
}
