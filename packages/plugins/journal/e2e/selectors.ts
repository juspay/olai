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

/** The rail's way to the agenda — the collapsed column's face of the entry,
 *  carrying the same `data-owed` as a dot. */
export const RAIL_AGENDA = selector(TESTID.railAgenda);
/** The agenda: the same dates read forward. `data-date` is the day it was
 *  answered for, which `/agenda` does not spell. */
export const AGENDA_PAGE = selector(TESTID.agendaPage);
/** THE LINE, drawn exactly when something is owed — so its absence is a claim
 *  the page makes and not a layout accident. */
export const AGENDA_SPINE = selector(TESTID.agendaSpine);
/** One day ON that line. `data-date` is which day, `data-when` is which side of
 *  now it sits on, and its heading is the link to that day's own page. */
export const AGENDA_DAY = selector(TESTID.agendaDay);
/** A silence worth naming beside the line; `data-days` is how long the wait
 *  was. Absent wherever a gap is too short to be worth a word. */
export const AGENDA_QUIET = selector(TESTID.agendaQuiet);
/** Said in place of the line when nothing is due. */
export const AGENDA_EMPTY = selector(TESTID.agendaEmpty);
/** What that entry REPORTS, wrapped round the link: `data-owed` is the face it
 *  wears (`overdue` / `today` / `quiet`) and `data-overdue` / `data-today` are
 *  the two counts, whichever of them is on screen. */
export const AGENDA_OWED = selector(TESTID.agendaOwed);
/** The number on it. Absent when nothing is owed — a quiet entry wears no chip
 *  rather than a zero. */
export const AGENDA_COUNT = selector(TESTID.agendaCount);
/** THE day's note, above those groups: a document named for the date itself.
 *  `data-file` is which. */
export const DAY_NOTE = selector(TESTID.dayNote);
/** Its heading — the way from the day to the document's own page. */
export const DAY_NOTE_LINK = selector(TESTID.dayNoteLink);
