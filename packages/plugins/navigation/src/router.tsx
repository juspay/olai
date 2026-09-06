import type { Router } from "./routing.tsx"
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
import { hrefOf,type Route } from "./routes.ts"
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
 *  it in `history.state` would be a copy that could disagree with the URL. */
interface Entry {
  readonly key: string
}

let minted = 0
const mintKey = (): string => `${performance.timeOrigin}#${++minted}`

const keyIn = (state: unknown): string | undefined => {
  const entry = state as Partial<Entry> | null
  return typeof entry?.key === "string" ? entry.key : undefined
}

const nameHere = (): string => {
  const known = keyIn(history.state)
  if (known !== undefined) return known
  const key = mintKey()
  history.replaceState({ key } as Entry, "")
  return key
}

const here = (): string =>
  location.pathname + location.search + location.hash

export const createRouter = (): Router => {
  const first = workspaceOf(here())
  const [workspace, setWorkspace] = createSignal<Workspace>(first)
  // A newly available plugin can claim the address already in the bar (for
  // example, Back into a disabled journal followed by enabling journal).
  // Reinterpret those routes when the claim table changes without navigating
  // or replacing the route objects that still mean the same thing.
  createEffect(() => {
    const parsed = workspaceOf(here())
    const current = untrack(workspace)
    let next = current
    const previous = panesOf(current)
    for (const [index, pane] of panesOf(parsed).entries()) {
      const before = previous[index]?.route
      if (before === undefined) continue
      if (before.kind === pane.route.kind && hrefOf(before) === hrefOf(pane.route)
        && (before.kind !== "plugin" || pane.route.kind !== "plugin"
          || before.source === pane.route.source)) continue
      next = navigateIn(next, index, pane.route)
    }
    if (next !== current) setWorkspace({ ...next, focus: current.focus })
  })

  const [landings, setLandings] = createSignal<Landings>(landingsOf(first))

  // THE NAME OF THE ENTRY UNDER THE READER, kept turn and turn about — the
  // one question a popstate cannot answer from its payload alone: did the
  // event TRAVERSE to another entry (whose key the router knows, every entry
  // it ever wrote being keyed once — a push mints, a replace keeps THE SAME
  // entry's name — and every one it traversed to below), or did the BROWSER
  // move inside this document? A same-document navigation births an entry
  // with no name of ours on it: that popstate is the address bar SPEAKING,
  // not the reader going back.
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
    const href = hrefOfWorkspace(next)
    if (how === "push") {
      currentKey = mintKey()
      history.pushState({ key: currentKey } as Entry, "", href)
    } else {
      history.replaceState({ key: nameHere() } as Entry, "", href)
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
      // itself (`./document/Hypertext.tsx`). Sending the window to the top
      // is the lone-page kindness it always was.
      scroll.toTop()
    }
  }

  const onPopState = () => {
    const target = keyIn(history.state)
    if (target === undefined || target === currentKey) {
      // THE ADDRESS BAR, MOVING INSIDE THIS DOCUMENT — a fragment arrived
      // hand-carried, or the very address on screen was asked for again.
      // That is an ARRIVAL the way the first paint is one (the browser's
      // own hashjump answers nothing here: a row is a place in a tree, not
      // an element id), so the address gets its landing minted the way the
      // first paint mints it, and where it lands is the act's to spend — a
      // reload of this URL would owe exactly that. The scroll memory's "the
      // position you left" belongs to entries, and none was traversed to.
      const next = workspaceOf(here())
      currentKey = nameHere()
      batch(() => {
        setLandings(landingsOf(next))
        setWorkspace(next)
      })
      return
    }
    currentKey = target
    // NOBODY IS OWED AN ARRIVAL ON THE WAY BACK, in any pane: a browser applies
    // a hash when you follow a link and does not re-apply it when you come back
    // to that entry — what it owes you then is the position you left, which is
    // the scroll memory's. One statement about the whole address, because a
    // `popstate` IS one: every pane on it is the pane the reader left.
    setLandings(NOWHERE)
    setWorkspace(workspaceOf(here()))
    scroll.restore(nameHere())
  }
  addEventListener("popstate", onPopState)
  onCleanup(() => removeEventListener("popstate", onPopState))

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

  return {
    workspace,
    route: () => focusedRoute(workspace()),
    landing: (index) => landings().get(index),
    landed: (index, file, at) =>
      setLandings((all) => spent(all, index, file, at)),
    go: (next) => goIn(workspace().focus, next),
    goIn,
    replace: (next) => replaceIn(workspace().focus, next),
    replaceIn,
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

