/**
 * A workspace is a list of panes, and a pane is a route.
 *
 * One pane is what this app has always been: an address names a page, a zoom
 * and a filter, and the bar holds that address. Two or more panes are the same
 * thing listed — each still a full route, none a stripped side view — joined
 * under a prefix this app has never used for a page (`/s/`), so a lone page
 * keeps the address it has always had and a split is a different string a
 * reader can send, reload and walk with Back.
 *
 * Width fractions and which pane is focused ride the query (`w`, `f`) rather
 * than the path: they are facts about the LAYOUT, not about any one page, and
 * a page's own `?q=` is already spoken for (and lives INSIDE each pane's
 * encoded route, not on the workspace). Collapse is a width of zero, so
 * "this pane is a rail" and "this pane is a tenth of the row" are one number
 * and not two flags that could disagree.
 *
 * Pure, and parsing and printing live beside each other for the same reason
 * `./routes.ts` does: they are one bijection, and the test that says so is
 * the only thing standing between a layout the app writes and a layout it
 * cannot read back.
 */

import {
  hrefOf,
  type Route,
  routeOf,
  splitAddress,
} from "./routes.ts"

/** One pane of a workspace: the route it is showing, and how much of the
 *  row it owns. `width` is a fraction of the expanded panes (they sum to 1
 *  among the ones that are not collapsed). `0` is collapsed — a labelled
 *  rail, not a closed pane. Absent means "equal share", which is what a
 *  pane is born with and what a URL that names no `w` means. */
export interface Pane {
  readonly route: Route
  readonly width?: number
}

/** The open layout: the panes, in order, and which one is focused. */
export interface Workspace {
  readonly panes: readonly Pane[]
  readonly focus: number
}

/** The path prefix a split workspace wears. Unused by any page route
 *  (`./routes.ts`: `/o/`, `/n/`, `/doc/`, `/d/`, `/today`, `/agenda`,
 *  `/trash`), so a lone page is never mistaken for a list of one. */
export const WORKSPACE_PREFIX = "/s/"

const WIDTH_KEY = "w"
const FOCUS_KEY = "f"

/** A workspace of one pane — what a lone page has always been. */
export const lone = (route: Route): Workspace => ({
  panes: [{ route }],
  focus: 0,
})

/** Whether this workspace is just a page. One pane, whatever width it
 *  might carry: a lone pane has nothing to be a fraction of, and this
 *  app never writes a collapsed lone pane (closing the second-to-last
 *  returns a plain page). */
export const isLone = (workspace: Workspace): boolean =>
  workspace.panes.length === 1

/** The focused pane's route — what keyboard, palette and filter typing
 *  act on. */
export const focusedRoute = (workspace: Workspace): Route =>
  workspace.panes[clampFocus(workspace.focus, workspace.panes.length)]!.route

/** The address of a workspace. One pane prints as that page's own href,
 *  so every existing link, bookmark and test stays what it was. Two or
 *  more encode each pane's href as one path segment and carry optional
 *  widths and the focus in the query. */
export const hrefOfWorkspace = (workspace: Workspace): string => {
  const panes = workspace.panes
  if (panes.length === 0) return hrefOf({ kind: "outline", file: null })
  if (isLone(workspace)) return hrefOf(panes[0]!.route)
  const path = WORKSPACE_PREFIX + panes.map((pane) => encodePane(pane.route)).join("/")
  const query = workspaceQuery(workspace)
  return query === "" ? path : `${path}?${query}`
}

/** The workspace an address names. Anything that is not a split prints as
 *  a lone page, including the addresses this app has always had. A split
 *  with no panes (a typed `/s/` and nothing after it) is the default
 *  outline, the same kindness `routeOf` shows an unknown path. */
