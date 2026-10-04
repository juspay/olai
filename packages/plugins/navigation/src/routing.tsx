import { localLink, type Intent } from "@olai/surface"
/** Stateless route consumers. They receive the navigation provider through
 * context; importing this contract starts no history, observer or timer. */
import { type Accessor,createContext,createMemo,type JSX,useContext } from "solid-js"
import type { Landing } from "./landing.ts"
import type { RevealState } from "./reveal.ts"
import { usePane } from "./pane/context.tsx"
import { fileNamed,type Route } from "./routes.ts"
import { workspaceFor, type AddressTarget, type Workspace, type WorkspaceRouting } from "./workspace.ts"
export interface LivePane {
  readonly element: Accessor<HTMLElement | undefined>
  readonly mount: (element: HTMLElement) => () => void
  readonly id: string
  readonly index: Accessor<number>
  readonly route: Accessor<Route>
  readonly width: Accessor<number | undefined>
}
export interface Lane extends Router {}
export interface Router {
  readonly revealState: (index: number) => RevealState | undefined
  readonly panes: Accessor<readonly LivePane[]>
  readonly focusIndex: Accessor<number>
  readonly split: Accessor<boolean>
  readonly shown: Accessor<boolean>
  readonly info: (index: number) => import("./index.ts").PageInfo | undefined
  readonly focused: Accessor<import("./index.ts").PageInfo | undefined>
  readonly report: (index: Accessor<number>, info: Accessor<import("./index.ts").PageInfo>) => void

  /**
   * THE ROUTE OPERATIONS THAT READ THE MOUNTED ROSTER — printing a URL,
   * parsing one, finding the tenant behind one, and the three narrowing
   * readings that ask a tenant whether its page takes a filter.
   *
   * ON THE ROUTER because a router is what HOLDS a route, and the four
   * questions are about the roster the route was made under: a `<Link>` three
   * levels inside a page has the router and cannot be handed anything else.
   * `Navigation` extends this, so a row that declares `navigation.state` is
   * handed the same capability without a second door.
   *
   * They were module-scope functions in `./routes.ts` over a module-scope
   * table, so every package parsed and printed against another activation's
   * live claims with nothing declared — the audit's §2 and §12. What stayed on
   * the door is the pure grammar: the constructors, the address reading, and
   * `hrefOfPlain` for a route this app's own grammar spells whole.
   */
  readonly routes: WorkspaceRouting
  readonly workspace: () => Workspace
  /** The focused pane's route — what the palette, the filter chord and
   *  anything that does not name a pane act on. */
  readonly route: () => Route
  /**
   * The place inside a page ONE PANE was asked to land on, or nothing.
   *
   * PER PANE, and that is the shape rather than a convenience. The address
   * is a LIST of routes and any number of them may name a section inside a
   * page, so a landing is a fact about the pane that named one — a document
   * in the other pane must not treat a landing aimed at this one as its own
   * (two panes previewing two files was the whole point of freeing the watch
   * set (#219), and yanking both to a heading one of them named would be the
   * same class of bug), and, from the other side, a two-pane link whose panes
   * both named a heading owes BOTH of them their section. One slot for the
   * workspace could only ever pay the focused one.
   *
   * `at` is a FACT about where the reader is on that pane; landing is an
   * ACT, and it happens once, on arrival. Cleared by a `popstate` that
   * TRAVERSED; a first paint counts as an arrival, and so does the address
   * bar asking again inside the same document (a fresh fragment reached
   * without a reload is still an address somebody was handed).
   *
   * Once, and {@link Router.landed} is where that word is kept — here,
   * beside the minting, rather than in each surface that performs one.
   */
  readonly landing: (index: number) => Landing | undefined
  /**
   * SPEND a pane's landing: the act named by `{index, file, at}` has
   * been performed, and must not be performed again. What that means, and
   * why it names all three, is `./landing.ts`'s `spent`.
   *
   * It is on the ROUTER rather than on the performer because the rule is
   * about the VALUE and every surface that reads one is bound by it. Kept
   * privately per surface it was one variable per face — the markdown face
   * had one, the preview pane had none, and the pane with none re-landed
   * its reader every time the file moved on disk.
   */
  readonly landed: (index: number, file: string, at: string) => void
  /** Navigate the focused pane (push). */
  readonly go: (route: Route) => void
  /** Navigate a named pane (push). */
  readonly goIn: (index: number, route: Route) => void
  /** The same pane, at a different address — history replaced, scroll left. */
  readonly replace: (route: Route) => void
  readonly replaceIn: (index: number, route: Route) => void
  /** Replace the whole workspace in one history push, without landings. */
  readonly open: (workspace: Workspace) => void
  readonly openWorkspaceRight: (from: number, workspace: Workspace, forceNew?: boolean) => void
  readonly openRight: (from: number, route: Route, forceNew?: boolean) => void
  readonly close: (index?: number) => void
  readonly focus: (index: number) => void
  readonly stepFocus: (delta: -1 | 1) => void
  readonly collapse: (index: number) => void
  readonly expand: (index: number) => void
  readonly resize: (widths: ReadonlyArray<number>) => void
  readonly reorder: (from: number, to: number) => void
  readonly lane: Accessor<string | null>

}

