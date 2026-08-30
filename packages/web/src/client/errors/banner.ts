/**
 * WHAT THE BROKEN-FILES SUMMARY DRAWS — the reading, without the drawing.
 *
 * `./Banner.tsx` is the markup; this is the decisions inside it, put where a
 * test can ask them. The banner is the surface `last-good-banner-flood`
 * happened on — it is drawn over EVERY page in the app, and it used to inline
 * the full row enumeration, so one outline failing typed validation put 135
 * rows above every open document — and the fix has two halves that live in
 * different places:
 *
 *   - the BOUND is the format's ({@link summaryOf}): a bounded face carries
 *     states and counts and has no way to carry a row, so no surface drawing it
 *     can flood;
 *   - the CLAMP is this file's, and it is a knob rather than a receptacle (the
 *     debate's finding 5). How many of a bounded thing to show is a question
 *     about this banner and nobody else's surface.
 *
 * ## TWO SOURCES, and the ordinary one is the directory
 *
 * Since the per-file ruling (2026-08-29) a broken outline does not stop the set
 * loading, so what is wrong with a served directory rides on the FILES — the
 * `broken` entry on each head, which is the same value that file's own page
 * draws ({@link brokenFace}). Nothing is re-partitioned on the way here, so the
 * count in the summary and the rows on the page it names are one list read
 * twice.
 *
 * The errors CELL is the other source and it says something else entirely: the
 * served directory could not be READ ({@link wentAway}). There are no files to
 * name then — there is no listing — so that face comes off the verdict
 * ({@link summary}) and the sentence over it is a different sentence.
 */

import {
  type BrokenFile,
  byPath,
  type FileState,
  type Summary,
  summary,
  summaryOf,
  type Verdict,
} from "@olai/format"

/**
 * How many broken files the banner names before it counts the rest.
 *
 * Enough that the ordinary case — one file somebody is in the middle of
 * editing — is never a tail count; small enough that a directory-wide breakage
 * is still a banner rather than a page.
 */
export const BANNER_FILES = 5

/**
 * What the banner shows, off the broken files this tab is holding.
 *
 * IN PATH ORDER, sorted here rather than taken as it comes: the map is keyed by
 * the order heads arrived in — a delta frame, not a listing — and the banner
 * reads down the directory the way the sidebar beside it does. It is the set's
 * own comparator (`@olai/format`'s `byPath`), which is the one the sidebar and
 * the server's listing already use.
 */
export const brokenFace = (broken: ReadonlyMap<string, BrokenFile>): Summary =>
  summaryOf(
    [...broken.values()].sort((one, other) => byPath(one.file, other.file)),
    BANNER_FILES,
  )

/** The same face for the OTHER thing that can be wrong — a directory nobody
 *  could read, which has no files to file itself under and arrives on the
 *  errors cell instead. */
export const goneFace = (verdict: Verdict): Summary => summary(verdict, BANNER_FILES)

/**
 * What is the matter with one file, in the voice a reader needs.
 *
 * The WORD is the format's ({@link FileState}) and the sentence is this
 * surface's, which is the same split the banner's lede already keeps: a
 * directory that could not be READ has nothing wrong with its files, and
 * telling somebody whose mount went away to go and fix their outlines is worse
 * than the silence this banner replaced.
 */
export const SAID: Record<FileState, string> = {
  unreadable: "could not be read",
  unparsed: "has lines that do not parse",
  invalid: "says something the set cannot hold",
}

/**
 * WHY the app is missing something — which is not always the same reason.
 *
 * Read off the verdict's own faces, so the two cannot drift: one file in the
 * `unreadable` state is enough, because a set nothing could read is a set
 * nothing could validate either, and anything else is downstream of it.
 */
export const wentAway = (face: Summary): boolean =>
  face.files.some((one) => one.state === "unreadable")
