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
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

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
   *
   * Once, and {@link Router.landed} is where that word is kept — here,
   * beside the minting, rather than in each surface that performs one.
   */
  readonly landing: () => Landing | undefined
  /**
   * SPEND this pane's landing: the act named by `{index, file, at}` has
   * been performed, and must not be performed again.
   *
   * It is the router's rather than the performer's because the rule is
   * about the VALUE and every surface that reads one is bound by it. Kept
   * privately per surface it was one variable per face — the markdown face
   * had one, the preview pane had none, and the pane with none re-landed
   * its reader every time the file moved on disk.
   *
   * NAMING WHAT IS BEING SPENT — the pane, the page and the place — so a
   * landing minted since is not spent by an act that was about the last
   * one: an act is scheduled a frame ahead (both performers scroll on the
   * next animation frame), and a navigation can arrive in between.
   *
   * STILL READABLE AFTERWARDS, which is the whole reason this is a mark
   * rather than a clear. The `.html` preview builds the frame's own URL
   * out of the slug, so a landing that vanished when it was spent would
   * change that address and re-point the frame at the file for no reason
   * anyone asked for — the very re-load this exists to stop.
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

export interface Landing {
  readonly index: number
  /** WHICH PAGE the slug is a place inside. A pane is one address at a time
   *  and this is the file that address names, so a face still drawn from the
   *  page being LEFT — every navigation has a frame of both on screen — can
   *  tell that the arrival it is being told about is not its own. Without it
   *  a `.html` preview re-pointed its frame on its way out, at a section of
   *  the page replacing it, which cost a fetch and a history entry: Back off
   *  such a page took two presses. */
  readonly file: string
  readonly at: string
  /** Whether the act has been performed. A spent landing is a slug that is
   *  still there to be read and no longer anything to do. */
  readonly spent: boolean
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

/** Where inside a page an arrival LANDS — the page's own file and a heading's
 *  own slug, and nothing for an address that names a whole place. It is read
 *  off the address, which is the only thing that says it: a `#` after a body
 *  is a heading, and after an outline it is a node (`@olai/format`'s
 *  `address.ts`), so the grammar has already decided which of the two this is
 *  — and a heading address carries the document it is a heading OF, so there
 *  is nothing to look the file up in. */
const landingOf = (index: number, route: Route): Landing | undefined => {
  const address = route.kind === "at" ? route.address : undefined
  if (address?.kind !== "heading") return undefined
  return { index, file: address.path, at: address.slug, spent: false }
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
    landed: (index, file, at) => {
      const land = landing()
      if (land === undefined || land.spent) return
      // The landing THIS act was about, or nothing: a navigation between the
      // scheduling and the performing has minted a new one, and that one is
      // owed its own arrival.
      if (land.index !== index || land.file !== file || land.at !== at) return
      setLanding({ ...land, spent: true })
    },
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
 * MEMOS, and that is the whole of what this adds over reading `landing()` and
 * comparing the index by hand. `landing` is ONE signal broadcast to every pane
 * and it is set on every push, with a fresh object each time — so a pane that
 * read it directly was notified by a navigation next door, every time, and
 * anything driven off that read ran again for an answer that had not moved.
 * Memos over a string are where that stops: each answer is a slug or nothing,
 * and `===` is the right comparison for both. Spending is the same story from
 * the other side — it replaces the object, so `at` must not be read off it
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
    const land = router.landing()
    return land !== undefined && land.index === here() && land.file === file()
      ? land
      : undefined
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
