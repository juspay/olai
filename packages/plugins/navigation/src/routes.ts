import { Schema } from "effect"
import type { AppPage } from "olai-plugin-navigation/slots"
import type { AppRouteClaim } from "olai-plugin-navigation/slots"
import {
type Address,
type Claims,
DocumentPath,
NodeId,
addressOf,
fileKind,
type PageReading,
nameOf,
type PageRequest,
parseAddress,
type Shown,
type Split,
splitAddress,
writtenAddress,
} from "@olai/format"

import { type Accessor,type JSX } from "solid-js"

import type { Drawn } from "olai-plugin-outlines/page"


const APP_ROUTE = Symbol("olai app route")
const APP_PAGE = Symbol("olai app page")

interface PageGrammar {
  readonly [APP_ROUTE]: true
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => unknown | null
  readonly href: (page: unknown) => string
  readonly breadcrumb: (page: unknown) => string
  readonly narrowable: boolean
  readonly glyph?: () => JSX.Element
}

export interface NodePageRoute extends PageGrammar {
  readonly kind: "node"
  readonly request: (page: unknown, today: string) => PageRequest
  readonly stream: {
    readonly use: (input: Accessor<PageRequest | null>) => PageAnswer
  }
}

export interface SelfDrawnPageRoute extends PageGrammar {
  readonly kind: "self-drawn"
}

export type PageRoute = NodePageRoute | SelfDrawnPageRoute

export interface PageAnswer {
  (): PageReading | undefined
  readonly error?: () => Error | undefined
  readonly changed?: (handler: () => void) => () => void
}

export interface MountedNodePage {
  readonly kind: "node"
  readonly route: NodePageRoute
  readonly face: (props: {
    readonly page: Shown
    readonly drawn: Drawn
    readonly today: string
  }) => JSX.Element
}

export interface MountedSelfDrawnPage {
  readonly kind: "self-drawn"
  readonly route: SelfDrawnPageRoute
  readonly face: (props: {
    readonly value: unknown
    readonly filter: string
    readonly narrow: (filter: string) => void
  }) => JSX.Element
}

export type MountedAppPage = MountedNodePage | MountedSelfDrawnPage

export type Route =
  | { readonly kind: "at"; readonly address: Address | null; readonly reveal?: true; readonly filter?: string }
  | { readonly kind: "trash"; readonly filter?: string }
  | {
    readonly kind: "plugin"
    readonly source: PageRoute
    readonly value: unknown
    readonly filter?: string
  }

export type PlainRoute = Exclude<Route, { readonly kind: "plugin" }>

interface DefinedGrammar<Value, Source extends PageRoute> {
  readonly source: Source
  readonly to: (value: Value) => Route
  readonly value: (route: Route) => Value | null
  readonly parse: (pathname: string) => Value | null
  readonly href: (value: Value) => `/${string}`
  readonly breadcrumb: (value: Value) => string
}

interface GrammarSpec<Value> {
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => Value | null
  readonly href: (value: Value) => `/${string}`
  readonly breadcrumb: (value: Value) => string
  readonly narrowable: boolean
  readonly glyph?: () => JSX.Element
}

const erasedGrammar = <Value>(spec: GrammarSpec<Value>): PageGrammar => ({
  [APP_ROUTE]: true,
  claims: spec.claims,
  parse: spec.parse as (pathname: string) => unknown | null,
  href: (value) => spec.href(value as Value),
  breadcrumb: (value) => spec.breadcrumb(value as Value),
  narrowable: spec.narrowable,
  ...(spec.glyph === undefined ? {} : { glyph: spec.glyph }),
})

const definedOver = <Value, Source extends PageRoute>(source: Source, spec: GrammarSpec<Value>): DefinedGrammar<Value, Source> => ({
  source,
  to: (value) => ({ kind: "plugin", source, value }),
  value: (route) =>
    route.kind === "plugin" && route.source === source ? route.value as Value : null,
  parse: spec.parse,
  href: spec.href,
  breadcrumb: spec.breadcrumb,
})

export interface DefinedAppRoute<Value, Request extends PageRequest> extends DefinedGrammar<Value, NodePageRoute> {
  readonly request: (value: Value, today: string) => Request
}

export const defineAppRoute = <Value, Request extends PageRequest>(spec: GrammarSpec<Value> & {
  readonly request: (value: Value, today: string) => Request
  readonly stream: {
    readonly use: (input: Accessor<Request | null>) => PageAnswer
  }
}): DefinedAppRoute<Value, Request> => {
  const source: NodePageRoute = {
    ...erasedGrammar(spec),
    kind: "node",
    request: (value, today) => spec.request(value as Value, today),
    stream: {
      use: (input) => spec.stream.use(input as Accessor<Request | null>),
    },
  }
  return { ...definedOver(source, spec), request: spec.request }
}

