/**
 * WHICH of the served directory's files a query means.
 *
 * ## One matcher, one caller left
 *
 * The chat composer's `@` list, where a word after the sigil names a file to
 * put in a message (`../chat/naming.ts`). It had a second — the DOCUMENT ROWS
 * the ⌘K palette and the header box drew — and that one left when a search
 * started answering with documents (`@olai/format`'s `matchingDocuments`): the
 * two doors ride the server's one index now, which matches a document's title,
 * path, tags and PROSE where this matches a path.
 *
 * WHAT IS LEFT is a live question about that split, and it is written down
 * rather than left to be discovered. The `@` list still answers "which served
 * paths is somebody typing towards" with a prefix rule where the palette
 * answers it with a weighted score, which is exactly the two-answers-to-one-
 * question this header used to forbid. It is not fixed here because fixing it
 * is a behaviour change with a real cost: this list is instant and offline
 * (the tab already holds the paths), and the index is a debounce and a round
 * trip away — and it would need the index to answer about OUTLINES too, which
 * is a ruling the design has not made
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/first-class-documents.md).
 *
 * It lives under `file/` rather than inside its caller for the reason
 * `../search/nodes.ts` lives in `search/` rather than in `palette/`: this
 * directory is where the client keeps what is true of a served FILE — the
 * glyph it is drawn with (`./icons.tsx`), the two a person can make
 * (`./making.ts`) — and a matcher over paths is one more of those.
 *
 * WHICH paths are offered stays the caller's: the `@` list passes every served
 * path (the section below says why the archives are among them).
 *
 * ## Nothing is walked here, and no walk was added anywhere else
 *
 * The paths are the ones this tab is ALREADY holding: the `outlines`
 * collection's keys and the `documents` collection's key set, which is exactly
 * what the sidebar's file tree draws (`../served.tsx` assembles the two). So
 * a caller offers what the server serves, with the server's own rules about
 * what that is already applied — the store's walk prunes dot-directories
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
 * that makes a completion feel slow. So the fold is kept in a `WeakMap` keyed
 * on the path list itself — `@olai/format`'s `vocabulary.ts` keeps the same
 * arrangement one package down, for its reason: asking only while somebody is
 * typing a query costs nothing at all on a session that never types one, and
 * the answer for a list nothing holds any more is collectable with the list. A memo in the composer would
 * instead re-fold the whole vault every time a file changed, whether or not
 * anybody ever completes a path.
 *
 * Keyed on the list means once per LIST, which is once per version of the
 * directory only because the list is made to work that way: `../served.tsx`
 * compares membership before publishing a new array, so a key frame that
 * re-sent the same paths does not mint one. Without that this would be once
 * per frame, which is a cache that misses exactly when it is asked.
 *
 * ## The archives ARE in the `@` list, and that is a decision — not an oversight
 *
 * An `_olai/Trash.olai` is a file the directory serves, so it is in the list the
 * composer passes; the sidebar hides it behind the Trash and that does not
 * (docs/chat.md). What a message may NAME is a different question from what a
 * reader opens, and "what did we put away last month" is a fair thing to ask an
 * agent.
 *
 * It is worth saying out loud because the other two lists over the same set go
 * the other way, and the three are one `grep` apart: the tag vocabulary
 * (`@olai/format`'s `vocabulary.ts`) stopped counting archived nodes under the 2026-08-17
 * ruling, and the NODE half of the `@` list (`../chat/nodes.ts`) offers none
 * unless the query says `is:trashed`. None of the three should be
 * "harmonized" into the others. The tag list ranks the vocabulary of the set a
 * reader is LOOKING at; the node list names a row of a reading, where what was
 * put away is drawn on the Trash and nowhere else; and this one completes a
 * PATH somebody is about to name in a sentence — a file is bytes an agent will
 * open, an archive is a file, and a path half-remembered reaches the agent as a
 * file that is not there.
 *
 * ## A prefix first and a substring second, which is not a score
 *
 * The same order `@olai/format`'s `vocabulary.ts` argues for, for the same reason: the
 * file somebody is typing towards is nearly always one they have started
 * spelling. The three buckets are the three ways a path can be started —
 * its NAME (`pal` → `notes/palette.md`), its PATH (`notes/pal` → the same
 * file), and neither, where the query is merely somewhere inside it. There is
 * no fuzzy subsequence match and no weighting: what a query means has to be
 * something a person can predict from the query alone.
 *
 * An EMPTY query answers with the whole list (capped), which is what makes a
 * bare `@` a way of seeing what this vault even holds. A door with nothing to
 * show for an empty box does not ask.
 */

/** One served path, ready to be matched: its own spelling, and the two folded
 *  forms the buckets below ask about. Both are computed once, when the
 *  directory changes, rather than per keystroke. */
export interface Folded {
  /** Root-relative, `/`-spelled — what a chosen row writes into a message, and
   *  what a document row opens. */
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
 * The files `query` could be the start of, best first, at most `limit` of them.
 *
 * ONE PASS over the directory, with the three buckets filled as it goes rather
 * than filtered three times, and an early exit once the best bucket alone can
 * fill the list: a query typed towards a real file finds its answer without
 * reading the rest of the vault.
 *
 * IT SELECTS, and does not project: what comes back is the entries handed in,
 * not their paths, so a caller that folded something ALONGSIDE the path keeps
 * it — the palette folds each document's KIND in, which is what its row's
 * glyph is, and the `@` list reads `.path` and
 * ignores the rest. Answering with paths cost that caller the kind on every
 * keystroke and gave it back only as a re-derivation with an impossible
 * `null` to guard: a fact this pass already knew, thrown away and looked up
 * again. The `@` list is unchanged by it — its rows were always the path.
 *
 * THE CAP IS THE CALLER'S because the list this fills is not the same list at
 * every door: in the `@` popup this half and the node half divide eight rows
 * between them ({@link ../chat/naming.ts}), and in the palette the document
 * rows are a block of their own under the commands
 * (the palette had one, while it matched paths for itself). A cap kept here
 * would be a second opinion
 * about a number each of those already owns. The `@` half is asked for the
 * WHOLE list rather than for its share — the early exit above is why: a pass
 * that stopped at three could not be asked for eight afterwards, when the
 * other half turned out to have nothing to offer.
 */
export const matchFiles = <File extends Folded>(
  files: ReadonlyArray<File>,
  query: string,
  limit: number,
): ReadonlyArray<File> => {
  const wanted = query.toLowerCase()
  const named: Array<File> = []
  const pathed: Array<File> = []
  const buried: Array<File> = []
  for (const file of files) {
    // NO BUCKET GROWS PAST THE CAP, because nothing past it can be drawn: the
    // answer is the first `limit` of the three read in order, so a ninth
    // path-match is dead the moment it is pushed. The WALK still goes on —
    // a name match further down the vault outranks everything held here, which
    // is why only `named` filling ends it — but a query with no name match at
    // all used to build two vault-sized arrays per keystroke to throw all but
    // eight of them away, and there are two doors typing into this now.
    if (wanted === "" || file.name.startsWith(wanted)) named.push(file)
    else if (file.whole.startsWith(wanted)) {
      if (pathed.length < limit) pathed.push(file)
    } else if (file.whole.includes(wanted) && buried.length < limit) {
      buried.push(file)
    }
    if (named.length >= limit) break
  }
  return [...named, ...pathed, ...buried].slice(0, limit)
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
