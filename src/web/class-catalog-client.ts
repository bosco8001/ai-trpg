import { isOfficialClassCatalog, type OfficialClassCatalog } from "../shared/class-catalog.js";
import { receive } from "./repair-preparation.js";

export async function readClassCatalog(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<OfficialClassCatalog> {
  signal.throwIfAborted();
  const response = await fetcher("/api/class-catalog", { signal, cache: "no-store" });
  if (!response.ok) { await response.body?.cancel(); throw new Error("目前無法讀取正式職業名冊。"); }
  const value: unknown = JSON.parse(await receive(response, signal, 32 * 1024));
  if (!isOfficialClassCatalog(value)) throw new Error("目前無法讀取正式職業名冊。");
  signal.throwIfAborted();
  return value;
}
