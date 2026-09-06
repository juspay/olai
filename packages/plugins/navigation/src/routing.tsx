/** Stateless route consumers. They receive the navigation provider through
 * context; importing this contract starts no history, observer or timer. */
import { ours,splitClick } from "@olai/web/client/press.ts"
import { type Accessor,createContext,createMemo,type JSX,useContext } from "solid-js"
import type { Landing } from "./landing.ts"
import { usePane } from "./pane/context.tsx"
import { fileNamed,hrefOf,type Route,routeIn } from "./routes.ts"
import type { Workspace } from "./workspace.ts"
export interface Router {
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
  readonly openRight: (from: number, route: Route, forceNew?: boolean) => void
  readonly close: (index?: number) => void
  readonly focus: (index: number) => void
  readonly stepFocus: (delta: -1 | 1) => void
  readonly collapse: (index: number) => void
  readonly expand: (index: number) => void
  readonly resize: (widths: ReadonlyArray<number>) => void
  readonly reorder: (from: number, to: number) => void
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
  const pane = usePane()
  if (router === undefined) return null
  return (route) => router.goIn(pane?.index ?? router.workspace().focus, route)
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

/**
 * TAKE a click on a link inside rendered markdown — the pair above, answered.
 *
 * {@link followed} and {@link followedSplit} say what a press is ASKING FOR;
 * this is the three lines every surface that draws markdown then writes to
 * answer it, and they must not be three lines each such surface writes for
 * itself: Alt opens to the right, a plain press goes in place, and everything
 * else — an external link, a modified click, a press something deeper already
 * answered — is left to the browser.
 *
 * {@link Link} answers the same question and does NOT come through here, which
 * is honest rather than an oversight waiting to be tidied: a `<Link>` is handed
 * the route it stands for, and reading one back off the `href` it just wrote
 * would be a round trip through a string for a value already in hand. What the
 * two must agree on is what a MODIFIER means, and that is `../press.ts`'s, read
 * by both — which is why the force bit below is `splitClick`'s answer and not a
 * second look at Shift.
 *
 * It lives here rather than in the pane because the pane is no longer the only
 * one: the chat panel is mounted BESIDE the panes (`./App.tsx`) and its
 * transcript renders the agent's markdown, so an anchor in an answer used to
 * fall through to the browser's default and reload the app cold. {@link useHere}
 * is what makes one function serve both — inside a pane it is that pane, and
 * outside every pane it is the FOCUSED one, which is where a link pressed in a
 * drawer belongs and where the palette and the sidebar already land.
 *
 * NOTHING COMES BACK. It either takes the press or leaves it, and there is no
 * third answer a caller could branch on — a caller with a question of its own
 * (the transcript's node chips) asks it BEFORE handing the event over, which is
 * the order that reads correctly anyway.
 */
export const useFollow = (): ((event: MouseEvent) => void) => {
  const router = useRouter()
  const here = useHere()
  const go = useGo()
  return (event) => {
    const split = followedSplit(event)
    if (split !== null) {
      event.preventDefault()
      // `splitClick`'s own answer for "a new pane or the one already there".
      // The line came out of the pane spelling it `event.shiftKey`, which was
      // the shift⇒force rule written twice — once in `../press.ts` where
      // `Link` reads it, once here — and free to disagree the day the gesture
      // moves.
      router.openRight(here(), split, splitClick(event) === "force")
      return
    }
    const next = followed(event)
    if (next === null) return
    event.preventDefault()
    go(next)
  }
}

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
