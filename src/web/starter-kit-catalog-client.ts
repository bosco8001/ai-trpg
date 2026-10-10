import { isOfficialStarterKitCatalog, type OfficialStarterKitCatalog } from "../shared/starter-kit-catalog.js";
import { receive } from "./repair-preparation.js";

export async function readStarterKitCatalog(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<OfficialStarterKitCatalog> {
  signal.throwIfAborted();
  const response = await fetcher("/api/starter-kit-catalog", { signal, cache: "no-store" });
  if (!response.ok) { await response.body?.cancel(); throw new Error("目前無法讀取正式起始配套名冊。"); }
  const value: unknown = JSON.parse(await receive(response, signal, 64 * 1024));
  if (!isOfficialStarterKitCatalog(value)) throw new Error("目前無法讀取正式起始配套名冊。");
  signal.throwIfAborted();
  return value;
}