const pageOf = (source: PageRoute, face: unknown): AppPage => {
  const page = { [APP_PAGE]: true, kind: source.kind, route: source, face }
  return page as unknown as AppPage
}

export const defineAppPage = <Value, Request extends PageRequest>(
  route: DefinedAppRoute<Value, Request>,
  face: (props: {
    readonly page: Extract<Shown, { readonly kind: Request["kind"] }>
    readonly drawn: Drawn
    readonly today: string
  }) => JSX.Element,
): AppPage => pageOf(route.source, face)

export type DefinedSelfDrawnRoute<Value> = DefinedGrammar<Value, SelfDrawnPageRoute>

export const defineSelfDrawnRoute = <Value>(spec: GrammarSpec<Value>): DefinedSelfDrawnRoute<Value> =>
  definedOver<Value, SelfDrawnPageRoute>({ ...erasedGrammar(spec), kind: "self-drawn" }, spec)

export const defineSelfDrawnPage = <Value>(
  route: DefinedSelfDrawnRoute<Value>,
  face: (props: {
    readonly value: Value
    readonly filter: string
    readonly narrow: (filter: string) => void
  }) => JSX.Element,
): AppPage => pageOf(route.source, face)

const HOME = "/"

type Named = Extract<Route, { readonly kind: "trash" }>["kind"]

const NAMED = {
  trash: "/trash",
} as const satisfies { readonly [K in Named]: `/${string}` }

const NAMED_AT = new Map<string, Named>(
  Object.entries(NAMED).map(([kind, at]) => [at, kind as Named]),
)

const isNamed = (kind: Route["kind"]): kind is Named => Object.hasOwn(NAMED, kind)

const FILTER_KEY = "q"

const addressNamed = (route: Route): Address | null =>
  route.kind === "at" ? route.address : null

const mountedPage = (page: AppPage): MountedAppPage => {
  if (!(APP_PAGE in page) || !(APP_ROUTE in page.route)) {
    throw new Error("app.route entries must be built with defineAppRoute and defineAppPage, or defineSelfDrawnRoute and defineSelfDrawnPage")
  }
  return page as unknown as MountedAppPage
}

const overlaps = (a: AppRouteClaim, b: AppRouteClaim): boolean => {
  if (a.kind === "exact" && b.kind === "exact") return a.path === b.path
  if (a.kind === "prefix" && b.kind === "prefix") {
    return a.path.startsWith(b.path) || b.path.startsWith(a.path)
  }
  const exact = a.kind === "exact" ? a.path : b.path
  const prefix = a.kind === "prefix" ? a.path : b.path
  return exact.startsWith(prefix)
}

interface RoutePage {
  readonly plugin: string
  readonly page: MountedAppPage
}

const printedClaim = (claim: AppRouteClaim): string => `${claim.kind} ${claim.path}`

export const settleRoutePages = (
  entries: ReadonlyArray<{ readonly plugin: string; readonly face: AppPage }>,
  report: (message: string) => void = console.error,
): ReadonlyArray<RoutePage> => {
  const pages: Array<RoutePage> = []
  const claimed: Array<{ readonly owner: string; readonly claim: AppRouteClaim }> = [
    { owner: "core", claim: { kind: "exact", path: "/trash" } },
  ]
  for (const { plugin, face } of entries) {
    let page: MountedAppPage
    try {
      page = mountedPage(face)
    } catch (error) {
      report(`app route from ${plugin} was dropped: ${String(error)}`)
      continue
    }
    const own: Array<{ readonly owner: string; readonly claim: AppRouteClaim }> = []
    let collision: { readonly owner: string; readonly claim: AppRouteClaim } | undefined
    let colliding: AppRouteClaim | undefined
    for (const claim of page.route.claims) {
      collision = [...claimed, ...own].find((one) => overlaps(one.claim, claim))
      if (collision !== undefined) {
        colliding = claim
        break
      }
      own.push({ owner: plugin, claim })
    }
    if (collision !== undefined && colliding !== undefined) {
      report(
        `app route ${printedClaim(colliding)} from ${plugin} overlaps ` +
          `${collision.owner}'s ${printedClaim(collision.claim)}; keeping ` +
          `${collision.owner} and dropping ${plugin}`,
      )
      continue
    }
    claimed.push(...own)
    pages.push({ plugin, page })
  }
  return pages
}

