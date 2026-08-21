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
 * A phone has no ⌘K at all, so before this change a phone had NO door to
 * search. The answer is not a cramped box: it is the icon, and the icon opens
 * the ⌘K palette, which is a full-width modal built for exactly this and
 * drawing exactly these rows. One more door, still one reading, and no
 * surface that exists only on a phone. The pills that used to crowd it out
 * of the bar are gone from the phone header (`../AppHeader.tsx`); the
 * magnifier stays because it is the door.
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

import { createEffect, createMemo, createSignal, Index, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { type Anchor, anchoredTo, styleOf } from "../anchor.ts"
import { SaidLine } from "../edit/SaidLine.tsx"
import { LAYER } from "../layer.ts"
import { hitItem } from "../palette/items.ts"
import { openPalette } from "../palette/open.ts"
import { refusalLines } from "../refusals.ts"
import type { Route } from "../routes.ts"
import { listKey } from "../keys.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { SearchCount } from "./Count.tsx"
import { createCursor } from "./cursor.ts"
import { createSearch } from "./nodes.ts"
import { Result, type RowTestids } from "./Result.tsx"

/** WHERE an alarm sits in this panel — a full-width band above the rows, ruled
 *  off from them. The caller's half of `../edit/SaidLine.tsx`: the layout is
 *  this door's, narrower than the palette's because the panel is, and the mood
 *  is that component's. */
const ALERT_ROW = "m-0 border-b border-alarm/40 bg-alarm/5 px-3 py-2 font-mono text-xs"

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
   * A MEMO of its own, because the hits hold still while somebody types and
   * re-mapping them per keystroke would be a redraw of rows nothing had
   * happened to: an unchanged answer returns the SAME array here, and the
   * `<Index>` below then writes nothing at all.
   */
  const items = createMemo(() => nodes.hits().map(hitItem))
  /** What the grammar could not read, as the sentences it is announced in —
   *  compared by value so a query that keeps refusing the same token is not
   *  read out loud again (`../refusals.ts`). */
  const refused = refusalLines(nodes.refusals)
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
          class="w-full min-w-0 rounded-full border-0 bg-paper/15 px-3 py-1.5 font-mono text-xs text-paper outline-none placeholder:text-paper/50 ring-1 ring-paper/20 focus:bg-paper/25 focus:ring-accent/70"
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
          a phone has. Height is a finger's; width is not a 44px square — that
          square sat on the wordmark at 360pt. */}
      <button
        type="button"
        class={`${TARGET} inline-flex w-8 shrink-0 items-center justify-center rounded text-paper/70 hover:text-paper md:hidden`}
        data-testid={TESTID.headerSearchOpen}
        aria-label="search the directory"
        onClick={() => openPalette()}
      >
        <span aria-hidden="true" class="text-base leading-none">⌕</span>
      </button>

      <Show when={showing() && at()}>
        {(box_) => (
          <Portal>
            <div
              class={`fixed ${LAYER.over} overflow-hidden rounded-2xl border-0 bg-panel shadow-xl ring-1 ring-rule/40`}
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
                  <SaidLine
                    said={{ tone: "alarm", text: err() }}
                    class={ALERT_ROW}
                    testid={TESTID.headerSearchError}
                  />
                )}
              </Show>
              {/* …and the OTHER refusal: an operator the grammar knows the
                  name of and not the value. Its own row rather than the one
                  above, for the reason that one has its own: a refused call
                  and a refused query are two different pieces of news. */}
              <Index each={refused()}>
                {(line) => (
                  <SaidLine
                    said={{ tone: "alarm", text: line() }}
                    class={ALERT_ROW}
                    testid={TESTID.searchRefusal}
                  />
                )}
              </Index>
              {/* Down, never sideways — the rows are built not to overflow
                  and this is what keeps that a property of the container. */}
              <ul class="m-0 max-h-72 list-none overflow-x-hidden overflow-y-auto p-1">
                {/* `<Index>` rather than `<For>`, which is `./Shortlist.tsx`'s
                    rule over the identical rows: they are positional, there
                    are at most eight, and every answer mints fresh items —
                    which by reference meant all eight rows torn down and
                    rebuilt, taking the hover with them. */}
                <Index each={items()}>
                  {(item, index) => (
                    <li>
                      <Result
                        label={item().label}
                        of={item().of}
                        place={item().place}
                        props={item().props}
                        active={index === cursor.at()}
                        testids={HEADER_ROW}
                        id={item().id}
                        onHover={() => cursor.to(index)}
                        onSelect={() => open(index)}
                      />
                    </li>
                  )}
                </Index>
              </ul>
              {/* WHAT IS BEHIND THE ROWS — under the list rather than inside
                  it, so a reader who has scrolled the eight rows still has it
                  in front of them, and absent entirely when the eight are all
                  there was (`./count.ts`). */}
              <SearchCount
                of={nodes}
                class="m-0 border-t border-rule/40 px-3 py-1.5 font-mono text-xs text-muted"
              />
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
