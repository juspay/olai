/**
 * The directory's DATES, as the wire speaks them — the sidebar's two standing
 * questions.
 *
 * The month in the sidebar draws a dot under every day that has something on
 * it, and the entry above it wears how much is owed. Both were walks over the
 * browser's own copy of the whole set until `vault-in-browser`'s PR 4; both are
 * now asked of the server, which is where the set is
 * (`https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/vault-in-browser.md` §3's Sidebar row, §6's item 4).
 *
 * ## Why the shapes are `@olai/format`'s, re-exported and not re-declared
 *
 * The same argument `./search.ts` makes, word for word, and for the same
 * reason it had to be made there: one vocabulary on the floor that this spec
 * and the ops layer both stand on, so there is no second spelling to drift. A
 * field added to an ops-side answer once type-checked clean across every
 * package, reached an agent, and was dropped by the wire's own encoder on the
 * way to a browser. `@olai/ops` PRODUCES these values (`Query.dated`,
 * `Query.owed`, over one reading of one snapshot), this spec CARRIES them, the
 * sidebar DRAWS them, and none of the three has to agree with the others by
 * memory.
 *
 * ## What travels, and what deliberately does not
 *
 * The owed member carries the two COUNTS and never the agenda. The three
 * stretches the agenda PAGE lists are a page reading, and every page reading
 * moves in one diff (PR 10, whose law forbids flipping routes one at a time) —
 * so what crosses here is exactly the badge, which is what §3's Sidebar row
 * names. That the page and the badge are then two readings of one directory
 * for the length of this sequence is honest and bounded: they are asked of the
 * SAME REVISION of the same set, so the most they can differ by is a frame,
 * which is the skew the design doc's cross-file consistency paragraph already
 * accounts for.
 *
 * They stopped being the same FUNCTION with `perf-agenda-history-walk`: the
 * badge is `owedNow` over an index the patcher keeps, where it was `owedOf`
 * over the whole agenda assembled and thrown away, because two integers are not
 * worth situating every overdue node in a directory per subscriber per
 * revision. What holds the two spellings to one answer is a differential rather
 * than a shared call (`@olai/format`'s `occasion.test.ts`, `@olai/ops`'
 * `owed.index.test.ts`), which changes nothing that crosses this wire — the
 * member is still the two counts and still nothing else.
 *
 * The DAY-NOTE marks the same grid draws are not here either, and never will
 * be: a day's note is a document NAMED for the date, so the question is asked
 * of the key set the sidebar's file tree already holds — paths, which the
 * design keeps in the browser because they are key-set-sized (`dailyNoteDays`
 * over `documents.keys`). A dot is a question about the vault; a note mark is
 * a question about a filename.
 */

/**
 * THE SHAPES, and not the equivalences beside them. `sameDated` and `sameOwed`
 * are the floor's too, and they do not come through this door: a cell declares
 * its `equals` in the spec (which is why `samePending` is imported by
 * `./index.ts` and re-exported by nobody), and a STREAM does not declare one at
 * all — the server supplies `isEqual` where it binds the member, from the same
 * floor. A name crossing this boundary for nobody is a public API with no
 * caller.
 */
export {
  /** Which days of a month have something on them, and the month asked for. */
  DatedAnswer,
  DatedRequest,
  /** The two numbers the directory's own entry wears, and the day they are
   *  counted against — the reader's, never the server's. */
  Owed,
  OwedRequest,
} from "@olai/format"