export type MountedPages = ReturnType<typeof settleRoutePages>

export const NO_PAGES: MountedPages = []

const claims = (route: PageRoute, pathname: string): boolean =>
  route.claims.some((claim) =>
    claim.kind === "exact" ? pathname === claim.path : pathname.startsWith(claim.path)
  )

export const routeFaceIn = (pages: MountedPages, route: Route): MountedAppPage | null => {
  if (route.kind !== "plugin") return null
  return pages.find((one) => one.page.route === route.source)?.page ?? null
}

export const HOME_ROUTE: PlainRoute = { kind: "at", address: null }

const atAddress = (address: Address | null): Extract<Route, { kind: "at" }> => ({ kind: "at", address })

export const atFile = (file: string): Extract<Route, { kind: "at" }> => atAddress({ kind: "document", path: DocumentPath.make(file) })

export const lineFragment = (line: number): string => `L${line}`
export const lineAt = (fragment: string | undefined): number | undefined => {
  if (fragment === undefined || !/^L[1-9][0-9]*$/.test(fragment)) return undefined
  const line = Number(fragment.slice(1))
  return Number.isSafeInteger(line) ? line : undefined
}

const sourceLanding = (route: PlainRoute): boolean => {
  const address = addressNamed(route)
  return address !== null && address.kind === "heading" && lineAt(address.slug) !== undefined
}

export const zoomNode = (id: string): Extract<Route, { kind: "at" }> => atAddress({ kind: "node", id: NodeId.make(id) })
export const atNode = (id: string): Extract<Route, { kind: "at" }> => ({ ...zoomNode(id), reveal: true })

export const atElement = (table: Claims, file: string, element: string | null): Extract<Route, { kind: "at" }> =>
  atAddress(addressOf(table, file, element))

export const hrefOfPlain = (route: PlainRoute): string => {
  const narrowed = narrowing(sourceLanding(route) ? route.filter : filterOfPlain(route))
  if (isNamed(route.kind)) return NAMED[route.kind] + narrowed
  const address = addressNamed(route)
  if (address === null) return HOME + narrowed
  const { path, element } = writtenAddress(address)
  return (address.kind === "node" && route.kind === "at" && !route.reveal ? "/zoom/" : HOME) + path + narrowed + (element === undefined ? "" : `#${element}`)
}

export const hrefOfIn = (table: Claims | undefined, pages: MountedPages, route: Route): string => {
  if (route.kind !== "plugin") return hrefOfPlain(route)
  return (routeFaceIn(pages, route)?.route.href(route.value) ?? HOME) + narrowing(filterOfIn(table, pages, route))
}

const narrowing = (filter: string | undefined): string =>
  filter === undefined || filter.trim() === ""
    ? ""
    : `?${new URLSearchParams({ [FILTER_KEY]: filter }).toString()}`

const narrowedBy = (search: string): { readonly filter?: string } => {
  if (search === "") return UNNARROWED
  const value = new URLSearchParams(search).get(FILTER_KEY)
  return value === null || value.trim() === "" ? UNNARROWED : { filter: value }
}

const UNNARROWED: { readonly filter?: string } = {}

export const fileNamed = (route: Route): string | undefined => {
  const address = addressNamed(route)
  return address === null || address.kind === "node" ? undefined : address.path
}

export const routeInIn = (table: Claims | undefined, pages: MountedPages, href: string): Route | null =>
  href.startsWith("/") ? routeNamedIn(table, pages, splitAddress(href)) : null

export const routeOfIn = (table: Claims | undefined, pages: MountedPages, address: string): Route => {
  const parts = splitAddress(address)
  const named = routeNamedIn(table, pages, parts)
  if (named !== null) return named
  return { ...HOME_ROUTE, ...narrowedBy(parts.search) }
}

