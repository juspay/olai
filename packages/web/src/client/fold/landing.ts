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
 *     depth-first — that SHOWS the id, mirror or not: each of them wears the
 *     accent (`../focus.ts`'s `data-focused` is matched the same way), so the
 *     act needs only one to aim at.
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
 * the address opened is whole. The half that is not silent is the chat panel's
 * press itself, which never even routes there: a node the set no longer
 * declares keeps the reader on the page they had (`../focus.ts`).
 */

import { type Row, shownRecord } from "@olai/format"

import { type Fold, foldOf } from "./rows.ts"

/**
 * The rows from a root of `rows` down to the row that SHOWS `id`, or
 * `undefined` when this page draws no such row.
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
    if (shownRecord(row).node.id === id) return chain
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
