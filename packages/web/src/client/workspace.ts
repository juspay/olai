/**
 * A workspace is a layout of routes, and a layout is a small tree.
 *
 * A node is a LEAF (one route — a pane) or a SPLIT (an axis and ordered
 * children, each with a fraction). Collapse is a fraction of zero, so
 * "this child is a rail" and "this child is a tenth of the split" are
 * one number. Today's product only writes a lone leaf or a single root
 * split on the row axis; the value is recursive so a column, and a
 * column that holds a row, is a local change to the codec and the
 * projection rather than a rewrite of every reader.
 *
 * The address of a one-level row is a `/s/` list of encoded hrefs, with
 * optional `?w=` and `?f=`. Axis and nesting have a place to grow (`?a=`,
 * `?t=`) that a one-level row does not write, so the flat shape stays the
 * flat shape. What each SEGMENT spells is one page's own address, whatever
 * that is — the segments changed when the addresses did (`./routes.ts`), and
 * this codec did not, which is the division it was built for.
 *
 * Pure: parsing and printing live beside each other, as `./routes.ts`
 * does, and the test that says so is the only thing standing between a
 * layout the app writes and a layout it cannot read back.
 */

import type { Axis } from "./pane/geometry.ts"
import {
  hrefOf,
  type Route,
  routeOf,
  splitAddress,
} from "./routes.ts"

export type { Axis } from "./pane/geometry.ts"

/** A leaf of the layout: one route, one pane. */
export interface Leaf {
  readonly kind: "leaf"
  readonly route: Route
}

/** One child of a split. `fraction` 0 is collapsed; absent is an equal
 *  share of whatever the siblings do not claim. */
export interface SplitChild {
  readonly layout: Layout
  readonly fraction?: number
}

/** Children side by side (`row`) or stacked (`col`). */
export interface Split {
  readonly kind: "split"
  readonly axis: Axis
  readonly children: readonly SplitChild[]
}

export type Layout = Leaf | Split

/** One pane as the projection reads it today: a route and the fraction
 *  it owns in its parent. Kept so a one-level row is still a list. */
export interface Pane {
  readonly route: Route
  readonly width?: number
}

/** The open layout and which leaf is focused (preorder). */
export interface Workspace {
  readonly layout: Layout
  readonly focus: number
}

/** The path prefix a split workspace wears. Unused by any page route. */
export const WORKSPACE_PREFIX = "/s/"

const WIDTH_KEY = "w"
const FOCUS_KEY = "f"
const AXIS_KEY = "a"
const TREE_KEY = "t"

/** A workspace of one pane — what a lone page has always been. */
export const lone = (route: Route): Workspace => ({
  layout: { kind: "leaf", route },
  focus: 0,
})

/** Whether this workspace is just a page. */
export const isLone = (workspace: Workspace): boolean =>
  workspace.layout.kind === "leaf"

/** Preorder leaves, as the one-level row the projection draws today.
 *  A nested tree flattens so a future URL still has something to show;
 *  this PR's verbs only write a lone leaf or a one-level row. */
export const panesOf = (workspace: Workspace): readonly Pane[] => {
  const layout = workspace.layout
  if (layout.kind === "leaf") return [{ route: layout.route }]
  if (layout.children.every((child) => child.layout.kind === "leaf")) {
    return layout.children.map((child) => {
      const route = (child.layout as Leaf).route
      return child.fraction === undefined ? { route } : { route, width: child.fraction }
    })
  }
  return leavesOf(layout).map((route) => ({ route }))
}

/** The focused pane's route. */
export const focusedRoute = (workspace: Workspace): Route => {
  const leaves = leavesOf(workspace.layout)
  if (leaves.length === 0) return { kind: "outline", file: null }
  return leaves[clampFocus(workspace.focus, leaves.length)]!
}

