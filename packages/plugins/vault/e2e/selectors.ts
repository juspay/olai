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

/** Shown OVER pages that are LIVE: which files of the directory are broken. It
 *  keeps the name it had when it meant "showing the last good version", which
 *  is now only what it says for a directory that could not be READ at all. */
export const STALE_BANNER = selector(TESTID.staleBanner);
/** ONE broken file's line inside that banner — its path, its state and a row
 *  COUNT, and never the rows themselves: the banner is drawn over somebody
 *  else's page (`last-good-banner-flood`, and `@olai/format`'s `summaryOf`,
 *  which has no way to hand a surface a row). */
export const BROKEN_FILE_LINE = selector(TESTID.brokenFileLine);
/** …and the door on that line, to the broken file's own page. */
export const BROKEN_FILE_LINK = selector(TESTID.brokenFileLink);
