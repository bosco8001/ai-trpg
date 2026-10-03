import type { RepairApplyRequest, RepairApplication } from "../shared/repair-application.js";
import type { RepairRawRecord } from "./repair-preview-reader.js";
export interface RepairApplicationBackend {
  bind(backup: string, source: RepairRawRecord, signal: AbortSignal): Promise<void>;
  lookup(id: string, signal: AbortSignal): Promise<RepairApplication>;
  apply(request: RepairApplyRequest, signal: AbortSignal): Promise<RepairApplication>;
  download(id: string, signal: AbortSignal): Promise<string>;
}