export const workspaceOf = (address: string): Workspace => {
  const { pathname, search } = splitAddress(address)
  if (!pathname.startsWith(WORKSPACE_PREFIX)) {
    return lone(routeOf(address))
  }
  const rest = pathname.slice(WORKSPACE_PREFIX.length)
  const segments = rest === "" ? [] : rest.split("/")
  const routes = segments
    .map(decodePane)
    .filter((route): route is Route => route !== undefined)
  if (routes.length === 0) return lone({ kind: "outline", file: null })
  const params = new URLSearchParams(search)
  const widths = widthsIn(params.get(WIDTH_KEY), routes.length)
  const panes = routes.map((route, i) => {
    const width = widths[i]
    return width === undefined ? { route } : { route, width }
  })
  const focus = clampFocus(intIn(params.get(FOCUS_KEY), 0), panes.length)
  return { panes, focus }
}

/** Encode one pane's route as a single path segment: the existing href,
 *  minus its leading `/`, percent-encoded so a `?q=` or a `#` inside it
 *  cannot be read as the workspace's own query or fragment. */
const encodePane = (route: Route): string => {
  const href = hrefOf(route)
  return encodeURIComponent(href.startsWith("/") ? href.slice(1) : href)
}

/** The other end of {@link encodePane}. A malformed escape is a segment
 *  nobody could have written, so it names no pane rather than throwing
 *  on the way to a layout the other panes would have drawn. */
const decodePane = (segment: string): Route | undefined => {
  if (segment === "") return undefined
  try {
    return routeOf("/" + decodeURIComponent(segment))
  } catch {
    return undefined
  }
}

/** `w=50,50` or `w=50,0,50` — percentages that sum to 100 among the
 *  expanded panes, with `0` meaning collapsed. Absent, or the wrong
 *  length, means equal expanded shares and no collapse. */
const workspaceQuery = (workspace: Workspace): string => {
  const params = new URLSearchParams()
  const widths = workspace.panes.map((pane) => pane.width)
  const anyWidth = widths.some((width) => width !== undefined)
  if (anyWidth) {
    params.set(WIDTH_KEY, printWidths(workspace.panes))
  }
  if (workspace.focus !== 0) params.set(FOCUS_KEY, String(workspace.focus))
  return params.toString()
}

/** Fraction of the row each pane owns. Collapsed is `0`. Expanded
 *  panes with no stored width share what is left equally. */
const sharesOf = (panes: readonly Pane[]): ReadonlyArray<number> => {
  const expanded = panes.filter((pane) => pane.width !== 0)
  const known = expanded.reduce((sum, pane) => sum + (pane.width ?? 0), 0)
  const unknown = expanded.filter((pane) => pane.width === undefined).length
  const leftover = Math.max(0, 1 - known)
  const each = unknown === 0 ? 0 : leftover / unknown
  return panes.map((pane) => {
    if (pane.width === 0) return 0
    return pane.width ?? each
  })
}

/** Print stored fractions as integer percents. A collapsed pane is `0`.
 *  Expanded panes that have no stored fraction share what is left
 *  equally, so a URL we write can be read back as the same shares. */
const printWidths = (panes: readonly Pane[]): string => {
  const percents = sharesOf(panes).map((fraction) => {
    if (fraction <= 0) return 0
    // A sliver that rounds to 0 must not print as a rail: reload would
    // collapse what the reader still had open. Floor of one percent.
    return Math.max(1, Math.round(fraction * 100))
  })
  // Rounding can leave the expanded total off 100 by a point; put the
  // remainder on the last expanded pane so a reload does not drift.
  const expandedIdx = percents
    .map((p, i) => (p > 0 ? i : -1))
    .filter((i) => i >= 0)
  if (expandedIdx.length > 0) {
    const total = expandedIdx.reduce((sum, i) => sum + percents[i]!, 0)
    const last = expandedIdx[expandedIdx.length - 1]!
    percents[last] = Math.max(1, percents[last]! + (100 - total))
  }
  return percents.join(",")
}

const widthsIn = (
  raw: string | null,
  n: number,
): ReadonlyArray<number | undefined> => {
  if (raw === null || raw === "") return Array.from({ length: n }, () => undefined)
  const parts = raw.split(",")
  if (parts.length !== n) return Array.from({ length: n }, () => undefined)
  const nums = parts.map((part) => {
    const value = Number(part)
    return Number.isFinite(value) ? value : undefined
  })
  const expanded = nums
    .map((value, i) => ({ i, value }))
    .filter((part) => part.value !== undefined && part.value > 0)
  const total = expanded.reduce((sum, part) => sum + part.value!, 0)
  if (total <= 0) return Array.from({ length: n }, () => undefined)
  return nums.map((value) => {
    if (value === undefined) return undefined
    if (value <= 0) return 0
    return value / total
  })
}