const leavesOf = (layout: Layout): Route[] => {
  if (layout.kind === "leaf") return [layout.route]
  return layout.children.flatMap((child) => leavesOf(child.layout))
}

const leafCount = (layout: Layout): number =>
  layout.kind === "leaf"
    ? 1
    : layout.children.reduce((sum, child) => sum + leafCount(child.layout), 0)

const isFlatSplit = (layout: Split, axis?: Axis): boolean =>
  (axis === undefined || layout.axis === axis)
  && layout.children.every((child) => child.layout.kind === "leaf")

// ── address ────────────────────────────────────────────────────────────

/** The address of a workspace. A lone leaf prints as that page's href.
 *  A one-level row prints as today's `/s/` list — no `a=`, no `t=` —
 *  so every existing split link stays. A column or a nested tree writes
 *  the growth keys; a one-level row never does. */
export const hrefOfWorkspace = (workspace: Workspace): string => {
  const layout = workspace.layout
  if (layout.kind === "leaf") return hrefOf(layout.route)
  const routes = leavesOf(layout)
  if (routes.length === 0) return hrefOf({ kind: "outline", file: null })
  const path = WORKSPACE_PREFIX + routes.map(encodePane).join("/")
  const query = workspaceQuery(workspace)
  return query === "" ? path : `${path}?${query}`
}

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
  const focus = clampFocus(intIn(params.get(FOCUS_KEY), 0), routes.length)
  const tree = params.get(TREE_KEY)
  if (tree !== null && tree !== "") {
    const shape = parseShape(tree)
    const layout = layoutFrom(shape, routes, params.get(WIDTH_KEY))
    return { layout, focus }
  }
  const axis = axisIn(params.get(AXIS_KEY))
  const widths = widthsIn(params.get(WIDTH_KEY), routes.length)
  const children: SplitChild[] = routes.map((route, i) => {
    const fraction = widths[i]
    const layout: Leaf = { kind: "leaf", route }
    return fraction === undefined ? { layout } : { layout, fraction }
  })
  return { layout: { kind: "split", axis, children }, focus }
}

const encodePane = (route: Route): string => {
  const href = hrefOf(route)
  return encodeURIComponent(href.startsWith("/") ? href.slice(1) : href)
}

const decodePane = (segment: string): Route | undefined => {
  if (segment === "") return undefined
  try {
    return routeOf("/" + decodeURIComponent(segment))
  } catch {
    return undefined
  }
}

/** Absent, `row`, or anything this codec does not know → a row. */
const axisIn = (raw: string | null): Axis => (raw === "col" ? "col" : "row")

const workspaceQuery = (workspace: Workspace): string => {
  const params = new URLSearchParams()
  const layout = workspace.layout
  if (layout.kind === "split") {
    if (isFlatSplit(layout, "row")) {
      const any = layout.children.some((child) => child.fraction !== undefined)
      if (any) params.set(WIDTH_KEY, printWidths(layout.children))
    } else if (isFlatSplit(layout, "col")) {
      params.set(AXIS_KEY, "col")
      const any = layout.children.some((child) => child.fraction !== undefined)
      if (any) params.set(WIDTH_KEY, printWidths(layout.children))
    } else {
      params.set(TREE_KEY, printShape(layout))
      params.set(WIDTH_KEY, printWTree(layout))
    }
  }
  if (workspace.focus !== 0) params.set(FOCUS_KEY, String(workspace.focus))
  return params.toString()
}

// ── shape (`t=`) ───────────────────────────────────────────────────────

type Shape =
  | { readonly kind: "leaf" }
  | { readonly kind: "split"; readonly axis: Axis; readonly kids: readonly Shape[] }

const printShape = (layout: Layout): string => {
  if (layout.kind === "leaf") return "leaf"
  return `${layout.axis}(${layout.children.map((child) => printShape(child.layout)).join(",")})`
}

const parseShape = (raw: string): Shape => {
  const [shape, at] = readShape(raw, 0)
  return at >= 0 ? shape : { kind: "leaf" }
}

