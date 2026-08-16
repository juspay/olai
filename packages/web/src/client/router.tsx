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
 *
 * A link this app DRAWS is a `<Link>`; a link a reader WROTE — in a note, in a
 * document — is an anchor no component owns, and {@link followed} is the same
 * decision for those. Two shapes, one rule about what a click means
 * (`./press.ts`'s `ours`, which is where that rule moved when a third place —
 * a `#tag` pill — started asking it), because the difference between them is
 * who wrote the markup and not what the reader meant by pressing it.
 */

import { createContext, createSignal, type JSX, onCleanup, useContext } from "solid-js"

import { ours } from "./press.ts"
import { fileNamed, hrefOf, type Route, routeIn, routeOf } from "./routes.ts"
import { createScrollMemory } from "./scroll.ts"

export interface Router {
  readonly route: () => Route
  /**
   * The place inside the page this NAVIGATION was asked to land on, or nothing
   * — which is a different thing from the fragment the address carries, and the
   * difference is the whole reason it is here.
   *
   * `route().at` is a FACT about where the reader is: it stays true while they
   * are on that page, it is what a copied link carries, and it is still there
   * an hour later. Landing is an ACT, and it happens once, on arrival. Reading
   * the fact as though it were the act is what a browser is careful not to do:
   * it applies a hash when you follow a link and NOT when you come back to that
   * entry, because on the way back the position it owes you is the one you left.
   *
   * That is exactly what this app got wrong for a round. `popstate` sets the
   * route, `scroll.restore` puts the window where the reader had scrolled to,
   * and the page — re-rendering with the same `at` — scheduled a landing that
   * fired a frame later and yanked them back to the heading. The fragment was
   * never wrong; treating it as an instruction on every render was.
   *
   * So: set when this component causes a navigation, and CLEARED on `popstate`.
   * A first paint counts as an arrival, so a typed address or a reload lands,
   * which is a browser's own behaviour too.
   */
  readonly landing: () => string | undefined
  readonly go: (route: Route) => void
  /**
   * The same page, at a different address — history REPLACED rather than
   * pushed, and the scroll left where it is.
   *
   * What it is for is the filter (`./filter/`), which is part of the address
   * (`./routes.ts`) and is typed one character at a time. Pushing an entry per
   * keystroke would put fourteen of them between the reader and the page they
   * came from; replacing means Back leaves the filter rather than un-typing it,
   * which is the behaviour a reader who pressed it wanted.
   *
   * NOT a general navigation: it does not move the page, because the row you
   * were looking at is still the row you are looking at.
   */
  readonly replace: (route: Route) => void
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

/** The whole address this app reads — path, query AND fragment, because the
 *  filter rides in the query and a document may name a place inside itself
 *  (`./routes.ts`). Said once, so the boot read and the back button cannot read
 *  different halves of the same bar. */
const here = (): string =>
  location.pathname + location.search + location.hash

/** The place inside the page a route names, for the arms that can name one.
 *  One reading, so `go` and the first paint cannot disagree about what an
 *  address asked to land on. */
const landingIn = (route: Route): string | undefined =>
  route.kind === "document" ? route.at : undefined

export const createRouter = (): Router => {
  const first = routeOf(here())
  const [route, setRoute] = createSignal<Route>(first)
  // A first paint is an arrival, so an address typed or reloaded lands.
  const [landing, setLanding] = createSignal<string | undefined>(landingIn(first))

  // The entry the reader landed on is named before anything can move, so
  // leaving it and coming back is a restore rather than a guess.
  nameHere()
  const scroll = createScrollMemory(() => keyIn(history.state))

  // The back button is a first-class way to navigate, not an edge case: the
  // whole point of a route is that the browser's own history works.
  const onPopState = () => {
    // A RESTORE, never an arrival: the position this entry is owed is the one
    // the reader left it at, and `scroll.restore` below is what knows it.
    setLanding(undefined)
    setRoute(routeOf(here()))
    // AFTER the route, and it has to be: Solid draws the page the new route
    // names while `setRoute` is still running, and a page that has not been
    // drawn is a document with nowhere to scroll to.
    scroll.restore(nameHere())
  }
  addEventListener("popstate", onPopState)
  onCleanup(() => removeEventListener("popstate", onPopState))

  return {
    route,
    landing,
    go: (next) => {
      setLanding(landingIn(next))
      history.pushState({ key: mintKey() } as Entry, "", hrefOf(next))
      setRoute(next)
      // A page you asked for, so: the top. Zooming out of the bottom of a long
      // outline used to land mid-page, at a line nobody chose.
      //
      // ALWAYS, even when the address names a place INSIDE the page. This is
      // the base every landing starts from and it is what makes the two cases
      // agree: a fragment that finds its section moves down from here a frame
      // later, and one that finds nothing leaves the reader at the top, which
      // is what a browser does with the same address. Skipping it — which this
      // did for one round — left the reader wherever the PREVIOUS page had
      // been scrolled to, so a landing that never happened was invisible and a
      // landing that did happen started from a lie.
      scroll.toTop()
    },
    replace: (next) => {
      // Not an arrival either: this is the page the reader is already on, at a
      // different address, and it deliberately does not move them.
      setLanding(undefined)
      // The entry KEEPS its key: it is the same entry, so the scroll position
      // remembered against it is still the position of this page.
      history.replaceState({ key: nameHere() } as Entry, "", hrefOf(next))
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

/** The router for a component under `<RouterProvider>` — navigation without
 *  throwing the document away (`go` is pushState, not `location.assign`). */
export const useRouter = (): Router => {
  const router = useContext(RouterContext)
  if (router === undefined) {
    throw new Error("a navigator outside the router — wrap the page in <RouterProvider>")
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

/**
 * The page a click on a link inside RENDERED MARKDOWN is asking for, or `null`
 * for one to leave alone.
 *
 * The other way a click becomes a route, and it is here beside {@link Link}
 * because this module is the one allowed to change the address. It cannot BE a
 * `<Link>`: rendered markdown reaches the page as HTML through `innerHTML`
 * (`markdown/rewrite.ts` is what points its `.md` links at `/doc/…`), so its
 * anchors belong to no component. Without this, moving between two files of one
 * directory would be a full document load — a fresh bundle, a fresh socket, a
 * fresh snapshot — which is what a vault of Markdown does all day.
 *
 * Used as ONE delegated listener on the main pane rather than a handler per
 * rendering: a page can hold a document, a note per row and a day's own notes.
 * On the pane rather than inside `<Markdown>` because the chat panel draws the
 * same markdown outside the router, and a component that needed one could not
 * be drawn there — and on the PANE rather than on `document`, which is the
 * placement that looks deeper and is not: Solid dispatches a handler on a
 * descendant before one on an ancestor, so a `<Link>` inside the pane is
 * guaranteed to have run (and to have prevented the default) before this is
 * asked. Two listeners on `document` would be ordered by which registered
 * first, and losing that race means one click pushing two history entries.
 *
 * What that placement costs is honest and small: the chat drawer is outside
 * the pane, so a `.md` link an agent writes is a plain navigation there. That
 * is the drawer's own standing — it draws no `<Link>` at all and has no router
 * to reach — rather than something this introduced, and the link still lands on
 * the right page.
 *
 * What it declines is the point: everything that is not a document's own page
 * (./routes.ts's `routeIn`) goes where it says.
 */
export const followed = (event: MouseEvent): Route | null => {
  if (!ours(event)) return null
  const target = event.target
  if (!(target instanceof Element)) return null
  // `closest`, because what is clicked is usually the TEXT of the link — or a
  // `<code>` or an `<em>` the markdown put inside it.
  const href = target.closest("a")?.getAttribute("href")
  return href === undefined || href === null ? null : routeIn(href)
}

export function Link(props: LinkProps) {
  const router = useRouter()

  const onClick = (event: MouseEvent) => {
    if (!ours(event)) return
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
