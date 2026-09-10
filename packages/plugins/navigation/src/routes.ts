import type { AppPage } from "olai-plugin-navigation/slots"
import type { AppRoute } from "olai-plugin-navigation/slots"
import type { AppRouteClaim } from "olai-plugin-navigation/slots"
/**
 * What a URL means, and nothing else.
 *
 * A URL here is an ADDRESS with a slash in front of it. `@olai/format`'s
 * `address.ts` owns the grammar — `[document]#[element]`, one currency for
 * every feature that has to name something — and this module owns everything
 * a BROWSER adds to it: which addresses are pages of this app, the routes
 * mounted plugins contribute, and the one thing that rides in a query.
 *
 * | URL | Page |
 * |---|---|
 * | `/Tasks.olai` | one outline, drawn as a tree |
 * | `/notes/README.md` | one document, drawn as a body |
 * | `/notes/README.md#install` | …landed at one of its headings |
 * | `/#a1b2c3` | one node, wherever it lives |
 * | `/` | whichever outline was found first |
 *
 * ## What a URL is made of
 *
 * Two things, and everything below is one of them:
 *
 *   - a PLACE — an address in the served directory, a core computed page, or
 *     a route whose grammar was registered by a mounted plugin;
 *   - a NARROWING — `?q=`, and nothing else rides in a query here.
 *
 * The bijection is over that pair, in both directions, which is why
 * {@link hrefOfIn} reads as *place, then narrowing, then the element half* and
 * {@link routeNamedIn} reads as *the words this app claimed, then the grammar*.
 *
 * {@link Route} IS spelled that way since PR 2 of the design: one content arm
 * carrying an address, and a filter beside it. The three arms it replaced —
 * an outline, a document, a node — stored a thing this module derives, which
 * is which PAGE an address opens; that is asked once now, where the page is
 * picked (`./page.ts`).
 *
 * ## No prefixes, and why the old three had to go
 *
 * This used to spell `/o/<file>`, `/doc/<file>` and `/n/<id>`, and the
 * argument for the first two was that an outline is a different KIND OF PAGE
 * from a body — a tree with rows to zoom into against prose drawn whole — so
 * the address should say which before the set is in hand. That argument was
 * already answered in this file, one kind over: hypertext got NO third prefix,
 * because *the path already says which* — the suffix is what `fileKind` reads,
 * and it is in the address either way. A prefix beside it is the same fact
 * spelled twice, free to disagree with the name it carries, and it makes the
 * kind of a file a property of the LINK that was clicked rather than of the
 * file. What changed on 2026-08-19 is that the ruling was taken all the way:
 * `.olai` is a suffix like the others, so the prefix that spelled it is gone
 * and a file's address is its path.
 *
 * A NODE spells no prefix either, for a sharper reason: `#a1b2c3` is the
 * address grammar's own spelling of a node, and it is location-free on
 * purpose. Ids are unique across the loaded set and survive renames and moves
 * between files, so the permalink outlives every edit short of a delete —
 * while a URL that also carried the outline would be a URL free to disagree
 * with the file it named.
 *
 * The two vocabularies cannot collide, and it is not luck: every document
 * address names a file, every served file carries a suffix the registry
 * claims, and every computed page below spells no file at all.
 *
 * WHAT CAN COLLIDE IS THE BUNDLE, and it is named here because a prefix-free
 * URL space is what makes it possible: the server hands the SPA shell to
 * anything it does not serve itself, and what it serves at the root is the
 * bundle's own — `/index.html` and the hashed dir, beside `/sw.js` and
 * `/manifest.webmanifest` (`@kolu/surface-app`). Only a hashed dir at
 * `/assets/` can shadow a PAGE: `/index.html` is the SPA shell, byte for
 * byte what the fallback would have answered with, so a vault's own
 * `index.html` opens as a page; the other two carry no suffix the registry
 * claims, so no address this parser can spell lands on them.
 *
 * The hashed dir used to sit at `/assets/`, and a miss under it has to 404
 * rather than fall through — a `.js` URL answered with the HTML shell is the
 * wrong MIME pinned `immutable` for a year (kolu#1319). So a vault file under
 * an `assets/` folder was an address this app could spell and could not open
 * (`packages/server/src/serve.test.ts`, measured in #341).
 *
 * That collision is gone. The hashed dir sits at `/_olai/assets/` now — the
 * same `_olai/` the shelf and the trash are minted into, so what it shadows
 * is olai's own namespace rather than the reader's. A vault file under
 * `assets/` opens as a page. The prefix is one spelling (`@olai/surface`'s
 * `ASSET_PREFIX`), taken by the build and pinned by the server.
 *
 * ## Computed pages, which name nothing on disk
 *
 * Core owns `/trash`. Mounted plugins may contribute more grammars through
 * `app.route`; journal contributes `/today`, `/d/<ISO-date>` and `/agenda`.
 * When that plugin is absent those words are ordinary unrecognised addresses,
 * and core has no day or agenda route arm to fall back to.
 *
 * `/trash` spells nothing for the same reason: it is a question asked of the
 * set — every `_olai/Trash.olai` under the directory — not a file's address. The
 * files it reads still HAVE addresses (`/_olai/Trash.olai` parses like any
 * outline), and what such an address opens is the trash view, because an
 * archive is not a place you edit (`page.ts` decides that, not this parser).
 *
 * Computed and plugin pages are READ FIRST, which is the whole precedence rule;
 * an address in the served directory is everything else.
 *
 * ## The query, which sits between the two halves of an address
 *
 * Most pages carry a QUERY as well as a path, and only one thing rides in it:
 * `?q=<filter>`, which is what the page is narrowed by. That is an address
 * rather than a signal for the same reason the pages are — a filtered page is
 * a link somebody can send, and Back is the browser's own history. See
 * {@link FILTER_KEY}.
 *
 * Where it SITS is the URL's rule rather than this app's: a query comes before
 * a fragment, so a narrowed node page is `/?q=is%3Atodo#a1b2c3` — the address
 * with the query slid into the one place a browser will read it from. The
 * grammar hands its two halves over already apart (`writtenAddress`), so this
 * writes a URL rather than cutting one back open.
 *
 * Pure, and parsing and printing live beside each other on purpose: they are
 * one bijection, and the test that says so (`routes.test.ts`) is the only
 * thing standing between a link the app writes and a link it cannot read back.
 *
 * AND TOTAL. Parsing answers a route for every string, including one no
 * address could have been written with: `decodeURIComponent` throws on a
 * malformed escape, and this parser is asked about the ADDRESS BAR, where a
 * person types, and about a TITLE in `Pins.olai`, which the format invites a
 * hand and an agent to edit (docs/format.md's Pins). A throw out of either is
 * not a bad address — it is a blank app, since a throw during render takes the
 * tree that was rendering with it and this client mounts no error boundary. So
 * every half of an address is read the way the fragment always was: what
 * cannot be read names nothing, and the address means what an unrecognised one
 * means.
 */

