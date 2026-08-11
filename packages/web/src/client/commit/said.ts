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

import type { Reason, RepoState, Sort } from "@olai/format"

import type { Attempt } from "./state.ts"

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
 *  button, and "web" would be telling them about a transport. */
export const WHO: Readonly<Record<string, string>> = {
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
    // Neither of these is ever drawn — the pill is absent for both — but a
    // total function is what makes that true by construction rather than by
    // the caller remembering.
    default:
      return "there is nowhere to commit to"
  }
}

/** Git's own words, when there are any — what you would paste into a search,
 *  which is why they are kept verbatim rather than folded into the sentence
 *  above. */
export const verbatim = (repo: RepoState): string | undefined =>
  repo._tag === "Blocked" ? repo.said : undefined

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
