import { createLane } from "./live.ts"
/**
 * The address bar, as a signal — and the one component allowed to change it.
 *
 * Which page is open is a ROUTE rather than a piece of component state, so
 * every page in this app is a link someone can send, and the back button is
 * the history the browser already keeps. A workspace is a LIST of those
 * routes (`./workspace.ts`); one pane is the address this app has always
 * written, and two or more encode the list so reload, Back and a shared
 * URL restore the same layout.
 *
 * `<Link>` is what makes it real: a real `<a href>`, so middle-click, ⌘-click
 * and "copy link address" behave the way they do everywhere else, with a plain
 * left click intercepted and answered in the pane the link was drawn in, and
 * Alt+click opening the pane to its right.
 *
 * The router reaches the tree through a context rather than a prop, so drawing
 * a tree of a thousand rows does not thread a navigate callback through every
 * one of them.
 */
import type { Lane, Router } from "./routing.tsx"
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
import { hrefOfWorkspace, type Workspace, workspaceOf } from "./workspace.ts"

/** What this app keeps on a history entry, which is a NAME for it and nothing
 *  else: what was on screen is derived from the address, and a second copy of
 *  it in `history.state` would be a copy that could disagree with the URL.
 *
 *  ...AND WHERE IT IS. `lane` is the tab the entry was written under (`null`
 *  while no row keeps tabs) and `at` its position in the stack — a push is one
 *  further than the entry it was pushed over, a replace keeps the position — so
 *  a traversal can tell which way it went and whose entry it reached
 *  (`./lanes.ts`). */
interface Entry {
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

const here = (): string =>
  location.pathname + location.search + location.hash

export const createRouter = (): Router => {
  const owner = getOwner()
  type Live = ReturnType<typeof createLane> & { dispose: () => void; name: ReturnType<typeof createSignal<string | null>> }
  const [live, setLive] = createSignal<readonly Live[]>([])
  const [front, setFront] = createSignal<Live>(undefined!)
  const inFront = createSelector(front)
  const lanes = createMemo(() => live().map(one => one.value))
  const workspace = () => front().value.workspace()
  const setWorkspace = (next: Workspace) => front().setWorkspace(next)
  const setLandings = (next: Landings) => front().setLandings(next)

  // THE NAME OF THE ENTRY UNDER THE READER, kept turn and turn about — the
  // one question a popstate cannot answer from its payload alone: did the
  // event TRAVERSE to another entry (whose key the router knows, every entry
  // it ever wrote being keyed once — a push mints, a replace keeps THE SAME
  // entry's name — and every one it traversed to below), or did the BROWSER
  // move inside this document? A same-document navigation births an entry
  // with no name of ours on it: that popstate is the address bar SPEAKING,
  // not the reader going back.
  //
  // THE LANE IN FORCE, and the table of which entry is whose. The table is this
  // DOCUMENT's: an entry written before a reload has no row, so while a lane is
  // in force it is dead, and history is per document (`./lanes.ts`). With no
  // lane in force nothing below reads it.
  const [lane, setLane] = createSignal<string | null>(null)
  let currentAt = atIn(history.state) ?? 0
  let rows: LaneRows = new Map([[currentAt, null]])
  /**
   * A TRAVERSAL STILL TRAVELLING — it reached another lane's entry and is on
   * its way to one of ours, or back to the entry it started from (which is
   * `currentAt`, unchanged until it lands). `steps` is how many entries from
   * there the browser is now; `pending` is a lane switch asked for meanwhile,
   * whose write to the entry waits until the browser is back on it.
   */
  let seeking: { readonly direction: 1 | -1; steps: number; pending?: () => void } | undefined
  const stamp = (key: string): Entry => ({ key, lane: untrack(lane), at: currentAt })
  /** An entry pushed over the one under the reader, by this router or by the
   *  browser: one position further, belonging to the lane in force, and every
   *  entry beyond it discarded. */
  const pushed = (): void => {
    currentAt += 1
    rows = pushedAt(rows, currentAt, untrack(lane))
  }
  /** The name of the entry under the reader, minted and written onto it where
   *  it has none — and its position, where a build before positions wrote it. */
  const nameHere = (): string => {
    const known = keyIn(history.state)
    if (known !== undefined && atIn(history.state) !== undefined) return known
    const key = known ?? mintKey()
    history.replaceState(stamp(key), "")
    return key
  }

  let currentKey = nameHere()
  const scroll = createScrollMemory(() => keyIn(history.state))

  /**
   * WHAT THE LANDINGS ARE AFTERWARDS is every caller's to say, and each of them
   * says one of three things.
   *
   * A verb that NAVIGATES one pane answers with {@link marked} of that pane —
   * a landing where the new address names a section, nothing where it does
   * not, and every other pane's left exactly as it was, because what happened
   * next door is not news about them.
   *
   * A verb that RENUMBERS the panes — opening one, closing one, reordering —
   * answers {@link NOWHERE}, or only the landing it just minted. A mark names
   * a pane by its index, and after a splice the pane at that index is a
   * different pane; carrying the marks through the permutation would be this
   * module keeping a second copy of `./workspace.ts`'s arithmetic for the sake
   * of a landing nobody is mid-way through.
   *
   * A verb that changes neither — focus, a collapse, a divider dragged — answers
   * {@link asTheyWere}, which is how it says nothing: the same map back, and the
   * signal compares by identity, so no pane hears about it at all.
   *
   * AS A FUNCTION OF WHAT THEY WERE rather than as a value, which is two things
   * at once: no verb has to READ the signal it is about to write — a read is a
   * subscription to whoever calls the verb, and every one of these is a DOM
   * handler today only — and there is no fourth answer, `undefined`, meaning
   * whatever the last reader of this file assumed it meant.
   */
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
    // ONE PROPAGATION, not two: without this every pane's landing memo re-runs
    // on the first write and everything drawn from the workspace on the second,
    // for one navigation.
    apply()
    if (how === "push") {
      // A page you asked for, so: the top. Always, even when the address
      // names a place inside the page — see the long argument this
      // replaced in the one-pane router. A split's columns are the
      // scrollports (`SHELL_SPLIT`, `./pane/Panes.tsx`); the window cannot
      // move there, and a `.html` preview's landing scrolls the column
      // itself (`olai-plugin-hypertext`’s `browser/Hypertext.tsx`). Sending the window to the top
      // is the lone-page kindness it always was.
      scroll.toTop()
    }
  }

