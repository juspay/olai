import { isReady, type CommitMode, type Pending } from "./committing.ts"

export const QUIET_MS = 15_000

export const flurryOf = (pending: Pending): string =>
  pending.changes.length === 0 && pending.outlines.length === 0 &&
    pending.others.length === 0 && pending.unreadable.length === 0
    ? ""
    : JSON.stringify([
      pending.changes,
      pending.outlines,
      pending.others,
      pending.unreadable,
    ])

/**
 * THE CHEAP TERMS COME FIRST, and that is not tidiness: {@link flurryOf}
 * serializes every waiting change, this runs on every published revision, and
 * on the default `manual` server no amount of it could ever arm anything.
 */
export const armedOn = (
  commit: CommitMode,
  paused: string | null,
  held: boolean,
  pending: Pending,
): string =>
  commit !== "auto" || paused !== null || held || !isReady(pending.repo)
    ? ""
    : flurryOf(pending)
