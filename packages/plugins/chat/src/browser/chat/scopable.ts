/**
 * WHICH SERVED FILES THE WAKE PICKER OFFERS — core's half of the ruling, over
 * the plugin's.
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
 * ## TWO QUESTIONS, and only the second is this file's
 *
 * **CAN this doorbell watch that file** is the plugin's, and it is answered
 * where the declaration it reads lives: `@olai/surface`'s `watchable`, over
 * `wake.kinds`. It is not re-spelled here, because the SERVE asks the same
 * question of a stored pick per revision (`olai-plugin-chat`'s `Chat.faults`) and the
 * day the two spellings drift is the day this picker offers a file the serve
 * faults on the moment somebody presses it.
 *
 * **WOULD anybody's board be that file** is core's, and it is the whole of what
 * is below. Core cannot know what a wake file MEANS — it never opens one — but
 * it knows which files are ITS OWN, and that is enough to keep a list of five
 * where two are meaningful from being nearly as bad as one that offers a `.md`.
 *
 * ## What is NOT offered is not thereby REFUSED
 *
 * The list is a CURATION and the fault is a CORRECTNESS rule, and only the
 * first is below. A conversation somebody scoped to `_olai/Trash.olai` before
 * this landed goes on deriving exactly what it always derived and is told
 * nothing: the pick is odd, it is not broken, and core does not interrupt a
 * person about a control that is doing what they asked. That is why
 * {@link scopable} is this module's only export and {@link watchable} is
 * imported rather than re-exported — the two questions have two answers and one
 * of them is nobody's business here.
 *
 * A module rather than a memo in the component, for `./busy.ts`'s reason: what
 * a picker offers is exactly the kind of thing a suite should be able to state
 * over a directory listing, and reaching it through a browser is not how
 * anybody should have to check that a document is not on offer.
 */

import { inOlaiDir, isPutAway } from "@olai/format"
import { watchable } from "@olai/surface"

/**
 * A FILE THE READER KEEPS THEIR OWN WORK IN — everything the directory serves
 * except what was put away and what olai made for itself.
 *
 * ## TWO PREDICATES FOR TWO REASONS, and they are not one rule wearing two
 * names
 *
 * It is tempting to read them as one — *outlines that will never carry a lane*
 * — and that reading is false of the first: `_olai/Trash.olai` is full of lanes
 * that DID carry one, records and `kolu-terminal` props and all. That is
 * exactly why it is excluded rather than harmless. So:
 *
 *   - **`isPutAway` — the records are not LIVE.** The one trash and the
 *     leftover `Archive.olai`s. A trashed lane's claim is history, and the walk
 *     would really derive terminals from it, which is worse than deriving
 *     nothing: the doorbell would ring about work somebody deliberately put
 *     away. `@olai/format` already names this disjunction for the half-dozen
 *     readings of the live set that ask it.
 *   - **`inOlaiDir` — the file is OLAI'S, not the reader's corpus.**
 *     `_olai/Pins.olai` is a shelf of mirrors, `_olai/Properties.olai` declares
 *     property kinds, `_olai/Kolu.olai` holds a watcher's knobs,
 *     `_olai/Inbox.olai` is where a capture lands. Outlines every one, and none
 *     of them is a board anybody keeps.
 *
 * ## And the sidebar is the evidence that they must stay two
 *
 * `../Sidebar.tsx` asks a question one word away from this one — it seats the
 * `_olai/` rows and the Trash apart from the tree — and it deliberately keeps
 * the leftover `Archive.olai`s IN the tree, because a person may want to open
 * one and hand-move what is in it. This module deliberately keeps them OUT,
 * because opening a file is not pointing a doorbell at it. A single named rule
 * for "the reader's own corpus" would have to be wrong for one of the two, and
 * a third case wanting a third predicate is the honest cost of that: the third
 * one will be a third REASON, and a reason deserves a name. The rule for
 * collapsing them is `isPutAway`'s own — a disjunction earns a name when no
 * reading has ever wanted one half without the other, and here the second
 * reading wants exactly that.
 *
 * NOT EXPORTED. It is half of one answer, and the answer is {@link scopable};
 * a caller reaching for this alone would be a second opinion about what the
 * picker offers.
 */
const readersOwn = (path: string): boolean => !isPutAway(path) && !inOlaiDir(path)

/**
 * ... and the two together: the files this doorbell could be pointed at.
 *
 * Asked per path per open, and per keystroke through the fold the matcher keeps
 * ({@link ./Wake.tsx}). Both halves are a constant-time answer over the name —
 * the registry compares suffixes, and the exclusions compare a prefix and a
 * basename against constants — so a vault of any size costs one pass.
 *
 * EVERYTHING ELSE IS OFFERED, and that is the honest end of the ruling rather
 * than the place the filtering stopped. Which of a person's outlines carries a
 * lane is a thing the picker cannot know and must not guess: a board is
 * `lanes.olai` on one machine and `work/today.olai` on the next, and a picker
 * that tried to rank them would be wrong in a way nobody could correct.
 */
export const scopable = (kinds: ReadonlyArray<string>, path: string): boolean =>
  watchable(kinds, path) && readersOwn(path)
