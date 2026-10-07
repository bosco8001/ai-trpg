import { isCreationRequest, type CreationRequest } from "../shared/character-creation.js";
import type { OfficialContentCatalog } from "../shared/content-catalog.js";
import type { OfficialClassCatalog } from "../shared/class-catalog.js";
import { validPoints } from "../shared/character-derivation.js";

export interface CreationDraft { raceId: string; classId: string; allocation: number[]; raceAllocation: number[] }
export const emptyCreationDraft = (): CreationDraft => ({ raceId: "race.human", classId: "class.swordsman",
  allocation: [0, 0, 0, 0, 0, 0], raceAllocation: [0, 0, 0, 0, 0, 0] });
export function creationDraftError(draft: CreationDraft, races: OfficialContentCatalog, classes: OfficialClassCatalog) {
  const race = races.races.find(r => r.id === draft.raceId);
  if (!race || !classes.classes.some(c => c.id === draft.classId)) return "請選擇正式種族與初階職業。";
  if (!validPoints(draft.allocation, 6, 12)) return "請分配完整 12 點，每項最多 6 點。";
  if (!validPoints(draft.raceAllocation, 2, race.freeAttributePoints))
    return race.freeAttributePoints ? "請分配完整 2 點人類種族加成。" : "此種族沒有自由種族點。";
  return "";
}
export function requestFromDraft(draft: CreationDraft, requestId: string): CreationRequest {
  const value = { schemaVersion: 1, raceCatalogVersion: 2, classCatalogVersion: 1, requestId, ...structuredClone(draft) };
  if (!isCreationRequest(value)) throw new Error("角色草稿不完整。");
  return value;
}
const pendingKey = "ai-trpg:character-creation:pending:v1";
/** Only the request identity and user inputs; no secret generated result or browser-only character. */
export function readPendingCreation(storage: Pick<Storage, "getItem">): CreationRequest | null {
  const text = storage.getItem(pendingKey);
  if (text === null) return null;
  if (text.length > 4096) throw new Error("無法讀取原建立識別。");
  const value: unknown = JSON.parse(text);
  if (!isCreationRequest(value)) throw new Error("無法讀取原建立識別。");
  return value;
}
export function retainPendingCreation(storage: Pick<Storage, "setItem" | "getItem">, request: CreationRequest) {
  if (!isCreationRequest(request)) throw new Error("建立識別格式不正確。");
  const text = JSON.stringify(request);
  storage.setItem(pendingKey, text);
  if (storage.getItem(pendingKey) !== text) throw new Error("瀏覽器無法保留建立識別。");
}
export function clearPendingCreation(storage: Pick<Storage, "removeItem">) { storage.removeItem(pendingKey); }
