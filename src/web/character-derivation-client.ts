import { isOfficialContentCatalog, type OfficialContentCatalog } from "../shared/content-catalog.js";
import { readClassCatalog } from "./class-catalog-client.js";
import { receive } from "./repair-preparation.js";
import { DERIVATION_MESSAGES, isDerivationResult, derivationObject, derivationKeys,
  sameDerivationSample, sameSampleResources, type DerivationRequest, type DerivationResult } from "../shared/character-derivation.js";

const unavailable = "目前無法完成樣本核對，請重試；原樣本仍保留。";
async function readRaces(signal: AbortSignal, fetcher: typeof fetch): Promise<OfficialContentCatalog> {
  signal.throwIfAborted();
  const response = await fetcher("/api/content-catalog", { signal, cache: "no-store" });
  if (!response.ok) { await response.body?.cancel(); throw new Error(unavailable); }
  const value: unknown = JSON.parse(await receive(response, signal, 32 * 1024));
  if (!isOfficialContentCatalog(value)) throw new Error(unavailable);
  signal.throwIfAborted(); return value;
}
export async function readDerivationCatalogs(signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const [races, classes] = await Promise.all([readRaces(signal, fetcher), readClassCatalog(signal, fetcher)]);
  signal.throwIfAborted(); return { races, classes };
}
export async function readDerivationPreview(request: DerivationRequest, signal: AbortSignal,
  fetcher: typeof fetch = fetch): Promise<DerivationResult> {
  signal.throwIfAborted();
  const response = await fetcher("/api/character-derivation/preview", {
    method: "POST", signal, cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
  });
  const value: unknown = JSON.parse(await receive(response, signal, 32 * 1024));
  signal.throwIfAborted();
  if (!response.ok) {
    if (derivationObject(value) && derivationKeys(value, ["code", "message"])
      && typeof value.code === "string" && Object.hasOwn(DERIVATION_MESSAGES, value.code))
      throw new Error(DERIVATION_MESSAGES[value.code as keyof typeof DERIVATION_MESSAGES]);
    throw new Error(unavailable);
  }
  if (!isDerivationResult(value) || !sameDerivationSample(value.sample, request.sample)
    || value.schemaVersion !== request.schemaVersion || value.raceCatalogVersion !== request.raceCatalogVersion
    || value.classCatalogVersion !== request.classCatalogVersion
    || !sameSampleResources(value.before, request.resources)) throw new Error(unavailable);
  return value;
}
