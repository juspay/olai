/**
 * The arithmetic of an outline's LANDING ACT — DOMless, so the rules about
 * which row an arrival lands on and which folds stand in its way are answerable
 * without a browser.
 *
 * The act itself is `./OutlinePage.tsx`'s face work beside the reading it
 * performs: the address said `/File.olai#id`, the router minted the landing
 * (`../landing.ts`), and the face owes its pane the row — selected with the
 * accent `./focus.ts` owns, on screen, exactly once.
 *
 * What is here is the half of that act that is a question about VALUES:
 *
 *   - **which chain of rows leads to the node.** A row on a drawn page is a
 *     place (`Row.key`), and the row an address asks about is the first —
 *     depth-first — that answers the id, mirror or not: each of them wears
 *     the accent (`../focus.ts`'s `data-focused` is matched the same way), so
 *     the act needs only one to aim at. 'Answers' is two questions, and both
 *     are asked because the id an address spells may name a PLACEMENT —
 *     `read_node` answers `mirrors` with placement ids and an agent citing a
 *     row naturally spells one: a row answers an id it SHOWS, and a mirror
 *     row ALSO answers the id it IS — its own record, the more specific of
 *     the two names when the address points at the placement itself. When the
 *     id is a placement this page does not draw, the rows cannot resolve it
 *     (a placement's own row is the only place the target is spelled), so the
 *     act asks the set, the way the chat panel's press on the same id already
 *     does — and the depth-first rule then answers for the target exactly as
 *     if the address had spelled it all along.
 *   - **which folds stand between the reader and that row**, spelled as
 *     `./rows.ts`'s `Fold`s — the exact write the act then makes in the tree's
 *     own expand vocabulary (`./memory.ts`'s `setFolded`, the verb a triangle
 *     press is), which is how the landing keeps the address's promise instead
 *     of naming a row nobody can see.
 *
 * WHY EXPAND RATHER THAN POINT AT THE NEAREST VISIBLE ANCESTOR is answered in
 * the act's terms rather than by preference. The row the address asks for IS
 * the node: `show this node` is the reference's title, and lighting up some
 * other row — its ancestor — is the accent saying "this is the row" about a
 * row that is not. And the reading precedent says the same sentence from the
 * other end: a FILTER suspends folds precisely because a collapse may not hide
 * the row the query was typed to find (`./reading.ts`). The filter achieves
 * that without writing, because it owns the reading; a landing does not — its
 * span is one arrival on an address the reader was handed — so it spends the
 * memory's own write: the same `setFolded`, the same per-file, per-browser
 * bookkeeping a triangle press files. The fold then stays open, as any
 * unfold does, which is also fair: the reader asked to LOOK at what is under
 * it, and closing it again is one triangle.
 *
 * THE OTHER WAYS A ROW CAN BE ABSENT: one of them is not an absence at all
 * any more and the rest keep the old sentence. A row whose PLACE the reading
 * holds and this page's DONE PICK hides is SHOWN to the landing — {@link aim}'s
 * reveal arm, the reveal being the pick's own mechanism spent for the visit
 * rather than the pick changed (`../settings/done.ts`): the same courtesy the
 * fold half pays, because a row the pick hides is exactly as present as a row
 * a fold hides — in the READING — and a landing whose answer depended on how
 * the reader reads would be a link that works for one of them. What the
 * reveal never is is the pick's word: nothing is stored, the flip's strip
 * and its `·` stand untouched, and the reveal dies with the page it was
 * owed on — the fold half SPENDS the memory's write (a fold is the reader's
 * own case-by-case memory, and closing it again is one triangle), where the
 * pick is the reader's STANDING claim about the page, and a landing minting
 * that claim for one arrival would outlive the visit it was for. What the
 * reveal also never covers is a FILTER's prune: while a query is typed the
 * reader's question is the page, and the act writes nothing over it — the
 * same discipline the fold half already keeps (`./reading.ts`).
 *
 * The remaining ways keep the document arm's own sentence: NOTHING FOUND IS
 * NOTHING DONE — a `.md` whose heading was renamed behaves exactly so. The
 * id's row is in no file this directory holds any more — or the filter's,
 * above — and in each case the page the address opened is whole. What has
 * changed hands is the SILENCE: nothing done used to be nothing said, which
 * made a dead link indistinguishable from a working one (the human's RCA
 * ruling, 2026-08-29 — a real one landed nowhere, and only its author could
 * tell). So the act says the miss out loud, in the same alarm voice every
 * refused act in this client speaks
 * ({@link missedSays}), once the set has answered and confirmed the page
 * really draws nothing by that name — never before, because an alarm about a
 * row that is one revision short of arriving is a lie for the length of the
 * lag. The half that stays quiet is the chat panel's press itself, which
 * never even routes there: a node the set no longer declares keeps the reader
 * on the page they had (`../focus.ts`).
 */

import { type Row, shownRecord } from "@olai/format"

import { type Fold, foldOf } from "./rows.ts"

