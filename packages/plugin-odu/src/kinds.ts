/**
 * WHAT ODU TEACHES THE VAULT'S VOCABULARY — one word, and what a value of it
 * has to be.
 *
 * A `worktree` value is a path olai will join `.ci/odu.sock` onto and DIAL in
 * somebody's checkout ({@link ./worktrees.ts}), which is why this kind exists
 * at all rather than the key staying `path`. Both are paths; only one of them
 * licences a socket dial, and `brief` — also a `path`, on the very same rows —
 * is the proof that a shape cannot tell them apart. The vault says which is
 * which, in the one place it says everything else about its keys.
 *
 * ## THE KIND IS THE ONE WORD, and `WORKTREE_KEY` is not it
 *
 * `WORKTREE_KEY` is what `@olai/odu-client` calls a COLUMN. This is the word a
 * VAULT DECLARES, and everything that decides whether a value is a checkout
 * follows it: the walk ({@link ./worktrees.ts}), the value gate, and — since the
 * page began carrying the licence per drawn value — the browser's dressing table
 * too ({@link ./plugin.ts}'s `dressings`, keyed by `WORKTREE_KIND`). So a column
 * called `checkout` gets the probe and the chip the day its row says
 * `{"type":"worktree"}`, and a `worktree` in a vault that declares nothing gets
 * neither. That is the behaviour change and it is the point: handing a path to a
 * socket dial in a directory nobody asked about is the highest bar in this
 * package, and only a declaration clears it.
 *
 * FOR ONE PR WINDOW THE BROWSER FOLLOWED THE KEY, because a vault's declarations
 * deliberately do not travel to a tab (juspay/olai#395), so the probe and the
 * chip agreed only while a vault named its column after the kind — this file's
 * header said as much. `@olai/format`'s `Licence` closed it: the same consult
 * that answers what a value NAMES answers what claims it. A later edit that
 * believed the old paragraph would re-introduce the name-matching this kind
 * exists to end.
 *
 * ## The shape is the FORMAT'S
 *
 * `isPathShaped` and not a second predicate spelled here. This kind is a `path`
 * that promises something further, so what it accepts must not be narrower or
 * wider than what a `path` accepts — a value the format calls a path and this
 * refused would be two answers about one string, which is the family
 * `@olai/format`'s `meaning.ts` header is a list of.
 */

import { isPathShaped } from "@olai/format"

/** The word a declaration writes: `{"title":"worktree","custom":{"type":"worktree"}}`. */
export const WORKTREE_KIND = "worktree"

/** The contribution, as `@olai/plugins`' registry reads it — reached on the
 *  server door, where the validator and the write planner are. */
export const kinds = [{
  kind: WORKTREE_KIND,
  takes: "`worktree` (a path to a checkout, no whitespace)",
  admits: isPathShaped,
}] as const
