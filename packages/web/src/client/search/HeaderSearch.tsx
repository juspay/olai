/**
 * The header's search box — the second door to the one search reading.
 *
 * ## Why a second door at all, and why it is not a second search
 *
 * ⌘K is a chord, and a chord is a thing you have to know. The bar is where
 * this app keeps what is true about the app rather than about the page, and a
 * box you can see is the difference between a feature and a feature somebody
 * told you about. What it must NOT be is a second implementation: it asks
 * `createNodeSearch` (`./nodes.ts`) exactly as the palette does, draws
 * `./Result.tsx` exactly as the palette does, and presses a result the same
 * way — so the two doors cannot answer differently, in the same sense that
 * the browser and an agent cannot (HACKING.md's consistency rule, one layer
 * in).
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
import { nodeItem } from "../palette/items.ts"
import { setPaletteOpen } from "../palette/open.ts"
import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { createNodeSearch } from "./nodes.ts"
import { Result } from "./Result.tsx"

export function HeaderSearch(props: {
  readonly go: (route: Route) => void
}) {
  const [query, setQuery] = createSignal("")
  const [caret, setCaret] = createSignal(false)
  const [active, setActive] = createSignal(0)
  const [at, setAt] = createSignal<Anchor | null>(null)
  let box: HTMLInputElement | undefined

  const nodes = createNodeSearch(() => (caret() ? query() : null))
  const items = createMemo(() => nodes.hits().map(nodeItem))
  const showing = () => caret() && (items().length > 0 || nodes.failure() !== null)

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

  createEffect(() => {
    const n = items().length
    if (active() >= n) setActive(n === 0 ? 0 : n - 1)
  })

  const open = (index: number) => {
    const item = items()[index]
    if (item === undefined) return
    const action = item.action
    // Every node row is a route by construction (`nodeItem`); the guard is
    // what keeps that true rather than assumed.
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
          aria-label="search the outlines"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value)
            setActive(0)
          }}
          onFocus={() => {
            setCaret(true)
            measure()
          }}
          onBlur={() => setCaret(false)}
          onKeyDown={(event) => {
            const n = items().length
            if (event.key === "ArrowDown" && n > 0) {
              event.preventDefault()
              setActive((index) => (index + 1) % n)
            } else if (event.key === "ArrowUp" && n > 0) {
              event.preventDefault()
              setActive((index) => (index - 1 + n) % n)
            } else if (event.key === "Enter") {
              event.preventDefault()
              open(active())
            } else if (event.key === "Escape") {
              event.preventDefault()
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
        aria-label="search the outlines"
        onClick={() => setPaletteOpen(true)}
      >
        <span aria-hidden="true" class="text-base leading-none">⌕</span>
      </button>

      <Show when={showing() && at()}>
        {(box_) => (
          <Portal>
            <div
              class="fixed z-50 overflow-hidden rounded-lg border border-rule/70 bg-panel shadow-lg"
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
              {/* Down, never sideways — the rows are built not to overflow
                  and this is what keeps that a property of the container. */}
              <ul class="m-0 max-h-72 list-none overflow-x-hidden overflow-y-auto p-1">
                <For each={[...items()]}>
                  {(item, index) => (
                    <li>
                      <Result
                        label={item.label}
                        place={item.place}
                        active={index() === active()}
                        testid={TESTID.headerSearchItem}
                        placeTestid={TESTID.headerSearchItemPlace}
                        id={item.id}
                        onHover={() => setActive(index())}
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
