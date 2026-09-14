/**
 * THIS ROW'S SELECTORS — its own ids, spelled once, for its own steps.
 *
 * They were in the harness's `support/world.ts`, which is where every row's
 * were: one table three thousand lines long that a change to any row appended
 * to. What made that the wrong place is not its size but its OWNER — a new
 * testid for this row was a diff in a package this row does not own, reviewed
 * by people who were not changing anything.
 *
 * The ids come from `../src/testids.ts`, which is this package's own file, so
 * a rename here is a type error in the package that renamed it rather than a
 * scenario that times out thirty seconds later saying nothing about why.
 * `selector()` is the client's, through the one door the suite may spell.
 *
 * WHAT IS NOT HERE is anything more than one row's steps read — the header, the
 * sidebar shell, the outline rows every page draws, the waits. Those are the
 * harness's, and a step imports them from `@olai/tests/harness/world.ts`
 * beside these. The rule is the one the shared helpers follow: what more than
 * one row's steps stand on is the harness's.
 */

import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

/** The trash: the one `_olai/Trash.olai` the directory holds, read-only, one verb. */
export const TRASH_PAGE = selector(TESTID.trashPage);
/** One row of it — a trashed node; `data-node-id` is which. */
export const TRASH_ROW = selector(TESTID.trashRow);
/** The one verb a trash row offers. */
export const TRASH_PUT_BACK = selector(TESTID.trashPutBack);
/** What the last put-back had to say, under its row; `data-tone` is the mood. */
export const TRASH_SAID = selector(TESTID.trashSaid);
/** Said in the rows' place when nothing is in the trash. */
export const TRASH_EMPTY = selector(TESTID.trashEmpty);
/** The page's OWN verb: empty the Trash for good. Drawn only when the
 *  trash holds something, and never taken away by a filter. One id for its
 *  three states, so a step reaches the control rather than a state of it. */
export const TRASH_EMPTY_VERB = selector(TESTID.trashEmptyVerb);
/** The question that replaces it before anything is written. */
export const TRASH_EMPTY_CONFIRM = selector(TESTID.trashEmptyConfirm);
/** The way out of that question, which writes nothing. */
export const TRASH_EMPTY_CANCEL = selector(TESTID.trashEmptyCancel);
/** What the emptying said — the PAGE's line, since the write is about the
 *  one trash and there is no row to put it under. */
export const TRASH_PAGE_SAID = selector(TESTID.trashPageSaid);