const intIn = (raw: string | null, fallback: number): number => {
  if (raw === null || raw === "") return fallback
  const n = Number(raw)
  return Number.isInteger(n) ? n : fallback
}

const clampFocus = (focus: number, n: number): number => {
  if (n <= 0) return 0
  if (!Number.isInteger(focus) || focus < 0) return 0
  return focus >= n ? n - 1 : focus
}

// ── operations: the verbs the UI asks of a workspace ───────────────────

/** Navigate one pane. The pane you are IN, not "the focused one" and not
 *  "the leftmost" — callers pass the index they mean. */
export const navigateIn = (
  workspace: Workspace,
  index: number,
  route: Route,
): Workspace => {
  const i = clampFocus(index, workspace.panes.length)
  const panes = workspace.panes.map((pane, at) =>
    at === i ? { ...pane, route } : pane,
  )
  return { panes, focus: i }
}

/** Focus a pane. Out-of-range is clamped, so a stale index cannot mint a
 *  workspace nothing can draw. */
export const focusAt = (workspace: Workspace, index: number): Workspace => ({
  panes: workspace.panes,
  focus: clampFocus(index, workspace.panes.length),
})

/** Move focus one step left or right, wrapping so Alt+Right on the last
 *  pane is the first and the other way around — a ring, not a wall. */
export const focusBy = (workspace: Workspace, delta: -1 | 1): Workspace => {
  const n = workspace.panes.length
  if (n <= 1) return workspace
  const next = (workspace.focus + delta + n) % n
  return { panes: workspace.panes, focus: next }
}

/**
 * Open a route in the pane to the RIGHT of `from`.
 *
 * Reuses the existing neighbour when there is one, unless `forceNew` —
 * Alt+click reuses, Alt+Shift+click inserts. There is no "leftmost" and
 * no "first empty": the only pane this ever writes is `from + 1`, and
 * when that index is past the end it is a pane that is created there.
 */
export const openRight = (
  workspace: Workspace,
  from: number,
  route: Route,
  forceNew = false,
): Workspace => {
  const i = clampFocus(from, workspace.panes.length)
  const right = i + 1
  if (!forceNew && right < workspace.panes.length) {
    const collapsed = workspace.panes[right]?.width === 0
    const panes = workspace.panes.map((pane, at) =>
      at === right ? { ...pane, route } : pane,
    )
    const reused = { panes, focus: right }
    // A rail is still the neighbour to the right. Reuse writes the
    // route and then EXPANDS — clearing width to `undefined` and
    // leaving the others' stored fractions made flexOf give the
    // reused pane `0`, so it stayed a rail that expandAt would
    // refuse (width was no longer `0`).
    return collapsed ? expandAt(reused, right) : reused
  }
  const born: Pane = { route }
  const panes = [
    ...workspace.panes.slice(0, right),
    born,
    ...workspace.panes.slice(right),
  ]
  return { panes: equalize(panes), focus: right }
}

/** Close a pane. Closing the second-to-last returns a lone page (no
 *  stored width). Closing the last pane is a no-op: a workspace with
 *  nothing in it is not a thing this app draws. Focus moves to the
 *  neighbour on the right, or the new last if this was the last. */
export const closeAt = (workspace: Workspace, index: number): Workspace => {
  const n = workspace.panes.length
  if (n <= 1) return workspace
  const i = clampFocus(index, n)
  const panes = workspace.panes.filter((_, at) => at !== i)
  const focus = i < panes.length ? i : panes.length - 1
  if (panes.length === 1) return { panes: [{ route: panes[0]!.route }], focus: 0 }
  return { panes: equalize(panes), focus }
}

/** Close the focused pane — the Cmd/Ctrl+W-equivalent. */
export const closeFocused = (workspace: Workspace): Workspace =>
  closeAt(workspace, workspace.focus)

