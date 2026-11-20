import { createLane } from "./live.ts"
import type { Lane, NavigationRouter } from "./routing.tsx"
import {
batch,
createEffect,
createSignal,
createMemo,
createSelector,
createRoot,
getOwner,
runWithOwner,
onCleanup,
untrack
} from "solid-js"

import { type Landings, landingsOf, NOWHERE } from "./landing.ts"
import { adopted, forgotten, type LaneRows, pushedAt, seek } from "./lanes.ts"
import { routing } from "./pages.ts"
import { createScrollMemory } from "./scroll.ts"
import { legacyZoomHref, hrefOfWorkspace, isLone, focusedRoute, type Workspace, workspaceOf } from "./workspace.ts"

interface Entry {
  readonly links?: 2
  readonly key: string
  readonly lane: string | null
  readonly at: number
}

let minted = 0
const mintKey = (): string => `${performance.timeOrigin}#${++minted}`

const keyIn = (state: unknown): string | undefined => {
  const entry = state as Partial<Entry> | null
  return typeof entry?.key === "string" ? entry.key : undefined
}

const atIn = (state: unknown): number | undefined => {
  const entry = state as Partial<Entry> | null
  return typeof entry?.at === "number" && Number.isSafeInteger(entry.at) ? entry.at : undefined
}

const here = (): string => {
  const href = location.pathname + location.search + location.hash
  return keyIn(history.state) !== undefined && history.state?.links !== 2 ? legacyZoomHref(href) : href
}

