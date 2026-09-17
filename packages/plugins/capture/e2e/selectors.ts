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

/** And the way to the INBOX, beside Agenda — drawn only when the directory
 *  has one, which is what the scenarios about a never-captured vault read. */
export const INBOX_LINK = selector(TESTID.inboxLink);
/** What that entry REPORTS, wrapped round the link: `data-count` is how many
 *  rows of the inbox are marked `todo` or `doing`, at any depth. */
export const INBOX_HELD = selector(TESTID.inboxHeld);
/** The number on it. Absent when the inbox is empty — a quiet door wears no
 *  chip rather than a zero. */
export const INBOX_COUNT = selector(TESTID.inboxCount);
