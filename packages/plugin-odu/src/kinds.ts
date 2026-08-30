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
 * ## Why the KIND is not `WORKTREE_KEY`
 *
 * They are two facts. The KEY is what the browser's dressing table is looked up
 * by, because declarations do not travel to a tab (`@olai/format`'s
 * `meaning.ts`). The KIND is what the SERVER follows — the walk and the value
 * gate — so a column called `checkout` gets the probe the day its row says
 * `{"type":"worktree"}`, and a `worktree` in a vault that declares nothing gets
 * none. That is the behaviour change and it is the point: handing a path to a
 * socket dial in a directory nobody asked about is the highest bar in this
 * package, and only a declaration clears it.
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
