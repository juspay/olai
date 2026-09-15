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
import { type Accessor, createEffect, createMemo, createRoot, createSignal, on, untrack } from "solid-js"

import { createPreference } from "@olai/web/client/preference.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { hrefOfWorkspace, lone, panesOf, type Workspace, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Dots, Tab, TabsState } from "./contract.ts"
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
  /** Hold the front tab's lane in force while a strip draws the tabs on a
   *  desktop, and the window's own history otherwise. The answer gives the
   *  window its history back, which is the row's release. */
  readonly takeLane: () => () => void
  /** Mirror the router into the front tab, and keep the stored set written.
   *  The answer stops both. */
  readonly follow: () => () => void
}

/** What a workspace is called before its page says: a page's label, or a
 *  split's leaves' labels joined. */
export const labelOf = (routes: Navigation["routes"], workspace: Workspace): string =>
  panesOf(workspace).map((pane) => routes.label(pane.route)).join(" + ")

/**
 * What the lone page being drawn calls itself, once it has really said. A page
 * mounts before it knows its name — no report, then its own address standing in
 * for one (`/#p71164pu`), then the name — and only the last is a name.
 */
const reportedName = (router: Pick<Navigation, "info" | "routes">, workspace: Workspace): string | undefined => {
  const [pane, ...more] = panesOf(workspace)
  const title = router.info(0)?.title?.trim()
  return more.length > 0 || pane === undefined || !title || title === router.routes.href(pane.route) ? undefined : title
}

export const createTabs = (router: Navigation): TabsStore => {
  // The stored set as it is PRINTED: read once here, written below only when
  // the printed string changes (`./persist.ts`'s `printStored`).
  const preference = createPreference<string | null>(TABS_KEY, { parse: (raw) => raw, print: (raw) => raw })
  const hrefOf = (workspace: Workspace): string => hrefOfWorkspace(router.routes, workspace)

  /** A tab holding `workspace`, named by its label until its page says. */
  const tabFor = (id: string, workspace: Workspace): Tab =>
    ({ id, href: hrefOf(workspace), title: labelOf(router.routes, workspace) })

  // READ ONCE, here. The address bar WINS over the stored front tab's page: a
  // link somebody opened, or an address typed, is what the tab in front shows.
  const here = tabFor(nextId(undefined), untrack(router.workspace))
  const [list, setList] = createSignal<TabList>(
    readStored(untrack(preference.value), here) ?? { tabs: [here], front: here.id })

  // EACH REGISTRATION IS ITS OWN ROW, released by the row rather than by the
  // value it carries: two strip activations hand over the same accessor
  // (layout's breakpoint is one function), and a release that compared values
  // would take the survivor's row with its own.
  const [draws, setDraws] = createSignal<ReadonlyArray<{ readonly desktop: Accessor<boolean> }>>([])
  const [dots, setDots] = createSignal<ReadonlyArray<{ readonly dots: Dots }>>([])
  const drawn = createMemo(() => draws().some((row) => row.desktop()))
  const dotted = createMemo<ReadonlyMap<string, string>>(() =>
    new Map(dots().flatMap(({ dots: one }) => [...one.ids()].map((id) => [id, one.paint] as const))))

  /** Whether a lane is in force — the router's own answer, and only this row
   *  takes one. */
  const laned = (): boolean => untrack(router.lane) !== null

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
    const workspace = workspaceOf(router.routes, incoming.href)
    if (laned()) {
      const key = router.switchLane(incoming.id, { workspace, key: incoming.key })
      setList((all) => updateTab(all, incoming.id, { key }))
    } else {
      // NOT DRIVEN — a phone, or no strip: the page is simply gone to, in the
      // window's own history, so Back returns to the page it came from.
      router.open(workspace)
    }
  }

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
      // THE LANE FOLLOWS THE STRIP. Below the breakpoint the tabs are kept but
      // not driven, so Back there is the window's — across a reload too — and
      // the first lane taken on a desk adopts whatever the window wrote meanwhile.
      createEffect(on(drawn, (desk) => {
        if (desk !== laned()) router.switchLane(desk ? untrack(list).front : null)
      }))
      return () => {
        dispose()
        if (laned()) router.switchLane(null)
      }
    }),
    follow: () => createRoot((dispose) => {
      createEffect(() => {
        const workspace = router.workspace()
        const href = hrefOf(workspace)
        const reported = reportedName(router, workspace)
        const label = labelOf(router.routes, workspace)
        // A TAB COMING BACK KEEPS ITS NAME while its page arrives, rather than
        // flickering through its stand-ins; only a page at a new address takes
        // its label before it has a real name.
        setList((all) => {
          const front = all.tabs.find((tab) => tab.id === all.front)
          return updateTab(all, all.front, { href, title: reported ?? (front?.href === href ? front.title : label) })
        })
      })
      // A WRITE ONLY WHEN WHAT IS KEPT CHANGES. The front tab's address and
      // name are not kept — the address bar supplies both at activation — so a
      // filter keystroke in the tab in front prints the same string and writes
      // nothing. A tab leaving the front is written with its last address then.
      const printed = createMemo(() => printStored(list()))
      createEffect(() => preference.set(printed()))
      return dispose
    }),
  }
}