/**
 * The rows from a root of `rows` down to the row that ANSWERS `id`, or
 * `undefined` when this page draws no such row.
 *
 * A row answers an id it SHOWS — or, being a mirror, an id it IS: the
 * placement's own record is a name for the node too ({@link answer}), which
 * is the half that lands a fragment written from `read_node`'s `mirrors`. The
 * two halves can never disagree about one id, because ids are unique across
 * the whole served set: a placement's own id is never some other record's
 * shown id.
 *
 * FIRST MATCH, depth-first: a node may BE any number of places on one page
 * (mirrors), every one of them wears the accent, and the scroll at the end of
 * the act aims at the first the DOM holds in document order — which is what
 * depth-first answers for it.
 *
 * Folds are not a question this function takes, on purpose: `rows` is the
 * reading, which holds a row under a collapsed ancestor as surely as any
 * other (the memory prunes the DRAW, `../Tree.tsx`), so the row an address
 * named is findable exactly where `shutAlong` can name what hides it.
 *
 * The act's own business now: {@link aim} is the question the act asks, and
 * this is its local half — nothing on a page-wide landing needs the page's
 * answer without the set's folded in beside it.
 */
const chainTo = (
  rows: ReadonlyArray<Row>,
  id: string,
): ReadonlyArray<Row> | undefined => {
  const descend = (row: Row, at: ReadonlyArray<Row>): ReadonlyArray<Row> | undefined => {
    const chain = [...at, row]
    if (answer(row, id)) return chain
    for (const child of row.children) {
      const down = descend(child, chain)
      if (down !== undefined) return down
    }
    return undefined
  }
  for (const row of rows) {
    const found = descend(row, [])
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * Whether ONE row is where `id` lands: it shows the node, or it IS the
 * placement the id names — a mirror's own record being the row an agent
 * means when it cites the placement id `read_node` answered it with. The
 * same rule the chat press settles for a span of the same words, one level
 * up (`../chat/refs.ts`'s `nodeNamedBy`): an id may MEAN the node at the end
 * of a mirror chain, and what a reader can be shown is a row. Where the two
 * differ is the second guess's subject: a span has no page to ask, so it is
 * pre-resolved; an address opens one, and a page that DOES draw the placement
 * has the better landing of the two — the mirror's own row, the place the id
 * actually names.
 *
 * `shownRecord`'s answer for a row that shows nothing — a dangling or cyclic
 * mirror — is the row's own record, so a fragment spelling THAT placement id
 * lands on the row that fails to draw its node, which is the most honest
 * landing the page can offer for it.
 */
const answer = (row: Row, id: string): boolean =>
  shownRecord(row).node.id === id ||
  (row.kind === "mirror" && row.at.node.id === id)

/**
 * What the landing answers once the id is also asked of the SET — the turn
 * `chainTo` cannot make, because a placement the page does not draw keeps the
 * id-to-target link in a row of some OTHER file. `named` is that answer, by
 * the chat press's own door: the node the set says the id names, `null` when
 * the set declares nothing by it, and `undefined` while the answer is
 * outstanding (`../OutlinePage.tsx` reads it off `../declared.ts`'s
 * `told`, the tab's one door for the question — which resolves a placement
 * to the regular node at the end of its chain).
 *
 * `whole` is the page's rows BEFORE the pick prunes them — handed in exactly
 * when the reveal MAY be asked (the pick hides done on this page and no
 * filter is typing over it; both halves are the caller's to gate, and
 * `undefined` keeps the reveal from being a question this function takes:
 * under a filter the reader's own query is what took the row and the act
 * writes nothing over it).
 *
 *   - the page's rows answer the id as spelled — {@link chainTo}'s question,
 *     placement half included — and no set is consulted at all;
 *   - 'ask': the rows said nothing and the set has not answered either —
 *     conclude NEITHER way: answering miss here is how a row one revision
 *     from arriving gets an alarm drawn about it;
 *   - the set answered, and what it answered IS drawn here: the target's
 *     chain, by `chainTo`'s own first-match rule — the landing one file over
 *     pays exactly as if the address had spelled the target;
 *   - 'reveal': the drawn rows said nothing but the WHOLE page answers — the
 *     row EXISTS here and the done pick is what hides it. The chain is the
 *     reading's own shape of it, root-down as ever (the id as spelled asked
 *     first, the set's resolution after — `settled`, the one probe both
 *     remaining scopes ask): what the act owes the view is the chain's
 *     PLACES kept out of the pick's sweep (`../settings/done.ts` spends
 *     that), after which the next pass of the act answers 'chain' the
 *     ordinary way;
 *   - 'miss': the set answered and it changes nothing this page can draw — a
 *     CERTAIN miss, in two honestly-different degrees, and the act owes
 *     each its own sentence ({@link missedSays}): `null` when the set
 *     itself declares nothing by the name, the target when the set declares
 *     it and no reading of this page draws a row of it — the filter's words
 *     pruning it, or the row living in some other file altogether.
 */
export const aim = (
  rows: ReadonlyArray<Row>,
  id: string,
  named: (asked: string) => string | null | undefined,
  whole?: ReadonlyArray<Row>,
): Aim => {
  const chain = chainTo(rows, id)
  if (chain !== undefined) return { kind: "chain", chain }
  const target = named(id)
  if (target === undefined) return { kind: "ask" }
  // THE SET HAS SPOKEN — and from here one probe asks both remaining scopes
  // the same question: where the settled node's chain lies. The drawn pool's
  // answer pays the landing; the whole page's owes the reveal, of the same
  // shape.
  const settled = (pool: ReadonlyArray<Row>): ReadonlyArray<Row> | undefined =>
    target === null ? undefined : chainTo(pool, target)
  const resolved = settled(rows)
  if (resolved !== undefined) return { kind: "chain", chain: resolved }
  if (whole !== undefined) {
    const hidden = chainTo(whole, id) ?? settled(whole)
    if (hidden !== undefined) return { kind: "reveal", chain: hidden }
  }
  return { kind: "miss", target }
}

/** The landing's answers, in {@link aim}'s own words. */
export type Aim =
  /** The chain the act owes its pane. */
  | { readonly kind: "chain"; readonly chain: ReadonlyArray<Row> }
  /** Nothing to do yet: the set has not answered the id. */
  | { readonly kind: "ask" }
  /** The row is here and the done pick hides it: the chain as the WHOLE page
   *  holds it, whose places the act asks the pick to spare — the landing
   *  then lands on it in the ordinary way, one pass later. */
  | { readonly kind: "reveal"; readonly chain: ReadonlyArray<Row> }
  /** Nothing this page can answer: the miss, to be said. The SET's own
   *  answer for the id rides as `target` — `null` for a name nothing
   *  declares, the very node for an id the set knows and this page merely
   *  does not draw — which is the half of certain it is, and the sentence
   *  ({@link missedSays}) is one of two: the set's answer is what a more
   *  honest wording answers. */
  | { readonly kind: "miss"; readonly target: string | null }

/**
 * What a CERTAIN miss SAYS — the id as it was asked, em-dashed to the one
 * reason a landing can have for doing nothing. The pair is
 * `../refusals.tsx`'s own shape (the token as asked, then why), in the alarm
 * mood `../SaidLine.tsx` draws it in, for that file's reason: a miss IS why
 * nothing happened, and a reader not told it believes the link worked.
 *
 * One ACT, TWO words, by which half of certain it is
 * ({@link aim}'s resolution): the id the set knows nothing of says so —
 * "nothing by that name is drawn on this page" — and the id the set DOES
 * declare, which this page merely draws no row for (a hidden branch the
 * reader's own FILTER pruned, or another file altogether — a row the done
 * pick hides is REVEALED now, never missed), answers "what it names
 * is not drawn on this page": a hidden live row must not be indistinguishable
 * from a dead link, in EITHER direction — which is the review's ruling on
 * the symmetric half of the silence this contract closed.
 *
 * The id IS quoted — unlike `../document/Hypertext.tsx`'s dropped click,
 * which may not echo a string grown inside somebody else's frame: a fragment
 * is text the reader's own address bar is already showing, in the same
 * register `../NotFound.tsx` quotes the id of a dead permalink in, and a said
 * line is a text node — nothing lands in markup.
 */
export const missedSays = (id: string, target: string | null): string =>
  target === null
    ? `${id} — nothing by that name is drawn on this page`
    : `${id} — what it names is not drawn on this page`

/**
 * What a FAILED ASK says — {@link missedSays}'s sibling, for the landing
 * whose answer never arrived: the id as it was asked, and why the page
 * cannot yet answer for it. The distinction is load-bearing: this line
 * says the ask failed, NOT that nothing by that name exists — a failed
 * ask on a page that DOES draw the placement's target would otherwise
 * lie in the miss's own words.
 */
export const failedSays = (id: string): string =>
  `${id} — the set could not be asked what it names`

/**
 * Which of the chain's own ANCESTORS are shut — the write the landing act
 * owes the reader's view, as `Fold`s.
 *
 * The last row of the chain is exempt: folding IT hides its children, never
 * the row itself. A mirror row's fold is the fold of the node it SHOWS
 * (`./rows.ts`'s rule), which is why the answer asks `foldOf` rather than
 * where the row happens to stand, and why the walk dedupes: a mirror inside
 * the chain and its target would file the same open twice.
 */
export const shutAlong = (
  chain: ReadonlyArray<Row>,
  folded: ReadonlySet<string>,
): ReadonlyArray<Fold> => {
  const seen = new Set<string>()
  const out: Fold[] = []
  for (const row of chain.slice(0, -1)) {
    const fold = foldOf(row)
    if (!folded.has(fold.id) || seen.has(fold.id)) continue
    seen.add(fold.id)
    out.push(fold)
  }
  return out
}
