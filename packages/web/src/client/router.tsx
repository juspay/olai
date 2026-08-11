/**
 * The address bar, as a signal — and the one component allowed to change it.
 *
 * Which page is open is a ROUTE rather than a piece of component state, so
 * every page in this app is a link someone can send, and the back button is
 * the history the browser already keeps. `history.pushState` plus `popstate`
 * is the whole mechanism; there is no router library here because two
 * addresses (routes.ts) do not need one.
 *
 * `<Link>` is what makes it real: a real `<a href>`, so middle-click, ⌘-click
 * and "copy link address" behave the way they do everywhere else, with a plain
 * left click intercepted and answered in place. The router reaches the tree
 * through a context rather than a prop, so drawing a tree of a thousand rows
 * does not thread a navigate callback through every one of them.
 *
 * Navigating is also the one thing in this app that MOVES THE PAGE, so the
 * router is where that is decided (./scroll.ts): every entry the reader visits
 * is keyed, and the key is what a position is remembered against. The keys are
 * the only thing this app puts in `history.state`.
 */

import { createContext, createSignal, type JSX, onCleanup, useContext } from "solid-js"

import { fileNamed, hrefOf, type Route, routeOf } from "./routes.ts"
import { createScrollMemory } from "./scroll.ts"

export interface Router {
  readonly route: () => Route
  readonly go: (route: Route) => void
}

/** What this app keeps on a history entry, which is a NAME for it and nothing
 *  else: what was on screen is derived from the address, and a second copy of
 *  it in `history.state` would be a copy that could disagree with the URL. */
interface Entry {
  readonly key: string
}

/** A key unique to this DOCUMENT — `timeOrigin` is when the document started,
 *  in fractional milliseconds, and no two share one. Scroll positions are
 *  remembered in memory (./scroll.ts), so a key minted before a reload must
 *  not be able to collide with one minted after it and name a position taken
 *  in a page that is gone. */
let minted = 0
const mintKey = (): string => `${performance.timeOrigin}#${++minted}`

/** The key an entry already carries, if it carries one. */
const keyIn = (state: unknown): string | undefined => {
  const entry = state as Partial<Entry> | null
  return typeof entry?.key === "string" ? entry.key : undefined
}

/** The key of the entry the reader is on, WRITTEN BACK when it has none — the
 *  one they landed on, one from before a reload, one an older olai pushed. A
 *  minted key that is not stored names nothing: the next visit to that same
 *  entry would mint a different one, and everything recorded against the first
 *  would be dead the moment it was written. */
const nameHere = (): string => {
  const known = keyIn(history.state)
  if (known !== undefined) return known
  const key = mintKey()
  // Two arguments: a third would be a URL, and this must not touch the address
  // a reader typed.
  history.replaceState({ key } as Entry, "")
  return key
}

export const createRouter = (): Router => {
  const [route, setRoute] = createSignal<Route>(routeOf(location.pathname))

  // The entry the reader landed on is named before anything can move, so
  // leaving it and coming back is a restore rather than a guess.
  nameHere()
  const scroll = createScrollMemory(() => keyIn(history.state))

  // The back button is a first-class way to navigate, not an edge case: the
  // whole point of a route is that the browser's own history works.
  const onPopState = () => {
    setRoute(routeOf(location.pathname))
    // AFTER the route, and it has to be: Solid draws the page the new route
    // names while `setRoute` is still running, and a page that has not been
    // drawn is a document with nowhere to scroll to.
    scroll.restore(nameHere())
  }
  addEventListener("popstate", onPopState)
  onCleanup(() => removeEventListener("popstate", onPopState))

  return {
    route,
    go: (next) => {
      history.pushState({ key: mintKey() } as Entry, "", hrefOf(next))
      setRoute(next)
      // A page you asked for, so: the top. Zooming out of the bottom of a long
      // outline used to land mid-page, at a line nobody chose.
      scroll.toTop()
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

/** The router for a component under `<RouterProvider>` — navigation without
 *  throwing the document away (`go` is pushState, not `location.assign`). */
export const useRouter = (): Router => {
  const router = useContext(RouterContext)
  if (router === undefined) {
    throw new Error("a <Link> outside the router — wrap the page in <RouterProvider>")
  }
  return router
}

export interface LinkProps {
  readonly route: Route
  readonly class?: string
  readonly title?: string
  readonly label?: string
  /** Marks this link as the page being read, for a reader using a screen
   *  reader and for the styling that says so. */
  readonly current?: boolean
  readonly testid?: string
  /** This link's outline could not be read. A `data-` fact rather than a class,
   *  because it is what the browser tests find a marked entry by. */
  readonly broken?: boolean
  /** Workflowy halo on a collapsed parent's bullet — a `data-` fact the
   *  browser tests assert on, never a colour. */
  readonly halo?: boolean
  readonly children?: JSX.Element
}

export function Link(props: LinkProps) {
  const router = useRouter()

  const onClick = (event: MouseEvent) => {
    // Let a modified click do what the browser does with any link: a new tab
    // is a reader saying they want the browser's behaviour, not ours.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return
    event.preventDefault()
    router.go(props.route)
  }

  return (
    <a
      href={hrefOf(props.route)}
      class={props.class}
      title={props.title}
      aria-label={props.label}
      aria-current={props.current === true ? "page" : undefined}
      data-testid={props.testid}
      // The file a link stands for, for the browser tests (./routes.ts).
      data-file={fileNamed(props.route)}
      data-broken={props.broken === true ? "true" : undefined}
      data-halo={props.halo === true ? "true" : undefined}
      onClick={onClick}
    >
      {props.children}
    </a>
  )
}
