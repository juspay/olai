/**
 * What a change is CALLED on screen.
 *
 * The panel never shows a text diff, and this is the whole reason it does not
 * have to: a `.jsonl` diff is one enormous line per node with everything on it
 * changing at once, and what a reader actually wants is the sentence. So
 * `@olai/format` classifies a change into one `Sort` — once, on the server,
 * from the fields that differ and what they became — and this is the table that
 * turns that into words a person reads.
 *
 * It is a table of ITS OWN rather than the one the commit message uses
 * (`@olai/ops`'s `message.ts`), and deliberately: one of them is a log line
 * somebody greps years later and the other is a phrase in a popover. Sharing
 * them would mean the panel saying `capture:` at somebody.
 */

import {
  type Pending,
  type Reason,
  type RepoState,
  type Sort,
  type Writer,
} from "@olai/format"
import type { GitState } from "@olai/surface"

import type { Attempt } from "./state.ts"

/**
 * Which of the eight things the pill is saying right now.
 *
 * EIGHT, and every one of them is drawn — the control is never absent. This
 * feature exists to be an audit trail of what the tool wrote, so "there is no
 * audit trail here" is the single most important thing it can say, and a pill
 * that disappeared is exactly how a person would never find that out. The same
 * argument the connection dot makes: green is a claim the page keeps making,
 * and an indicator that is only there when something is wrong cannot be trusted
 * when it is absent.
 *
 * `off` and `no-repo` are SETTINGS rather than faults, and are drawn as such:
 * dim, inert, no warning. `blocked` and `error` are the two a person can act
 * on, so they are the two that get a warning.
 *
 * `error` is the newest, and it is the whole of `one-git-indicator`: it is
 * #108's git readout, which used to be a SECOND chip in the header answering
 * the same question this one does. Two indicators for one subject is what the
 * human filed, and folding the fault face in here is the answer — the reason a
 * repository will not take a write has to stay visible (that was #108's bug),
 * but it belongs on the control that is already talking about writes. Git's own
 * words ride it, on the tip AND on the `aria-label`, because a sentence only a
 * pointer can reach is a sentence half the readers never get.
 *
 * `unknown` is not a state of the DIRECTORY at all: it is this page, before the
 * server has said anything. It is here because the alternative is what the pill
 * used to do — draw the default value's `off` face, claiming a setting about a
 * server it had not heard from.
 *
 * `never` is not the same as `committed` and the difference is the whole reason
 * the last commit is carried at all: a clean tree that just committed and a
 * clean tree where olai has never written anything both have nothing pending,
 * and saying "committed" to the second would be a lie.
 */
export type Face =
  | "unknown"
  | "off"
  | "no-repo"
  | "error"
  | "blocked"
  | "waiting"
  | "committed"
  | "never"

/**
 * The one face, from the two readings the server publishes together.
 *
 * `git` is the second argument rather than something derived from `pending`
 * alone, and it has to be: a repository whose identity nobody set answers
 * `rev-parse` perfectly happily, so `repo` reads `Ready` while every commit
 * fails — which is precisely the silence #108 was filed for. The server
 * REMEMBERS that refusal and publishes it as `error` (`@olai/ops`' `gitOf` and
 * the override beside it); nothing in the survey alone can say so. The two
 * values are recomputed from ONE survey in one statement (`server/runtime.ts`),
 * so reading both here is not a second probe.
 *
 * Order is the argument. A page that has heard nothing claims nothing. `off`
 * comes next because a server that never asks git cannot have a git fault to
 * report. Then the FAULT, ahead of `no-repo`: #108's rule is that broken-git
 * and no-repo must never collapse into each other, and of the two, the fault is
 * the one with something to fix.
 */
export const faceOf = (pending: Pending, heard: boolean, git: GitState): Face => {
  if (!heard) return "unknown"
  if (pending.repo._tag === "Off") return "off"
  // Both spellings of the same news: git could not be asked about the directory
  // at all (the survey's own answer), or it refused a commit here (the server's
  // memory, which no probe can see).
  if (git.status === "error" || pending.repo._tag === "Unusable") return "error"
  if (pending.repo._tag === "NoRepo") return "no-repo"
  const waiting = pending.changes.length + pending.unreadable.length
  // A busy repository with nothing waiting is not a problem anybody has: there
  // is nothing the block is stopping.
  if (waiting > 0) return pending.repo._tag === "Blocked" ? "blocked" : "waiting"
  return pending.last === null ? "never" : "committed"
}

