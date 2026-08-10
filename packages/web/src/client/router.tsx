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
 */

import { createContext, createSignal, type JSX, onCleanup, useContext } from "solid-js"

import { fileNamed, hrefOf, type Route, routeOf } from "./routes.ts"

export interface Router {
  readonly route: () => Route
  readonly go: (route: Route) => void
}

export const createRouter = (): Router => {
  const [route, setRoute] = createSignal<Route>(routeOf(location.pathname))

  // The back button is a first-class way to navigate, not an edge case: the
  // whole point of a route is that the browser's own history works.
  const onPopState = () => setRoute(routeOf(location.pathname))
  addEventListener("popstate", onPopState)
  onCleanup(() => removeEventListener("popstate", onPopState))

  return {
    route,
    go: (next) => {
      history.pushState(null, "", hrefOf(next))
      setRoute(next)
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

const useRouter = (): Router => {
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
      onClick={onClick}
    >
      {props.children}
    </a>
  )
}
