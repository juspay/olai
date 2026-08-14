/**
 * What a put-away asks before it happens — ONE sentence, whichever door it was
 * chosen from.
 *
 * The human's ruling (2026-08-12) was about the ARCHIVE, not about a menu: a
 * subtree may go to the Trash, with a confirm naming how much goes with it and
 * promising the bin it implies. So the sentence belongs to the Trash rather
 * than to either affordance, and it is here beside the page that opens one.
 *
 * It was written twice for a day — once for the `•••` menu's single row
 * (`../menu/verbs.ts`) and once for a multi-selection's several
 * (`../select/SelectionBar.tsx`) — which is one derivation in two copies: the
 * same op, the same promise, free to drift in wording while both still
 * compiled. What actually differs between the callers is the SUBJECT (a row
 * somebody named, or a count somebody picked), and that is the argument.
 *
 * The agreement — `it` against `them`, `its id` against `their ids` — follows
 * the number of RECORDS the write moves rather than the subject, because that
 * is what the sentence is about. One row with three under it is "they".
 */

/** What is going, as the sentence names it. */
export type Going =
  /** One row, chosen where it is drawn — so it can be named. */
  | { readonly kind: "row"; readonly title: string }
  /** Several, picked — so they are counted. A count of one is still this arm:
   *  a pick of one row was still picked rather than pointed at. */
  | { readonly kind: "rows"; readonly count: number }

export const archiveQuestion = (
  going: Going,
  /** How many rows hang UNDER the ones going — not counting them. A fact about
   *  the set rather than about the tree on screen (`../menu/subtree.ts`). */
  under: number,
): string => {
  const named = going.kind === "row"
    ? `“${going.title}”`
    : going.count === 1
    ? "this row"
    : `these ${going.count} rows`
  const going_ = going.kind === "row" ? 1 : going.count
  const one = going_ === 1 && under === 0
  const beneath = under === 0
    ? ""
    : ` and the ${under === 1 ? "row" : `${under} rows`} under ${
      going_ === 1 ? "it" : "them"
    }`
  return `Move ${named}${beneath} to the Trash? ${
    one ? "It keeps its id" : "They keep their ids"
  }, and the Trash in the sidebar is where to put ${one ? "it" : "them"} back.`
}