import {
type Address,
addressOf,
fileKind,
type PageReading,
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

/** The node-page protocol the shell actually knows how to host. Plugin API's
 * heterogeneous positions are narrowed to this protocol once, by
 * {@link defineAppRoute}, rather than cast independently by every consumer. */
export interface NodePageRoute {
  readonly [APP_ROUTE]: true
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => unknown | null
  readonly href: (page: unknown) => string
  readonly breadcrumb: (page: unknown) => string
  readonly narrowable: boolean
  readonly request: (page: unknown, today: string) => PageRequest
  readonly stream: {
    readonly use: (input: Accessor<PageRequest | null>) => PageAnswer
  }
}

export interface PageAnswer {
  (): PageReading | undefined
  readonly changed?: (handler: () => void) => () => void
}

export interface MountedAppPage {
  readonly route: NodePageRoute
  readonly face: (props: {
    readonly page: Shown
    readonly drawn: Drawn
    readonly today: string
  }) => JSX.Element
}

export type Route =
  /**
   * A PLACE in the served directory — one address, and `null` for the front
   * page, which names none ("whichever outline was found first", the bare
   * `/`).
   *
   * ONE ARM, where there were three: an outline, a document and a node. That
   * was three spellings of what the address grammar already has three
   * constructors for, and it stored a thing this module can DERIVE — which
   * PAGE an address opens is the suffix's answer (`@olai/format`'s
   * `fileKind`), asked where the page is picked (`./page.ts`) rather than
   * frozen into the route by whoever built it. Two answers to that question is
   * a link that opens a different page from the sidebar row beside it, which
   * is exactly the class of bug the addresses PR removed the prefixes for
   * (PR #256's deferral, taken here).
   *
   * A HEADING rides in the address like everything else: `README.md#install`
   * is one `AtHeading`, and it used to be a `file` with an `at` beside it on
   * the document arm alone.
   */
  | { readonly kind: "at"; readonly address: Address | null; readonly filter?: string }
  /** What was put away: every `_olai/Trash.olai` under the directory, read-only.
   *  It spells no file for the reason `/agenda` spells no horizon — which
   *  archives exist is the set's answer, and an address that named one would
   *  mean something different the day a subdirectory gets its own. */
  | { readonly kind: "trash"; readonly filter?: string }
  /** A page whose grammar, reading and face are owned by a mounted plugin. */
  | {
    readonly kind: "plugin"
    readonly source: NodePageRoute
    readonly value: unknown
    readonly filter?: string
  }

/**
 * EVERY ARM THIS APP'S OWN GRAMMAR SPELLS WHOLE — the union minus the one a
 * mounted plugin owns.
 *
 * It exists so that "this route needs no roster" is a fact the COMPILER holds
 * rather than a sentence somebody keeps true: {@link hrefOfPlain} takes one,
 * the three constructors answer one, and a caller that spells
 * `hrefOfPlain(atNode(id))` is statically proved not to be asking about a
 * tenant. A caller holding a `Route` that may be a plugin's cannot reach that
 * function at all, and goes through the {@link Routing} capability instead.
 */
export type PlainRoute = Exclude<Route, { readonly kind: "plugin" }>

export interface DefinedAppRoute<Value, Request extends PageRequest> {
  readonly source: NodePageRoute
  readonly to: (value: Value) => Route
  readonly value: (route: Route) => Value | null
  /** Kept for the route grammar's own focused tests. */
  readonly parse: (pathname: string) => Value | null
  readonly href: (value: Value) => `/${string}`
  readonly breadcrumb: (value: Value) => string
  readonly request: (value: Value, today: string) => Request
}

/** Define one typed node-page grammar. This is the sole erasure point between
 * a tenant's value/request types and the heterogeneous route slot. */
export const defineAppRoute = <Value, Request extends PageRequest>(spec: {
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => Value | null
  readonly href: (value: Value) => `/${string}`
  readonly breadcrumb: (value: Value) => string
  readonly narrowable: boolean
  readonly request: (value: Value, today: string) => Request
  readonly stream: {
    readonly use: (input: Accessor<Request | null>) => PageAnswer
  }
}): DefinedAppRoute<Value, Request> => {
  const source: NodePageRoute = {
    [APP_ROUTE]: true,
    claims: spec.claims,
    parse: spec.parse as (pathname: string) => unknown | null,
    href: (value) => spec.href(value as Value),
    breadcrumb: (value) => spec.breadcrumb(value as Value),
    narrowable: spec.narrowable,
    request: (value, today) => spec.request(value as Value, today),
    stream: {
      use: (input) => spec.stream.use(input as Accessor<Request | null>),
    },
  }
  return {
    source,
    to: (value) => ({ kind: "plugin", source, value }),
    value: (route) =>
      route.kind === "plugin" && route.source === source ? route.value as Value : null,
    parse: spec.parse,
    href: spec.href,
    breadcrumb: spec.breadcrumb,
    request: spec.request,
  }
}

/** Join a typed route to the face mounted in the same plugin scope. */
export const defineAppPage = <Value, Request extends PageRequest>(
  route: DefinedAppRoute<Value, Request>,
  face: (props: {
    readonly page: Extract<Shown, { readonly kind: Request["kind"] }>
    readonly drawn: Drawn
    readonly today: string
  }) => JSX.Element,
): AppPage => {
  const page = {
    [APP_PAGE]: true,
    route: route.source as unknown as AppRoute,
    face: face as AppPage["face"],
  }
  return page
}

/** The front page: the address that names no place at all, and what every
 *  string this cannot read comes back as. */
const HOME = "/"

/**
 * THE PAGES THIS APP CLAIMS BY NAME, as ONE table read in both directions.
 *
 * They were three constants printed in {@link hrefOfIn} and compared again in
 * {@link routeNamedIn} — two lists of the same fact, which is the shape where a
 * page can end up printed and not parsed: a link the app writes, that loads as
 * the front page. Nothing fails when they disagree, which is why it is worth
 * making impossible rather than watching for.
 *
 * Core's table is deliberately small: journal's volatile address vocabulary
 * now arrives through `app.route`. The `satisfies` is the socket:
 * a kind named in {@link Named} and missing here is a compile error at the one
 * place the app says which words it has taken.
 *
 * NOT its own module, though it is the volatile part: the seam that matters is
 * this table, it has exactly one consumer, and a file per twenty lines is
 * decomposition by size rather than by what changes together.
 */
type Named = Extract<Route, { readonly kind: "trash" }>["kind"]

const NAMED = {
  trash: "/trash",
} as const satisfies { readonly [K in Named]: `/${string}` }

/** The same table read backwards — spelling to page — built once rather than
 *  per parse. */
const NAMED_AT = new Map<string, Named>(
  Object.entries(NAMED).map(([kind, at]) => [at, kind as Named]),
)

/** Whether a route is a core page that spells a word — asked of the table
 *  itself, so its kind is not written out a second time and the answer
 *  narrows the type rather than casting it away. */
const isNamed = (kind: Route["kind"]): kind is Named => Object.hasOwn(NAMED, kind)

/**
 * The query key the FILTER rides in — the one thing in an address here that is
 * not a path.
 *
 * It is in the address for the reason everything else is: a narrowed outline is
 * a link somebody can send, and the back button is the browser's history rather
 * than something this app keeps. A signal beside the route would be a second
 * answer to "what is on screen", free to disagree with the URL the moment a
 * `popstate` lands.
 *
 * On every route but the DOCUMENT's. It was the two tree routes for one
 * release, and the three that were left out were left out on a guess that did
 * not survive being written down: a day and the agenda are date questions, but
 * a filter over one is "which of the things on this day", which is a narrowing
 * of the answer rather than a second question about it — and the trash is
 * read-only, which is a fact about its VERBS and not about whether a pile of
 * archived rows can be looked through. What stays out is the one page whose
 * content the grammar has nothing to say about: a document is prose, and this
 * grammar selects nodes.
 */
const FILTER_KEY = "q"

/**
 * The address a route names, or `null` for one that names no place.
 *
 * A FIELD READ rather than a correspondence to maintain, which is what the arm
 * collapse bought: a content route IS an address, so there is nothing here to
 * get wrong and nothing that could disagree with the grammar. The computed
 * pages name no place at all, and neither does the front page.
 */
const addressNamed = (route: Route): Address | null =>
  route.kind === "at" ? route.address : null

const nodePage = (page: AppPage): MountedAppPage => {
  if (!(APP_PAGE in page) || !(APP_ROUTE in page.route)) {
    throw new Error("app.route entries must be built with defineAppRoute and defineAppPage")
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

/** Settle one snapshot of mounted route claims. Earlier plugins keep their
 * claims; a later colliding page is omitted as a whole and named in one log
 * sentence, so a bad tenant cannot turn a parse into a blank application. */
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
      page = nodePage(face)
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

/**
 * THE ROUTES THE MOUNTED PLUGINS CLAIM, as this grammar is handed them.
 *
 * It was a module variable here, with a `holdRoutePages` beside it that
 * navigation's renderer integration called — so five other packages parsed and
 * printed URLs against a live table nobody had declared a dependency on, and a
 * serve whose renderer had not yet contributed answered a DIFFERENT grammar
 * (`/d/2026-09-07` becomes a vault file rather than a day) with nothing saying
 * so. That is the audit's §2 and §12, in the one module every package in this
 * tree spells an address with.
 *
 * The table travels as an ARGUMENT now. The pure half of the grammar — the
 * constructors, the address reading, the narrowing — is exported as it always
 * was; the four operations that genuinely read the roster are exported as pure
 * functions OVER it, and {@link routingOver} binds them into the {@link Routing}
 * capability `Navigation` carries. A consumer that prints or parses a plugin
 * URL names `navigation.state` and is handed that capability; a consumer whose
 * routes are this app's own keeps {@link hrefOfPlain}, which needs no roster
 * because there is no tenant in it.
 */
export type MountedPages = ReturnType<typeof settleRoutePages>

/** No plugin claims a URL — the honest reading before a renderer has
 *  contributed anything, and the one a bench starts from. */
export const NO_PAGES: MountedPages = []

const claims = (route: NodePageRoute, pathname: string): boolean =>
  route.claims.some((claim) =>
    claim.kind === "exact" ? pathname === claim.path : pathname.startsWith(claim.path)
  )

/** The mounted tenant for a plugin route, or null after that tenant left. */
export const routeFaceIn = (pages: MountedPages, route: Route): MountedAppPage | null => {
  if (route.kind !== "plugin") return null
  return pages.find((one) => one.page.route === route.source)?.page ?? null
}

/** The front page: the address that names no place. One value, since it is
 *  only ever read. */
export const HOME_ROUTE: PlainRoute = { kind: "at", address: null }

/**
 * WHERE AN ADDRESS OPENS.
 *
 * The one constructor for a content route, so that no caller assembles the arm
 * itself — which is what makes "the page kind is derived" true rather than
 * merely intended. `null` is the front page, and it is what an unnameable
 * pair falls back to, on {@link routeOfIn}'s own kindness: a route that names
 * nothing is the page that names nothing.
 */
const atAddress = (address: Address | null): PlainRoute => ({ kind: "at", address })

/** The page a served FILE opens — an outline drawn as a tree, a body drawn
 *  whole, and which of those is nobody's decision here (`./page.ts` asks the
 *  registry when it picks the page). */
export const atFile = (file: string, fragment?: string, query?: string): PlainRoute => ({
  ...atAddress(addressOf(file, fragment ?? null)),
  ...(fragment !== undefined && lineAt(fragment) !== undefined && query?.trim() ? { filter: query } : {}),
})

/** The source-line fragment grammar, shared by result routes and document pages. */
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

/** One node's page, by the id that is the whole of its address: bare, global,
 *  and right about where the node lives after every move short of a delete. */
export const atNode = (id: string): PlainRoute => atAddress(addressOf(null, id))

/** A place INSIDE a file — a heading of a body, or a node of an outline, which
 *  is the grammar's own reading of what a `#` after a path means. */
export const atElement = (file: string, element: string | null): PlainRoute =>
  atAddress(addressOf(file, element))

/**
 * The URL a route is at: a PLACE, and what it is NARROWED by.
 *
 * Both halves of that sentence are visible in the shape of this function. The
 * place is either an address ({@link addressNamed}) or one of the computed
 * pages, which spell a word instead; the narrowing is a query, and it goes
 * where a URL keeps one — after the path and BEFORE any fragment, which is
 * why the address is written in halves ({@link writtenAddress}) rather than
 * whole and cut back open here.
 */
export const hrefOfPlain = (route: PlainRoute): string => {
  const narrowed = narrowing(sourceLanding(route) ? route.filter : filterOfPlain(route))
  if (isNamed(route.kind)) return NAMED[route.kind] + narrowed
  const address = addressNamed(route)
  if (address === null) return HOME + narrowed
  const { path, element } = writtenAddress(address)
  return HOME + path + narrowed + (element === undefined ? "" : `#${element}`)
}

/**
 * ...AND THE SAME QUESTION ABOUT A ROUTE THAT MAY BE A PLUGIN'S, which needs
 * the roster.
 *
 * A PLUGIN ROUTE WHOSE TENANT HAS LEFT SPELLS THE FRONT PAGE, and that is a
 * product contract rather than an implementation detail: a pinned link to a
 * page nobody serves any more takes a reader somewhere that exists.
 * `routes.test.ts` holds it, together with the other half of the same
 * sentence — {@link samePageIn} still tells that route APART from the front
 * page, so the router's own reinterpretation is not suppressed by the URL it
 * happens to print.
 *
 * The presence check is `route.source` looked up in the roster BY IDENTITY, so
 * a replacement provider's page is a different route rather than the same one
 * (`samePageIn`'s third case).
 */
export const hrefOfIn = (pages: MountedPages, route: Route): string => {
  if (route.kind !== "plugin") return hrefOfPlain(route)
  return (routeFaceIn(pages, route)?.route.href(route.value) ?? HOME) + narrowing(filterOfIn(pages, route))
}

/** The `?q=…` a filtered page wears — and nothing at all for an unfiltered
 *  one, so the ordinary address is exactly the address it always was. Whitespace
 *  becomes `+` through `URLSearchParams`, which reads better in the bar than
 *  `%20` and decodes back identically. */
const narrowing = (filter: string | undefined): string =>
  filter === undefined || filter.trim() === ""
    ? ""
    : `?${new URLSearchParams({ [FILTER_KEY]: filter }).toString()}`

/**
 * What a query NARROWS a route by, as the fields to spread onto one — `{}` for
 * a query that narrows nothing.
 *
 * The spread rather than the string, because every caller wanted the same two
 * lines around it and a blank filter has to be ABSENT rather than empty: two
 * routes for one unfiltered page would be two strings in the bar and two
 * entries in the history. One reading, so the parser, the front-page fallback
 * and anything that later wants it cannot disagree about a blank one.
 */
const narrowedBy = (search: string): { readonly filter?: string } => {
  // The common address carries no query at all — every title-borne address,
  // every link in a note — and `URLSearchParams` is a parser to build for a
  // string that has nothing in it.
  if (search === "") return UNNARROWED
  const value = new URLSearchParams(search).get(FILTER_KEY)
  return value === null || value.trim() === "" ? UNNARROWED : { filter: value }
}

/** The narrowing of a page nothing narrows — one object, since it is only ever
 *  spread and never held. */
const UNNARROWED: { readonly filter?: string } = {}

/**
 * The file a route names, for the two that name one — what a link publishes as
 * `data-file`, and the sidebar's own answer to "is this entry the page I am
 * on". Read off the route rather than passed beside it: the two could disagree,
 * and the route is the one a click follows.
 *
 * IT READS THE ADDRESS, which is now a field read rather than a walk: the
 * route HOLDS the address since the arms collapsed, so this costs a property
 * access on a path called once per `<Link>` per frame (`./router.tsx`,
 * `data-file`). The measured objection to asking the grammar — that it walked
 * the path and minted an `Address` to hand back a field the route already had
 * — is gone with the field it was about.
 */
export const fileNamed = (route: Route): string | undefined => {
  const address = addressNamed(route)
  return address === null || address.kind === "node" ? undefined : address.path
}

/**
 * The route a link on the page names, or `null` for an address this app should
 * let the browser have.
 *
 * STRICTER THAN {@link routeOfIn} on purpose, and the difference is who is
 * asking. `routeOf` reads the address bar, where an unrecognised path is a
 * reader who typed something and the kindest answer is the app's front page.
 * This reads an `href` inside RENDERED MARKDOWN — a link somebody wrote in a
 * file — and there the same fallback would mean every link this app has no
 * page for silently opening the default outline instead of going where it says.
 *
 * SO IT ASKS THE PARSER WHETHER IT RECOGNISED ANYTHING, which is a question
 * {@link routeNamedIn} can answer and {@link routeOfIn} cannot: the front page is
 * what an unread address FALLS BACK to there, so a caller holding the answer
 * cannot tell "the reader typed `/`" from "this is not one of ours". It used
 * to be tested by the BIJECTION instead — print the route back and compare —
 * which answered the same for `/etc/passwd` and refused a spelling this app
 * reads but would not have written, `/house.olai#kitchen`. The bijection is
 * still the TEST (`routes.test.ts`); it is no longer the mechanism.
 *
 * A FRAGMENT IS PART OF THE ADDRESS NOW, and this claims it. It used to be
 * left to the browser on the argument that what a `#` named on a rendered page
 * was an id this app mints per block — but a `#` is the address grammar's own
 * punctuation since the addresses ruling, `/notes/README.md#install` is a
 * document landed at a heading and `/#a1b2c3` is a node, and both are pages
 * this app draws. What is still the browser's is a fragment with NO PATH in
 * front of it (`#md-1a2b-beds`): that is an anchor inside the page being read,
 * and an app address always starts with a slash.
 */
export const routeInIn = (pages: MountedPages, href: string): Route | null =>
  href.startsWith("/") ? routeNamedIn(pages, splitAddress(href)) : null

/**
 * Anything this does not recognise is the default outline: an unknown path is
 * a reader who typed something, and the app they wanted is the one at `/`.
 *
 * It takes the whole ADDRESS — path, query and fragment — rather than the
 * pathname, because both of the others are part of what a URL means here and a
 * parser handed one of them could only ever answer part of one. Callers pass
 * `location.pathname + location.search + location.hash`; a bare path parses
 * exactly as it did before.
 *
 * The reading itself is {@link routeNamedIn}'s, which answers `null` where this
 * answers the front page — one grammar, read once, with the KINDNESS added
 * here rather than baked into it.
 */
export const routeOfIn = (pages: MountedPages, address: string): Route => {
  const parts = splitAddress(address)
  const named = routeNamedIn(pages, parts)
  if (named !== null) return named
  /** What an address this does not recognise means, and — since {@link spelled}
   *  — what one it cannot READ means too. The kindness is the same either way:
   *  somebody typed something, and the app they wanted is the one at `/`. It
   *  keeps whatever the address was NARROWED by, because a query is read by
   *  `URLSearchParams`, which is lenient where a path is not. */
  return { ...HOME_ROUTE, ...narrowedBy(parts.search) }
}

/**
 * The route an address NAMES, or `null` for a string that names no page of
 * this app — the whole of the grammar, and the only place it is read.
 *
 * The `null` is what {@link routeInIn} needs and what {@link routeOfIn} spends: a
 * parser that answered the front page for everything could never say whether
 * it had recognised anything, and both callers want that answer for opposite
 * reasons.
 *
 * PLUGIN AND CORE COMPUTED PAGES ARE READ FIRST. A plugin claim reserves its
 * whole exact word or prefix, including malformed paths its parser refuses;
 * those paths do not silently become vault-file addresses. Claims are checked
 * against every other computed-page claim before one is read.
 */
const routeNamedIn = (pages: MountedPages, parts: Split): Route | null => {
  const { pathname, search, fragment } = parts
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
  // The front page names no file — "whichever outline was found first" — which
  // is a page of this app and not a fallback, so a link may be written to it.
  if (pathname === HOME && fragment === undefined) return { ...HOME_ROUTE, ...narrowed }

  const named = parseAddress(
    pathname.slice(HOME.length) + (fragment === undefined ? "" : `#${fragment}`),
  )
  if (named === null) return null
  // WHICH PAGE it opens is not decided here and is not stored: an address is a
  // place, and what is drawn at that place is the suffix's answer, asked once
  // where the page is picked (`./page.ts`). That is the whole of the arm
  // collapse — an address and a sidebar click cannot open two different pages
  // for one file, because neither of them says which page.
  const route = atAddress(named)
  return narrowablePlain(route) || sourceLanding(route) ? { ...route, ...narrowed } : route
}

/**
 * Which addresses may be narrowed — every one but a document's, and the one
 * place that list is written down.
 *
 * It was said three times before it was a function: once in the arms that carry
 * a `filter`, once in {@link narrowedToIn}'s guard and once in {@link filterOfIn}'s.
 * Three spellings of the same list is three edits the day another page grows a
 * filter, and two of them are easy to miss because nothing fails when they
 * disagree — the filter simply goes nowhere. The day a day page grew one, this
 * was the only line that changed.
 *
 * Written as the ONE EXCLUSION rather than as a list of five, because that is
 * the shape of the rule now: a filter selects nodes, and a document is the one
 * page here that is not made of them.
 *
 * IT IS A DERIVATION SINCE THE ARMS COLLAPSED, and that is the same move the
 * page kind made: which page an address opens is the registry's answer, so
 * "does this page hold nodes" is too. It used to be an arm that had no
 * `filter` field, which was the rule spelled in the TYPE — a stronger promise,
 * and one the type could only make while the route stored what it drew. What
 * replaces it is that nothing can build a document route with a filter without
 * going through {@link narrowedToIn}, which asks this.
 */
export const narrowablePlain = (route: PlainRoute): boolean => {
  const address = addressNamed(route)
  return address === null || address.kind === "node" ||
    fileKind(address.path) === "outline"
}

/** ...and the same question about a route that may be a plugin's, where the
 *  answer is the TENANT'S own declaration and a departed tenant narrows
 *  nothing. */
export const narrowableIn = (pages: MountedPages, route: Route): boolean =>
  route.kind === "plugin"
    ? routeFaceIn(pages, route)?.route.narrowable ?? false
    : narrowablePlain(route)

/**
 * The same page, narrowed — or not, when `filter` is blank.
 *
 * Here rather than at the call site because a filter typed on a document page
 * has nowhere to go, and a caller that spread it onto the route anyway would
 * mint an address {@link hrefOfIn} silently drops and {@link routeOfIn} never
 * returns.
 */
export const narrowedToIn = (pages: MountedPages, route: Route, filter: string): Route => {
  if (!narrowableIn(pages, route)) return route
  return { ...route, filter: filter.trim() === "" ? undefined : filter }
}

/** What a page is narrowed BY, for the one component that draws it and the
 *  memo that parses it. Read off the route for the reason `fileNamed` is: the
 *  route is what an address decodes to, and a copy beside it could differ. */
export const filterOfPlain = (route: PlainRoute): string =>
  (narrowablePlain(route) ? route.filter : undefined) ?? ""

/** ...and the same reading of a route that may be a plugin's. */
export const filterOfIn = (pages: MountedPages, route: Route): string =>
  (narrowableIn(pages, route) ? route.filter : undefined) ?? ""

/**
 * The same PAGE, whatever it is narrowed by.
 *
 * What it is for is the one thing a filter must NOT do: a query typed one
 * character at a time mints a fresh `Route` per keystroke, and everything
 * downstream of "which page is open" — resolving the id, walking the tree,
 * minting a row per node — would be redone for each of them. Asked through the
 * bijection rather than field by field, so it cannot go stale against a route
 * arm added later.
 */
export const samePageIn = (pages: MountedPages, a: Route, b: Route): boolean =>
  a.kind === b.kind
  && (a.kind !== "plugin" || b.kind !== "plugin" || a.source === b.source)
  && hrefOfIn(pages, narrowedToIn(pages, a, "")) === hrefOfIn(pages, narrowedToIn(pages, b, ""))

/**
 * THE FOUR OPERATIONS THAT READ THE ROSTER, BOUND — what `Navigation` carries
 * and what a consumer that prints or parses a plugin URL is handed.
 *
 * A FACTORY over an accessor rather than a snapshot: the roster moves while a
 * tab is open, and a capability holding the table as it stood when the row
 * applied would print a departed tenant's URL for the life of the page. The
 * accessor is navigation's own, fed by the renderer integration that declares
 * `Faces` — so the dependency the audit is about is declared once, by the row
 * that brokers it, and every consumer names that row.
 */
export interface Routing {
  /** The mounted tenant for a plugin route, or `null` after it left. */
  readonly face: (route: Route) => MountedAppPage | null
  /** Whether a page takes a filter at all — the tenant's own declaration where
   *  the page is a plugin's. */
  readonly narrowable: (route: Route) => boolean
  /** The same page, narrowed — or not, where it takes no filter. */
  readonly narrowedTo: (route: Route, filter: string) => Route
  /** What a page is narrowed BY. */
  readonly filterOf: (route: Route) => string
  /** The URL a route is at — the front page for a departed tenant. */
  readonly href: (route: Route) => string
  /** The route a link on the page names, or `null` for an address this app
   *  should let the browser have. */
  readonly routeIn: (href: string) => Route | null
  /** ...and the address bar's kinder reading, which falls back to the front
   *  page rather than answering nothing. */
  readonly routeOf: (address: string) => Route
  /** The same PAGE, whatever it is narrowed by. */
  readonly samePage: (a: Route, b: Route) => boolean
}

export const routingOver = (pages: () => MountedPages): Routing => ({
  face: (route) => routeFaceIn(pages(), route),
  narrowable: (route) => narrowableIn(pages(), route),
  narrowedTo: (route, filter) => narrowedToIn(pages(), route, filter),
  filterOf: (route) => filterOfIn(pages(), route),
  href: (route) => hrefOfIn(pages(), route),
  routeIn: (href) => routeInIn(pages(), href),
  routeOf: (address) => routeOfIn(pages(), address),
  samePage: (a, b) => samePageIn(pages(), a, b),
})
