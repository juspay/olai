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
import type { Router } from "./routing.tsx"
import {
batch,
createEffect,
createSignal,
onCleanup,
untrack
} from "solid-js"

import {
asTheyWere,
landingOf,
type Landings,
landingsOf,
marked,
NOWHERE,
spent
} from "./landing.ts"
import { adopted, forgotten, type LaneRows, pushedAt, seek } from "./lanes.ts"
import type { Route } from "./routes.ts"
import { routing } from "./pages.ts"
import { createScrollMemory } from "./scroll.ts"
import {
closeAt,
closeFocused,
collapseAt,
expandAt,
focusAt,
focusBy,
focusedRoute,
hrefOfWorkspace,
isLone,
navigateIn,
openRight,
panesOf,
reorder as reorderPanes,
resizeTo,
type Workspace,
workspaceOf,
} from "./workspace.ts"

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
  const first = workspaceOf(routing, here())
  const [workspace, setWorkspace] = createSignal<Workspace>(first)
  const [landings, setLandings] = createSignal<Landings>(landingsOf(first))

  // A newly available plugin can claim the address already in the bar (for
  // example, Back into a disabled journal followed by enabling journal).
  // Reinterpret those routes when the claim table changes without navigating
  // or replacing the route objects that still mean the same thing.
  createEffect(() => {
    const parsed = workspaceOf(routing, here())
    const current = untrack(workspace)
    let next = current
    let arrivals = untrack(landings)
    const previous = panesOf(current)
    for (const [index, pane] of panesOf(parsed).entries()) {
      const before = previous[index]?.route
      if (before === undefined) continue
      if (before.kind === pane.route.kind && routing.href(before) === routing.href(pane.route)
        && (before.kind !== "plugin" || pane.route.kind !== "plugin"
          || before.source === pane.route.source)) continue
      next = navigateIn(next, index, pane.route)
      arrivals = marked(arrivals, index, landingOf(pane.route))
    }
    if (next !== current) batch(() => {
      setLandings(arrivals)
      setWorkspace({ ...next, focus: current.focus })
    })
  })

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
    land: (all: Landings) => Landings,
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
    batch(() => {
      setLandings(land)
      setWorkspace(next)
    })
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
    setLandings(NOWHERE)
    setWorkspace(workspaceOf(routing, here()))
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

  const goIn = (index: number, next: Route): void => {
    commit(
      navigateIn(workspace(), index, next),
      "push",
      (all) => marked(all, index, landingOf(next)),
    )
  }
  const replaceIn = (index: number, next: Route): void => {
    // A REPLACE IS NOT AN ARRIVAL — it is the same page at a different address
    // (a filter narrowed, a focus recorded), and the scroll is deliberately
    // left where it is. So this pane is owed nothing, and no other pane hears.
    commit(
      navigateIn(workspace(), index, next),
      "replace",
      (all) => marked(all, index, undefined),
    )
  }

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
    const name = to === undefined ? currentKey : (to.key ?? mintKey())
    // The entries this document wrote while no lane was in force belong to no
    // tab yet; the lane taken over them is the tab that was showing them.
    const owned = untrack(lane) === null && next !== null ? adopted(rows, next) : rows
    setLane(next)
    currentKey = name
    rows = new Map(owned).set(currentAt, next)
    const href = to === undefined ? undefined : hrefOfWorkspace(routing, to.workspace)
    const write = () => history.replaceState(stamp(name), "", href)
    // MID-TRAVEL the browser is on some other entry, so the write waits until
    // the traversal has taken it back to this one (`onTravel`).
    if (seeking !== undefined) seeking.pending = write
    else write()
    if (to === undefined) return name
    batch(() => {
      setLandings(NOWHERE)
      setWorkspace(to.workspace)
    })
    scroll.restore(name)
    return name
  }

  return {
    lane,
    entryKey: () => currentKey,
    switchLane,
    forgetLane: (gone) => {
      rows = forgotten(rows, gone)
      // Forgetting the lane in force keeps the entry under the reader alive,
      // so Back and Forward still have somewhere to come home to until the
      // next `switchLane` puts another lane on it.
      if (gone === untrack(lane)) rows = new Map(rows).set(currentAt, gone)
    },
    // THE ROSTER-DEPENDENT HALF OF THE GRAMMAR, on the router that holds the
    // routes — one binding over this row's own claim table (`./pages.ts`), so
    // every `<Link>`, every pane label and every consuming row asks one thing.
    routes: routing,
    workspace,
    route: () => focusedRoute(workspace()),
    landing: (index) => landings().get(index),
    landed: (index, file, at) =>
      setLandings((all) => spent(all, index, file, at)),
    go: (next) => goIn(workspace().focus, next),
    goIn,
    replace: (next) => replaceIn(workspace().focus, next),
    replaceIn,
    open: (next) => commit(next, "push", () => NOWHERE),
    openRight: (from, next, forceNew) => {
      const after = openRight(workspace(), from, next, forceNew === true)
      // A PANE IS BORN, so every index at or after it means a different pane
      // than it did a moment ago: only the arrival this verb is about survives.
      commit(after, "push", () => marked(NOWHERE, after.focus, landingOf(next)))
    },
    close: (index) => {
      const here = workspace()
      const after = index === undefined ? closeFocused(here) : closeAt(here, index)
      if (after === here) return
      // Closing the second-to-last returns a plain page: push, so Back
      // restores the split. A pane is gone, so the indices moved.
      commit(after, "push", () => NOWHERE)
    },
    focus: (index) => {
      const here = workspace()
      const after = focusAt(here, index)
      if (after.focus === here.focus) return
      // Focus is part of the address so a reload restores it, but it is
      // not a page you went TO: replace, so Back is not an un-focus. No pane
      // changed page, so no pane's landing changed either.
      commit(after, "replace", asTheyWere)
    },
    stepFocus: (delta) => {
      const here = workspace()
      if (isLone(here)) return
      const after = focusBy(here, delta)
      if (after.focus === here.focus) return
      commit(after, "replace", asTheyWere)
    },
    collapse: (index) => {
      commit(collapseAt(workspace(), index), "replace", asTheyWere)
    },
    expand: (index) => {
      commit(expandAt(workspace(), index), "replace", asTheyWere)
    },
    resize: (widths) => {
      commit(resizeTo(workspace(), widths), "replace", asTheyWere)
    },
    reorder: (from, to) => {
      // The panes are permuted, so every mark names the wrong one.
      commit(reorderPanes(workspace(), from, to), "push", () => NOWHERE)
    },
  }
}

