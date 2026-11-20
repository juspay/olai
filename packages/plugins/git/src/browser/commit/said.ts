import {
  armedOn,
  type How,
  type Lock,
  type Pending,
  type Reason,
  type RepoState,
  type Writer,
} from "@olai/format"
import type { GitState } from "@olai/format"
import type { BarStatus, BarTone } from "olai-plugin-layout/slots"

import { agoOf } from "@olai/web/client/ago.ts"

export type Face =
  | "unknown"
  | "off"
  | "no-repo"
  | "error"
  | "blocked"
  | "waiting"
  | "committed"
  | "never"

export const waitingIn = (pending: Pending): number => {
  const changed = new Set(pending.changes.map((change) => change.file))
  const unreadable = new Set(pending.unreadable)
  const silent = pending.outlines.filter((outline) =>
    !changed.has(outline.file) && !unreadable.has(outline.file)
  )
  return pending.changes.length + pending.others.length + pending.unreadable.length +
    silent.length
}

export const faceOf = (pending: Pending, heard: boolean, git: GitState): Face => {
  if (!heard) return "unknown"
  if (pending.repo._tag === "Off") return "off"
  if (git.status === "error" || pending.repo._tag === "Unusable") return "error"
  if (pending.repo._tag === "NoRepo") return "no-repo"
  const waiting = waitingIn(pending)
  if (waiting > 0) return pending.repo._tag === "Blocked" ? "blocked" : "waiting"
  return pending.last === null ? "never" : "committed"
}

export const isInert = (face: Face): boolean =>
  face === "unknown" || face === "off" || face === "no-repo"

export const isNews = (face: Face, pending: Pending, git: GitState): boolean =>
  NEWS.has(readingOf(face, pending, git).tone)

const NEWS: ReadonlySet<BarTone> = new Set(["notice", "alarm"])

export const unpushedIn = (pending: Pending): number => pending.unpushed?.commits ?? 0

export const newsSays = (face: Face, pending: Pending, git: GitState): string => {
  const waiting = waitingIn(pending)
  const unpushed = unpushedIn(pending)
  const paused = git.paused
  if (paused !== null) {
    return waiting > 0
      ? `${waiting} uncommitted · ${AUTO_PAUSED} — tap to see`
      : `${AUTO_PAUSED} — tap to see`
  }
  switch (face) {
    case "waiting":
      return `${waiting} uncommitted — tap to record`
    case "blocked":
      return `${waiting} uncommitted — repository busy`
    case "error":
      return "Git error — tap to see"
    default:
      if (git.pushSaid !== null) return `${PUSH_REFUSED} — tap to see`
      return unpushed > 0 ? `${unpushed} unpushed — tap to push` : ""
  }
}

export const FACE_TONE: Readonly<Record<Face, BarTone>> = {
  unknown: "quiet",
  off: "quiet",
  "no-repo": "quiet",
  error: "alarm",
  blocked: "notice",
  waiting: "notice",
  committed: "healthy",
  never: "healthy",
}

export interface Reading {
  readonly tone: BarTone
  readonly says: string
  readonly riders: ReadonlyArray<string>
  readonly detail: string
}

export const readingOf = (face: Face, pending: Pending, git: GitState): Reading => {
  const unpushed = unpushedIn(pending)
  const riders = [
    ...(unpushed > 0 ? [`${unpushed} unpushed`] : []),
    ...(git.pushSaid !== null ? [PUSH_REFUSED] : []),
    ...(git.paused !== null ? [AUTO_PAUSED] : []),
  ]
  const tone: BarTone = git.pushSaid !== null || git.paused !== null
    ? "alarm"
    : unpushed > 0 && FACE_TONE[face] !== "alarm"
    ? "notice"
    : FACE_TONE[face]
  return { tone, says: saysOf(face, waitingIn(pending)), riders, detail: explain(face, pending, git) }
}

export const DETAIL: Readonly<Record<Face, string>> = {
  unknown: "Loading…",
  off: "Commits are turned off (`commit: off`), so changes are saved but not committed",
  "no-repo":
    "This folder isn't a git repository, so changes are saved but not committed",
  error: "Git failed here, so changes are saved but not committed",
  blocked: "waiting to be committed",
  waiting: "waiting to be committed. Open it to see what changed and commit",
  committed:
    "Everything is committed. Open it to see the last commit",
  never: "This is a git repository, and olai hasn't committed here yet",
}

export const lockSays = (since: number, now: number | null): string =>
  `A git lock file is in the way${
    now === null ? "" : ` (left ${agoOf(since, now)})`
  }. If no git command is running, remove it and retry.`

export const LOCK_HELD =
  "A git process may still be writing; try again in a moment."

export const lockRefused = (git: GitState): Lock | null =>
  git.status === "error" ? git.lock : null

export const explain = (face: Face, pending: Pending, git: GitState): string =>
  alsoPaused(alsoUnpushed(sentence(face, pending, git), pending, git), git)

