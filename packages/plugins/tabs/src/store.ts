/**
 * THE LIVE TAB SET — one per activation of the row, created inside the row's
 * own root (`./browser.tsx`) and offered as `tabs.state`.
 *
 * WHAT IT OWNS: the list and which tab is in front (`./list.ts` decides every
 * change), the stored copy of both (`./persist.ts`), and the lane the router
 * walks history in. WHAT IT DOES NOT: `history` itself, which is the
 * navigation row's — this names a lane and switches it (`Router.switchLane`),
 * and a closed tab's lane is forgotten (`Router.forgetLane`).
 *
 * THE FRONT TAB MIRRORS THE ROUTER. A door, Back, a pane verb: whatever moves
 * the router's workspace rewrites the front tab's address and title, and
 * nothing else in the list. A tab in the background has no page mounted and
 * does not change while it is there.
 *
 * TWO READINGS ARRIVE FROM COMPONENTS, because the row may not want what they
 * need: whether a strip draws the tabs on a desktop (`draw`, from the strip,
 * which names `layout.shell`) and which tabs wear the needs-you dot (`dot`,
 * from the attention component, which names `chat.state`). Each is registered
 * by its owner and released with it.
 */
import { type Accessor, createEffect, createMemo, createRoot, createSignal, untrack } from "solid-js"

import { createPreference } from "@olai/web/client/preference.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { hrefOfWorkspace, panesOf, type Workspace, workspaceOf } from "olai-plugin-navigation/workspace"

import { type Dots, type Tab, TABS_KEY, type TabsState } from "./contract.ts"
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
import { storedCodec } from "./persist.ts"

export interface TabsStore extends TabsState {
  /** Put the front tab's lane in force. The answer gives the window its own
   *  history back (`switchLane(null, …)`), which is the row's release. */
  readonly takeLane: () => () => void
  /** Mirror the router into the front tab, and keep the stored set written.
   *  The answer stops both. */
  readonly follow: () => () => void
}

/**
 * What a workspace is called: the page's own title where the page in it
 * reported one (`live`, which is only true of the workspace being drawn), else
 * its label; a split's leaves' labels joined.
 */
export const titleOf = (
  router: Pick<Navigation, "info" | "routes">,
  workspace: Workspace,
  live: boolean,
): string => {
  const panes = panesOf(workspace)
  if (panes.length === 1) {
    const reported = live ? router.info(0)?.title?.trim() : undefined
    return reported !== undefined && reported !== "" ? reported : router.routes.label(panes[0]!.route)
  }
  return panes.map((pane) => router.routes.label(pane.route)).join(" + ")
}

export const createTabs = (router: Navigation): TabsStore => {
  const preference = createPreference(TABS_KEY, storedCodec)
  const hrefOf = (workspace: Workspace): string => hrefOfWorkspace(router.routes, workspace)

  // READ ONCE, here. The address bar WINS over the stored front tab's page: a
  // link somebody opened, or an address typed, is what the tab in front shows,
  // and a reload writes that very address back anyway.
  const stored = untrack(preference.value)
  const drawing = untrack(router.workspace)
  const initial: TabList = stored === undefined
    ? { tabs: [{ id: nextId(undefined), href: hrefOf(drawing), title: titleOf(router, drawing, false) }], front: nextId(undefined) }
    : updateTab(stored, stored.front, { href: hrefOf(drawing) })
  const [list, setList] = createSignal<TabList>(initial)

  const [draws, setDraws] = createSignal<ReadonlyArray<Accessor<boolean>>>([])
  const [dots, setDots] = createSignal<ReadonlyArray<Dots>>([])
  const drawn = createMemo(() => draws().some((desktop) => desktop()))
  const dotted = createMemo<ReadonlyMap<string, string>>(() =>
    new Map(dots().flatMap((one) => [...one.ids()].map((id) => [id, one.paint] as const))))

  /** Whether this store's lane is in force — between `takeLane` and its release. */
  let laned = false

  /**
   * THE ONE WAY THE LIST CHANGES. A verb hands over the list afterwards; what
   * that means for the router is read off the difference: tabs that went have
   * their lanes forgotten, and a new front tab has its lane switched in, after
   * the outgoing tab has recorded which entry it was left on.
   */
  const commit = (next: TabList): void => {
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
    const key = router.switchLane(laned ? incoming.id : null, workspaceOf(router.routes, incoming.href), incoming.key)
    setList((all) => updateTab(all, incoming.id, { key }))
  }

  const home = (from: TabList) => (): Tab => ({
    id: nextId(from),
    href: router.routes.href(HOME_ROUTE),
    title: router.routes.label(HOME_ROUTE),
  })

  return {
    tabs: () => list().tabs,
    front: () => list().front,
    drawn,
    dotted,
    open: (workspace, options) => {
      const from = untrack(list)
      const id = nextId(from)
      commit(openTab(from, { id, href: hrefOf(workspace), title: titleOf(router, workspace, false) },
        options?.behind === true && untrack(drawn)))
      return id
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
      setDraws((all) => [...all, desktop])
      return () => setDraws((all) => all.filter((one) => one !== desktop))
    },
    dot: (reading) => {
      setDots((all) => [...all, reading])
      return () => setDots((all) => all.filter((one) => one !== reading))
    },
    takeLane: () => {
      laned = true
      const front = untrack(list).front
      const key = router.switchLane(front, untrack(router.workspace), router.entryKey())
      setList((all) => updateTab(all, front, { key }))
      return () => {
        laned = false
        router.switchLane(null, untrack(router.workspace), router.entryKey())
      }
    },
    follow: () => createRoot((dispose) => {
      createEffect(() => {
        const workspace = router.workspace()
        const href = hrefOf(workspace)
        const title = titleOf(router, workspace, true)
        setList((all) => updateTab(all, all.front, { href, title }))
      })
      createEffect(() => preference.set(list()))
      return dispose
    }),
  }
}
