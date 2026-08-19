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

import { createContext, createSignal, type JSX, onCleanup, useContext } from "solid-js"

import { usePane } from "./pane/context.tsx"
import { splitClick } from "./press.ts"
import { ours } from "./press.ts"
import { fileNamed, hrefOf, type Route, routeIn, routeOf } from "./routes.ts"
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
  reorder as reorderPanes,
  resizeTo,
  type Workspace,
  workspaceOf,
} from "./workspace.ts"

export interface Router {
  readonly workspace: () => Workspace
  /** The focused pane's route — what the palette, the filter chord and
   *  anything that does not name a pane act on. */
  readonly route: () => Route
  /**
   * The place inside a page this NAVIGATION was asked to land on, and
   * WHICH pane it belongs to. A document in the other pane must not
   * treat a landing aimed at this one as its own — two panes previewing
   * two files was the whole point of freeing the watch set (#219), and
   * yanking both to a heading one of them named would be the same class
   * of bug.
   *
   * `at` is a FACT about where the reader is on that pane; landing is an
   * ACT, and it happens once, on arrival. Cleared on `popstate`. A first
   * paint counts as an arrival.
   */
  readonly landing: () => Landing | undefined
  /** Navigate the focused pane (push). */
  readonly go: (route: Route) => void
  /** Navigate a named pane (push). */
  readonly goIn: (index: number, route: Route) => void
  /** The same pane, at a different address — history replaced, scroll left. */
  readonly replace: (route: Route) => void
  readonly replaceIn: (index: number, route: Route) => void
  readonly openRight: (from: number, route: Route, forceNew?: boolean) => void
  readonly close: (index?: number) => void
  readonly focus: (index: number) => void
  readonly stepFocus: (delta: -1 | 1) => void
  readonly collapse: (index: number) => void
  readonly expand: (index: number) => void
  readonly resize: (widths: ReadonlyArray<number>) => void
  readonly reorder: (from: number, to: number) => void
}

export interface Landing {
  readonly index: number
  readonly at: string
}

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

/** Where inside a page an arrival LANDS — a heading's own slug, and nothing
 *  for an address that names a whole place. It is read off the address, which
 *  is the only thing that says it: a `#` after a body is a heading, and after
 *  an outline it is a node (`@olai/format`'s `address.ts`), so the grammar has
 *  already decided which of the two this is. */
const landingIn = (route: Route): string | undefined =>
  route.kind === "at" && route.address?.kind === "heading" ? route.address.slug : undefined

const landingOf = (index: number, route: Route): Landing | undefined => {
  const at = landingIn(route)
  return at === undefined ? undefined : { index, at }
}

export const createRouter = (): Router => {
  const first = workspaceOf(here())
  const [workspace, setWorkspace] = createSignal<Workspace>(first)
  const [landing, setLanding] = createSignal<Landing | undefined>(
    landingOf(first.focus, focusedRoute(first)),
  )

  nameHere()
  const scroll = createScrollMemory(() => keyIn(history.state))

  const commit = (
    next: Workspace,
    how: "push" | "replace",
    land?: Landing,
  ): void => {
    const href = hrefOfWorkspace(next)
    if (how === "push") {
      history.pushState({ key: mintKey() } as Entry, "", href)
    } else {
      history.replaceState({ key: nameHere() } as Entry, "", href)
    }
    setLanding(land)
    setWorkspace(next)
    if (how === "push") {
      // A page you asked for, so: the top. Always, even when the address
      // names a place inside the page — see the long argument this
      // replaced in the one-pane router. With more than one pane the
      // DOCUMENT still scrolls (each pane is a column in the same
      // scrollport until it is tall enough to be its own); sending the
      // window to the top is the same kindness it was for one.
      scroll.toTop()
    }
  }

  const onPopState = () => {
    setLanding(undefined)
    setWorkspace(workspaceOf(here()))
    scroll.restore(nameHere())
  }
  addEventListener("popstate", onPopState)
  onCleanup(() => removeEventListener("popstate", onPopState))

  const goIn = (index: number, next: Route): void => {
    commit(navigateIn(workspace(), index, next), "push", landingOf(index, next))
  }
  const replaceIn = (index: number, next: Route): void => {
    commit(navigateIn(workspace(), index, next), "replace")
  }

  return {
    workspace,
    route: () => focusedRoute(workspace()),
    landing,
    go: (next) => goIn(workspace().focus, next),
    goIn,
    replace: (next) => replaceIn(workspace().focus, next),
    replaceIn,
    openRight: (from, next, forceNew) => {
      const after = openRight(workspace(), from, next, forceNew === true)
      commit(after, "push", landingOf(after.focus, next))
    },
    close: (index) => {
      const here = workspace()
      const after = index === undefined ? closeFocused(here) : closeAt(here, index)
      if (after === here) return
      // Closing the second-to-last returns a plain page: push, so Back
      // restores the split.
      commit(after, "push")
    },
    focus: (index) => {
      const here = workspace()
      const after = focusAt(here, index)
      if (after.focus === here.focus) return
      // Focus is part of the address so a reload restores it, but it is
      // not a page you went TO: replace, so Back is not an un-focus.
      commit(after, "replace")
    },
    stepFocus: (delta) => {
      const here = workspace()
      if (isLone(here)) return
      const after = focusBy(here, delta)
      if (after.focus === here.focus) return
      commit(after, "replace")
    },
    collapse: (index) => {
      commit(collapseAt(workspace(), index), "replace")
    },
    expand: (index) => {
      commit(expandAt(workspace(), index), "replace")
    },
    resize: (widths) => {
      commit(resizeTo(workspace(), widths), "replace")
    },
    reorder: (from, to) => {
      commit(reorderPanes(workspace(), from, to), "push")
    },
  }
}

