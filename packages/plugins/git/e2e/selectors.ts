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

/** What olai last recorded here, in the panel — or the words that say it never
 *  has, which is a fact no count of what is pending can express. */
export const COMMIT_LAST = selector(TESTID.commitLast);
/** One node that changed. `data-sort` is WHAT changed about it — never the
 *  words it is rendered as, which the view is entitled to reword. */
export const COMMIT_CHANGE = selector(TESTID.commitChange);
export const COMMIT_MESSAGE = selector(TESTID.commitMessage);
export const COMMIT_NOW = selector(TESTID.commitNow);
export const COMMIT_BLOCKED = selector(TESTID.commitBlocked);
/** One dirty file that is NOT a served outline — a document a person edited, a
 *  source file, an outline outside the served root. `data-path` is which and
 *  `data-how` what happened to it, never the chip's own words. */
export const COMMIT_OTHER = selector(TESTID.commitOther);
/** The box that says whether a file is going into this commit; `data-path` is
 *  which file. Everything is ticked until somebody says otherwise. */
export const COMMIT_TICK = selector(TESTID.commitTick);
/** What the panel is a list OF — the whole repository, and the part of it olai
 *  serves. */
export const COMMIT_SCOPE = selector(TESTID.commitScope);
/** What is committed here and nowhere else; `data-commits` is how many. */
export const COMMIT_UNPUSHED = selector(TESTID.commitUnpushed);
export const COMMIT_PUSH = selector(TESTID.commitPush);
/** What git said when it last refused a push, verbatim. Off the git cell, so
 *  it is there for whoever opens the panel rather than only for the tab that
 *  made the request. */
export const COMMIT_PUSH_REFUSED = selector(TESTID.commitPushRefused);
/** Why the quiet-window loop stopped, in git's own words. Absent while the loop
 *  is running, which is what makes its PRESENCE the fact a scenario asserts. */
export const COMMIT_AUTO_PAUSED = selector(TESTID.commitAutoPaused);
/** What Auto-commit is about to do with what the panel is listing. Drawn only
 *  while it really is going to happen. */
export const COMMIT_AUTO_ARMED = selector(TESTID.commitAutoArmed);