export const createRouter = (): NavigationRouter => {
  const owner = getOwner()
  type Live = ReturnType<typeof createLane> & { dispose: () => void; name: ReturnType<typeof createSignal<string | null>> }
  const [live, setLive] = createSignal<readonly Live[]>([])
  const [front, setFront] = createSignal<Live>(undefined!)
  const [contentVisibility, setContentVisibility] = createSignal<readonly { shown: () => boolean }[]>([])
  const drawn = createMemo(() => contentVisibility().length === 0 || contentVisibility().some(row => row.shown()))
  const retiring = new Set<Live>()
  const inFront = createSelector(front)
  const lanes = createMemo(() => live().map(one => one.value))
  const workspace = () => front().value.workspace()
  const setWorkspace = (next: Workspace) => front().setWorkspace(next, here())
  const setLandings = (next: Landings) => front().setLandings(next)

  const [lane, setLane] = createSignal<string | null>(null)
  let currentAt = atIn(history.state) ?? 0
  let rows: LaneRows = new Map([[currentAt, null]])
  let seeking: { readonly direction: 1 | -1; steps: number; pending?: () => void } | undefined
  const stamp = (key: string): Entry => ({ links: 2, key, lane: untrack(lane), at: currentAt })
  const pushed = (): void => {
    currentAt += 1
    rows = pushedAt(rows, currentAt, untrack(lane))
  }
  const nameHere = (): string => {
    const known = keyIn(history.state)
    if (known !== undefined && atIn(history.state) !== undefined) return known
    const key = known ?? mintKey()
    history.replaceState(stamp(key), "")
    return key
  }

  const initial = here()
  if (initial !== location.pathname + location.search + location.hash) history.replaceState({ ...history.state, links: 2 }, "", initial)
  let currentKey = nameHere()
  const scroll = createScrollMemory(() => keyIn(history.state))
  let alive = true
  onCleanup(() => { alive = false })

  const commit = (
    next: Workspace,
    how: "push" | "replace",
    apply: () => void,
  ): void => {
    const href = hrefOfWorkspace(routing, next)
    if (how === "push") {
      currentKey = mintKey()
      pushed()
      history.pushState(stamp(currentKey), "", href)
    } else {
      history.replaceState(stamp(keyIn(history.state) ?? mintKey()), "", href)
    }
    apply()
    if (how === "push") {
      scroll.toTop()
    }
  }

  const arrive = (target: string, at: number | undefined): void => {
    if (at !== undefined) currentAt = at
    currentKey = target
    batch(() => {
      setLandings(NOWHERE)
      setWorkspace(workspaceOf(routing, here()))
    })
    scroll.restore(nameHere())
  }

  const travel = (delta: number): void => {
    if (seeking === undefined) return
    seeking.steps += delta
    history.go(delta)
  }
  const steer = (decision: "seek" | "bounce"): void =>
    travel(decision === "seek" ? seeking!.direction : -seeking!.steps)

  const onTravel = (target: string | undefined, at: number | undefined): void => {
    const trip = seeking!
    if (at !== undefined) trip.steps = at - currentAt
    if (at !== undefined && at === currentAt) {
      seeking = undefined
      trip.pending?.()
      return
    }
    if (trip.pending !== undefined || at === undefined) {
      travel(-trip.steps)
      return
    }
    const decision = seek(rows, currentAt, at, untrack(lane))
    if (decision === "apply") {
      seeking = undefined
      arrive(target!, at)
    } else steer(decision)
  }

  const onPopState = () => {
    const target = keyIn(history.state)
    const at = atIn(history.state)
    if (seeking !== undefined) return onTravel(target, at)
    if (target === undefined || (target === currentKey && (at === undefined || at === currentAt))) {
      if (target === undefined) pushed()
      const next = workspaceOf(routing, here())
      currentKey = nameHere()
      if (isLone(next) && front().revealVisible(focusedRoute(next))) return
      batch(() => {
        setLandings(landingsOf(next))
        setWorkspace(next)
      })
      return
    }
    const inForce = untrack(lane)
    if (inForce !== null) {
      if (at === undefined) {
        seeking = { direction: -1, steps: -1 }
        travel(1)
        return
      }
      const decision = seek(rows, currentAt, at, inForce)
      if (decision !== "apply") {
        seeking = { direction: Math.sign(at - currentAt) as 1 | -1, steps: at - currentAt }
        steer(decision)
        return
      }
    }
    arrive(target, at)
  }
  addEventListener("popstate", onPopState)
  onCleanup(() => {
    removeEventListener("popstate", onPopState)
    seeking = undefined
  })

  const switchLane = (next: string | null, to?: { readonly workspace: Workspace; readonly key?: string }): string => {
    scroll.leave()
    return batch(() => {
      const previous = untrack(front)
      const adopting = untrack(lane) === null && next !== null
      let target = next === null || adopting ? previous : untrack(live).find(one => one.name[0]() === next)
      if (!target) target = makeLane(next, to?.workspace ?? previous.value.workspace())
      target.name[1](next)
      const name = to === undefined ? currentKey : (to.key ?? mintKey())
      const owned = adopting ? adopted(rows, next!) : rows
      setLane(next)
      currentKey = name
      rows = new Map(owned).set(currentAt, next)
      const href = to === undefined ? undefined : hrefOfWorkspace(routing, target.value.workspace())
      const write = () => history.replaceState(stamp(name), "", href)
      if (seeking !== undefined) seeking.pending = write
      else write()
      setFront(target)
      retiring.delete(target)
      const retired = [...retiring]
      retiring.clear()
      if (retired.length) {
        setLive(all => all.filter(one => !retired.includes(one)))
        for (const one of retired) one.dispose()
      }
      if (next === null) {
        const gone = untrack(live).filter(one => one !== target)
        setLive([target])
        for (const one of gone) one.dispose()
      }
      if (to !== undefined) queueMicrotask(() => { if (alive && currentKey === name) scroll.restore(name) })
      return name
    })
  }

  const forgetLane = (gone: string) => {
    rows = forgotten(rows, gone)
    const target = untrack(live).find(one => one.name[0]() === gone)
    if (target === untrack(front)) {
      rows = new Map(rows).set(currentAt, gone)
      retiring.add(target)
      return
    }
    if (target) {
      setLive(all => all.filter(one => one !== target))
      target.dispose()
    }
  }
  const makeLane = (name: string | null, seed: Workspace): Live => {
    const one = runWithOwner(owner, () => createRoot(dispose => {
      const nameSignal = createSignal(name)
      const state = createLane(seed, { lane: nameSignal[0] },
        () => inFront(result) && drawn(), (next, how, apply) => {
          if (untrack(front) === result) commit(next, how, apply)
          else apply()
        }, name === null ? here() : undefined)
      const result: Live = { ...state, dispose, name: nameSignal }
      return result
    }))!
    setLive(all => [...all, one])
    return one
  }
  setFront(makeLane(null, workspaceOf(routing, here())))
  onCleanup(() => { for (const one of untrack(live)) one.dispose() })
  let tabOpener: ((workspace: Workspace) => void) | undefined
  const current = (): Lane => front().value
  return {
    offerTabs(open) {
      if (tabOpener) throw new Error("navigation already has a tab owner")
      tabOpener = open
      return () => { if (tabOpener === open) tabOpener = undefined }
    },
    openTab(workspace) { if (!tabOpener) return false; tabOpener(workspace); return true },
    drawContent(shown) {
      const row = { shown }
      setContentVisibility(rows => [...rows, row])
      return () => setContentVisibility(rows => rows.filter(one => one !== row))
    },
    lanes, lane, entryKey: () => currentKey, switchLane, forgetLane,
    routes: routing,
    workspace,
    panes: createMemo(() => current().panes()),
    focusIndex: createMemo(() => current().focusIndex()),
    split: createMemo(() => current().split()),
    route: createMemo(() => current().route()),
    info: index => current().info(index),
    focused: createMemo(() => current().focused()),
    report: (index, info) => current().report(index, info),
    shown: () => true,
    landing: index => current().landing(index),
    landed: (...args) => current().landed(...args),
    go: (...args) => current().go(...args),
    revealState: index => current().revealState(index),
    goIn: (...args) => current().goIn(...args),
    replace: (...args) => current().replace(...args),
    replaceIn: (...args) => current().replaceIn(...args),
    open: (...args) => current().open(...args),
    openWorkspaceRight: (...args) => current().openWorkspaceRight(...args),
    openRight: (...args) => current().openRight(...args),
    close: (...args) => current().close(...args),
    focus: (...args) => current().focus(...args),
    stepFocus: (...args) => current().stepFocus(...args),
    collapse: (...args) => current().collapse(...args),
    expand: (...args) => current().expand(...args),
    resize: (...args) => current().resize(...args),
    reorder: (...args) => current().reorder(...args),
  }
}
