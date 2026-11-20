import { type Accessor, batch, createEffect, createMemo, createRoot, createSignal, mapArray, on, untrack } from "solid-js"

import { createPreference } from "@olai/web/client/preference.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { hrefOfWorkspace, lone, panesOf, type Workspace, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Dots, Mark, Tab, TabsState } from "./contract.ts"
import {
  closeOthers,
  closeTab,
  duplicateTab,
  nextId,
  openTab,
  reorderTabs,
  showTab,
  stepFront,
  type TabList,
  updateTab,
} from "./list.ts"
import { printStored, readStored, TABS_KEY } from "./persist.ts"

export interface TabsStore extends TabsState {
  readonly takeLane: () => () => void
  readonly follow: () => () => void
}

const labelOf = (routes: Navigation["routes"], workspace: Workspace): string =>
  panesOf(workspace).map((pane) => routes.label(pane.route)).join(" + ")

export const createTabs = (router: Navigation): TabsStore => {
  const preference = createPreference<string | null>(TABS_KEY, { parse: (raw) => raw, print: (raw) => raw })
  const hrefOf = (workspace: Workspace): string => hrefOfWorkspace(router.routes, workspace)

  const tabFor = (id: string, workspace: Workspace): Tab =>
    ({ id, href: hrefOf(workspace), title: labelOf(router.routes, workspace) })

  const here = tabFor(nextId(undefined), untrack(router.workspace))
  const [list, setList] = createSignal<TabList>(
    readStored(untrack(preference.value), here) ?? { tabs: [here], front: here.id })

  const [draws, setDraws] = createSignal<ReadonlyArray<{ readonly desktop: Accessor<boolean> }>>([])
  const [dots, setDots] = createSignal<ReadonlyArray<{ readonly dots: Dots }>>([])
  const drawn = createMemo(() => draws().some((row) => row.desktop()))
  const dotted = createMemo<ReadonlyMap<string, Mark>>(() => {
    const marked = new Map<string, Mark>()
    for (const { dots: one } of dots()) {
      for (const id of one.ids()) {
        const held = marked.get(id)
        if (held === undefined || one.rank > held.rank) marked.set(id, one)
      }
    }
    return marked
  })

  let lane: Navigation["switchLane"] | undefined

  const commit = (next: TabList): void => batch(() => {
    const before = untrack(list)
    if (next === before) return
    const gone = before.tabs.filter((tab) => !next.tabs.some((kept) => kept.id === tab.id))
    for (const tab of gone) router.forgetLane(tab.id)
    if (next.front === before.front) {
      setList(next)
      return
    }
    setList(updateTab(next, before.front, { key: router.entryKey() }))
    const incoming = next.tabs.find((tab) => tab.id === next.front)!
    const workspace = workspaceOf(router.routes, incoming.href)
    if (lane !== undefined) {
      const key = lane(incoming.id, { workspace, key: incoming.key })
      setList((all) => updateTab(all, incoming.id, { key }))
    } else {
      router.open(workspace)
    }
  })

  const home = (from: TabList) => (): Tab => tabFor(nextId(from), lone(HOME_ROUTE))

  return {
    tabs: () => list().tabs,
    front: () => list().front,
    drawn,
    dotted,
    open: (workspace, options) => {
      const from = untrack(list)
      const tab = tabFor(nextId(from), workspace)
      commit(openTab(from, tab, options?.behind === true && untrack(drawn)))
      return tab.id
    },
    show: (id) => commit(showTab(untrack(list), id)),
    step: (delta) => commit(stepFront(untrack(list), delta)),
    close: (id) => {
      const from = untrack(list)
      commit(closeTab(from, id, home(from)))
    },
    closeOthers: (id) => commit(closeOthers(untrack(list), id)),
    duplicate: (id) => {
      const from = untrack(list)
      commit(duplicateTab(from, id, nextId(from)))
    },
    reorder: (from, to) => commit(reorderTabs(untrack(list), from, to)),
    draw: (desktop) => {
      const row = { desktop }
      setDraws((all) => [...all, row])
      return () => setDraws((all) => all.filter((one) => one !== row))
    },
    dot: (reading) => {
      const row = { dots: reading }
      setDots((all) => [...all, row])
      return () => setDots((all) => all.filter((one) => one !== row))
    },
    takeLane: () => createRoot((dispose) => {
      const take = (): void => {
        lane = router.switchLane
        lane(untrack(list).front)
      }
      const release = (): void => {
        if (lane === undefined) return
        const held = lane
        lane = undefined
        held(null)
      }
      createEffect(on(drawn, (desk) => {
        if (desk === (lane !== undefined)) return
        if (desk) take()
        else release()
      }))
      return () => {
        dispose()
        release()
      }
    }),
    follow: () => createRoot((dispose) => {
      const mirrors = mapArray(router.lanes, lane => {
        const href = createMemo(() => hrefOf(lane.workspace()))
        const label = createMemo(() => lane.panes().map(pane => router.routes.label(pane.route())).join(" + "))
        const reported = createMemo(() => {
          if (lane.panes().length !== 1) return undefined
          const title = lane.info(0)?.title?.trim()
          return title && title !== router.routes.href(lane.panes()[0]!.route()) ? title : undefined
        })
        createEffect(() => {
          const id = lane.lane(), address = href(), title = reported(), fallback = label()
          setList(all => {
            const key = id ?? all.front
            const tab = all.tabs.find(tab => tab.id === key)
            return tab ? updateTab(all, key, { href: address,
              title: title ?? (tab.href === address ? tab.title : fallback) }) : all
          })
        })
      })
      createEffect(mirrors)
      const printed = createMemo(() => printStored(list()))
      createEffect(() => preference.set(printed()))
      return dispose
    }),
  }
}
