/**
 * WHAT THE LAST-GOOD BANNER DRAWS — the reading, without the drawing.
 *
 * `./Banner.tsx` is the markup; this is the two decisions inside it, put where
 * a test can ask them. The banner is the surface `last-good-banner-flood`
 * happened on — it is drawn over EVERY page in the app, and it used to inline
 * the full row enumeration, so one outline failing typed validation put 135
 * rows above every open document — and the fix has two halves that live in
 * different places:
 *
 *   - the BOUND is the format's ({@link summary}): a verdict's bounded face
 *     carries states and counts and has no way to carry a row, so no surface
 *     drawing it can flood;
 *   - the CLAMP is this file's, and it is a knob rather than a receptacle (the
 *     debate's finding 5). How many of a bounded thing to show is a question
 *     about this banner and nobody else's surface.
 */

import { type FileState, type Summary, summary, type Verdict } from "@olai/format"

/**
 * How many broken files the banner names before it counts the rest.
 *
 * Enough that the ordinary case — one file somebody is in the middle of
 * editing — is never a tail count; small enough that a directory-wide breakage
 * is still a banner rather than a page.
 */
export const BANNER_FILES = 5

/** What the banner shows, off the verdict the errors cell carries. */
export const bannerFace = (verdict: Verdict): Summary => summary(verdict, BANNER_FILES)

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
 * WHY the tree below is old — which is not always the same reason.
 *
 * Read off the verdict's own faces, so the two cannot drift: one file in the
 * `unreadable` state is enough, because a set nothing could read is a set
 * nothing could validate either, and anything else is downstream of it.
 */
export const wentAway = (face: Summary): boolean =>
  face.files.some((one) => one.state === "unreadable")
