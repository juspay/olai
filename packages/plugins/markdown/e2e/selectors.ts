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

/** The editor itself — a textarea holding the document's SOURCE, verbatim.
 *  Present exactly while the page is in its edit mode. */
export const DOCUMENT_EDITOR = selector(TESTID.documentEditor);
export const DOCUMENT_SAVE = selector(TESTID.documentSave);
export const DOCUMENT_CANCEL = selector(TESTID.documentCancel);
/** What the last document write had to say; `data-tone` is which mood. */
export const DOCUMENT_SAID = selector(TESTID.documentSaid);
/** The explicit "overwrite anyway" after a conflict refusal. */
export const DOCUMENT_OVERWRITE = selector(TESTID.documentOverwrite);
/** The notice, while the editor is open, that the file moved on disk. */
export const DOCUMENT_DRIFTED = selector(TESTID.documentDrifted);
/** The two sidebar path boxes — a new outline's and a new document's — are
 *  reached through the client's own table (`file/making.ts`) rather than
 *  through constants here: the steps that drive them are one pair over the
 *  KIND (`olai-plugin-files`’ `e2e/steps/new_file_steps.ts`), so a selector per kind spelled
 *  in this file would be the copy that pair exists to delete. */
/** A document's table of contents, above its body. A `<details>`: whether it is
 *  open is the element's own state. */
export const TOC = selector(TESTID.toc);
/** One line of it — a link to a heading in the same page. */
export const TOC_LINK = selector(TESTID.tocLink);
/** Its summary — the count in words, and what a pointer presses to open it. */
export const DOCUMENT_REFERRERS_SUMMARY = selector(TESTID.documentReferrersSummary);
/** One row of that list. */
export const DOCUMENT_REFERRER = selector(TESTID.documentReferrer);
