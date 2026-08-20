/**
 * The shortlist under a caret — one box for all three widgets.
 *
 * PRIVATE to this directory: `./completing.tsx` hands its consumer a `Panel`
 * that draws this, so a field with a completion in it wires one thing rather
 * than a hook and a component that have to agree about a shape.
 *
 * It draws {@link ../search/Result.tsx}'s row, which is the row the ⌘K palette
 * and the header's search box already draw, for the reason that file gives:
 * three spellings of a result row are three rows, and the day one of them
 * learns to show a mark or a date is the day they stop being the same product.
 * What this adds is only the BOX — where it sits, and the fact of which widget
 * it belongs to.
 *
 * ## Out of flow, and out of the tree
 *
 * The date picker two directories over argues at length for drawing in place
 * under the row rather than floating (`../date/DatePicker.tsx`), and that
 * argument does not reach this: what it rules out is a panel with geometry of
 * its own to keep anchored while the page scrolls. This box is out of flow so
 * the tree below does not JUMP as candidates appear and disappear on every
 * keystroke — a list that pushed the outline down by four rows while somebody
 * typed `#ho` and pulled it back up on the `m` would be unusable for exactly
 * the gesture it exists to serve.
 *
 * It is also PORTALLED. A sticky section heading is a stacking context at the
 * same {@link LAYER.row} this list rides (`../layer.ts`), and a box left in
 * the title cell is cut in two the moment the next section arrives — the
 * `•••` menu's own bug (`menu-under-headers`). The portal is the same escape
 * that menu takes; the measure below is what "scrolls with the row" costs
 * once the box has left the cell.
 *
 * The caret never leaves the input, so nothing here takes focus: the rows are
 * chosen by the arrows and Enter (`./completing.tsx`), and a pointer press is
 * defaulted-away by the row itself so a click cannot blur the line being typed.
 */

import { createEffect, createSignal, Index, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { LAYER } from "../layer.ts"
import { overlayRoot } from "../overlay.ts"
import { Result, type RowTestids } from "../search/Result.tsx"

/** What this door calls its rows (`../search/Result.tsx`'s `RowTestids`). */
const COMPLETION_ROW: RowTestids = {
  row: TESTID.completionItem,
  place: TESTID.completionItemPlace,
  prop: TESTID.completionItemProp,
}
import { TESTID } from "../testids.ts"
import type { Listing } from "./completing.tsx"

/** Where the list hangs, in viewport pixels — the title cell's left edge
 *  and the line under it. */
interface At {
  readonly left: number
  readonly top: number
}

const sameAt = (a: At | null, b: At | null): boolean =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top)

export function Completions(props: { readonly listing: Listing }) {
  /** The title cell this list belongs to. `contents` so it adds no box of
   *  its own; the parent is the `relative` span `../edit/RowEditor.tsx`
   *  wraps the input in. */
  let host: HTMLSpanElement | undefined
  const [at, setAt] = createSignal<At | null>(null, { equals: sameAt })

  const measure = (): void => {
    if (host === undefined) return
    const cell = host.parentElement
    if (cell === null) {
      throw new Error("completions: the title cell is gone — the list cannot hang")
    }
    const box = cell.getBoundingClientRect()
    setAt({ left: box.left, top: box.bottom + 4 })
  }

  createEffect(() => {
    if (!props.listing.showing()) {
      setAt(null)
      return
    }
    measure()
    window.addEventListener("resize", measure)
    // Capture: the pane that moves under a list is not the window.
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  return (
    <span ref={host} class="contents">
    {/* WHETHER there is a box is the listing's own answer, not a second
        formula here — see `Listing.showing`. */}
    <Show when={props.listing.showing() ? at() : undefined}>
      {(spot) => (
      <Portal mount={overlayRoot()}>
      <div
        // `LAYER.row` is the whole stacking claim, and it is the `•••` menu's
        // (`../layer.ts`): this hangs off a ROW, so it covers the rows under
        // it and gives way to every piece of chrome. The portal is what
        // makes the number mean that against a later sticky heading. A bare
        // number here would be the twentieth call site that could only be
        // read by looking at the other nineteen.
        class={`fixed ${LAYER.row} w-[min(24rem,80vw)] overflow-hidden rounded-md border border-rule/70 bg-panel shadow-lg`}
        style={{ left: `${spot().left}px`, top: `${spot().top}px` }}
        data-testid={TESTID.completions}
        // WHICH widget this is, as a fact in the markup rather than as a guess
        // from what is in it — the same contract every other panel in this
        // client keeps about its own mood.
        data-kind={props.listing.kind() ?? undefined}
        role="listbox"
        aria-label="completions"
      >
        {/* The search's own refusal, in its own words and in its own slot —
            never dropped, and never overwriting a list somebody is reading. */}
        <Show when={props.listing.failure()}>
          {(failure) => (
            <p
              class="m-0 border-b border-alarm/40 bg-alarm/5 px-3 py-2 font-mono text-xs text-alarm"
              data-testid={TESTID.completionsError}
              role="alert"
            >
              {failure()}
            </p>
          )}
        </Show>
        {/* `<Index>`, not `<For>`: the rows are POSITIONAL and there are at
            most eight of them, and every keystroke mints a fresh `Choice` per
            row (each carries its own `choose` closure), so a reference-keyed
            diff would match nothing and tear down every row to build it again
            — including while a `((` list is sitting unchanged behind its
            debounce. Index-keying updates the props in place. */}
        <ul class="m-0 max-h-64 list-none overflow-x-hidden overflow-y-auto p-1">
          <Index each={props.listing.choices()}>
            {(choice, index) => (
              <li>
                <Result
                  label={choice().label}
                  hint={choice().hint}
                  place={choice().place}
                  props={choice().props}
                  active={index === props.listing.active()}
                  testids={COMPLETION_ROW}
                  id={choice().id}
                  onHover={() => props.listing.hover(index)}
                  onSelect={() => choice().choose()}
                />
              </li>
            )}
          </Index>
        </ul>
      </div>
      </Portal>
      )}
    </Show>
    </span>
  )
}