const routeNamedIn = (table: Claims | undefined, pages: MountedPages, parts: Split): Route | null => {
  const { pathname, search, fragment } = parts
  if (pathname === "/zoom/" && fragment !== undefined) {
    const node = routeNamedIn(table, pages, { ...parts, pathname: "/" })
    return node?.kind === "at" && node.address?.kind === "node" ? { ...node, reveal: undefined } : null
  }
  const narrowed = narrowedBy(search)

  const tenant = pages.find((one) => claims(one.page.route, pathname))?.page
  if (tenant !== undefined) {
    const value = tenant.route.parse(pathname)
    if (value === null) return null
    return {
      kind: "plugin",
      source: tenant.route,
      value,
      ...(tenant.route.narrowable ? narrowed : UNNARROWED),
    }
  }

  const word = NAMED_AT.get(pathname)
  if (word !== undefined) return { kind: word, ...narrowed }
  if (!pathname.startsWith(HOME)) return null
  if (pathname === HOME) {
    if (fragment === undefined) return { ...HOME_ROUTE, ...narrowed }
    if (!fragment) return null
    try { return { ...atNode(decodeURIComponent(fragment)), ...narrowed } } catch { return null }
  }

  const named = table === undefined ? null : parseAddress(
    table,
    pathname.slice(HOME.length) + (fragment === undefined ? "" : `#${fragment}`),
  )
  if (named === null) {
    let path: string
    try { path = decodeURIComponent(pathname.slice(HOME.length)) } catch { return null }
    const name = path.slice(path.lastIndexOf("/") + 1)
    return /\.[^./]+$/.test(name) && Schema.is(DocumentPath)(path) ? atFile(path) : null
  }
  const route = atAddress(named)
  return narrowablePlain(table, route) || sourceLanding(route) ? { ...route, ...narrowed } : route
}

export const narrowablePlain = (table: Claims | undefined, route: PlainRoute): boolean => {
  const address = addressNamed(route)
  return address === null || address.kind === "node" ||
    table !== undefined && table.byKind.get(fileKind(table, address.path) ?? "")?.holds === "nodes"
}

export const narrowableIn = (table: Claims | undefined, pages: MountedPages, route: Route): boolean =>
  route.kind === "plugin"
    ? routeFaceIn(pages, route)?.route.narrowable ?? false
    : narrowablePlain(table, route)

export const narrowedToIn = (table: Claims | undefined, pages: MountedPages, route: Route, filter: string): Route => {
  if (!narrowableIn(table, pages, route)) return route
  return { ...route, filter: filter.trim() === "" ? undefined : filter }
}

export const filterOfPlain = (route: PlainRoute): string =>
  route.filter ?? ""

export const filterOfIn = (table: Claims | undefined, pages: MountedPages, route: Route): string =>
  (narrowableIn(table, pages, route) ? route.filter : undefined) ?? ""

export const samePageIn = (table: Claims | undefined, pages: MountedPages, a: Route, b: Route): boolean =>
  a.kind === b.kind
  && (a.kind !== "plugin" || b.kind !== "plugin" || a.source === b.source)
  && hrefOfIn(table, pages, narrowedToIn(table, pages, a, "")) === hrefOfIn(table, pages, narrowedToIn(table, pages, b, ""))

export interface Routing {
  readonly face: (route: Route) => MountedAppPage | null
  readonly narrowable: (route: Route) => boolean
  readonly narrowedTo: (route: Route, filter: string) => Route
  readonly filterOf: (route: Route) => string
  readonly href: (route: Route) => string
  readonly routeIn: (href: string) => Route | null
  readonly routeOf: (address: string) => Route
  readonly samePage: (a: Route, b: Route) => boolean
  readonly label: (route: Route) => string
  readonly name: (route: Route) => string | undefined
}

export const labelIn = (pages: MountedPages, route: Route): string => {
  if (route.kind === "at") {
    const address = route.address
    if (address === null) return "Home"
    return address.kind === "node" ? address.id : address.path
  }
  if (route.kind === "plugin") return routeFaceIn(pages, route)?.route.breadcrumb(route.value) ?? "Page"
  return "Trash"
}

export const nameIn = (table: Claims | undefined, route: Route): string | undefined => {
  if (table === undefined || route.kind !== "at") return undefined
  const address = route.address
  if (address === null || (address.kind !== "document" && address.kind !== "heading")) return undefined
  return fileKind(table, address.path) === null ? undefined : nameOf(table, address.path)
}

export const routingOver = (claims: () => Claims | undefined, pages: () => MountedPages): Routing => ({
  face: (route) => routeFaceIn(pages(), route),
  narrowable: (route) => narrowableIn(claims(), pages(), route),
  narrowedTo: (route, filter) => narrowedToIn(claims(), pages(), route, filter),
  filterOf: (route) => filterOfIn(claims(), pages(), route),
  href: (route) => hrefOfIn(claims(), pages(), route),
  routeIn: (href) => routeInIn(claims(), pages(), href),
  routeOf: (address) => routeOfIn(claims(), pages(), address),
  samePage: (a, b) => samePageIn(claims(), pages(), a, b),
  label: (route) => labelIn(pages(), route),
  name: (route) => nameIn(claims(), route),
})
