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
 * THE OTHER WAYS A ROW CAN BE ABSENT are deliberately answered the same, and
 * the document arm's own sentence for them is inherited: NOTHING FOUND IS
 * NOTHING DONE — a `.md` whose heading was renamed behaves exactly so. The
 * id lives on under done-hidden, under an active filter that did not select
 * it, or in no file this directory holds any more, and in each case the page
 * the address opened is whole. What has changed hands is the SILENCE: nothing
 * done used to be nothing said, which made a dead link indistinguishable from
 * a working one (the human's RCA ruling, 2026-08-29 — a real one landed
 * nowhere, and only its author could tell). So the act says the miss out
 * loud, in the same alarm voice every refused act in this client speaks
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
 */
export const chainTo = (
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
 * outstanding (`../OutlinePage.tsx` asks `nodes.named`, which resolves a
 * placement to the regular node at the end of its chain).
 *
 *   - the page's rows answer the id as spelled — {@link chainTo}'s question,
 *     placement half included — and no set is consulted at all;
 *   - 'ask': the rows said nothing and the set has not answered either —
 *     conclude NEITHER way: answering miss here is how a row one revision
 *     from arriving gets an alarm drawn about it;
 *   - the set answered, and what it answered IS drawn here: the target's
 *     chain, by `chainTo`'s own first-match rule — the landing one file over
 *     pays exactly as if the address had spelled the target;
 *   - 'miss': the set answered and it changes nothing this page draws — a
 *     CERTAIN miss, and the act owes its one sentence ({@link missedSays}).
 */
export const aim = (
  rows: ReadonlyArray<Row>,
  id: string,
  named: (asked: string) => string | null | undefined,
): Aim => {
  const chain = chainTo(rows, id)
  if (chain !== undefined) return { kind: "chain", chain }
  const target = named(id)
  if (target === undefined) return { kind: "ask" }
  if (target !== null) {
    const resolved = chainTo(rows, target)
    if (resolved !== undefined) return { kind: "chain", chain: resolved }
  }
  return { kind: "miss" }
}

/** The landing's three answers, in {@link aim}'s own words. */
export type Aim =
  /** The chain the act owes its pane. */
  | { readonly kind: "chain"; readonly chain: ReadonlyArray<Row> }
  /** Nothing to do yet: the set has not answered the id. */
  | { readonly kind: "ask" }
  /** Nothing this page can answer: the miss, to be said. */
  | { readonly kind: "miss" }

/**
 * What a CERTAIN miss SAYS — the id as it was asked, em-dashed to the one
 * reason a landing can have for doing nothing. The pair is
 * `../refusals.tsx`'s own shape (the token as asked, then why), in the alarm
 * mood `../SaidLine.tsx` draws it in, for that file's reason: a miss IS why
 * nothing happened, and a reader not told it believes the link worked.
 *
 * The id IS quoted — unlike `../document/Hypertext.tsx`'s dropped click,
 * which may not echo a string grown inside somebody else's frame: a fragment
 * is text the reader's own address bar is already showing, in the same
 * register `../NotFound.tsx` quotes the id of a dead permalink in, and a said
 * line is a text node — nothing lands in markup.
 */
export const missedSays = (id: string): string =>
  `${id} — nothing by that name is drawn on this page`

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
