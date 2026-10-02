import type { Pool, PoolClient } from "pg";

/** Handle borrowed-client errors separately from pg-pool's idle-client listener. */
export async function withPgClient<T>(pool: Pick<Pool, "connect">, signal: AbortSignal,
  unavailable: () => Error, work: (client: PoolClient) => Promise<T>): Promise<T> {
  if (signal.aborted) throw unavailable();
  let client: PoolClient;
  try { client = await pool.connect(); }
  catch { throw unavailable(); }
  let released = false, failure: Error | null = null;
  const release = (destroy: boolean) => {
    if (!released) { released = true; client.release(destroy); }
  };
  let rejectStopped!: (error: Error) => void;
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  const stop = () => {
    failure ??= unavailable();
    rejectStopped(failure);
    release(true);
  };
  client.on("error", stop);
  signal.addEventListener("abort", stop, { once: true });
  try {
    // Both outcomes are observed even when an in-flight query rejects after the error event.
    const operation = Promise.resolve().then(async () => {
      if (signal.aborted || failure) throw failure ?? unavailable();
      const value = await work(client);
      if (signal.aborted || failure) throw failure ?? unavailable();
      return value;
    });
    return await Promise.race([operation, stopped]);
  } catch (error) {
    release(true);
    throw failure ?? error;
  } finally {
    signal.removeEventListener("abort", stop);
    // release() installs the pool's idle error listener synchronously. Keep ours until then.
    try { release(false); }
    finally { client.removeListener("error", stop); }
  }
}