/** Store width fractions. Values are clamped to `[0, 1]` and then
 *  normalised so the expanded ones sum to 1. A `0` stays collapsed. */
export const resizeTo = (
  workspace: Workspace,
  widths: ReadonlyArray<number>,
): Workspace => {
  if (widths.length !== workspace.panes.length) return workspace
  const panes = workspace.panes.map((pane, i) => ({
    ...pane,
    width: Math.max(0, widths[i] ?? 0),
  }))
  return { ...workspace, panes: normalize(panes) }
}

/** Collapse a pane to a rail. The stored width becomes `0`; the others
 *  keep their relative shares. */
export const collapseAt = (workspace: Workspace, index: number): Workspace => {
  const i = clampFocus(index, workspace.panes.length)
  if (workspace.panes[i]?.width === 0) return workspace
  // A lone pane does not collapse: there is nothing for a rail to sit
  // beside, and closing is the other verb.
  if (workspace.panes.length <= 1) return workspace
  const panes = workspace.panes.map((pane, at) =>
    at === i ? { ...pane, width: 0 } : pane,
  )
  return { ...workspace, panes: normalize(panes) }
}

/** Re-expand a collapsed pane to an equal share of the expanded row. */
export const expandAt = (workspace: Workspace, index: number): Workspace => {
  const i = clampFocus(index, workspace.panes.length)
  if (workspace.panes[i]?.width !== 0) return workspace
  const panes = workspace.panes.map((pane, at) =>
    at === i ? { route: pane.route } : pane,
  )
  return { ...workspace, panes: equalize(panes) }
}

/** Reorder: move the pane at `from` so it sits at `to`. Focus follows
 *  the moved pane when it was the focused one; otherwise the focused
 *  identity (not the index) is preserved. */
export const reorder = (
  workspace: Workspace,
  from: number,
  to: number,
): Workspace => {
  const n = workspace.panes.length
  if (n <= 1) return workspace
  const a = clampFocus(from, n)
  const b = clampFocus(to, n)
  if (a === b) return workspace
  const panes = [...workspace.panes]
  const [moved] = panes.splice(a, 1)
  panes.splice(b, 0, moved!)
  const focus = workspace.focus === a
    ? b
    : workspace.focus > a && workspace.focus <= b
    ? workspace.focus - 1
    : workspace.focus < a && workspace.focus >= b
    ? workspace.focus + 1
    : workspace.focus
  return { panes, focus }
}

/** Give every expanded pane the same share. Collapsed panes stay `0`.
 *  Used after insert/close so a new pane is not born as a sliver and a
 *  closed pane's share does not sit in a hole. */
const equalize = (panes: readonly Pane[]): readonly Pane[] => {
  const expanded = panes.filter((pane) => pane.width !== 0).length
  if (expanded === 0) {
    return panes.map((pane, i) => (i === 0 ? { route: pane.route } : { ...pane, width: 0 }))
  }
  const share = 1 / expanded
  return panes.map((pane) =>
    pane.width === 0 ? { ...pane, width: 0 } : { route: pane.route, width: share },
  )
}

/** Normalise stored widths so expanded fractions sum to 1. */
const normalize = (panes: readonly Pane[]): readonly Pane[] => {
  const expanded = panes.filter((pane) => (pane.width ?? 1) > 0)
  const total = expanded.reduce((sum, pane) => sum + (pane.width ?? 0), 0)
  if (expanded.length === 0) return equalize(panes)
  if (total <= 0) return equalize(panes)
  return panes.map((pane) => {
    const width = pane.width ?? 0
    if (width <= 0) return { ...pane, width: 0 }
    return { ...pane, width: width / total }
  })
}

/** The flex-grow each pane should take in a row, given the stored
 *  fractions. Collapsed panes are `0` (the rail is a fixed width beside
 *  the flex). Expanded panes with no stored width share equally. */
export const flexOf = (panes: readonly Pane[]): ReadonlyArray<number> =>
  sharesOf(panes)

/** Whether a pane is the collapsed rail. */
export const isCollapsed = (pane: Pane): boolean => pane.width === 0
