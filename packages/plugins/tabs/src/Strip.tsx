/**
 * THE STRIP — the row of tabs above the panes, on a desktop.
 *
 * Desk ground and a one-pixel rule under it; the tab in front on paper with the
 * rule broken under it, the others muted. A press brings a tab forward when it
 * is let go, a drag reorders it with the
 * pane header's threshold and pointer helper, a middle-click closes it, and a
 * right-click opens its menu. `+` opens a front-page tab, and the readout at
 * the right is the address of the tab in front.
 *
 * It draws the list and nothing else: every verb is `tabs.state`'s.
 */
import { Key } from "@solid-primitives/keyed"
import { createEffect, createMemo, createSignal, on, Show } from "solid-js"

import { DOT } from "@olai/web/client/readout.ts"
import { createDrags } from "@olai/web/client/pointer.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { lone } from "olai-plugin-navigation/workspace"

import type { Tab, TabsState } from "./contract.ts"
import { glyphOf } from "./face.ts"
import { PointMenu } from "./chunk.ts"
import { TESTID } from "./testids.ts"

/** How far a press on a tab travels before it is a drag — the pane header's. */
const DRAG_PX = 8

export function Strip(props: { readonly tabs: TabsState; readonly router: Navigation }) {
  const tabs = props.tabs
  const [menu, setMenu] = createSignal<{ readonly id: string; readonly x: number; readonly y: number } | null>(null)
  const [lifted, setLifted] = createSignal<string | null>(null)
  /** Where a carried tab would land: the tab it is over, while it travels. */
  const [over, setOver] = createSignal<{ readonly id: string; readonly side: "before" | "after" } | null>(null)
  let row: HTMLDivElement | undefined
  // One gesture at a time, torn down with the strip — a strip removed
  // mid-drag (the row switched off, the breakpoint crossed) leaves no window
  // listener and no selection guard behind.
  const drags = createDrags()

  /** The index a tab carried from `from` lands at, for a pointer at `x`. */
  const landingAt = (x: number, from: number): number => {
    const faces = row === undefined ? [] : [...row.querySelectorAll(`[data-testid="${TESTID.tabsTab}"]`)]
    const hit = faces.findIndex((face) => {
      const box = face.getBoundingClientRect()
      return x >= box.left && x <= box.right
    })
    if (hit >= 0) return hit
    return x < (faces[0]?.getBoundingClientRect().left ?? 0) ? 0 : Math.max(from, faces.length - 1)
  }

  const frontHref = () => tabs.tabs().find((tab) => tab.id === tabs.front())?.href ?? ""

  // The tab in front is kept in view when it CHANGES — a chord or a new tab can
  // bring one forward that the strip has scrolled past. Only the strip's own
  // row scrolls, sideways: `scrollIntoView` would also move the window up to a
  // strip the reader had scrolled away from, and the front id is compared so a
  // navigation inside the tab (which rewrites its record) moves nothing.
  const front = createMemo(() => tabs.front())
  createEffect(on(front, (id) => queueMicrotask(() => {
    if (row === undefined || !row.isConnected) return
    const face = row.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`)
    if (face === null) return
    const left = face.offsetLeft - row.offsetLeft
    if (left < row.scrollLeft) row.scrollLeft = left
    else if (left + face.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left + face.offsetWidth - row.clientWidth
  })))

  // A PRESS THAT DOES NOT TRAVEL brings the tab forward when it is let go, not
  // when it goes down: the page coming back asks for its old scroll position,
  // and that request stands down for the reader's own pointerdown — which the
  // one still being dispatched would be.
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
    <div data-testid={TESTID.tabsStrip} class="relative flex h-full items-end gap-1 bg-desk px-2 pt-1.5">
      {/* The rule under the strip. Every tab is positioned and comes after it,
          so the tab in front, on paper, breaks the rule without a z-index. */}
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-rule/70" />
      <div ref={row} role="tablist" aria-label="open tabs"
        class="flex h-full min-w-0 flex-1 items-end gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        <Key each={tabs.tabs()} by="id">{(tab, index) => {
          const front = () => tabs.front() === tab().id
          const dot = () => tabs.dotted().get(tab().id)
          return (
            <div
              role="tab"
              aria-selected={front()}
              tabIndex={front() ? 0 : -1}
              title={tab().title}
              data-testid={TESTID.tabsTab}
              data-tab={String(index())}
              data-tab-id={tab().id}
              data-tab-front={front() ? "true" : undefined}
              data-href={tab().href}
              data-lifted={lifted() === tab().id ? "true" : undefined}
              data-drop={over()?.id === tab().id ? over()!.side : undefined}
              // EVERY TAB THE SAME WIDTH, up to a cap: a title that changes
              // (a page naming itself as it arrives) must not move its
              // neighbours along the strip.
              class="group/tab relative flex min-w-[5rem] max-w-[15rem] flex-1 basis-0 cursor-default select-none items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 pl-2.5 pr-1 text-[0.8125rem]"
              classList={{
                "h-full border-rule/70 bg-paper font-semibold text-ink": front(),
                "h-[calc(100%-0.25rem)] border-transparent text-muted hover:bg-panel/55 hover:text-ink": !front(),
                "opacity-40": lifted() === tab().id,
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
              {/* WHERE THE CARRIED TAB WOULD LAND, drawn on the tab it is over. */}
              <Show when={over()?.id === tab().id ? over()!.side : undefined}>{(side) =>
                <span aria-hidden="true" class="pointer-events-none absolute bottom-1 top-1.5 w-0.5 rounded-full bg-accent"
                  classList={{ "-left-0.5": side() === "before", "-right-0.5": side() === "after" }} />
              }</Show>
              <span aria-hidden="true" class="shrink-0 font-mono text-xs opacity-75">{glyphOf(props.router.routes, tab().href)}</span>
              <span class="min-w-0 truncate">{tab().title}</span>
              <Show when={dot()}>{(paint) =>
                <span data-testid={TESTID.tabsDot} data-tab-dot="true" role="img" aria-label="needs you" class={`${DOT} ${paint()}`} />
              }</Show>
              <button
                type="button"
                data-testid={TESTID.tabsClose}
                aria-label={`close ${tab().title}`}
                class="flex size-5 shrink-0 items-center justify-center rounded font-mono text-sm leading-none text-muted hover:bg-rule hover:text-ink focus-visible:opacity-100 group-hover/tab:opacity-100"
                classList={{ "opacity-0": !front() }}
                onClick={(event) => {
                  event.stopPropagation()
                  tabs.close(tab().id)
                }}
              >×</button>
            </div>
          )
        }}</Key>
      </div>
      <button
        type="button"
        data-testid={TESTID.tabsNew}
        aria-label="new tab"
        title="new tab"
        class="mb-1.5 flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-muted hover:bg-panel hover:text-ink"
        onClick={() => tabs.open(lone(HOME_ROUTE))}
      >+</button>
      <span data-testid={TESTID.tabsAddress} class="mb-2.5 ml-2 max-w-[18rem] shrink-0 truncate font-mono text-[0.7rem] text-muted">
        {frontHref()}
      </span>
      <Show when={menu()} keyed>{(open) =>
        <PointMenu x={open.x} y={open.y} label="tab" close={() => setMenu(null)} entries={[
          { label: "Duplicate tab", run: () => tabs.duplicate(open.id) },
          { label: "Close other tabs", run: () => tabs.closeOthers(open.id) },
          { rule: true },
          { label: "Close", run: () => tabs.close(open.id) },
        ]} />
      }</Show>
    </div>
  )
}