  /** Land on the entry a traversal reached: the page the reader left there. */
  const arrive = (target: string, at: number | undefined): void => {
    if (at !== undefined) currentAt = at
    currentKey = target
    // NOBODY IS OWED AN ARRIVAL ON THE WAY BACK, in any pane: a browser applies
    // a hash when you follow a link and does not re-apply it when you come back
    // to that entry — what it owes you then is the position you left, which is
    // the scroll memory's. One statement about the whole address, because a
    // `popstate` IS one: every pane on it is the pane the reader left.
    batch(() => {
      setLandings(NOWHERE)
      setWorkspace(workspaceOf(routing, here()))
    })
    scroll.restore(nameHere())
  }

  /** Keep travelling: `delta` entries further, from wherever the browser is. */
  const travel = (delta: number): void => {
    if (seeking === undefined) return
    seeking.steps += delta
    history.go(delta)
  }
  /** On toward the lane's next entry, or back home. */
  const steer = (decision: "seek" | "bounce"): void =>
    travel(decision === "seek" ? seeking!.direction : -seeking!.steps)

  /**
   * WHILE TRAVELLING nothing on screen moves — no workspace, no landing, no
   * scroll: the entries passed through are not pages anyone asked for. The
   * traversal stops on one of this lane's entries, or back on the one it
   * started from, and only then does anything change (a switch asked for
   * meanwhile is written to that entry then).
   */
  const onTravel = (target: string | undefined, at: number | undefined): void => {
    const trip = seeking!
    if (at !== undefined) trip.steps = at - currentAt
    if (at !== undefined && at === currentAt) {
      seeking = undefined
      trip.pending?.()
      return
    }
    if (trip.pending !== undefined || at === undefined) {
      // HOME, and nowhere else: a switch is waiting, or the browser is on an
      // entry with no position (its own, or a build's before positions) and so
      // cannot say whether anything of this lane lies beyond it. Travelling on
      // past one could run off the end of the stack, where no popstate ever
      // comes and the trip would never finish; the entry it started from is
      // always there, `steps` away.
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
      // A same-document navigation the browser made is an entry pushed over
      // this one, and it belongs to whichever lane is in force. THAT IS AN
      // ASSUMPTION, and the one this reading rests on: a state-less entry the
      // reader TRAVERSED to would be read as a push too. None is reachable —
      // every entry is stamped the moment it is landed on (`nameHere` below),
      // so the only state-less entry a traversal can meet is one the browser
      // made and this document never drew.
      if (target === undefined) pushed()
      // THE ADDRESS BAR, MOVING INSIDE THIS DOCUMENT — a fragment arrived
      // hand-carried, or the very address on screen was asked for again.
      // That is an ARRIVAL the way the first paint is one (the browser's
      // own hashjump answers nothing here: a row is a place in a tree, not
      // an element id), so the address gets its landing minted the way the
      // first paint mints it, and where it lands is the act's to spend — a
      // reload of this URL would owe exactly that. The scroll memory's "the
      // position you left" belongs to entries, and none was traversed to.
      const next = workspaceOf(routing, here())
      currentKey = nameHere()
      batch(() => {
        setLandings(landingsOf(next))
        setWorkspace(next)
      })
      return
    }
    const inForce = untrack(lane)
    if (inForce !== null) {
      if (at === undefined) {
        // AN ENTRY FROM A BUILD BEFORE POSITIONS, still in the stack after the
        // upgrade's reload: this document did not write it, so it is dead —
        // and it has no position to say how far away it is. Such entries only
        // lie behind every entry this document wrote, so Back reached it by
        // one step, and one step forward is home.
        seeking = { direction: -1, steps: -1 }
        travel(1)
        return
      }
      // A TRAVERSAL WITH A LANE IN FORCE may have reached another tab's entry.
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
    // A trip in flight ends with the router: its write waited for an entry
    // this router will never be told it reached, so it is refused, not joined.
    seeking = undefined
  })

