/**
 * The one failure the store can have that the codec cannot DESCRIBE — though
 * it is now one the codec is asked to TRANSLATE.
 *
 * Everything a codec rejects is a value it hands back — a `Result` failure the
 * store publishes. This is the other kind: the set was never seen at all,
 * because the directory could not be listed or a file could not be read. There
 * is no `file:line` to name and nothing to report but the reason.
 *
 * It is what the binary exits on at boot. What it is NOT any more is invisible
 * afterwards: a probe that fails mid-serve hands this to `Codec.unreadable`,
 * which renders it into the caller's own error vocabulary, and it travels the
 * same channel a validation failure does. Log-only was a page frozen at the
 * last good revision with nothing on screen saying so — the exact failure mode
 * a live store exists to prevent.
 */

import { Data } from "effect"

/** The served directory itself, in the same root-relative spelling every other
 *  path in this package uses. A failure about the ROOT used to carry the
 *  absolute path instead, which was two vocabularies on one field — and, once
 *  this became something a browser renders, the server's filesystem layout on
 *  somebody's screen. */
export const ROOT_ITSELF = "."

export class PlatformFailure extends Data.TaggedError("PlatformFailure")<{
  /** Root-relative and `/`-spelled, like every path this package publishes —
   *  {@link ROOT_ITSELF} when it is the directory itself. */
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `cannot read ${
      this.path === ROOT_ITSELF ? "the served directory" : this.path
    }: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`
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
