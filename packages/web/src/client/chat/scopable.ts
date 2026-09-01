/**
 * WHICH SERVED FILES A DOORBELL MAY BE POINTED AT — the wake picker's offered
 * set, as one rule over paths.
 *
 * ## The defect this is
 *
 * The picker offered every file the directory serves. The human's screenshot,
 * 2026-09-01, has `2026-09-01.md` sitting between two outlines — and a document
 * cannot be a scope for a doorbell that derives its watched set from a file's
 * NODES: it has none, so the conversation watches the empty set for ever. That
 * is not a loud failure. There is no wake, no digest, and a HEARTBEAT that goes
 * on saying the watcher is alive, so a person reads quiet-and-fine over a fleet
 * that is wholly unsupervised — the exact confusion the heartbeat was built to
 * prevent, handed to them by the control.
 *
 * ## TWO RULES, and they belong to two different people
 *
 * **The KIND is the plugin's**, and it arrives as data: `wake.kinds` off the
 * roster (`@olai/surface`'s `BuiltPlugin`), compared against the registry's
 * answer for a path (`@olai/format`'s `fileKind`). Core does not know what a
 * wake file MEANS — it never opens one — so it may not decide which kinds can
 * carry a filter, and it no longer has to: the plugin says.
 *
 * NOT A SUFFIX. `path.endsWith(".olai")` would be a second answer to a question
 * `kinds.ts` settles, spelled in a picker, free to drift the day a kind is
 * renamed with every one of its own tests still green. The registry is asked
 * per path instead, which is the same table the store walked the directory with.
 *
 * **WHICH of those files to OFFER is core's**, because what is left is a
 * question about core's own files rather than about the plugin's subject:
 *
 *   - what is PUT AWAY is not offered (`@olai/format`'s `isPutAway`) — the one
 *     `_olai/Trash.olai` and the leftover `Archive.olai`s. A trashed lane's
 *     claim is HISTORY: the records are real and the walk would really derive
 *     terminals from them, which is worse than deriving nothing, because a
 *     doorbell would then ring about work somebody deliberately put away;
 *   - and neither are the files OLAI NAMED FOR ITSELF (`inOlaiDir`) —
 *     `_olai/Pins.olai`, `_olai/Properties.olai`, `_olai/Kolu.olai`,
 *     `_olai/Inbox.olai`. They are outlines and they will never be a board: one
 *     is a shelf of mirrors, one declares property kinds, one holds a watcher's
 *     knobs. A list of five where two are meaningful is nearly as bad as one
 *     that offers a `.md`, and this is the second reader of a rule the sidebar
 *     already keeps for the same reason it keeps it — those rows are olai's, and
 *     the tree is the reader's.
 *
 * EVERYTHING ELSE IS OFFERED, and that is the honest end of the ruling rather
 * than a place the filtering stopped. Which of a person's outlines carries a
 * lane is a thing the picker cannot know and must not guess: a board is
 * `lanes.olai` on one machine and `work/today.olai` on the next, and a picker
 * that tried to rank them would be wrong in a way nobody could correct.
 *
 * ## What is NOT offered is not thereby REFUSED
 *
 * This is a curation of a list, and the only thing that can be a FAULT is a
 * scope that cannot work at all — the kind rule, judged per revision by the
 * serve (`@olai/chat`'s `Chat.faults`). A conversation somebody scoped to
 * `_olai/Trash.olai` before this landed goes on deriving exactly what it always
 * derived and is told nothing: the pick is odd, and it is not broken, and core
 * does not interrupt a person about a control that is doing what they asked. So
 * the two rules are separate here on purpose, and only {@link watchable} is
 * spent on both sides.
 *
 * A module rather than a memo in the component, for `./busy.ts`'s reason: what
 * a picker offers is exactly the kind of thing a suite should be able to state
 * over a directory listing, and reaching it through a browser is not how
 * anybody should have to check that a document is not on offer.
 */

import { fileKind, inOlaiDir, isPutAway } from "@olai/format"

/**
 * Whether a doorbell declaring `kinds` could watch `path` AT ALL — the kind
 * rule alone, which is the one a stored pick is judged by.
 *
 * A path no kind claims — a `README`, a `.ts`, a file this app is not part of —
 * answers `false`, which needs no arm of its own: it is in no plugin's list
 * because it is in no list.
 */
export const watchable = (path: string, kinds: ReadonlyArray<string>): boolean => {
  const kind = fileKind(path)
  return kind !== null && kinds.includes(kind)
}

/**
 * ... and whether the picker OFFERS it: watchable, and one of the reader's own
 * files rather than one of olai's or one that was put away.
 *
 * Asked per path per open, and per keystroke through the fold the matcher keeps
 * ({@link ./Wake.tsx}). All three questions are a constant-time answer over the
 * name — the registry compares suffixes, and the other two compare a prefix and
 * a basename against constants — so a vault of any size costs one pass.
 */
export const scopable = (path: string, kinds: ReadonlyArray<string>): boolean =>
  watchable(path, kinds) && !isPutAway(path) && !inOlaiDir(path)
