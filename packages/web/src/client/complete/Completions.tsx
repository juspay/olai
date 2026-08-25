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
 * that menu takes. Placement is `@kobalte/core/popper` — flip, shift and
 * autoUpdate, the primitive the menu already hangs from — so a scrolled page
 * does not leave this list where the cell was. Kobalte's popper is
 * `strategy: "absolute"` and cannot be talked out of it; mounted on
 * {@link ../overlay.ts} those numbers are viewport coordinates.
 *
 * The caret never leaves the input, so nothing here takes focus: the rows are
 * chosen by the arrows and Enter (`./completing.tsx`), and a pointer press is
 * defaulted-away by the row itself so a click cannot blur the line being typed.
 */

import { Popper } from "@kobalte/core/popper"
import { createSignal, Index, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { ALARM_BAND, SaidLine } from "../SaidLine.tsx"
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

export function Completions(props: { readonly listing: Listing }) {
  /** The host is `contents` and has no box of its own; the parent is the
   *  title cell `../edit/RowEditor.tsx` wraps the input in. Popper observes
   *  this node for scroll/resize; `rectOf` is what it actually hangs from. */
  const [host, setHost] = createSignal<HTMLElement>()
  const [content, setContent] = createSignal<HTMLElement>()

  /** The cell as it is NOW. Popper calls this on every autoUpdate; a missing
   *  parent is a bug, not a skip. The bind does not throw: this component
   *  mounts with the editor, before a list is showing, and a contents span's
   *  parent can still be unset in the ref. */
  const rectOf = (): DOMRect | undefined => {
    const el = host()
    if (el === undefined) return undefined
    const cell = el.parentElement
    if (cell === null) {
      throw new Error("completions: the title cell is gone — the list cannot hang")
    }
    return cell.getBoundingClientRect()
  }

  return (
    <span ref={setHost} class="contents">
    {/* WHETHER there is a box is the listing's own answer, not a second
        formula here — see `Listing.showing`. */}
    <Show when={props.listing.showing()}>
      <Popper
        anchorRef={host}
        contentRef={content}
        getAnchorRect={rectOf}
        placement="bottom-start"
        gutter={4}
      >
      <Portal mount={overlayRoot()}>
      <Popper.Positioner>
      <div
        ref={setContent}
        // `LAYER.row` is the whole stacking claim, and it is the `•••` menu's
        // (`../layer.ts`): this hangs off a ROW, so it covers the rows under
        // it and gives way to every piece of chrome. The portal is what
        // makes the number mean that against a later sticky heading. A bare
        // number here would be the twentieth call site that could only be
        // read by looking at the other nineteen. `relative` so the layer
        // bites on the positioner's absolute box, the same as the menu.
        class={`relative ${LAYER.row} w-[min(24rem,80vw)] overflow-hidden rounded-md border border-rule/70 bg-panel shadow-lg`}
        data-testid={TESTID.completions}
        // WHICH widget this is, as a fact in the markup rather than as a guess
        // from what is in it — the same contract every other panel in this
        // client keeps about its own mood.
        data-kind={props.listing.kind() ?? undefined}
        role="listbox"
        aria-label="completions"
      >
        {/* The search's own refusal, in its own words and in its own slot —
            never dropped, and never overwriting a list somebody is reading.
            The band is the one the other two shortlist panels wear and the
            mood is `../SaidLine.tsx`'s, once: this row spelled both by
            hand, down to the pad, and so carried no `data-tone` for a
            scenario to read the mood off. */}
        <Show when={props.listing.failure()}>
          {(failure) => (
            <SaidLine
              said={{ tone: "alarm", text: failure() }}
              class={`${ALARM_BAND} px-3`}
              testid={TESTID.completionsError}
            />
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
                  from={choice().from}
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
      </Popper.Positioner>
      </Portal>
      </Popper>
    </Show>
    </span>
  )
}
