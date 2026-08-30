/**
 * WHAT IS WRONG WITH THIS DIRECTORY — the reading, without the drawing.
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
 * ## ONE VALUE, TWO ARMS — and the arms are not a product of two facts
 *
 * There are two different things that can be wrong with a served directory, and
 * they are two SENTENCES rather than two degrees of one:
 *
 *   - `files` — some of its outlines are broken. Since the per-file ruling
 *     (2026-08-29) that costs the reader those files and nothing else, so every
 *     page under this banner is LIVE and the banner is a signpost. It rides on
 *     the files themselves, which is the same `broken` entry each file's own
 *     page draws — nothing is re-partitioned on the way here, so the count in
 *     the summary and the rows on the page it names are one list read twice.
 *   - `gone` — the directory could not be READ. There are no files to name
 *     then, because there is no listing; what is on screen is from before it
 *     went away, and it comes off the errors cell.
 *
 * THE SECOND OUTRANKS THE FIRST, and that is why this is a discriminated value
 * rather than a pair of props. The broken map a tab is holding is a fold of
 * frames the server sent while it could still read the directory — so over a
 * directory that has gone away those entries are the last thing that was true,
 * and naming them would be telling a reader to go and fix files nobody can
 * currently see. That precedence was arm ORDER inside the component and a
 * second copy of the same condition at its one call site (`../pane/Panes.tsx`
 * asked `broken.size > 0 || !isClean(verdict)` to decide whether to draw at
 * all). It is resolved once, here, and the component is handed the answer: it
 * has no way to draw the per-file face over a directory that went away, because
 * on that arm there is no per-file face to draw.
 */

import {
  type BrokenFile,
  byPath,
  type FileState,
  isClean,
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
 * What is wrong with the served directory, as one value — or `null` when
 * nothing is.
 *
 * Both arms carry the same bounded face, which is what lets the component draw
 * one list of lines whichever sentence it is saying; what differs is the
 * sentence, and whether a line names a page somebody can open.
 */
export type Trouble =
  | { readonly kind: "files"; readonly face: Summary }
  | { readonly kind: "gone"; readonly face: Summary }

/**
 * The one reading, off the two things a tab holds: the files it knows are
 * broken, and what the server says about the directory itself.
 *
 * IN PATH ORDER, sorted here rather than taken as it comes: the map is keyed by
 * the order heads arrived in — a delta frame, not a listing — and the banner
 * reads down the directory the way the sidebar beside it does. It is the set's
 * own comparator (`@olai/format`'s `byPath`), which is the one the sidebar and
 * the server's listing already use.
 *
 * WHAT DECIDES `gone` is the verdict's own face rather than a code compared
 * here, so the two cannot drift: one file in the `unreadable` state is enough,
 * because a set nothing could read is a set nothing could validate either, and
 * anything else is downstream of it.
 */
export const troubleIn = (
  broken: ReadonlyMap<string, BrokenFile>,
  verdict: Verdict,
): Trouble | null => {
  if (!isClean(verdict)) {
    const face = summary(verdict, BANNER_FILES)
    if (face.files.some((one) => one.state === "unreadable")) return { kind: "gone", face }
  }
  if (broken.size === 0) return null
  const files = [...broken.values()].sort((one, other) => byPath(one.file, other.file))
  return { kind: "files", face: summaryOf(files, BANNER_FILES) }
}

/**
 * What is the matter with one file, in the voice a reader needs.
 *
 * The WORD is the format's ({@link FileState}) and the sentence is this
 * surface's, which is the same split the banner's two arms keep: a directory
 * that could not be READ has nothing wrong with its files, and telling somebody
 * whose mount went away to go and fix their outlines is worse than the silence
 * this banner replaced.
 */
export const SAID: Record<FileState, string> = {
  unreadable: "could not be read",
  unparsed: "has lines that do not parse",
  invalid: "says something the set cannot hold",
}
