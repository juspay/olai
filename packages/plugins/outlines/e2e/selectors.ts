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

/** What a node itself says it comes AFTER — its own field, drawn on its page
 *  beside the DERIVED `blocked by` row above it. The two are different claims:
 *  this one is what `outlines_after` writes, and only this one carries an `×`. */
export const AFTER_REFS = selector(TESTID.afterRefs);
/** The `×` on one drawn reference — drop that target. `data-ref` is which. */
export const REF_DROP = selector(TESTID.refDrop);
// ── what refers to a node, read backwards ──────────────────────────────
/** The `<details>` under a zoomed node's heading. `data-count` is how many
 *  RECORDS refer to it; the element's own `open` says whether it is unfolded.
 *  Absent on a node nothing refers to. */
export const BACKLINKS = selector(TESTID.backlinks);
/** Its summary — the count in words, and what a pointer presses to open it. */
export const BACKLINKS_SUMMARY = selector(TESTID.backlinksSummary);
// ── writing a node's edges ─────────────────────────────────────────────
/** The panel that writes one relation of one node, in place under the row or
 *  under a zoomed node's heading. `data-relation` says which of `see` /
 *  `after`; present only while it is open. */
export const EDGE_PANEL = selector(TESTID.edgePanel);
/** The `×` on one of those chips; `data-ref` is the target it drops. */
export const EDGE_DROP = selector(TESTID.edgeDrop);
/** Its search box — the server's own node search, the same one ⌘K, the header
 *  box and the `((` widget call. */
export const EDGE_SEARCH = selector(TESTID.edgeSearch);
/** One hit in it; `data-id` is the node it would name. */
export const EDGE_HIT = selector(TESTID.edgeHit);
/** What the last edge WRITE said — a refusal verbatim (the loop an `after`
 *  would close), or a nudge. `data-tone` is which mood. Never the same line as
 *  a refused SEARCH. */
export const EDGE_SAID = selector(TESTID.edgeSaid);
/** One of the two edge verbs on a zoomed node's page, where a heading has no
 *  `•••` to put them in. `data-relation` says which. */
export const EDGE_VERB = selector(TESTID.edgeVerb);
// ── carrying a row to a new parent ─────────────────────────────────────
/** The move-to picker, in place under the row it was opened on. `data-row` is
 *  the RECORD being moved, `data-asked` the query its hits answer. */
export const MOVE_PICKER = selector(TESTID.movePicker);
/** Its search box — the server's own node search again, over the whole set. */
export const MOVE_SEARCH = selector(TESTID.moveSearch);
/** One destination in it; `data-id` is the node it would go under. */
export const MOVE_HIT = selector(TESTID.moveHit);
/** WHY the destination under the cursor cannot take the row — drawn at the
 *  aim, before `Enter`, and absent whenever the aim is a legal one. */
export const MOVE_REFUSED = selector(TESTID.moveRefused);
/** What the last MOVE said: the ops layer's refusal, or a nudge from one that
 *  landed. Never the same line as the aim's refusal above. */
export const MOVE_SAID = selector(TESTID.moveSaid);
/** The picker's way out for a pointer — and the one place in the panel that is
 *  not the search box, which is what makes it the position Escape has to be
 *  answered from as well. */
export const MOVE_CLOSE = selector(TESTID.movePickerClose);
/** The date picker, in place under the row it was opened on — from the pill
 *  above, or from the `•••` menu's `Set date…`. Its box is a native
 *  `<input type="date">`, so what it holds is the ten characters the record
 *  will hold; its button's LABEL is the verb, and `Clear date` is the menu's
 *  own words for the same edit once the box has been emptied. */
export const DATE_PICKER = selector(TESTID.datePicker);
export const DATE_PICKER_DAY = selector(TESTID.datePickerDay);
export const DATE_PICKER_TIME = selector(TESTID.datePickerTime);
export const DATE_PICKER_NO_TIME = selector(TESTID.datePickerNoTime);
export const DATE_PICKER_SET = selector(TESTID.datePickerSet);
export const DATE_PICKER_CANCEL = selector(TESTID.datePickerCancel);
/** Said when the node stores a value a day box cannot hold — a datetime,
 *  quoted verbatim, with what picking a day would do to it. */
export const DATE_PICKER_NOTICE = selector(TESTID.datePickerNotice);
/** ...and the disclosure a value too long to be a fact is drawn behind. */
export const PROP_FOLD = selector(TESTID.propFold);
/** The KEY half of a chip, which is the handle: pressing it opens the value for
 *  editing whatever the value is. A button only where the surface offers
 *  writing. */
export const PROP_KEY = selector(TESTID.propKey);
/** The `+` at the end of the run — the door onto adding one, drawn wherever
 *  there is a run to put it at the end of. */
export const PROP_ADD = selector(TESTID.propAdd);
/** What the last commit had to say, under the run — a refusal quoted verbatim,
 *  or a nudge that rode back on a write that landed. */
export const PROP_SAID = selector(TESTID.propSaid);
/** The one FACT a folded row may show beside its title (`client/hot.ts`) —
 *  `pr` on shipped work. The rollup is the other arm of that slot and keeps
 *  `PROGRESS` above. */
export const HOT_FACT = selector(TESTID.hotFact);
/** The question that panel asks before the one verb that takes a branch away.
 *  Present only while it is asking. */
export const NODE_MENU_CONFIRM = selector(TESTID.nodeMenuConfirm);
/** What the last verb had to say, beside the `•••`. `data-tone` is which of
 *  the two moods it is in — `alarm` for a refusal, `aside` for a nudge. */
export const NODE_MENU_SAID = selector(TESTID.nodeMenuSaid);
/** The status box beside that bullet: checked for done, half for doing, empty
 *  for todo — and absent entirely on a node with no mark. */
export const CHECKBOX = selector(TESTID.checkbox);
/** Where a `((` hit sits — the second line of its row. */
export const COMPLETION_ITEM_PLACE = selector(TESTID.completionItemPlace);
/** What a write that LANDED had to say — the rollup's nudge, in the same
 *  place and the opposite mood. */
export const EDIT_NUDGE = selector(TESTID.editNudge);
/** The way in on a page with no rows at all. */
export const START_LINE = selector(TESTID.startLine);
/** The face a PANE wears while a row is held over it that cannot land there —
 *  the drag's other answer, and never drawn beside the line. `data-file` is the
 *  file that said no, and the sentence inside is the one the selection bar says
 *  once the pointer is released. */
export const DROP_REFUSED = selector(TESTID.dropRefused);
/** The band a drag-across pulls — present only while one is being pulled.
 *  `data-rows` is how many rows it is crossing, which is the half of the
 *  gesture that is still a prediction while the pointer is down. */
export const SWEEP_BAND = selector(TESTID.sweepBand);
/** The bar a multi-selection draws. `data-rows` is the count the bulk verbs
 *  are asked of — the picked rows nothing else picked contains. */
export const SELECTION_BAR = selector(TESTID.selectionBar);
export const SELECTION_TRASH = selector(TESTID.selectionTrash);
export const SELECTION_CONFIRM = selector(TESTID.selectionConfirm);
/** Said in the Trash button's place when the pick holds a placement. */
export const SELECTION_NOTE = selector(TESTID.selectionNote);
