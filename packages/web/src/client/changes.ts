/**
 * What a change is CALLED on screen — the one vocabulary, read by both panels
 * that report on a write.
 *
 * Neither of them shows a text diff over an outline, and this is the whole
 * reason neither has to: a raw `.org` diff exposes a multi-line storage drawer with
 * everything on it changing at once, so `@olai/format` classifies a change into
 * one `Sort` — once, on the server, from the fields that differ and what they
 * became — and this is the table that turns that into words a person reads.
 *
 * It is read TWICE, which is why it sits here rather than inside either
 * reader: the commit panel draws a pending row with it, and the chat transcript
 * draws what an olai write just did with it. Those are the same event seen at
 * two moments — the agent marks a node done, the panel says *marked done*, and
 * the row waiting to be committed says *marked done* — and two tables would be
 * the day one of them started saying something else.
 *
 * It stays a table of its own rather than the one the commit MESSAGE uses
 * (`@olai/ops`'s `message.ts`), and deliberately: one of them is a log line
 * somebody greps years later and the other is a phrase on screen. Sharing them
 * would mean a panel saying `capture:` at somebody.
 */

import type { Sort } from "@olai/format"

/**
 * The phrase, in the past tense, because every one of these has happened
 * already: the write is on disk, and what is being reported is what it did.
 */
export const SAID: Readonly<Record<Sort, string>> = {
  created: "created",
  trashed: "trashed",
  gone: "gone from the file",
  done: "marked done",
  undone: "no longer done",
  cancelled: "called off",
  uncancelled: "no longer cancelled",
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
  trashed: "⌦",
  gone: "⌦",
  done: "✓",
  undone: "○",
  cancelled: "✗",
  uncancelled: "○",
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