/** Whether pressing it could do anything. The two settings are inert — there is
 *  no panel to open, because there is nothing behind it to say — and so is a
 *  page that has not been told anything yet.
 *
 *  `error` is deliberately NOT one of them. A git that refused a commit is a
 *  repository with writes waiting in it, and the panel is where they are listed
 *  and where the retry lives; and an inert control is a control a keyboard
 *  cannot reach, which is how the reason would go back to being hover-only. */
export const isInert = (face: Face): boolean =>
  face === "unknown" || face === "off" || face === "no-repo"

/**
 * The mark a face wears, or `null` for the faces that wear none.
 *
 * A table, so every face must be given one — including the ones whose answer is
 * NOTHING, which is a decision and is spelled out rather than left as a missing
 * key. It is here rather than in the component for the reason the retired
 * readout's `LOOK` was: what a state looks like is an argument about that state,
 * and an argument is a thing to unit-test.
 *
 * `⚠` is for the two a person can act on, in the two tones that tell them
 * apart: a repository mid-rebase is amber and will take a commit once they
 * finish, a git that failed is alarm and will not.
 *
 * The `✓` is deliberately NOT green, and that is #108's rule surviving its own
 * readout: the connection dot beside this pill is the page's one green claim,
 * and a second one permanently lit in the ordinary case dilutes the thing a
 * reader actually scans for. Recency is what the committed face carries
 * (`✓ committed · 3m ago`); the colour was only ever decoration.
 */
export interface Mark {
  /** One character, already in the font — nothing to load and nothing to
   *  disagree with the words beside it. */
  readonly glyph: string
  /** The token that paints it. A theme token, never a literal colour. */
  readonly tone: string
}

export const MARK: Readonly<Record<Face, Mark | null>> = {
  unknown: null,
  off: null,
  "no-repo": null,
  error: { glyph: "⚠", tone: "text-alarm" },
  blocked: { glyph: "⚠", tone: "text-doing" },
  waiting: null,
  committed: { glyph: "✓", tone: "text-muted" },
  never: null,
}

/**
 * What a face MEANS, in one sentence — the tip a pointer opens and the
 * `aria-label` everybody else gets.
 *
 * The static half. {@link explain} adds the words only the VALUE has, which is
 * the half #108 existed for: what git actually said.
 */
export const DETAIL: Readonly<Record<Face, string>> = {
  unknown: "waiting to hear from the server",
  off: "commits are off for this server (`--commit=off`), so nothing here is recorded",
  "no-repo":
    "this directory is not a git work tree, so writes land on disk but are not committed anywhere",
  // True of both ways this state is reached — a git that could not be asked
  // about the directory at all, and a commit it refused — because what happened
  // is in the words that follow, and what a reader needs first is the
  // consequence.
  error: "git failed here, so writes are landing on disk but are not being committed",
  // The two that are counted: {@link explain} puts the tally in front of them,
  // because "3 uncommitted" on screen and "some writes are waiting" in the
  // sentence would be the same fact told twice and told differently.
  blocked: "waiting to be committed",
  waiting: "waiting to be committed — open it to see what changed, and to record it",
  committed:
    "everything olai has written here is committed — open it for what it last recorded",
  never: "this directory is a git repository, and olai has not committed in it yet",
}

/**
 * The whole sentence, for the one face being worn.
 *
 * Three of the eight have something the table cannot hold: the fault carries
 * git's own words, and the two that are waiting carry how much. Everything else
 * reads as its own sentence.
 */
export const explain = (face: Face, pending: Pending, git: GitState): string => {
  switch (face) {
    case "error": {
      // The cell's words first — they are the remembered refusal, which is the
      // half a survey cannot see — and the survey's own as the fallback.
      const words = git.said === null || git.said === ""
        ? verbatim(pending.repo) ?? ""
        : git.said
      return words === "" ? DETAIL.error : `${DETAIL.error} — ${words}`
    }
    case "waiting":
      return `${counted(pending)} ${DETAIL.waiting}`
    case "blocked":
      return `${counted(pending)} ${DETAIL.blocked}, and ${because(pending.repo)}`
    default:
      return DETAIL[face]
  }
}

