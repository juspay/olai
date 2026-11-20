import { Key } from "@solid-primitives/keyed"
import { createEffect, createMemo, createSelector, createSignal, on, Show } from "solid-js"

import { DOT } from "@olai/web/client/readout.ts"
import { createDrags } from "@olai/web/client/pointer.ts"
import { SHOWN_WITHOUT_HOVER } from "@olai/ui-primitives/touch.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { LAYER } from "@olai/web/client/layer.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { lone } from "olai-plugin-navigation/workspace"

import type { Tab, TabsState } from "./contract.ts"
import { createFaces, glyphOf } from "./face.ts"
import { PointMenu } from "./chunk.ts"
import { TESTID } from "./testids.ts"

const DRAG_PX = 8

export function Strip(props: { readonly tabs: TabsState; readonly router: Navigation }) {
  const tabs = props.tabs
  const [menu, setMenu] = createSignal<{ readonly id: string; readonly x: number; readonly y: number } | null>(null)
  const [lifted, setLifted] = createSignal<string | null>(null)
  const [over, setOver] = createSignal<{ readonly id: string; readonly side: "before" | "after" } | null>(null)
  let row: HTMLDivElement | undefined
  const drags = createDrags()

  const landingAt = (x: number, from: number): number => {
    const faces = row === undefined ? [] : [...row.querySelectorAll(`[data-testid="${TESTID.tabsTab}"]`)]
    const hit = faces.findIndex((face) => {
      const box = face.getBoundingClientRect()
      return x >= box.left && x <= box.right
    })
    if (hit >= 0) return hit
    return x < (faces[0]?.getBoundingClientRect().left ?? 0) ? 0 : Math.max(from, faces.length - 1)
  }

  const faces = createFaces(props.router.routes, tabs.tabs)

  /** Inside a `then` rather than a `catch`: a page served over plain http has
   *  no `navigator.clipboard` at all, so the call throws before any promise
   *  exists. The address is handed over to copy by hand instead. */
  const copyAddress = (id: string): void => {
    const href = tabs.tabs().find((tab) => tab.id === id)?.href
    if (href === undefined) return
    const url = new URL(href, location.href).href
    Promise.resolve().then(() => navigator.clipboard.writeText(url)).catch(() => {
      window.prompt("Couldn't copy the address. Copy it from here:", url)
    })
  }

  const isFront = createSelector(tabs.front)
  const lifting = createSelector(lifted)
  const front = createMemo(() => tabs.front())
  createEffect(on(front, (id) => queueMicrotask(() => {
    if (row === undefined || !row.isConnected) return
    const face = row.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`)
    if (face === null) return
    const left = face.offsetLeft - row.offsetLeft
    if (left < row.scrollLeft) row.scrollLeft = left
    else if (left + face.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left + face.offsetWidth - row.clientWidth
  })))

  const press = (event: PointerEvent, tab: Tab) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("button")) return
    const from = tabs.tabs().findIndex((one) => one.id === tab.id)
    let moved = false
    drags.start(event, {
      threshold: DRAG_PX,
      onStart: () => {
        moved = true
        setLifted(tab.id)
      },
      onMove: (move) => {
        const to = landingAt(move.clientX, from)
        const target = tabs.tabs()[to]
        setOver(to === from || target === undefined ? null : { id: target.id, side: to < from ? "before" : "after" })
      },
      onEnd: (up) => {
        setLifted(null)
        setOver(null)
        if (up === null) return
        if (!moved) return tabs.show(tab.id)
        const to = landingAt(up.clientX, from)
        if (to !== from) tabs.reorder(from, to)
      },
    })
  }

  return (
    <div data-testid={TESTID.tabsStrip} class="relative flex h-full items-stretch gap-1 pr-1">
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-rule" />
      <div ref={row} role="tablist" aria-label="Open tabs"
        class="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        <Key each={tabs.tabs()} by="id">{(tab, index) => {
          const front = () => isFront(tab().id)
          const href = createMemo(() => tab().href)
          const glyph = createMemo(() => glyphOf(props.router.routes, href()))
          const face = createMemo(() => faces().get(tab().id), undefined, { equals: (a, b) => a?.title === b?.title && a?.tip === b?.tip })
          const title = () => face()?.title ?? tab().title
          const dot = () => tabs.dotted().get(tab().id)
          const isLifted = () => lifting(tab().id)
          const drop = () => (over()?.id === tab().id ? over()!.side : undefined)
          const said = () =>
            [title(), dot()?.label, face()?.tip ?? tab().href]
              .filter((one): one is string => one !== undefined && one !== "")
              .join(", ")
          return (
            <Tip text={face()?.tip ?? tab().href} layer={LAYER.over}>
              <div
                role="tab"
                aria-selected={front()}
                aria-label={said()}
                tabIndex={front() ? 0 : -1}
                data-testid={TESTID.tabsTab}
                data-tab={String(index())}
                data-tab-id={tab().id}
                data-tab-front={front() ? "true" : undefined}
                data-href={tab().href}
                data-lifted={isLifted() ? "true" : undefined}
                data-drop={drop()}
                class="olai-tab-filled group/tab relative flex h-full min-w-[5rem] max-w-[14rem] flex-1 basis-0 cursor-default select-none items-center gap-1.5 whitespace-nowrap border-r border-rule pl-3 pr-1 text-label"
                classList={{
                  "bg-paper font-medium text-ink": front(),
                  "text-muted hover:bg-ink/5 hover:text-ink": !front(),
                  "opacity-40": isLifted(),
                }}
                draggable={false}
                onPointerDown={(event) => press(event, tab())}
                onMouseDown={(event) => { if (event.button === 1) event.preventDefault() }}
                onAuxClick={(event) => {
                  if (event.button !== 1) return
                  event.preventDefault()
                  tabs.close(tab().id)
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setMenu({ id: tab().id, x: event.clientX, y: event.clientY })
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault()
                    tabs.step(event.key === "ArrowRight" ? 1 : -1)
                  }
                }}
              >
                <Show when={drop()}>{(side) =>
                  <span aria-hidden="true" class="pointer-events-none absolute inset-y-1.5 w-0.5 rounded-full bg-accent"
                    classList={{ "-left-0.5": side() === "before", "-right-0.5": side() === "after" }} />
                }</Show>
                <span aria-hidden="true" class="shrink-0 text-caption opacity-70">{glyph()}</span>
                <span data-testid={TESTID.tabsTitle} class="min-w-0 flex-1 truncate">{title()}</span>
                <Show when={dot()}>{(mark) =>
                  <span data-testid={TESTID.tabsDot} data-tab-dot="true" role="img" aria-label={mark().label} class={`${DOT} ${mark().paint}`} />
                }</Show>
                <Tip text="Close tab" layer={LAYER.over}>
                  <button
                    type="button"
                    data-testid={TESTID.tabsClose}
                    aria-label={`Close ${title()}`}
                    class={`flex size-5 shrink-0 items-center justify-center rounded-control text-body leading-none text-muted hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 group-hover/tab:opacity-100 ${SHOWN_WITHOUT_HOVER}`}
                    classList={{ "opacity-0": !front() }}
                    onClick={(event) => {
                      event.stopPropagation()
                      tabs.close(tab().id)
                    }}
                  >×</button>
                </Tip>
              </div>
            </Tip>
          )
        }}</Key>
      </div>
      <Tip text="New tab" layer={LAYER.over}>
        <button
          type="button"
          data-testid={TESTID.tabsNew}
          aria-label="New tab"
          class="my-auto flex size-6 shrink-0 items-center justify-center rounded-control text-muted hover:bg-ink/5 hover:text-ink"
          onClick={() => tabs.open(lone(HOME_ROUTE))}
        >+</button>
      </Tip>
      <Show when={menu()} keyed>{(open) =>
        <PointMenu x={open.x} y={open.y} label="Tab menu" close={() => setMenu(null)} entries={[
          { label: "Duplicate tab", run: () => tabs.duplicate(open.id) },
          { label: "Close other tabs", run: () => tabs.closeOthers(open.id) },
          { label: "Copy address", run: () => copyAddress(open.id) },
          { rule: true },
          { label: "Close", run: () => tabs.close(open.id) },
        ]} />
      }</Show>
    </div>
  )
}