const RouterContext = createContext<Router>()

export function RouterProvider(
  props: { readonly router: Router; readonly children: JSX.Element },
) {
  return (
    <RouterContext.Provider value={props.router}>
      {props.children}
    </RouterContext.Provider>
  )
}

export const useRouter = (): Router => {
  const router = useContext(RouterContext)
  if (router === undefined) {
    throw new Error("a navigator outside the router — wrap the page in <RouterProvider>")
  }
  return router
}

/** Which pane a gesture in this component is about: the one we are
 *  drawn in, or the focused pane when we sit outside every pane. */
export const useHere = (): (() => number) => {
  const router = useRouter()
  const pane = usePane()
  return () => pane?.index ?? router.workspace().focus
}

/** Navigate the pane this component is in, or the focused pane when it is
 *  chrome that sits outside every pane. One helper so a `<Link>`, a menu
 *  "Zoom in" and a `.html` preview cannot pick three different panes. */
export const useGo = (): ((route: Route) => void) => {
  const router = useRouter()
  const here = useHere()
  return (route) => router.goIn(here(), route)
}

export interface LinkProps {
  readonly route: Route
  readonly class?: string
  readonly title?: string
  readonly label?: string
  readonly current?: boolean
  readonly testid?: string
  readonly broken?: boolean
  readonly halo?: boolean
  readonly children?: JSX.Element
}

/**
 * The page a click on a link inside RENDERED MARKDOWN is asking for, or `null`
 * for one to leave alone.
 *
 * Same rule as {@link Link}: a plain press is in-place in this pane; the
 * caller decides what to do with it. Split presses are not this function's
 * — they fail `ours`, so the pane's own listener can see Alt and open
 * right without this claiming the event as a same-pane go.
 */
const routeFrom = (
  event: MouseEvent,
  claimed: (event: MouseEvent) => boolean,
): Route | null => {
  if (!claimed(event)) return null
  const target = event.target
  if (!(target instanceof Element)) return null
  const href = target.closest("a")?.getAttribute("href")
  return href === undefined || href === null ? null : routeIn(href)
}

export const followed = (event: MouseEvent): Route | null =>
  routeFrom(event, ours)

/** The route an Alt+click on a written link is asking to open to the right,
 *  or `null`. Pair of {@link followed}, for the press `ours` declines. */
export const followedSplit = (event: MouseEvent): Route | null =>
  routeFrom(event, (event) => splitClick(event) !== null)

export function Link(props: LinkProps) {
  const router = useRouter()
  const here = useHere()
  const go = useGo()

  const onClick = (event: MouseEvent) => {
    const split = splitClick(event)
    if (split !== null) {
      event.preventDefault()
      router.openRight(here(), props.route, split === "force")
      return
    }
    if (!ours(event)) return
    event.preventDefault()
    go(props.route)
  }

  return (
    <a
      href={hrefOf(props.route)}
      class={props.class}
      title={props.title}
      aria-label={props.label}
      aria-current={props.current === true ? "page" : undefined}
      data-testid={props.testid}
      data-file={fileNamed(props.route)}
      data-broken={props.broken === true ? "true" : undefined}
      data-halo={props.halo === true ? "true" : undefined}
      onClick={onClick}
    >
      {props.children}
    </a>
  )
}
