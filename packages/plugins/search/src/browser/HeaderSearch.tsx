import { actionHref } from "olai-plugin-navigation/palette-model"
import type { Claims } from "@olai/format"
import { boxFace, crumbFaces } from "./faces.ts"
import type {} from "../contracts/box.ts"
import { TESTID as IDS_NAVIGATION } from "olai-plugin-navigation/testids"
import { needlesFrom } from "@olai/format"
import { createEffect, createMemo, createSelector, createSignal, Index, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { type Anchor, anchoredTo, styleOf } from "@olai/web/client/anchor.ts"
import { ALARM_BAND, SaidLine } from "@olai/web/client/SaidLine.tsx"
import { LAYER } from "@olai/web/client/layer.ts"
import { hitItems, type PaletteItem } from "olai-plugin-navigation/palette-model"
import { openPalette } from "./palette.ts"
import { Refusals } from "@olai/web/client/refusals.tsx"
import { useMaybeGo, useMaybeRouter } from "olai-plugin-navigation/routing"
import { listKey } from "@olai/web/client/keys.ts"

import { TESTID } from "../testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { useToday } from "./clock.ts"
import { SearchCount } from "olai-plugin-search/ui/Count.tsx"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { createSearch } from "./reading.ts"
import { Result, type RowTestids } from "olai-plugin-search/ui/Result.tsx"
import { spend } from "@olai/web/client/settled.ts"

const ALERT_ROW = `${ALARM_BAND} px-3`

const HEADER_ROW: RowTestids = {
  row: TESTID.headerSearchItem,
  place: TESTID.headerSearchItemPlace,
  prop: TESTID.headerSearchItemProp,
}

export function HeaderSearch(props: { readonly claims: Claims | undefined }) {
  let results: HTMLDivElement | undefined
  const go = useMaybeGo()
  const router = useMaybeRouter()
  const [query, setQuery] = createSignal("")
  const [caret, setCaret] = createSignal(false)
  const today = useToday()
  const needles = createMemo(() => needlesFrom(query(), today()))
  const cursor = createCursor(() => items().length)
  const [at, setAt] = createSignal<Anchor | null>(null, { equals: (a, b) => a === b || !!a && !!b && a.left === b.left && a.width === b.width && a.maxHeight === b.maxHeight && a.side === b.side && a.offset === b.offset })
  let box: HTMLInputElement | undefined

  const asked = () => (caret() ? query() : null)

  const below = () => boxFace("search.box.below")?.face
  const nodes = createSearch(asked, () => below()?.pick())
  const items = createMemo(() => hitItems(nodes))
  const isCurrent = createSelector(cursor.at)
  const showing = () =>
    caret() &&
    (nodes.answering() !== null || below() !== undefined || items().length > 0 || nodes.failure() !== null || nodes.refusals().length > 0)

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

  const open = (item: PaletteItem) => {
    const action = item.action
    if (action.kind !== "route") return
    go?.(action.route)
    setQuery("")
    box?.blur()
  }

  if (go === null) return null

  return (
    <>
      <div class="hidden min-w-0 max-w-56 flex-1 md:block">
        <input
          ref={box}
          type="search"
          class="h-7 w-full min-w-0 rounded-control border border-rule bg-paper px-2.5 text-label text-ink placeholder:text-muted focus:border-accent"
          data-testid={TESTID.headerSearch}
          enterkeyhint="go"
          autocorrect="off"
          autocapitalize="none"
          spellcheck={false}
          placeholder="Search"
          aria-label="Search"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value)
            cursor.top()
          }}
          onFocus={() => {
            setCaret(true)
            measure()
          }}
          onBlur={event => { if (!(event.relatedTarget instanceof Node && results?.contains(event.relatedTarget))) setCaret(false) }}
          onKeyDown={(event) => {
            const action = listKey(event, true)
            if (action === "cycle") {
              const face = below()
              if (face !== undefined) { event.preventDefault(); event.stopPropagation(); face.cycle() }
              return
            }
            if (action === null) return
            event.preventDefault()
            if (action === "next") cursor.step(1)
            if (action === "prev") cursor.step(-1)
            if (action === "take") spend(items()[cursor.at()], open)
            if (action === "dismiss") {
              setQuery("")
              box?.blur()
            }
          }}
        />
      </div>

      <button
        type="button"
        class={`${TARGET} inline-flex w-8 shrink-0 items-center justify-center rounded-control text-muted hover:text-ink md:hidden`}
        data-testid={TESTID.headerSearchOpen}
        aria-label="Search"
        onClick={() => openPalette()}
      >
        <span aria-hidden="true" class="text-title leading-none">⌕</span>
      </button>

      <Show when={showing() && at()}>
        {(box_) => (
          <Portal>
            <div
              // A `border`, not a `ring-1`: forced colors mode computes
              // `box-shadow` to `none`, leaving this panel with no edge at all.
              class={`fixed ${LAYER.over} overflow-hidden rounded-surface border border-rule bg-panel shadow-overlay`}
              ref={results}
              onFocusOut={event => { if (!(event.relatedTarget instanceof Node && (results?.contains(event.relatedTarget) || event.relatedTarget === box))) setCaret(false) }}
              data-testid={TESTID.headerSearchResults}
              style={styleOf(box_())}
            >
              <Show when={below()} keyed>{face => <face.body search={nodes} />}</Show>
              <Show when={nodes.failure()}>
                {(err) => (
                  <SaidLine
                    said={{ tone: "alarm", text: err() }}
                    class={ALERT_ROW}
                    testid={TESTID.headerSearchError}
                  />
                )}
              </Show>
              <Refusals
                of={nodes.refusals()}
                class={ALERT_ROW}
                testid={IDS_NAVIGATION.searchRefusal}
              />
              <ul
                class="m-0 max-h-72 list-none overflow-x-hidden overflow-y-auto p-1"
                data-asked={nodes.answering() ?? undefined}
              >
                <Index each={items()}>
                  {(item, index) => (
                    <li>
                      <Result
                        claims={props.claims}
                        href={actionHref(router?.routes, item().action)}
                        onNavigate={() => { setQuery(""); box?.blur() }}
                        label={item().label}

                        from={item().from}
                        needles={needles()}
                        place={item().place}
                        props={item().props}
                        faces={crumbFaces()}
                        active={isCurrent(index)}
                        testids={HEADER_ROW}
                        id={item().id}
                        onHover={() => cursor.to(index)}
                        onSelect={() => open(item())}
                      />
                    </li>
                  )}
                </Index>
              </ul>
              <SearchCount
                of={nodes}
                empty={nodes.answering() !== null}
                class="m-0 border-t border-rule/40 px-3 py-1.5 text-label text-muted"
              />
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
