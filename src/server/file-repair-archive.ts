import { constants } from "node:fs";
import { mkdir, open, readdir, lstat, rm, link, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { parseRepairBackup, repairIdValid, REPAIR_BACKUP_MAX_BYTES, REPAIR_ARCHIVE_MAX_BYTES, REPAIR_PAGE_SIZE, type RepairPreparationSummary } from "../shared/repair-preparation.js";
import { PreparationFailure, backupSummary, reuseBackup, sha256, verifiedBackup, type RepairArchive } from "./repair-archive.js";

const absent = (e: unknown) => (e as NodeJS.ErrnoException)?.code === "ENOENT";
async function syncDirectory(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function pause(signal: AbortSignal) {
  signal.throwIfAborted();
  await new Promise<void>((resolvePause, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new PreparationFailure("unavailable")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolvePause(); }, 50);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** One immutable envelope per repair; reads never create a directory or initialize game state. */
export class FileRepairArchive implements RepairArchive {
  readonly directory: string;
  constructor(directory: string, readonly maxBytes = REPAIR_BACKUP_MAX_BYTES, readonly capacityBytes = REPAIR_ARCHIVE_MAX_BYTES) {
    this.directory = resolve(directory);
  }
  private async directoryExists(): Promise<boolean> {
    try {
      const stat = await lstat(this.directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new PreparationFailure("unavailable");
      return true;
    } catch (error) { if (absent(error)) return false; throw error; }
  }
  private async readFile(id: string, signal: AbortSignal): Promise<string | null> {
    signal.throwIfAborted();
    if (!repairIdValid(id)) throw new PreparationFailure("invalid-request");
    let handle;
    try { handle = await open(join(this.directory, `${id}.json`), constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (absent(error)) return null; throw error; }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > this.maxBytes || stat.size > REPAIR_BACKUP_MAX_BYTES) throw new PreparationFailure("unavailable");
      // Read at most limit + 1 even if an external writer grows a corrupt file after stat().
      const bytes = Buffer.alloc(Math.min(stat.size + 1, this.maxBytes + 1));
      let size = 0;
      while (size < bytes.length) {
        signal.throwIfAborted();
        const part = await handle.read(bytes, size, bytes.length - size, size);
        if (!part.bytesRead) break;
        size += part.bytesRead;
      }
      if (size !== stat.size) throw new PreparationFailure("unavailable");
      signal.throwIfAborted();
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size));
    } finally { await handle.close(); }
  }
  async get(id: string, characterId: string, signal: AbortSignal): Promise<string | null> {
    if (!await this.directoryExists()) return null;
    const text = await this.readFile(id, signal);
    if (text === null) return null;
    let parsed: ReturnType<typeof parseRepairBackup>;
    try { parsed = parseRepairBackup(text); }
    catch { throw new PreparationFailure("unavailable"); }
    if (sha256(parsed.envelope.payload) !== parsed.envelope.checksum.value || parsed.data.storage !== "memory") throw new PreparationFailure("unavailable");
    if (parsed.data.characterId !== characterId) return null;
    verifiedBackup(text, characterId, id);
    // A previous response may have been lost during directory sync. Confirm durability now.
    await syncDirectory(this.directory);
    signal.throwIfAborted();
    return text;
  }
  async list(characterId: string, cursor: string | null, signal: AbortSignal) {
    if (!await this.directoryExists()) return { records: [], nextCursor: null };
    const names = (await readdir(this.directory)).filter(name => name.endsWith(".json") && repairIdValid(name.slice(0, -5)))
      .map(name => name.slice(0, -5)).sort().reverse().filter(id => cursor === null || id < cursor);
    const records: RepairPreparationSummary[] = [];
    let last: string | null = null;
    for (const id of names) {
      signal.throwIfAborted();
      const text = await this.get(id, characterId, signal);
      if (text === null) continue;
      if (records.length === REPAIR_PAGE_SIZE) return { records, nextCursor: last };
      records.push(backupSummary(text, characterId, "")); last = id;
    }
    return { records, nextCursor: null };
  }
  private async lock(signal: AbortSignal): Promise<() => Promise<void>> {
    const lockPath = join(this.directory, ".write-lock");
    const deadline = Date.now() + 25_000;
    while (true) {
      signal.throwIfAborted();
      try { await mkdir(lockPath, { mode: 0o700 }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
        if (Date.now() >= deadline) throw new PreparationFailure("unavailable");
        // Never steal a live process lock or a lock whose owner cannot be established.
        const stat = await lstat(lockPath).catch(error => {
          if (absent(error)) return null;
          throw error;
        });
        // The holder may have released its lock after mkdir reported EEXIST.
        if (stat === null) { await pause(signal); continue; }
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PreparationFailure("unavailable");
        const owner = await open(join(lockPath, "owner"), constants.O_RDONLY | constants.O_NOFOLLOW).catch(error => {
          if (absent(error)) return null;
          throw error;
        });
        if (owner) {
          try {
            if ((await owner.stat()).size > 1024) throw new PreparationFailure("unavailable");
            const originalOwner = await owner.readFile("utf8");
            let info: unknown = null;
            try { info = JSON.parse(originalOwner); }
            catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
              // The owner may still be being written. Unknown ownership only waits;
              // the existing deadline/abort governs refusal, never lock recovery.
            }
            if (info !== null && typeof info === "object" && "pid" in info && "host" in info
              && info.host === hostname() && typeof info.pid === "number" && Number.isInteger(info.pid) && info.pid > 0) {
              try { process.kill(info.pid, 0); }
              catch (check) {
                if ((check as NodeJS.ErrnoException).code === "ESRCH") {
                  // Claim recovery with an exclusive marker: only one waiter may remove a dead owner's lock.
                  let claim;
                  try { claim = await open(join(lockPath, "recovery"), "wx", 0o600); }
                  catch { await pause(signal); continue; }
                  await claim.close();
                  const currentOwner = await open(join(lockPath, "owner"), constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
                  if (currentOwner) {
                    let unchanged = false;
                    try { unchanged = (await currentOwner.stat()).size <= 1024 && await currentOwner.readFile("utf8") === originalOwner; }
                    finally { await currentOwner.close(); }
                    if (unchanged) { await rm(lockPath, { recursive: true }); await syncDirectory(this.directory); continue; }
                  }
                  // Another recovery already published a new live lock; never remove it.
                  await pause(signal); continue;
                }
              }
            }
          } finally { await owner.close(); }
        }
        await pause(signal); continue;
      }
      try {
        const owner = await open(join(lockPath, "owner"), "wx", 0o600);
        try { await owner.writeFile(JSON.stringify({ pid: process.pid, host: hostname(), token: randomUUID() })); await owner.sync(); }
        finally { await owner.close(); }
        await syncDirectory(lockPath); await syncDirectory(this.directory);
        return async () => { await rm(lockPath, { recursive: true }); await syncDirectory(this.directory); };
      } catch (error) { await rm(lockPath, { recursive: true }).catch(() => {}); throw error; }
    }
  }
  async put(text: string, characterId: string, signal: AbortSignal): Promise<string> {
    const data = verifiedBackup(text, characterId).data;
    if (data.storage !== "memory") throw new PreparationFailure("conflict");
    if (Buffer.byteLength(text) > this.maxBytes) throw new PreparationFailure("too-large");
    signal.throwIfAborted();
    const firstCreated = await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (!await this.directoryExists()) throw new PreparationFailure("unavailable");
    if (firstCreated) {
      let path = this.directory;
      while (true) { await syncDirectory(path); if (path === dirname(firstCreated)) break; path = dirname(path); }
    }
    const unlock = await this.lock(signal);
    let temporary: string | null = null;
    try {
      const old = await this.get(data.repairId, characterId, signal);
      if (old !== null) return reuseBackup(old, text, characterId);
      if (await this.readFile(data.repairId, signal) !== null) throw new PreparationFailure("conflict");
      let used = 0n;
      for (const name of await readdir(this.directory)) {
        if (name === ".write-lock") continue;
        const stat = await lstat(join(this.directory, name));
        if (!stat.isFile() || stat.isSymbolicLink()) throw new PreparationFailure("unavailable");
        used += BigInt(stat.size);
      }
      // Reserve bounded lock metadata as well as the entire new envelope; no automatic cleanup.
      if (used + BigInt(Buffer.byteLength(text)) + 4096n > BigInt(this.capacityBytes)) throw new PreparationFailure("capacity");
      signal.throwIfAborted();
      temporary = join(this.directory, `${data.repairId}-${randomUUID()}.tmp`);
      const file = await open(temporary, "wx", 0o600);
      try { await file.writeFile(text, "utf8"); await file.sync(); } finally { await file.close(); }
      signal.throwIfAborted();
      // Hard-link publishes the complete inode atomically and refuses to overwrite an existing ID.
      await link(temporary, join(this.directory, `${data.repairId}.json`));
      await syncDirectory(this.directory);
      await unlink(temporary); temporary = null; await syncDirectory(this.directory);
      const saved = await this.get(data.repairId, characterId, signal);
      if (saved !== text) throw new PreparationFailure("unavailable");
      return saved;
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
      await unlock();
    }
  }
}
