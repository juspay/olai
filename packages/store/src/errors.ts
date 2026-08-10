/**
 * The one failure the store can have that the codec cannot describe.
 *
 * Everything a codec rejects is a value it hands back — a `Result` failure the
 * store publishes. This is the other kind: the set was never seen at all,
 * because the directory could not be listed or a file could not be read. There
 * is no `file:line` to name and nothing to report but the reason, so it is not
 * an `E` and never reaches a browser. It is what the binary exits on at boot,
 * and what a later probe logs and retries past.
 */

import { Data } from "effect"

export class PlatformFailure extends Data.TaggedError("PlatformFailure")<{
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `cannot read ${this.path}: ${
      this.cause instanceof Error ? this.cause.message : String(this.cause)
    }`
  }
}

/**
 * The store moved on between the read a write was derived from and the write
 * itself. The optimistic-concurrency half of the write gate.
 *
 * It is not a fault and it is not the caller's mistake: a `git pull`, another
 * tab or another agent got there first. The contract is that the caller
 * re-derives its edit from `currentRev`'s snapshot and asks again — which for
 * a SEMANTIC op ("mark node X done") lands cleanly, because the thing it names
 * is still there. Only two edits that genuinely collide survive a retry, and
 * then it is the op's own validation error that speaks, not this.
 *
 * The current revision rides along so a caller does not have to re-read the
 * snapshot to find out what it is racing.
 */
export class StaleWrite extends Data.TaggedError("StaleWrite")<{
  readonly baseRev: number
  readonly currentRev: number
}> {
  override get message(): string {
    return `the store is at revision ${this.currentRev}, not ${this.baseRev}: re-derive the write and try again`
  }
}