const readShape = (raw: string, start: number): [Shape, number] => {
  const ident = readIdent(raw, start)
  if (ident === undefined) return [{ kind: "leaf" }, start]
  const [name, after] = ident
  if (name === "leaf" && raw[after] !== "(") return [{ kind: "leaf" }, after]
  const axis: Axis = name === "col" ? "col" : "row"
  if (raw[after] !== "(") return [{ kind: "split", axis, kids: [] }, after]
  const kids: Shape[] = []
  let i = after + 1
  if (raw[i] === ")") return [{ kind: "split", axis, kids }, i + 1]
  while (i < raw.length) {
    const [kid, next] = readShape(raw, i)
    kids.push(kid)
    i = next
    if (raw[i] === ",") {
      i += 1
      continue
    }
    if (raw[i] === ")") return [{ kind: "split", axis, kids }, i + 1]
    break
  }
  return [{ kind: "split", axis, kids }, i]
}

const readIdent = (raw: string, start: number): [string, number] | undefined => {
  let i = start
  while (i < raw.length && /[A-Za-z]/.test(raw[i]!)) i += 1
  if (i === start) return undefined
  return [raw.slice(start, i), i]
}

const layoutFrom = (
  shape: Shape,
  routes: readonly Route[],
  w: string | null,
): Layout => {
  let taken = 0
  const take = (): Route => routes[taken++] ?? { kind: "outline", file: null }
  const wTree = parseWTree(w)
  const build = (node: Shape, weights: WNode | undefined): Layout => {
    if (node.kind === "leaf") return { kind: "leaf", route: take() }
    const kids = node.kids.length > 0
      ? node.kids
      : routes.slice(taken).map((): Shape => ({ kind: "leaf" }))
    const slots = kids.map((_, i) =>
      weights?.kind === "split" ? weights.kids[i] : undefined,
    )
    const percents = percentListToFractions(slots.map((slot) => slot?.fraction))
    const children = kids.map((kid, i) => {
      const slot = slots[i]
      const layout = build(kid, slot)
      const fraction = percents[i]
      return fraction === undefined ? { layout } : { layout, fraction }
    })
    return { kind: "split", axis: node.axis, children }
  }
  return build(shape, wTree)
}

// ── fractions ──────────────────────────────────────────────────────────

type WNode =
  | { readonly kind: "leaf"; readonly fraction?: number }
  | { readonly kind: "split"; readonly fraction?: number; readonly kids: readonly WNode[] }

const parseWTree = (raw: string | null): WNode | undefined => {
  if (raw === null || raw === "") return undefined
  const kids: WNode[] = []
  let i = 0
  while (i < raw.length) {
    const [kid, next] = readWNode(raw, i)
    kids.push(kid)
    i = next
    if (raw[i] === ",") {
      i += 1
      continue
    }
    break
  }
  return { kind: "split", kids }
}

const readWNode = (raw: string, start: number): [WNode, number] => {
  let i = start
  let fraction: number | undefined
  if (raw[i] === "(") {
    const [kids, next] = readWList(raw, i + 1)
    return [{ kind: "split", kids }, next]
  }
  const num = readNumber(raw, i)
  if (num !== undefined) {
    fraction = num[0]
    i = num[1]
  }
  if (raw[i] === "(") {
    const [kids, next] = readWList(raw, i + 1)
    return [{ kind: "split", fraction, kids }, next]
  }
  return [{ kind: "leaf", fraction }, i]
}

const readWList = (raw: string, start: number): [WNode[], number] => {
  const kids: WNode[] = []
  let i = start
  if (raw[i] === ")") return [kids, i + 1]
  while (i < raw.length) {
    const [kid, next] = readWNode(raw, i)
    kids.push(kid)
    i = next
    if (raw[i] === ",") {
      i += 1
      continue
    }
    if (raw[i] === ")") return [kids, i + 1]
    break
  }
  return [kids, i]
}

