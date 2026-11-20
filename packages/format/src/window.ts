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

export const armedOn = (
  commit: CommitMode,
  paused: string | null,
  held: boolean,
  pending: Pending,
): string => {
  const committing = commit === "auto" && paused === null && !held
  return committing && isReady(pending.repo) ? flurryOf(pending) : ""
}
