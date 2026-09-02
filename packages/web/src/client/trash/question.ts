/**
 * WHAT THE TRASH ASKS BEFORE IT DOES ANYTHING — the two questions, in one
 * place, because they are the two halves of one promise.
 *
 * {@link trashQuestion} is asked on the way IN — one sentence, whichever
 * door it was chosen from — and it promises a bin somebody can open.
 * {@link emptyQuestion} is asked when somebody stops wanting the bin, and it is
 * the only sentence in this app about a write that destroys. They are beside
 * each other so the second cannot drift out of the voice the first set: a
 * reader who was told "the Trash is where to put it back" is owed, in the same
 * words, what it means when the Trash goes.
 *
 * The human's ruling (2026-08-12) was about the TRASH, not about a menu: a
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

export const trashQuestion = (
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

/**
 * WHAT EMPTYING THE TRASH ASKS — the other sentence this module owns, and the
 * only one in the app about a write that DESTROYS.
 *
 * It is here beside {@link trashQuestion} because the two are one promise
 * read in both directions: that one says the bin is where to put a row back,
 * and this one is what happens when somebody stops wanting the bin. A reader
 * who agreed to the first is owed the second in the same voice.
 *
 * THREE THINGS IT HAS TO SAY, and it says exactly those:
 *
 *   - HOW MANY rows go. Counted over the SET — every record in `_olai/Trash.org`
 *     — and never over the rows this page is drawing, for
 *     `../menu/subtree.ts`'s reason one page along: a filter narrows what is on
 *     screen, and a sentence that counted the picture would understate the
 *     write. The trash's own signpost titles are records and are counted,
 *     which is right twice over: they are rows a reader can see on this page,
 *     and they are records the write deletes;
 *   - THAT NOTHING IN OLAI PUTS THEM BACK. Not "are you sure" — the whole of
 *     what makes this different from `Move to Trash` is that there is no bin
 *     behind it, and a confirm that did not say so would be the one place this
 *     app hid a consequence;
 *   - AND EXACTLY WHAT DOES SURVIVE, which is the sentence that took the most
 *     care to get honest. The records leave the trash through the same gate
 *     and the same commit door as every other write, so git holds them to
 *     precisely the extent git had already recorded them — and no further. It
 *     is phrased that way rather than as "git still has them" on purpose: a
 *     directory with no repository, one served `--no-commit`, or one whose
 *     trash has been waiting uncommitted since the row was put away all have
 *     the same true answer under this wording and would be lied to by the
 *     shorter one. Nothing here reads the git state to decide — a claim that
 *     is true in every case does not need a branch, and a confirm that changed
 *     its promise depending on a cell it had to subscribe to would be a second
 *     reading of the repository beside the header's.
 */
export const emptyQuestion = (
  /** How many records the write deletes — every record in `_olai/Trash.org`
   *  (`../page.ts` holds which files those are). */
  count: number,
): string => {
  const one = count === 1
  // The agreement above the sentence rather than inside it, which is what lets
  // the sentence itself be read as the thing a person is about to agree to —
  // the same arrangement the refusal it may meet afterwards keeps
  // (`@olai/ops`' `plan.ts`).
  const rows = one ? "the one row" : `all ${count} rows`
  const it = one ? "it" : "them"
  const leave = one ? "record leaves" : "records leave"
  return `Permanently delete ${rows} in the Trash? Nothing in olai puts ${it} ` +
    `back — the ${leave} the trash the way every other write does, so what ` +
    `survives is whatever git has already recorded.`
}
