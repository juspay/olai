import { localLink, type Intent } from "@olai/surface"
import { type Accessor,createContext,createMemo,type JSX,useContext } from "solid-js"
import { Tip } from "@olai/web/client/Tip.tsx"
import { elsewhereOf, ELSEWHERE_SELECTOR } from "./elsewhere.ts"
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

  readonly routes: WorkspaceRouting
  readonly workspace: () => Workspace
  readonly route: () => Route
  readonly landing: (index: number) => Landing | undefined
  readonly landed: (index: number, file: string, at: string) => void
  readonly go: (route: Route) => void
  readonly goIn: (index: number, route: Route) => void
  readonly replace: (route: Route) => void
  readonly replaceIn: (index: number, route: Route) => void
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

export interface NavigationRouter extends Router {
  readonly offerTabs: (open: (workspace: Workspace) => void) => () => void
  readonly openTab: (workspace: Workspace) => boolean
  readonly lanes: Accessor<readonly Lane[]>
  readonly drawContent: (shown: Accessor<boolean>) => () => void
  readonly lane: Accessor<string | null>
  readonly entryKey: () => string
  readonly switchLane: (lane: string | null, to?: { readonly workspace: Workspace; readonly key?: string }) => string
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

export const usePaneId = (): Accessor<string> => {
  const router = useRouter(), pane = usePane()
  return () => pane?.id ?? router.panes()[router.focusIndex()]!.id
}

export const useHere = (): (() => number) => {
  const router = useMaybeRouter()
  const pane = usePane()
  return () => pane?.index ?? router?.focusIndex() ?? 0
}

export interface Landfall {
  readonly at: Accessor<string | undefined>
  readonly owed: Accessor<string | undefined>
  readonly landed: (at: string) => void
}

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

export const useGo = (): ((route: Route) => void) => {
  const router = useRouter()
  const here = useHere()
  return (route) => router.goIn(here(), route)
}

export const useMaybeGo = (): ((route: Route) => void) | null => {
  const router = useContext(RouterContext)
  const here = useHere()
  if (router === undefined) return null
  return (route) => router.goIn(here(), route)
}

export interface LinkProps {
  readonly route: Route
  readonly class?: string
  readonly tip?: string
  readonly label?: string
  readonly current?: boolean
  readonly testid?: string
  readonly broken?: boolean
  readonly halo?: boolean
  readonly children?: JSX.Element
}

export function Link(props: LinkProps) {
  const router = useRouter()
  return (
    <Tip text={props.tip ?? ""} disabled={props.tip === undefined}>
    <a
      href={router.routes.href(props.route)}
      class={props.class}
      aria-label={props.label}
      aria-current={props.current === true ? "page" : undefined}
      data-testid={props.testid}
      data-file={fileNamed(props.route)}
      data-broken={props.broken === true ? "true" : undefined}
      data-halo={props.halo === true ? "true" : undefined}
    >
      {props.children}
    </a>
    </Tip>
  )
}

export interface LinkTarget {
  readonly destination: AddressTarget
  readonly router: Router
  readonly index: number
  readonly anchor: HTMLAnchorElement
  readonly tabs?: NavigationRouter
}
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
declare module "solid-js" { namespace JSX { interface CustomEvents { "olai-navigated": Event } } }
export const follow = (target: LinkTarget, intent: Intent): void => {
  const { destination, router, index, anchor, tabs } = target
  const workspace = workspaceFor(destination)
  if (intent === "go" && anchor.dataset.linkIntent === "new-tab" && tabs?.openTab(workspace)) { }
  else if (destination.kind === "layout") {
    if (intent === "go") router.open(workspace)
    else router.openWorkspaceRight(index, workspace, intent === "new-pane")
  } else if (intent === "go") {
    const elsewhere = anchor.closest(ELSEWHERE_SELECTOR) === null ? null : elsewhereOf(index)
    if (elsewhere === null) router.goIn(index, destination.route)
    else if (elsewhere.kind === "into") router.goIn(elsewhere.index, destination.route)
    else router.openRight(elsewhere.from, destination.route)
  }
  else router.openRight(index, destination.route, intent === "new-pane")
  anchor.dispatchEvent(new CustomEvent("olai-navigated"))
}
