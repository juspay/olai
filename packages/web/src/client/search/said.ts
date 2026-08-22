/**
 * WHAT `/search?q=…` SAYS ABOUT ITS OWN ANSWER — one sentence, in the bar the
 * page's filter box already draws.
 *
 * A DIFFERENT SENTENCE from a narrowed page's, and that is the point rather
 * than an inconsistency. "3 of 41" is arithmetic about a page somebody was
 * already reading: 41 rows, three of them matched. There is no such
 * denominator here — the directory's row count is not a number anybody wants —
 * so what this page can honestly say is what it FOUND: how many nodes, in how
 * many files, and how many documents beside them.
 *
 * `no matches` keeps no denominator for the same reason `no matches of 41` has
 * one: on a page the denominator is the news ("your query emptied it, and here
 * is what it emptied"), and here the news is that the directory holds no
 * answer at all.
 *
 * THE CAP IS SAID OUT LOUD, and this is the one place it is: a query over
 * `EVERYWHERE_LIMIT` draws the limit, and a page drawing two hundred rows while
 * thirteen hundred matched, in silence, is the exact failure this whole arc is
 * about (docs/brainstorming/one-search-box.md). It reads as a number and an
 * instruction, because the fix is another word in the query rather than a
 * second page of results.
 *
 * A FUNCTION rather than lines in the bar, for `../filter/count.ts`'s reason
 * word for word: a sentence assembled in a JSX binding is a sentence no test
 * can ask about.
 */

/**
 * WHAT `/search` DREW — the reading itself, and not four numbers taken off it.
 *
 * Two of the four are LENGTHS (`groups.length` is how many files hold a row,
 * `documents.length` is how many the other half found), and a caller projecting
 * them was a caller that had to know which lengths this sentence counts. That
 * is one derivation living at the call site, which is the first place a second
 * caller gets it subtly wrong. The element types are deliberately opaque:
 * nothing here reads a row.
 */
export interface Everywhere {
  /** How many NODES the query selected in the whole directory — uncapped. */
  readonly matches: number
  /** …and how many of those the page actually drew. Equal to {@link matches}
   *  until the cap bites. */
  readonly drawn: number
  /** One entry per file that holds a drawn match. */
  readonly groups: ReadonlyArray<unknown>
  /** …and the DOCUMENTS beside them — never capped, and counted apart because
   *  a document is not a row of a tree. */
  readonly documents: ReadonlyArray<unknown>
}

/** What one of something is called, so the sentence reads in English rather
 *  than in code. */
const many = (count: number, one: string, more = `${one}es`): string =>
  `${count} ${count === 1 ? one : more}`

export const everywhereLine = (
  { matches, drawn, groups, documents }: Everywhere,
): string => {
  const files = groups.length
  const found = documents.length
  const said = matches === 0
    // No RECORD matched. The clause below still runs, so a query that found only
    // documents reads `no matches · 2 documents` — which is the honest pair
    // rather than a sentence that hides half its answer.
    ? "no matches"
    : drawn < matches
    // THE CAP, named: what is drawn, what was found, and what to do about it.
    ? `${drawn} of ${many(matches, "match")} in ${many(files, "file", "files")} — narrow the query`
    : `${many(matches, "match")} in ${many(files, "file", "files")}`
  // The other half of the directory, counted apart — absent when a query found
  // none, which is the zero rule every count line in this app keeps.
  return found === 0 ? said : `${said} · ${many(found, "document", "documents")}`
}
