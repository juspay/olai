/**
 * WHICH of the served directory's files an `@` query means.
 *
 * ## Nothing is walked here, and no walk was added anywhere else
 *
 * The paths are the ones this tab is ALREADY holding: the `outlines`
 * collection's keys and the `documents` collection's key set, which is exactly
 * what the sidebar's file tree draws (`../served.tsx` assembles the two). So
 * the completion offers what the server serves, with the server's own rules
 * about what that is already applied — the store's walk prunes dot-directories
 * and `node_modules` (`@olai/store`'s `pruned`) and admits only the kinds the
 * format claims (`@olai/format`'s registry). A second enumeration in the
 * browser, or a new procedure on the wire to ask "what files are there", would
 * be a second answer to a question the directory has already answered on a
 * subscription every open tab holds.
 *
 * What that costs on a large vault is the honest part: nothing per keystroke
 * except the pass below, and nothing per session at all — the key set is on
 * the wire whether or not anybody ever types an `@`, because the sidebar needs
 * it.
 *
 * ## Folded once, matched per keystroke
 *
 * `toLowerCase` on every path on every character typed is a throwaway string
 * per file per keystroke, which on a thousand-file vault is exactly the shape
 * that makes a completion feel slow. So the fold happens ONCE PER VERSION of
 * the directory and is kept in a `WeakMap` keyed on the path list itself —
 * `../complete/tags.ts`'s arrangement, for its reason: asking here, only while
 * an `@` is being typed, costs nothing at all on a session that never types
 * one, and the answer for a list nothing holds any more is collectable with
 * the list. A memo in the composer would instead re-fold the whole vault every
 * time a file changed, whether or not anybody ever completes a path.
 *
 * ## A prefix first and a substring second, which is not a score
 *
 * The same order `../complete/tags.ts` argues for, for the same reason: the
 * file somebody is typing towards is nearly always one they have started
 * spelling. The three buckets are the three ways a path can be started —
 * its NAME (`pal` → `notes/palette.md`), its PATH (`notes/pal` → the same
 * file), and neither, where the query is merely somewhere inside it. There is
 * no fuzzy subsequence match and no weighting: what a query means has to be
 * something a person can predict from the query alone.
 *
 * An EMPTY query answers with the whole directory (capped), which is what
 * makes a bare `@` a way of seeing what this vault even holds.
 */

/** How many rows the list offers. A completion is a shortlist — the same eight
 *  the row editor's widgets show (`../complete/tags.ts`). */
const LIMIT = 8

/** One served path, ready to be matched: its own spelling, and the two folded
 *  forms the buckets below ask about. Both are computed once, when the
 *  directory changes, rather than per keystroke. */
export interface Folded {
  /** Root-relative, `/`-spelled — what a chosen row writes into the message. */
  readonly path: string
  /** The whole path, folded for case. */
  readonly whole: string
  /** The last segment, folded for case — what `pal` is meant to match. */
  readonly name: string
}

const seen = new WeakMap<ReadonlyArray<string>, ReadonlyArray<Folded>>()

export const folded = (paths: ReadonlyArray<string>): ReadonlyArray<Folded> => {
  const before = seen.get(paths)
  if (before !== undefined) return before
  const now = paths.map((path) => {
    const whole = path.toLowerCase()
    return { path, whole, name: whole.slice(whole.lastIndexOf("/") + 1) }
  })
  seen.set(paths, now)
  return now
}

/**
 * The files `query` could be the start of, best first.
 *
 * ONE PASS over the directory, with the three buckets filled as it goes rather
 * than filtered three times, and an early exit once the best bucket alone can
 * fill the list: a query typed towards a real file finds its answer without
 * reading the rest of the vault.
 */
export const matchFiles = (
  files: ReadonlyArray<Folded>,
  query: string,
): ReadonlyArray<string> => {
  const wanted = query.toLowerCase()
  const named: Array<string> = []
  const pathed: Array<string> = []
  const buried: Array<string> = []
  for (const file of files) {
    if (wanted === "" || file.name.startsWith(wanted)) named.push(file.path)
    else if (file.whole.startsWith(wanted)) pathed.push(file.path)
    else if (file.whole.includes(wanted)) buried.push(file.path)
    if (named.length >= LIMIT) break
  }
  return [...named, ...pathed, ...buried].slice(0, LIMIT)
}

/** The file's own name — the row's label, because a directory of daily notes
 *  is a column of identical prefixes otherwise. */
export const nameOf = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1)

/** Where it sits, or `""` for a file at the root — the row's hint, so two
 *  files with one name are told apart without reading a wrapped path. */
export const dirOf = (path: string): string => {
  const cut = path.lastIndexOf("/")
  return cut === -1 ? "" : path.slice(0, cut)
}
