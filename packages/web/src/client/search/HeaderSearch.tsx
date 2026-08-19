/**
 * The header's search box — the second door to the one search reading.
 *
 * ## Why a second door at all, and why it is not a second search
 *
 * ⌘K is a chord, and a chord is a thing you have to know. The bar is where
 * this app keeps what is true about the app rather than about the page, and a
 * box you can see is the difference between a feature and a feature somebody
 * told you about. What it must NOT be is a second implementation: it asks
 * `createSearch` (`./nodes.ts`) exactly as the palette does, draws
 * `./Result.tsx` exactly as the palette does, and presses a result the same
 * way — so the two doors cannot answer differently, in the same sense that
 * the browser and an agent cannot (HACKING.md's consistency rule, one layer
 * in).
 *
 * That rule is why the DOCUMENT ROWS are here too. They are the palette's
 * block, built by the palette's own module over the served list
 * (`../palette/items.ts`), in the same order and drawn with the same
 * glyph: a box that found `finishes.md` while the chord next to it did not
 * would be the drift above, inside one client, with nothing to blame it on but
 * which surface somebody happened to think about.
 *
 * ## Where it sits, and what gives way
 *
 * In the right-hand cluster, FIRST, before the pills. The bar's documented
 * give-way order (`../AppHeader.tsx`) is about what a reader loses when the
 * width runs out; this box takes what is left after the pills have their
 * floors — it is `min-w-0` with a `max-w`, so it shrinks to nothing before
 * the connection state or the commit pill loses a character. It is the one
 * control here that can afford that: an input narrowed to a slot is still an
 * input, while `live` narrowed is a lie.
 *
 * ## On a phone: a magnifier that opens the palette
 *
 * The bar at 390pt already spends its last pixels on the pills (five things
 * that do not fit, and this would be a sixth), and a phone has no ⌘K at all —
 * so before this change a phone had NO door to search. The answer is not a
 * cramped box: it is the icon, and the icon opens the ⌘K palette, which is a
 * full-width modal built for exactly this and drawing exactly these rows. One
 * more door, still one reading, and no surface that exists only on a phone.
 *
 * ## The panel PORTALS
 *
 * The header is `sticky` with a `z-index`, which makes it a stacking context
 * three rem tall — "not somewhere a panel can hang out of", as the bar's own
 * header says, which is why the commit and preferences panels portal. This
 * one does the same, positioned by the shared geometry (`../anchor.ts`) so a
 * box near the right edge is pushed back inside rather than clipped.
 *
 * Focus, not a click-away, is what closes it: the results are up while the
 * box has the caret, and pressing one keeps the caret where it is
 * (`Result.tsx`'s `mousedown` guard) so the press lands before the blur.
 */