/** Window-wide controls belong to the declared navigation service, never to
 * the lane router handed to a page. */
export interface NavigationRouter extends Router {
  readonly offerTabs: (open: (workspace: Workspace) => void) => () => void
  readonly openTab: (workspace: Workspace) => boolean
  readonly lanes: Accessor<readonly Lane[]>
  /** Layouts register content visibility independently. Any shown registration draws
   * the front lane; with no registrations the front lane is shown. */
  readonly drawContent: (shown: Accessor<boolean>) => () => void
  /**
   * WHICH TAB THE HISTORY BELONGS TO, or `null` for the window's own.
   *
   * A row that keeps several workspaces open names a LANE for the one in front,
   * and from then on Back and Forward walk only that lane's entries: a
   * traversal that reaches another lane's entry keeps travelling the same way,
   * or returns to where it started when there is none of this lane's beyond it
   * (`./lanes.ts`). The lane is this document's: an entry written before a
   * reload belongs to nobody. With `null` in force every entry is everyone's,
   * which is the router with no tabs at all.
   */
  readonly lane: Accessor<string | null>
  /** The name of the entry under the reader — what the scroll memory keys the
   *  place it was left at by. */
  readonly entryKey: () => string
  /** Name the lane the current entry belongs to; given `to`, also replace the
   *  entry with `to.workspace`, reusing `to.key` if given so the scroll memory
   *  finds that entry's place. Not a history event. Returns the entry's key. */
  readonly switchLane: (lane: string | null, to?: { readonly workspace: Workspace; readonly key?: string }) => string
  /** Entries of this lane are dead from now on: a traversal passes over them. */
  readonly forgetLane: (lane: string) => void
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

export const useMaybeRouter = (): Router | undefined => useContext(RouterContext)
const ShownContext = createContext<Accessor<boolean>>()
export function ShownProvider(props: { readonly shown: Accessor<boolean>; readonly children: JSX.Element }) {
  return <ShownContext.Provider value={props.shown}>{props.children}</ShownContext.Provider>
}
export const useShown = (): Accessor<boolean> => {
  const shown = useContext(ShownContext)
  if (shown) return shown
  const router = useContext(RouterContext)
  return router?.shown ?? (() => true)
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
export const usePaneId = (): Accessor<string> => {
  const router = useRouter(), pane = usePane()
  return () => pane?.id ?? router.panes()[router.focusIndex()]!.id
}

export const useHere = (): (() => number) => {
  const router = useMaybeRouter()
  const pane = usePane()
  return () => pane?.index ?? router?.focusIndex() ?? 0
}

/**
 * WHERE INSIDE THIS PANE'S PAGE the navigation was asked to land — read two
 * ways, because the two questions a surface asks about a landing have
 * different answers once it has been performed.
 *
 * {@link Landfall.at} is the FACT: the slug this pane's address named, spent
 * or not. {@link Landfall.owed} is the ACT still to be done, and goes to
 * nothing the moment it is. A surface that scrolls somebody reads `owed`; a
 * surface that builds an address out of the slug reads `at` — which is the
 * split this exists for, and the `.html` preview needs both.
 */
export interface Landfall {
  /** The slug this pane's address named, or nothing. Unchanged by spending. */
  readonly at: Accessor<string | undefined>
  /** The same slug WHILE IT IS STILL AN ACT: what this pane owes its reader,
   *  or nothing once the arrival has happened. */
  readonly owed: Accessor<string | undefined>
  /** Done: the reader has been taken to `at`. Named rather than implied,
   *  because an act is performed a frame after it is decided on and the
   *  landing it was about is the one it may spend ({@link Router.landed}). */
  readonly landed: (at: string) => void
}

/**
 * {@link Router.landing} read for the pane the reader of it is drawn in.
 *
 * MEMOS, and that is the whole of what this adds over reading `landing(…)` by
 * hand. The landings are ONE signal, replaced whenever any pane navigates — so
 * a pane that read it directly was notified by a navigation next door and
 * anything driven off that read ran again for an answer that had not moved.
 * Memos over a string are where that stops: each answer is a slug or nothing,
 * and `===` is the right comparison for both. Spending is the same story from
 * the other side — it replaces the map, so `at` must not be read off it
 * raw either, or the address a preview is pointed at would change the instant
 * its landing was performed.
 *
 * WHOSE LANDING THIS IS is asked in two halves, because a face is one FILE
 * drawn in one PANE and either alone lets somebody else's arrival through.
 * `useHere`'s rule answers the pane, so a preview, a document's scroll and
 * anything else that lands somewhere cannot disagree about it (the
 * disagreement two panes previewing two files would show as one being yanked
 * by the other's click — `reactivity-after-the-flip` §3.3). The `file` this
 * face draws answers the other, and the case it excludes is the pane's own
 * PREVIOUS page: a navigation has both on screen for a frame, and the one on
 * its way out was being told about the arrival of the one replacing it.
 */
export const useLanding = (file: () => string): Landfall => {
  const router = useRouter()
  const here = useHere()
  const mine = createMemo(() => {
    const land = router.landing(here())
    return land !== undefined && land.file === file() ? land : undefined
  })
  return {
    at: createMemo(() => mine()?.at),
    owed: createMemo(() => {
      const land = mine()
      return land === undefined || land.spent ? undefined : land.at
    }),
    landed: (at) => router.landed(here(), file(), at),
  }
}

/** Navigate the pane this component is in, or the focused pane when it is
 *  chrome that sits outside every pane. One helper so a `<Link>`, a menu
 *  "Zoom in" and a `.html` preview cannot pick three different panes. */
export const useGo = (): ((route: Route) => void) => {
  const router = useRouter()
  const here = useHere()
  return (route) => router.goIn(here(), route)
}

/**
 * {@link useGo}, or `null` where there is no router under this component.
 *
 * TWO screens draw the bar with no router beneath it — the error report and
 * the waiting page — and a face hung in `app.header` is mounted on both. While
 * the search box was core's, `AppHeader` carried that fact as an optional `go`
 * and simply did not draw the box; a slot face has no props to be handed one
 * through, so the absence is asked for here instead. The sentence is the one
 * that prop's own comment carried: a door that could not open anywhere is worse
 * than no door.
 *
 * `useContext` rather than {@link useRouter}, because the whole point is to
 * ANSWER instead of throwing — and a plugin's face throwing out of its own
 * mount is a cascade the shell should not be able to be handed.
 */
export const useMaybeGo = (): ((route: Route) => void) | null => {
  const router = useContext(RouterContext)
  const here = useHere()
  if (router === undefined) return null
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

/** Content encodes its destination; navigation owns every press. */
export function Link(props: LinkProps) {
  const router = useRouter()
  return (
    <a
      href={router.routes.href(props.route)}
      class={props.class}
      title={props.title}
      aria-label={props.label}
      aria-current={props.current === true ? "page" : undefined}
      data-testid={props.testid}
      data-file={fileNamed(props.route)}
      data-broken={props.broken === true ? "true" : undefined}
      data-halo={props.halo === true ? "true" : undefined}
    >
      {props.children}
    </a>
  )
}

/** One reading for activation, menus, previews and the opaque-frame bridge.
 * Raw local fragments remain the content's; a resolved absolute URL loses that fact. */
export interface LinkTarget {
  readonly destination: AddressTarget
  readonly router: Router
  readonly index: number
  readonly anchor: HTMLAnchorElement
  readonly tabs?: NavigationRouter
}
/** `here` is the router the reader holds; `tabs`, the window's navigation, when
 *  the anchor may sit in any of its lanes. */
export const targetOf = (here: Router, anchor: HTMLAnchorElement, tabs?: NavigationRouter): LinkTarget | undefined => {
  if (localLink(anchor)) return
  const destination = here.routes.destinationIn(anchor.href)
  if (!destination) return
  const id = anchor.closest<HTMLElement>("[data-pane-id]")?.dataset.paneId
  const router = id ? (tabs?.lanes() ?? [here]).find(lane => lane.panes().some(pane => pane.id === id)) : here
  if (!router || !router.shown()) return
  const index = id ? router.panes().findIndex(pane => pane.id === id) : router.focusIndex()
  return index < 0 ? undefined : { destination, router, index, anchor, tabs }
}
export const follow = (target: LinkTarget, intent: Intent): void => {
  const { destination, router, index, anchor, tabs } = target
  const workspace = workspaceFor(destination)
  if (intent === "go" && anchor.dataset.linkIntent === "new-tab" && tabs?.openTab(workspace)) { /* served by tabs */ }
  else if (destination.kind === "layout") {
    if (intent === "go") router.open(workspace)
    else router.openWorkspaceRight(index, workspace, intent === "new-pane")
  } else if (intent === "go") router.goIn(index, destination.route)
  else router.openRight(index, destination.route, intent === "new-pane")
  anchor.dispatchEvent(new CustomEvent("olai-navigated"))
}