  /**
   * NAME THE LANE THE ENTRY UNDER THE READER BELONGS TO — and, given `to`, put
   * that lane's workspace on it, which is what a tab brought to the front is.
   * Not a history event either way: the entry is replaced, so Back from here is
   * the lane's own history.
   *
   * Without `to` nothing on screen moves and the address is left alone: a lane
   * taken over the first paint arrives before every tenant has claimed its URL,
   * and a plugin's page printed then would be the front page. With `to` it is
   * an arrival the way a traversal is one — no landing, and the place `to.key`
   * was left, which is the top for a key this document never saw.
   */
  const switchLane = (next: string | null, to?: { readonly workspace: Workspace; readonly key?: string }): string => {
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
      if (next === null) {
        const gone = untrack(live).filter(one => one !== target)
        setLive([target])
        for (const one of gone) one.dispose()
      }
      if (to !== undefined) scroll.restore(name)
      return name
    })
  }

  const forgetLane = (gone: string) => {
    rows = forgotten(rows, gone)
    const target = untrack(live).find(one => one.name[0]() === gone)
    // The tab store may forget the front immediately before switching it.
    // Keep that view until the replacement is installed in the same transaction.
    if (target === untrack(front)) {
      rows = new Map(rows).set(currentAt, gone)
    }
    if (target) {
      setLive(all => all.filter(one => one !== target))
      target.dispose()
    }
  }
  const makeLane = (name: string | null, seed: Workspace): Live => {
    const one = runWithOwner(owner, () => createRoot(dispose => {
      const nameSignal = createSignal(name)
      const state = createLane(seed, { lanes, lane: nameSignal[0], entryKey: () => currentKey, switchLane, forgetLane },
        () => inFront(result), (next, how, apply) => {
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
  // Service readers follow the front; lane readers retain their own view.
  const current = (): Lane => front().value
  return {
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
    goIn: (...args) => current().goIn(...args),
    replace: (...args) => current().replace(...args),
    replaceIn: (...args) => current().replaceIn(...args),
    open: (...args) => current().open(...args),
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
