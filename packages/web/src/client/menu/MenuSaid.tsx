/**
 * The line beside the `•••`: what the last verb had to say (`./picking.ts`).
 *
 * Drawn by the ROW rather than by the panel, because the panel is gone by the
 * time most of these arrive — a message inside something that has gone is a
 * message nobody reads.
 *
 * Named for the surface it belongs to, the way `edit/UndoSaid.tsx` is: `Said`
 * on its own is the TYPE every one of these lines carries (`../saying.ts`),
 * and a component wearing the same word made the one file where both meet
 * import the type under an alias to tell them apart.
 *
 * WHAT IT OWNS IS WHERE THE LINE HANGS, and nothing else. The mood — its
 * colour, its `data-tone`, and whether a screen reader is interrupted — is
 * `../SaidLine.tsx`'s, once, for every surface in this client that says
 * something about a write.
 *
 * It is PORTALLED onto {@link ../overlay.ts}. A sticky section heading is a
 * stacking context at the same {@link LAYER.row} this line rides, and a line
 * left in the gutter is the one a later heading paints through
 * (`menu-said-overlay`). Completions hang from the same socket for the same
 * reason; the measure below is what "beside the •••" costs once the line has
 * left the cell.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { SaidLine } from "../SaidLine.tsx"
import type { Said } from "../saying.ts"
import { LAYER } from "../layer.ts"
import { overlayRoot } from "../overlay.ts"
import { TESTID } from "../testids.ts"

/** Where the line hangs, in viewport pixels — the gutter's left edge and
 *  the line under it. */
interface At {
  readonly left: number
  readonly top: number
}

const sameAt = (a: At | null, b: At | null): boolean =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top)

export function MenuSaid(props: { readonly said: Said | null }) {
  /** The gutter this line belongs to. `contents` so it adds no box of its
   *  own; the parent is the positioned root `./NodeMenu.tsx` wraps the
   *  `•••` in. */
  let host: HTMLSpanElement | undefined
  const [at, setAt] = createSignal<At | null>(null, { equals: sameAt })

  const measure = (): void => {
    if (host === undefined) return
    const cell = host.parentElement
    if (cell === null) {
      throw new Error("MenuSaid: the row gutter is gone — the line cannot hang")
    }
    const box = cell.getBoundingClientRect()
    // `mt-0.5` was the in-tree gutter: 2px under the `•••`.
    setAt({ left: box.left, top: box.bottom + 2 })
  }

  createEffect(() => {
    if (props.said === null) {
      setAt(null)
      return
    }
    measure()
    window.addEventListener("resize", measure)
    // Capture: the pane that moves under a line is not the window.
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  return (
    <span ref={host} class="contents">
      <Show when={props.said}>
        {(message) => (
          <Show when={at()}>
            {(spot) => (
              <Portal mount={overlayRoot()}>
                {/* Out of flow, like the panel, so a word that widened the
                    gutter would move the whole outline sideways. It WRAPS,
                    because a refusal is a sentence rather than a word — the
                    ops layer names the node and says what to do about it —
                    and a line that never wrapped would run off the right of
                    the screen with the reason on it. `fixed` + the measure:
                    the same claim the title-cell completions make, against a
                    later sticky heading. */}
                <SaidLine
                  said={message()}
                  class={`fixed ${LAYER.row} m-0 max-w-[24rem] w-max rounded border border-rule/70 bg-panel px-2 py-1 text-xs shadow-md`}
                  style={{ left: `${spot().left}px`, top: `${spot().top}px` }}
                  testid={TESTID.nodeMenuSaid}
                />
              </Portal>
            )}
          </Show>
        )}
      </Show>
    </span>
  )
}