const readNumber = (raw: string, start: number): [number, number] | undefined => {
  const slice = raw.slice(start)
  const match = /^-?\d+(?:\.\d+)?/.exec(slice)
  if (match === null) return undefined
  const value = Number(match[0])
  if (!Number.isFinite(value)) return undefined
  return [value, start + match[0].length]
}

const printWTree = (layout: Split): string => {
  const item = (child: SplitChild): string => {
    const self = child.fraction === undefined ? "" : printPercent(child.fraction)
    if (child.layout.kind === "leaf") return self === "" ? "0" : self
    const inner = child.layout.children.map(item).join(",")
    return self === "" ? `(${inner})` : `${self}(${inner})`
  }
  return layout.children.map(item).join(",")
}

const printPercent = (fraction: number): string => {
  if (fraction <= 0) return "0"
  return String(Math.max(1, Math.round(fraction * 100)))
}

const sharesOf = (children: readonly SplitChild[]): ReadonlyArray<number> => {
  const expanded = children.filter((child) => child.fraction !== 0)
  const known = expanded.reduce((sum, child) => sum + (child.fraction ?? 0), 0)
  const unknown = expanded.filter((child) => child.fraction === undefined).length
  const leftover = Math.max(0, 1 - known)
  const each = unknown === 0 ? 0 : leftover / unknown
  return children.map((child) => {
    if (child.fraction === 0) return 0
    return child.fraction ?? each
  })
}

