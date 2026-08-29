/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation and the same store — a file is just the widest zoom
 * there is.
 *
 * The LANDING (below) is the outline arm of what the markdown face draws for
 * `#heading`: an address like `/house.olai#install` asking this page to arrive
 * at the row it names. The act is the small half the browser cannot do: the
 * row is a place in the tree, not an element id — and the address may name
 * one inside a branch this reader has folded, which the tree answers with its
 * own expand vocabulary (`./fold/landing.ts` argues why expanding beats
 * pointing at the nearest visible ancestor).
 */

import type { Row } from "@olai/format"
import { createEffect, onCleanup, Show } from "solid-js"

import { setFolded } from "./fold/memory.ts"
import { createFoldReading } from "./fold/reading.ts"
import { chainTo, shutAlong } from "./fold/landing.ts"
import { Editable } from "./edit/Editable.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { unfiltered } from "./filter/why.ts"
import { bringOntoScreen, selectNode } from "./focus.ts"
import { useHere, useLanding } from "./router.tsx"
import { doneHidden } from "./settings/done.ts"
import { TESTID } from "./testids.ts"
import { Tree } from "./Tree.tsx"

export function OutlinePage(props: {
  /** Which file this is — needed by exactly one thing, and it is the one
   *  place a browser names a path: an outline with no rows has no anchor to
   *  put a first one after. */
  readonly file: string
  readonly rows: ReadonlyArray<Row>
}) {
  const narrowed = useNarrowed()
  const folds = createFoldReading()
  const here = useHere()
  const landing = useLanding(() => props.file)

  /**
   * LAND at the row the address named, once there is a page to land in — the
   * outline's half of the act the markdown face performs for headings
   * (`./document/faces.tsx`), with the same rules in the same order:
   *
   *   - an EFFECT rather than a call, because the rows arrive on their own
   *     schedule: the reading can sit a revision behind the navigation that
   *     minted the landing, and re-running is how the arrival eventually
   *     lands — through `props.rows`, which is also the reason a page
   *     REPUBLISHED underfoot does not re-land a reader (the mark below);
   *   - NOTHING FOUND IS NOTHING DONE, the document arm's own sentence: the
   *     file half of a row address can go stale exactly as a heading's slug
   *     can, and a landing that finds its row on no revision is quiet about
   *     it — over a whole page, never a blank one. Kept UNspent, so a page
   *     that starts showing the row again — a filter let it back in, a done
   *     it was about vanished — still pays the arrival it was owed;
   *   - spent ON THE SCROLL rather than on the attempt, for the markdown
   *     face's reason: giving up the first time the row was absent would give
   *     up on the frame before the rows had arrived at all.
   *
   * What changes is the ACT, and it is the emphasis of this page: folding is
   * the reader's own memory — the row is found in the READING regardless
   * (`./fold/landing.ts`, which asks `props.rows`, not the memory-pruned
   * draw), so a collapsed ancestor is unshut with the tree's own expand verb
   * before the row is selected and brought on screen, instead of the reader
   * being left pointing at somewhere they cannot see.
   *
   * The fold half is asked of the READING, not of the memory —
   * `createFoldReading`, the same door the tree, the editor, the selection
   * and the drag ask. They differ on exactly one page: a NARROWED one, where
   * the reading has already suspended every collapse and the memory still
   * names the reader's real ones — so `shut` under a filter comes back
   * empty, and the act writes nothing: a landing that wrote there could
   * un-collapse branches nobody was hiding from it, which is the promise
   * `./fold/reading.ts`'s header is for.
   */
  createEffect(() => {
    const at = landing.owed()
    if (at === undefined) return
    const chain = chainTo(props.rows, at)
    if (chain === undefined) return
    const shut = shutAlong(chain, folds())
    if (shut.length > 0) setFolded(shut, false)
    selectNode(at)
    const frame = requestAnimationFrame(() => {
      // The landing belongs to THIS pane: the SAME outline can sit in two
      // columns, and the scroll is the pane whose address named the row.
      const root = document.querySelector(
        `[data-testid="${TESTID.pane}"][data-pane="${String(here())}"]`,
      )
      if (root === null) return
      // Aim at the landing's OWN row — the chain's last placement, found by
      // the record id its row wears — not at the accent: the accent is one
      // signal for the whole app and a landing is a fact per pane, so two at
      // once (a shared view naming a row in each of this file's columns)
      // would scroll one pane to the other's row and say its own arrival
      // paid — the wrong-row spend `./landing.ts`'s header was once and
      // forever written against. Rows wear `data-node-id` for exactly this
      // (`./Tree.tsx`), even mirrors — the placement stays put.
      const placement = chain.at(-1)
      if (placement === undefined) return
      const row = root.querySelector(
        `[data-testid="${TESTID.node}"][data-node-id="${placement.at.node.id}"]`,
      )
      if (row === null) return
      bringOntoScreen(row)
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    // A whole outline is drawn inside nothing, which is the answer rather than
    // the absence of one (`./drag/fields.ts`).
    <Editable rows={() => props.rows} file={props.file} within={[]}>
      <Tree rows={props.rows} />
      {/* An outline that holds nothing still has to be startable, and a tree
          of no rows offers nowhere to press a key. Only when the file really
          is empty: rows can also be missing because this reading is hiding
          what is done — or because a FILTER matched nothing — and "write its
          first line" would be a lie over a tree that is one click from coming
          back. The filter bar says what happened in that case. */}
      <Show
        when={unfiltered(narrowed) && props.rows.length === 0 && !doneHidden()}
      >
        <StartLine
          at={{ kind: "first", file: props.file }}
          label="This outline is empty — write its first line."
        />
      </Show>
    </Editable>
  )
}
