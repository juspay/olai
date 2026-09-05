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
  batch,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

import {
  asTheyWere,
  type Landing,
  type Landings,
  landingOf,
  landingsOf,
  marked,
  NOWHERE,
  spent,
} from "./landing.ts"
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
  panesOf,
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

// A wire rebuild recreates the router's listeners, but it is still the same
// workspace. Preserve its route objects so inactive panes retain the drafts
// they own even when navigation in a neighbour changed the history entry.
let remembered: { readonly href: string; readonly workspace: Workspace } | undefined

export const createRouter = (): Router => {
  const parsed = workspaceOf(here())
  let first = parsed
  if (remembered?.href === here()) {
    const previous = panesOf(remembered.workspace)
    for (const [index, pane] of panesOf(parsed).entries()) {
      const before = previous[index]?.route
      // Plugin routes must be parsed against the new roster. Only the core
      // pages whose addresses still agree can keep their draft identity.
      if (before?.kind === "at" && pane.route.kind === "at" && hrefOf(before) === hrefOf(pane.route)) {
        first = navigateIn(first, index, before)
      }
    }
    first = { ...first, focus: parsed.focus }
  }
  const [workspace, setWorkspace] = createSignal<Workspace>(first)
  onCleanup(() => {
    remembered = { href: here(), workspace: workspace() }
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