const printWidths = (children: readonly SplitChild[]): string => {
  const percents = sharesOf(children).map((fraction) => {
    if (fraction <= 0) return 0
    return Math.max(1, Math.round(fraction * 100))
  })
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

const percentListToFractions = (
  nums: ReadonlyArray<number | undefined>,
): ReadonlyArray<number | undefined> => {
  const expanded = nums
    .map((value, i) => ({ i, value }))
    .filter((part) => part.value !== undefined && part.value > 0)
  const total = expanded.reduce((sum, part) => sum + part.value!, 0)
  if (total <= 0) return nums.map(() => undefined)
  return nums.map((value) => {
    if (value === undefined) return undefined
    if (value <= 0) return 0
    return value / total
  })
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

// ── tree location ──────────────────────────────────────────────────────

interface At {
  readonly parent: Split
  readonly index: number
  readonly path: readonly number[]
}

const locate = (layout: Layout, leaf: number): At | "lone" | undefined => {
  if (layout.kind === "leaf") return leaf === 0 ? "lone" : undefined
  let skip = 0
  for (let i = 0; i < layout.children.length; i++) {
    const child = layout.children[i]!
    const n = leafCount(child.layout)
    if (leaf < skip + n) {
      if (child.layout.kind === "leaf") {
        return { parent: layout, index: i, path: [i] }
      }
      const inner = locate(child.layout, leaf - skip)
      if (inner === undefined || inner === "lone") return undefined
      return { ...inner, path: [i, ...inner.path] }
    }
    skip += n
  }
}

/** Replace the children of the split at `path` (empty = the root). */
const replaceKids = (
  layout: Layout,
  path: readonly number[],
  kids: readonly SplitChild[],
): Layout => {
  if (layout.kind !== "split") return layout
  if (path.length === 0) return { ...layout, children: kids }
  const [head, ...rest] = path
  if (head === undefined) return layout
  return {
    ...layout,
    children: layout.children.map((child, i) =>
      i === head
        ? { ...child, layout: replaceKids(child.layout, rest, kids) }
        : child
    ),
  }
}

const unwrap = (layout: Layout): Layout => {
  if (layout.kind !== "split") return layout
  if (layout.children.length === 1) return unwrap(layout.children[0]!.layout)
  return layout
}

const rowOf = (children: readonly SplitChild[]): Split => ({
  kind: "split",
  axis: "row",
  children,
})

const leafOf = (route: Route): Leaf => ({ kind: "leaf", route })

// ── verbs (leaf indices; a one-level row is the only shape we write) ───

export const navigateIn = (
  workspace: Workspace,
  index: number,
  route: Route,
): Workspace => {
  const n = leafCount(workspace.layout)
  const i = clampFocus(index, n)
  const at = locate(workspace.layout, i)
  if (at === "lone") return { layout: leafOf(route), focus: 0 }
  if (at === undefined) return workspace
  const kids = at.parent.children.map((child, k) =>
    k === at.index ? { ...child, layout: leafOf(route) } : child,
  )
  return { layout: replaceKids(workspace.layout, at.path.slice(0, -1), kids), focus: i }
}

export const focusAt = (workspace: Workspace, index: number): Workspace => ({
  layout: workspace.layout,
  focus: clampFocus(index, leafCount(workspace.layout)),
})

export const focusBy = (workspace: Workspace, delta: -1 | 1): Workspace => {
  const n = leafCount(workspace.layout)
  if (n <= 1) return workspace
  const next = (workspace.focus + delta + n) % n
  return { layout: workspace.layout, focus: next }
}

export const openRight = (
  workspace: Workspace,
  from: number,
  route: Route,
  forceNew = false,
): Workspace => {
  const n = leafCount(workspace.layout)
  const i = clampFocus(from, n)
  const at = locate(workspace.layout, i)
  const born: SplitChild = { layout: leafOf(route) }
  if (at === "lone") {
    return {
      layout: rowOf(equalize([{ layout: workspace.layout }, born])),
      focus: 1,
    }
  }
  if (at === undefined) return workspace
  const right = at.index + 1
  const siblings = at.parent.children
  const parentPath = at.path.slice(0, -1)
  if (!forceNew && right < siblings.length) {
    const neighbour = siblings[right]!
    const collapsed = neighbour.fraction === 0
    const kids = siblings.map((child, k) =>
      k === right && child.layout.kind === "leaf"
        ? { ...child, layout: leafOf(route) }
        : child,
    )
    const ready = {
      layout: replaceKids(workspace.layout, parentPath, kids),
      focus: i + 1,
    }
    return collapsed ? expandAt(ready, i + 1) : ready
  }
  const inserted = [
    ...siblings.slice(0, right),
    born,
    ...siblings.slice(right),
  ]
  return {
    layout: replaceKids(workspace.layout, parentPath, equalize(inserted)),
    focus: i + 1,
  }
}

export const closeAt = (workspace: Workspace, index: number): Workspace => {
  const n = leafCount(workspace.layout)
  if (n <= 1) return workspace
  const i = clampFocus(index, n)
  const at = locate(workspace.layout, i)
  if (at === undefined || at === "lone") return workspace
  const remain = at.parent.children.filter((_, k) => k !== at.index)
  if (remain.length === 0) return workspace
  const parentPath = at.path.slice(0, -1)
  if (remain.length === 1 && parentPath.length === 0) {
    return { layout: unwrap(remain[0]!.layout), focus: 0 }
  }
  const kids = remain.length === 1
    ? [{ layout: unwrap(remain[0]!.layout) }]
    : equalize(remain)
  const focus = i < n - 1 ? i : n - 2
  return { layout: unwrap(replaceKids(workspace.layout, parentPath, kids)), focus }
}

export const closeFocused = (workspace: Workspace): Workspace =>
  closeAt(workspace, workspace.focus)

export const resizeTo = (
  workspace: Workspace,
  widths: ReadonlyArray<number>,
): Workspace => {
  const layout = workspace.layout
  if (layout.kind !== "split") return workspace
  if (widths.length !== layout.children.length) return workspace
  const children = layout.children.map((child, i) => ({
    ...child,
    fraction: Math.max(0, widths[i] ?? 0),
  }))
  return { ...workspace, layout: { ...layout, children: normalize(children) } }
}

export const collapseAt = (workspace: Workspace, index: number): Workspace => {
  const n = leafCount(workspace.layout)
  if (n <= 1) return workspace
  const i = clampFocus(index, n)
  const at = locate(workspace.layout, i)
  if (at === undefined || at === "lone") return workspace
  if (at.parent.children[at.index]?.fraction === 0) return workspace
  const children = at.parent.children.map((child, k) =>
    k === at.index ? { ...child, fraction: 0 } : child,
  )
  return {
    ...workspace,
    layout: replaceKids(workspace.layout, at.path.slice(0, -1), normalize(children)),
  }
}

export const expandAt = (workspace: Workspace, index: number): Workspace => {
  const n = leafCount(workspace.layout)
  const i = clampFocus(index, n)
  const at = locate(workspace.layout, i)
  if (at === undefined || at === "lone") return workspace
  if (at.parent.children[at.index]?.fraction !== 0) return workspace
  const children = at.parent.children.map((child, k) =>
    k === at.index ? { layout: child.layout } : child,
  )
  return {
    ...workspace,
    layout: replaceKids(workspace.layout, at.path.slice(0, -1), equalize(children)),
  }
}

export const reorder = (
  workspace: Workspace,
  from: number,
  to: number,
): Workspace => {
  const n = leafCount(workspace.layout)
  if (n <= 1) return workspace
  const a = clampFocus(from, n)
  const b = clampFocus(to, n)
  if (a === b) return workspace
  const here = locate(workspace.layout, a)
  const there = locate(workspace.layout, b)
  if (
    here === undefined || here === "lone"
    || there === undefined || there === "lone"
  ) return workspace
  if (here.path.slice(0, -1).join() !== there.path.slice(0, -1).join()) {
    return workspace
  }
  const siblings = [...here.parent.children]
  const [moved] = siblings.splice(here.index, 1)
  siblings.splice(there.index, 0, moved!)
  const layout = replaceKids(workspace.layout, here.path.slice(0, -1), siblings)
  const focus = workspace.focus === a
    ? b
    : workspace.focus > a && workspace.focus <= b
    ? workspace.focus - 1
    : workspace.focus < a && workspace.focus >= b
    ? workspace.focus + 1
    : workspace.focus
  return { layout, focus }
}

const equalize = (children: readonly SplitChild[]): readonly SplitChild[] => {
  const expanded = children.filter((child) => child.fraction !== 0).length
  if (expanded === 0) {
    return children.map((child, i) =>
      i === 0 ? { layout: child.layout } : { ...child, fraction: 0 },
    )
  }
  const share = 1 / expanded
  return children.map((child) =>
    child.fraction === 0
      ? { ...child, fraction: 0 }
      : { layout: child.layout, fraction: share },
  )
}

const normalize = (children: readonly SplitChild[]): readonly SplitChild[] => {
  const expanded = children.filter((child) => (child.fraction ?? 1) > 0)
  const total = expanded.reduce((sum, child) => sum + (child.fraction ?? 0), 0)
  if (expanded.length === 0 || total <= 0) return equalize(children)
  return children.map((child) => {
    const fraction = child.fraction ?? 0
    if (fraction <= 0) return { ...child, fraction: 0 }
    return { ...child, fraction: fraction / total }
  })
}

export const flexOf = (panes: readonly Pane[]): ReadonlyArray<number> =>
  sharesOf(panes.map((pane) => ({
    layout: leafOf(pane.route),
    fraction: pane.width,
  })))

export const isCollapsed = (pane: Pane): boolean => pane.width === 0

/** Build a nested workspace in tests — the product does not write this. */
export const splitOf = (
  axis: Axis,
  children: ReadonlyArray<{ layout: Layout; fraction?: number }>,
  focus = 0,
): Workspace => ({
  layout: { kind: "split", axis, children },
  focus,
})