import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { type Anchor, anchoredTo, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import { hitItem } from "../palette/items.ts"
import { setPaletteOpen } from "../palette/open.ts"
import { useServed } from "../served.tsx"
import type { Route } from "../routes.ts"
import { listKey } from "../keys.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { createCursor } from "./cursor.ts"
import { createSearch } from "./nodes.ts"
import { Result, type RowTestids } from "./Result.tsx"

/** What this door calls its rows (`./Result.tsx`'s `RowTestids`). */
const HEADER_ROW: RowTestids = {
  row: TESTID.headerSearchItem,
  place: TESTID.headerSearchItemPlace,
  prop: TESTID.headerSearchItemProp,
}

export function HeaderSearch(props: {
  readonly go: (route: Route) => void
}) {
  const [query, setQuery] = createSignal("")
  const [caret, setCaret] = createSignal(false)
  /** Every path the directory serves (`../served.tsx`) — what the document
   *  rows below are matched against. */
  const served = useServed()
  // WHICH row Enter takes — the one cursor every shortlist in this client
  // shares (`./cursor.ts`), so the arrows here, in the ⌘K palette and in the
  // row editor's completions cannot disagree about what the bottom of a list
  // does. It also keeps a list the SERVER shortened under somebody honest,
  // which is what the clamp-after-the-fact here used to be for.
  const cursor = createCursor(() => items().length)
  const [at, setAt] = createSignal<Anchor | null>(null)
  let box: HTMLInputElement | undefined

  /** WHAT THIS BOX IS ASKING — the query, or `null` while nobody has the caret
   *  in it. One accessor for both lists below, exactly as the palette keeps one
   *  (`../palette/Palette.tsx`): a box that stopped asking is a box neither
   *  list may still be answering, and gated per list that is a rule each of
   *  them could stop keeping on its own. */
  const asked = () => (caret() ? query() : null)

  const nodes = createSearch(asked)
  /**
   * The rows, minted from the hits — ONE BLOCK, because there is one reading.
   *
   * There were two: the documents were matched in this tab off the served
   * paths, above the node hits, "because this box is the OTHER DOOR to one
   * reading and a door that found a file the other one did not would be exactly
   * the drift this whole seam exists against". The drift is closed from the
   * other end now — a search answers with both kinds
   * (`@olai/format`'s `matchingDocuments`) — so the two doors share an index
   * rather than a matcher each, and a document is found by what its prose says
   * as well as by what it is called.
   *
   * A MEMO of its own, because `<For>` keys a row by reference and the hits
   * hold still while somebody types: re-mapping them per keystroke would be a
   * teardown and a redraw of rows nothing had happened to.
   */
  const items = createMemo(() => nodes.hits().map(hitItem))
  // The panel is up when there is anything to say — rows, a refused call, or a
  // query the grammar could not read. That last one is why a typo in an
  // operator opens the panel at all rather than looking like an empty
  // directory (`./nodes.ts` says why the two refusals are separate slots).
  const showing = () =>
    caret() &&
    (items().length > 0 || nodes.failure() !== null || nodes.refusals().length > 0)

  /** Where the panel goes. Re-measured while it is up, because the bar is
   *  sticky over a document that scrolls under it. */
  const measure = () => {
    if (box === undefined) return
    setAt(anchoredTo(box.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }

  createEffect(() => {
    if (!showing()) return
    measure()
    window.addEventListener("scroll", measure, true)
    window.addEventListener("resize", measure)
    onCleanup(() => {
      window.removeEventListener("scroll", measure, true)
      window.removeEventListener("resize", measure)
    })
  })

  const open = (index: number) => {
    const item = items()[index]
    if (item === undefined) return
    const action = item.action
    // Every row this box draws is a route by construction — every hit is
    // somewhere to go (`../palette/items.ts`'s `hitItem`); the guard is what
    // keeps that true rather than assumed.
    if (action.kind !== "route") return
    props.go(action.route)
    setQuery("")
    box?.blur()
  }

  return (
    <>
      {/* The box itself — desktop and up. `min-w-0` with a cap: it gives way
          before any pill does. */}
      <div class="hidden min-w-0 max-w-56 flex-1 md:block">
        <input
          ref={box}
          type="search"
          class="w-full min-w-0 rounded border border-rule/70 bg-panel px-2 py-1 font-mono text-xs text-ink outline-none placeholder:text-muted focus:border-rule"
          data-testid={TESTID.headerSearch}
          placeholder="search"
          aria-label="search the directory"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value)
            cursor.top()
          }}
          onFocus={() => {
            setCaret(true)
            measure()
          }}
          onBlur={() => setCaret(false)}
          // WHICH key is the registry's (`../keys.ts`'s list layer, the same
          // one the palette and the row editor's completions ask); what each
          // answer MEANS is this box's — `dismiss` empties it and gives the
          // caret back to the page.
          onKeyDown={(event) => {
            const action = listKey(event)
            if (action === null) return
            event.preventDefault()
            if (action === "next") cursor.step(1)
            if (action === "prev") cursor.step(-1)
            if (action === "take") open(cursor.at())
            if (action === "dismiss") {
              setQuery("")
              box?.blur()
            }
          }}
        />
      </div>

      {/* The phone's door: the same modal the chord opens, and the only door
          a phone has. */}
      <button
        type="button"
        class={`${TARGET_BOX} inline-flex items-center justify-center rounded text-muted hover:text-ink md:hidden`}
        data-testid={TESTID.headerSearchOpen}
        aria-label="search the directory"
        onClick={() => setPaletteOpen(true)}
      >
        <span aria-hidden="true" class="text-base leading-none">⌕</span>
      </button>

      <Show when={showing() && at()}>
        {(box_) => (
          <Portal>
            <div
              class={`fixed ${LAYER.over} overflow-hidden rounded-lg border border-rule/70 bg-panel shadow-lg`}
              data-testid={TESTID.headerSearchResults}
              // `styleOf` rather than a style object of this file's own: a
              // COMPUTED key (`[at.side]`) compiles away silently in Solid and
              // leaves the panel with no vertical position at all — which is
              // documented in `../anchor.ts` because it already cost the
              // Commit panel its placement once, and cost this one an
              // afternoon before the shared answer was used.
              style={styleOf(box_())}
            >
              <Show when={nodes.failure()}>
                {(err) => (
                  <div
                    class="border-b border-alarm/40 bg-alarm/5 px-3 py-2 font-mono text-xs text-alarm"
                    data-testid={TESTID.headerSearchError}
                    role="alert"
                  >
                    {err()}
                  </div>
                )}
              </Show>
              {/* …and the OTHER refusal: an operator the grammar knows the
                  name of and not the value. Its own row rather than the one
                  above, for the reason that one has its own: a refused call
                  and a refused query are two different pieces of news. */}
              <For each={[...nodes.refusals()]}>
                {(refusal) => (
                  <div
                    class="border-b border-alarm/40 bg-alarm/5 px-3 py-2 font-mono text-xs text-alarm"
                    data-testid={TESTID.searchRefusal}
                    role="alert"
                  >
                    {refusal.token} — {refusal.reason}
                  </div>
                )}
              </For>
              {/* Down, never sideways — the rows are built not to overflow
                  and this is what keeps that a property of the container. */}
              <ul class="m-0 max-h-72 list-none overflow-x-hidden overflow-y-auto p-1">
                <For each={[...items()]}>
                  {(item, index) => (
                    <li>
                      <Result
                        label={item.label}
                        of={item.of}
                        place={item.place}
                        props={item.props}
                        active={index() === cursor.at()}
                        testids={HEADER_ROW}
                        id={item.id}
                        onHover={() => cursor.to(index())}
                        onSelect={() => open(index())}
                      />
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
