import { createGameState, type GameState } from "./game.js";
import {
  ENGINEERING_TEST_TACTIC_PREFERENCES,
  isKnownTacticPreference,
  type PartyMemberState,
  type TacticPreferenceDefinition,
} from "./party-tactics.js";
import type { CombatRow } from "./combat-state.js";

export interface PartyCompanionView {
  readonly id: string;
  readonly displayName: string;
  readonly level: number | null;
  readonly row: CombatRow | null;
  readonly hp: { readonly current: number; readonly maximum: number } | null;
  readonly mp: { readonly current: number; readonly maximum: number } | null;
  readonly tacticPreferenceId: string | null;
}

export interface CombatPartyOptions {
  readonly revision: number;
  readonly context: "outside-combat" | "active-combat" | "ended-combat";
  readonly canChangeTacticPreference: boolean;
  readonly companions: readonly PartyCompanionView[];
  readonly tacticPreferences: readonly TacticPreferenceDefinition[];
}

export function getCombatPartyOptions(state: GameState): CombatPartyOptions {
  const context = state.activity !== "in-combat" ? "outside-combat"
    : state.combat?.status === "ended" ? "ended-combat" : "active-combat";
  return Object.freeze({
    revision: state.revision,
    context,
    canChangeTacticPreference: context === "active-combat",
    companions: Object.freeze(state.partyMembers.map((member) => Object.freeze({
      id: member.id,
      displayName: member.displayName,
      // Phase 21 does not have authoritative companion level, row, HP or MP fields.
      level: null,
      row: null,
      hp: null,
      mp: null,
      tacticPreferenceId: member.tacticPreferenceId,
    }))),
    tacticPreferences: ENGINEERING_TEST_TACTIC_PREFERENCES,
  });
}

export interface SetTacticPreferenceCommand {
  readonly expectedRevision: number;
  readonly companionId: string;
  readonly tacticPreferenceId: string;
}

export type TacticPreferenceEffect =
  | { readonly type: "tactic-preference-updated"; readonly companionId: string; readonly tacticPreferenceId: string }
  | { readonly type: "tactic-preference-unchanged"; readonly companionId: string; readonly tacticPreferenceId: string };

export type SetTacticPreferenceCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "not-in-combat" | "combat-ended" | "companion-not-found" | "tactic-preference-not-found";

export type SetTacticPreferenceResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: TacticPreferenceEffect }
  | { readonly ok: false; readonly code: SetTacticPreferenceCode; readonly message: string };

const tacticPreferenceMessages: Record<SetTacticPreferenceCode, string> = {
  "invalid-command": "隊友戰術偏好請求格式不正確。",
  "stale-revision": "遊戲狀態已更新，請重新讀取隊伍資料後再試。",
  "revision-limit": "狀態版本已達工程上限，無法更新隊友偏好。",
  "not-in-combat": "目前沒有進行中的戰鬥，暫時無法修改隊友偏好。",
  "combat-ended": "戰鬥已結束；目前只能查看隊伍資料。",
  "companion-not-found": "找不到這名隊友，隊伍資料沒有變更。",
  "tactic-preference-not-found": "找不到這個戰術偏好選項，隊伍資料沒有變更。",
};

function reject(code: SetTacticPreferenceCode): SetTacticPreferenceResult {
  return { ok: false, code, message: tacticPreferenceMessages[code] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function parseSetTacticPreference(value: unknown): SetTacticPreferenceCommand | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 3
    || !Object.hasOwn(value, "expectedRevision") || !Object.hasOwn(value, "companionId")
    || !Object.hasOwn(value, "tacticPreferenceId")
    || typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0 || !isId(value.companionId) || !isId(value.tacticPreferenceId)) return undefined;
  return {
    expectedRevision: value.expectedRevision,
    companionId: value.companionId,
    tacticPreferenceId: value.tacticPreferenceId,
  };
}

/** Preference-only mutation. It intentionally never reads or advances the current combat actor. */
export function setCompanionTacticPreference(state: GameState, input: unknown): SetTacticPreferenceResult {
  const command = parseSetTacticPreference(input);
  if (!command) return reject("invalid-command");
  if (command.expectedRevision !== state.revision) return reject("stale-revision");
  if (state.activity !== "in-combat" || state.combat === null) return reject("not-in-combat");
  if (state.combat.status !== "active") return reject("combat-ended");

  const companion = state.partyMembers.find((member) => member.id === command.companionId);
  if (!companion) return reject("companion-not-found");
  if (!isKnownTacticPreference(command.tacticPreferenceId)) return reject("tactic-preference-not-found");
  if (companion.tacticPreferenceId === command.tacticPreferenceId) {
    return { ok: true, state, effect: {
      type: "tactic-preference-unchanged", companionId: companion.id,
      tacticPreferenceId: command.tacticPreferenceId,
    } };
  }
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");

  const partyMembers: readonly PartyMemberState[] = state.partyMembers.map((member) => member.id === companion.id
    ? { ...member, tacticPreferenceId: command.tacticPreferenceId } : member);
  const next = createGameState({ ...state, revision: state.revision + 1, partyMembers });
  return { ok: true, state: next, effect: {
    type: "tactic-preference-updated", companionId: companion.id,
    tacticPreferenceId: command.tacticPreferenceId,
  } };
}
