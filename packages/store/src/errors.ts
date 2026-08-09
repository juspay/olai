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