const sentence = (face: Face, pending: Pending, git: GitState): string => {
  switch (face) {
    case "error": {
      if (git.lock !== null) return lockSays(git.lock.since, null)
      const words = git.said === null || git.said === ""
        ? verbatim(pending.repo) ?? ""
        : git.said
      return words === "" ? DETAIL.error : `${DETAIL.error} — ${words}`
    }
    case "waiting":
      return `${counted(pending)} ${DETAIL.waiting}`
    case "blocked":
      return `${counted(pending)} ${DETAIL.blocked}. ${because(pending.repo)}`
    default:
      return DETAIL[face]
  }
}

const alsoUnpushed = (said: string, pending: Pending, git: GitState): string => {
  const unpushed = unpushedOf(pending)
  if (git.pushSaid !== null) {
    const count = unpushed === null ? "" : `${unpushed} · `
    return `${said} · ${count}${PUSH_REFUSED}: ${git.pushSaid}`
  }
  return unpushed === null ? said : `${said} · ${unpushed}. Open it to push`
}

export const PUSH_REFUSED = "Push refused"

export const AUTO_PAUSED = "Auto-commit paused"

export const loopIn = (git: GitState): "off" | "armed" | "paused" =>
  git.policy.commit !== "auto" ? "off" : git.paused !== null ? "paused" : "armed"

const RESUME_GESTURE = "Press Resume in the commit panel to start it again."

const autoSays = (paused: string): string =>
  `Auto-commit is paused: ${paused}. ${RESUME_GESTURE}`

const AUTO_SAYS_AGAIN = `Auto-commit is paused. ${RESUME_GESTURE}`

const quoted = (git: GitState): boolean =>
  git.paused === git.pushSaid || git.paused === git.said

export const AUTO_STOPPED =
  `Auto-commit is paused. Git's message is below. ${RESUME_GESTURE}`

export const willRecord = (pending: Pending, git: GitState): boolean =>
  armedOn(git.policy.commit, git.paused, false, pending) !== ""

export const AUTO_ARMED =
  "Auto-commit will commit all of this once you stop editing."

const alsoPaused = (said: string, git: GitState): string =>
  git.paused === null
    ? said
    : `${said} · ${quoted(git) ? AUTO_SAYS_AGAIN : autoSays(git.paused)}`

const counted = (pending: Pending): string => {
  const waiting = waitingIn(pending)
  return `${waiting} ${waiting === 1 ? "change is" : "changes are"}`
}

export const HOW: Readonly<Record<How, string>> = {
  modified: "modified",
  added: "added",
  deleted: "deleted",
  renamed: "renamed",
  untracked: "untracked",
}

export const HOW_TONE: Readonly<Record<How, string>> = {
  modified: "text-doing",
  added: "text-done",
  untracked: "text-done",
  renamed: "text-doing",
  deleted: "text-alarm",
}

export const localOf = (from: string | null, served: string): string | null =>
  from !== null && served !== "" && from.startsWith(served)
    ? from.slice(served.length)
    : from

export const scopeOf = (served: string): string =>
  served === ""
    ? "Whole repository"
    : `Whole repository · olai shows ${served}`

export const unpushedOf = (pending: Pending): string | null => {
  const unpushed = pending.unpushed
  if (unpushed === null || unpushed.commits === 0) return null
  const commits = `${unpushed.commits} ${unpushed.commits === 1 ? "commit" : "commits"}`
  return `${commits} not on ${unpushed.upstream}`
}

export const WHO: Readonly<Record<Writer, string>> = {
  "chat-agent": "chat agent",
  mcp: "an agent in a terminal",
  web: "you",
  move: "olai moved chats onto their notes",
  auto: "auto-commit",
  sleep: "olai put a node agent's memory in order",
  filer: "olai filed conversations into the Inbox",
}

export const wroteOf = (writer: Writer, ops: number): string => writer === "move"
  ? `olai moved chats onto their notes · ${ops} ${ops === 1 ? "write" : "writes"}`
  : `${WHO[writer]} ${ops}`

export const because = (repo: RepoState): string => {
  switch (repo._tag) {
    case "Blocked":
      return BLOCKED[repo.reason]
    case "Unusable":
      return "Git couldn't read this folder"
    default:
      return "There is nowhere to commit to"
  }
}

export const verbatim = (repo: RepoState): string | undefined =>
  repo._tag === "Blocked" || repo._tag === "Unusable" ? repo.said : undefined

const BLOCKED: Readonly<Record<Reason, string>> = {
  merge: "A merge is in progress. Finish it first",
  rebase: "A rebase is in progress. Finish it first",
  "cherry-pick": "A cherry-pick is in progress. Finish it first",
  detached: "No branch is checked out. Check out a branch first",
}

export const commitRefused = (git: GitState): string | null =>
  git.status === "error" ? git.said : null

export const saysOf = (face: Face, waiting: number): string => {
  switch (face) {
    case "unknown":
      return "…"
    case "off":
      return "Commits off"
    case "no-repo":
      return "Not a git folder"
    case "error":
      return "Git error"
    case "never":
      return "No commits yet"
    case "committed":
      return "Committed"
    default:
      return `${waiting} uncommitted`
  }
}

export const gitStatusOf = (face: Face, pending: Pending, git: GitState): BarStatus => {
  const said = readingOf(face, pending, git)
  return { tone: said.tone, label: [said.says, ...said.riders].join(" · "), detail: said.detail }
}
