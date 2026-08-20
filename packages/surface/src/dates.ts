/**
 * The directory's DATES, as the wire speaks them — the sidebar's two standing
 * questions.
 *
 * The month in the sidebar draws a dot under every day that has something on
 * it, and the entry above it wears how much is owed. Both were walks over the
 * browser's own copy of the whole set until `vault-in-browser`'s PR 4; both are
 * now asked of the server, which is where the set is (`docs/brainstorming/
 * vault-in-browser.md` §3's Sidebar row, §6's item 4).
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
 * for the length of this sequence is honest and bounded: they are the SAME
 * function over the SAME set (`owedOf` over `agendaOf`), so the most they can
 * differ by is a frame, which is the skew the design doc's cross-file
 * consistency paragraph already accounts for.
 *
 * The DAY-NOTE marks the same grid draws are not here either, and never will
 * be: a day's note is a document NAMED for the date, so the question is asked
 * of the key set the sidebar's file tree already holds — paths, which the
 * design keeps in the browser because they are key-set-sized (`dailyNoteDays`
 * over `documents.keys`). A dot is a question about the vault; a note mark is
 * a question about a filename.
 */

export {
  /** Which days of a month have something on them, and the month asked for.
   *  `sameDated` is the answer's own equivalence — what keeps the server from
   *  sending a frame to a tab whose dots did not move. */
  DatedAnswer,
  DatedRequest,
  /** The two numbers the directory's own entry wears, and the day they are
   *  counted against — the reader's, never the server's. */
  Owed,
  OwedRequest,
  sameDated,
  sameOwed,
} from "@olai/format"