/** How much is waiting, in words — the same tally the pill draws as a number,
 *  so the sentence and the label cannot disagree. */
const counted = (pending: Pending): string => {
  const waiting = pending.changes.length + pending.unreadable.length
  return `${waiting} ${waiting === 1 ? "change is" : "changes are"}`
}

/** The phrase, in the past tense, because every one of these has happened
 *  already: the write is on disk and this is what is waiting to be recorded. */
export const SAID: Readonly<Record<Sort, string>> = {
  created: "created",
  archived: "archived",
  gone: "gone from the file",
  done: "marked done",
  undone: "no longer done",
  doing: "started",
  "not-doing": "no longer started",
  moved: "moved",
  scheduled: "scheduled",
  unscheduled: "unscheduled",
  noted: "note rewritten",
  renamed: "retitled",
  linked: "links changed",
  edited: "edited",
}

/**
 * One character standing for the same thing.
 *
 * Text, not an icon set: these sit in a list of node titles at the size of the
 * text around them, and a glyph that is already in the font is one that cannot
 * fail to load and cannot disagree with the word beside it. Every row carries
 * BOTH — the glyph is the scan, the word is the answer.
 */
export const GLYPH: Readonly<Record<Sort, string>> = {
  created: "+",
  archived: "⌦",
  gone: "⌦",
  done: "✓",
  undone: "○",
  doing: "◐",
  "not-doing": "○",
  moved: "⇅",
  scheduled: "◷",
  unscheduled: "◷",
  noted: "✎",
  renamed: "✎",
  linked: "→",
  edited: "✎",
}

/** Who a writer is, to a reader. `web` is the only one that gets a different
 *  word than its name: the person reading this is the one who pressed the
 *  button, and "web" would be telling them about a transport.
 *
 *  Keyed by `Writer` rather than by `string`, so a writer the format grows is
 *  a compile error here instead of a raw tag on screen. */
export const WHO: Readonly<Record<Writer, string>> = {
  "chat-agent": "chat agent",
  mcp: "an agent in a terminal",
  web: "you",
}

/** Why the repository cannot take a commit right now. Git's own words ride the
 *  pending value as `said` and are what the panel hangs on the line as a title;
 *  this is the sentence. */
export const because = (repo: RepoState): string => {
  switch (repo._tag) {
    case "Blocked":
      return BLOCKED[repo.reason]
    // A git that could not be asked at all. It says so HERE as well as on the
    // pill, because this is the line the panel draws where the button would be
    // — and "there is nowhere to commit to" would be reporting a broken git as
    // an absent repository, which is the one confusion #108 exists to have
    // ended.
    case "Unusable":
      return "git could not be asked about this directory"
    // The two settings, and the pill DOES draw for both — it is never absent —
    // but their sentence is {@link DETAIL}'s, because they are statements
    // rather than something to fix. This is the fallback that keeps the
    // function total.
    default:
      return "there is nowhere to commit to"
  }
}

/** Git's own words, when there are any — what you would paste into a search,
 *  which is why they are kept verbatim rather than folded into the sentence
 *  above. Both states that HAVE any hand them over: a repository that is busy,
 *  and a git that failed. */
export const verbatim = (repo: RepoState): string | undefined =>
  repo._tag === "Blocked" || repo._tag === "Unusable" ? repo.said : undefined

const BLOCKED: Readonly<Record<Reason, string>> = {
  merge: "a merge is in progress — finish it first",
  rebase: "a rebase is in progress — finish it first",
  "cherry-pick": "a cherry-pick is in progress — finish it first",
  detached: "HEAD is detached — check out a branch first",
}

/**
 * What an attempt leaves on screen, or `null` for one that leaves nothing.
 *
 * A commit that WORKED is the `null`: it republishes what is pending, and the
 * panel it would have been read in is gone with it.
 */
export const trouble = (attempt: Attempt | null): string | null => {
  if (attempt === null) return null
  switch (attempt._tag) {
    case "Committed":
      return null
    case "NothingToCommit":
      return "nothing was waiting"
    case "Blocked":
      return `${because(attempt.repo)} — nothing was committed`
    case "Failed":
      return attempt.said
    case "Refused":
      return attempt.failure.message
  }
}
