/**
 * What a URL means, and nothing else.
 *
 * A URL here is an ADDRESS with a slash in front of it. `@olai/format`'s
 * `address.ts` owns the grammar — `[document]#[element]`, one currency for
 * every feature that has to name something — and this module owns everything
 * a BROWSER adds to it: which addresses are pages of this app, the computed
 * pages that name nothing on disk, and the one thing that rides in a query.
 *
 * | URL | Page |
 * |---|---|
 * | `/Tasks.olai` | one outline, drawn as a tree |
 * | `/notes/README.md` | one document, drawn as a body |
 * | `/notes/README.md#install` | …landed at one of its headings |
 * | `/#a1b2c3` | one node, wherever it lives |
 * | `/` | whichever outline was found first |
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
 * anything it does not serve itself, and the two things it does serve at the
 * root are `/index.html` and `/assets/…` (`@kolu/surface-app`). A served
 * directory holding an `index.html` at its top level, or any file under an
 * `assets/` folder, is a page this app can address and cannot be reached at —
 * the bundle answers first. Moving the bundle's own paths under a reserved
 * prefix is the fix and it is a server change, so it is filed rather than
 * done here.
 *
 * ## The computed pages, which name nothing on disk
 *
 * `/d/<ISO-date>` names a DAY, which is not a thing on disk: it is a question
 * asked of every dated node in the set, answered at view time. `/today` is the
 * same page and a different address — it names no day, it names the day it IS,
 * which is what a bookmark, a home screen and an agent can all keep. Resolving
 * it needs a clock, and a clock is exactly what parsing a URL must not have.
 *
 * `/agenda` names no day either, and unlike `/today` it never will: it is the
 * same dates read FORWARD, so it spells nothing at all. A horizon in the URL
 * would be an address that meant something different tomorrow.
 *
 * `/trash` spells nothing for the same reason: it is a question asked of the
 * set — every `Archive.olai` under the directory — not a file's address. The
 * files it reads still HAVE addresses (`/Archive.olai` parses like any
 * outline), and what such an address opens is the trash view, because an
 * archive is not a place you edit (`page.ts` decides that, not this parser).
 *
 * They are READ FIRST, which is the whole of the precedence rule: a computed
 * page is a word this app claimed, and an address is everything else.
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
 * printed whole, with the query slid into the one place a browser will read it
 * from. {@link printAddress} escapes every `#` inside a name, so the one it
 * writes is the only one in the result and the seam is unambiguous.
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
  parseAddress,
  printAddress,
} from "@olai/format"

export type Route =
  /** One outline. `null` is "whichever was found first" — the bare `/`. */
  | { readonly kind: "outline"; readonly file: string | null; readonly filter?: string }
  /**
   * One document, by its path — and optionally by a place INSIDE it.
   *
   * `at` is a heading's own id, which is what a `#` after a document has
   * always meant, and it is on this arm alone because it is the only page made
   * of prose: a `.md` renders headings that `rehype-slug` gives ids to, and a
   * `.html` is a document with whatever ids its author wrote. An outline's
   * elements are NODES, and the grammar reads a `#` after a `.olai` as one —
   * which is why the node arm below carries no file.
   *
   * WITHOUT the `#`, because that character is the address's punctuation
   * rather than part of the name: {@link hrefOf} writes it and {@link routeOf}
   * strips it, the same division `filter` gets with `?q=`.
   */
  | { readonly kind: "document"; readonly file: string; readonly at?: string }
  | { readonly kind: "node"; readonly id: string; readonly filter?: string }
  /** One day of the journal, by its ISO date. */
  | { readonly kind: "day"; readonly date: string; readonly filter?: string }
  /** Whichever day it is when this is read. */
  | { readonly kind: "today"; readonly filter?: string }
  /** What is owed, read forward from whatever day it is. */
  | { readonly kind: "agenda"; readonly filter?: string }
  /** What was put away: every `Archive.olai` under the directory, read-only.
   *  It spells no file for the reason `/agenda` spells no horizon — which
   *  archives exist is the set's answer, and an address that named one would
   *  mean something different the day a subdirectory gets its own. */
  | { readonly kind: "trash"; readonly filter?: string }

const DAY_PREFIX = "/d/"
const TODAY = "/today"
const AGENDA = "/agenda"
const TRASH = "/trash"

/** The front page: the address that names no place at all, and what every
 *  string this cannot read comes back as. */
const HOME = "/"

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
 * The three CONTENT routes are the address grammar's three arms, and this is
 * the whole of the correspondence: an outline and a document are both a
 * document (which of the two a page draws is the suffix's answer, not the
 * address's), a place inside a document is its element, and a node is an
 * element with no document at all.
 *
 * `null` is what the front page is — an outline route naming no file — and
 * what a route naming a path this directory could not serve is. The second is
 * the print-side twin of {@link routeOf}'s kindness: a route that names
 * nothing is written as the address that names nothing.
 */
const addressIn = (route: Route): Address | null => {
  if (route.kind === "node") return addressOf(null, route.id)
  if (route.kind === "document") return addressOf(route.file, route.at ?? null)
  if (route.kind === "outline") return addressOf(route.file, null)
  return null
}

/** The address every content URL is made of, with the query slid into the one
 *  place a URL will carry it: between the path and the fragment. */
export const hrefOf = (route: Route): string => {
  if (route.kind === "day") {
    return DAY_PREFIX + encodeURIComponent(route.date) + narrowing(route.filter)
  }
  if (route.kind === "today") return TODAY + narrowing(route.filter)
  if (route.kind === "agenda") return AGENDA + narrowing(route.filter)
  if (route.kind === "trash") return TRASH + narrowing(route.filter)
  const address = addressIn(route)
  if (address === null) return HOME + narrowing(filterOf(route))
  const written = printAddress(address)
  const cut = written.indexOf("#")
  const path = cut === -1 ? written : written.slice(0, cut)
  const element = cut === -1 ? "" : written.slice(cut)
  return HOME + path + narrowing(filterOf(route)) + element
}

/** The `?q=…` a filtered page wears — and nothing at all for an unfiltered
 *  one, so the ordinary address is exactly the address it always was. Whitespace
 *  becomes `+` through `URLSearchParams`, which reads better in the bar than
 *  `%20` and decodes back identically. */
const narrowing = (filter: string | undefined): string =>
  filter === undefined || filter.trim() === ""
    ? ""
    : `?${new URLSearchParams({ [FILTER_KEY]: filter }).toString()}`

/** The filter an address carries, or `undefined` — one reading, so the parser
 *  below and anything that later wants it cannot disagree about a blank one. */
const filterIn = (search: string): string | undefined => {
  const value = new URLSearchParams(search).get(FILTER_KEY)
  return value === null || value.trim() === "" ? undefined : value
}

/** The file a route names, for the two that name one — what a link publishes
 *  as `data-file`, and the sidebar's own answer to "is this entry the page I
 *  am on". Read off the route rather than passed beside it: the two could
 *  disagree, and the route is the one a click follows. */
export const fileNamed = (route: Route): string | undefined =>
  route.kind === "document"
    ? route.file
    : route.kind === "outline"
    ? route.file ?? undefined
    : undefined

/**
 * The route a link on the page names, or `null` for an address this app should
 * let the browser have.
 *
 * STRICTER THAN {@link routeOf} on purpose, and the difference is who is
 * asking. `routeOf` reads the address bar, where an unrecognised path is a
 * reader who typed something and the kindest answer is the app's front page.
 * This reads an `href` inside RENDERED MARKDOWN — a link somebody wrote in a
 * file — and there the same fallback would mean every link this app has no
 * page for silently opening the default outline instead of going where it says.
 *
 * SO IT ASKS THE PARSER WHETHER IT RECOGNISED ANYTHING, which is a question
 * {@link routeNamed} can answer and {@link routeOf} cannot: the front page is
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
export const routeIn = (href: string): Route | null =>
  href.startsWith("/") ? routeNamed(href) : null

/**
 * Path, query and fragment of an address, cut the way this app writes them.
 *
 * ONE split, so a lone page (`routeOf`) and a workspace that embeds those
 * pages (`workspaceOf`) cannot disagree about where the query ends and
 * the fragment starts. The fragment comes off first: a `#` ends the
 * query, so cutting on `?` before it would leave `#beds` inside a filter
 * and a page narrowed by a word nobody typed.
 *
 * The fragment comes back AS WRITTEN, unescaped, because it is half of an
 * address and the address grammar is what reads it (`@olai/format`'s
 * `parseAddress`). Decoding it here would be this module holding an opinion
 * about a name, and re-joining a decoded half to a written one is how a `#`
 * inside somebody's heading becomes a second cut.
 */
export const splitAddress = (
  address: string,
): {
  readonly pathname: string
  readonly search: string
  readonly fragment: string | undefined
} => {
  const hash = address.indexOf("#")
  const whole = hash === -1 ? address : address.slice(0, hash)
  const fragment = hash === -1 ? undefined : address.slice(hash + 1)
  const cut = whole.indexOf("?")
  return {
    pathname: cut === -1 ? whole : whole.slice(0, cut),
    search: cut === -1 ? "" : whole.slice(cut + 1),
    fragment,
  }
}

/**
 * The text a path segment SPELLS, or `undefined` for an escape no address
 * could have been written with.
 *
 * `decodeURIComponent` THROWS on a malformed escape (`%`, `%ZZ`, `%2`), and a
 * parser that throws is a parser a caller cannot use: this one reads the
 * address BAR, where somebody types, and it reads a title out of `Pins.olai`,
 * which the format invites a hand and an agent to edit (docs/format.md's
 * Pins). A `URIError` out of either of those is not a bad address — it is a
 * blank app, because a throw during render takes the tree that was rendering
 * with it, and this client mounts no error boundary.
 *
 * It is left here for the DAY, which is the one address of this app that is
 * not a `@olai/format` address: a date is not a place in the directory, so
 * nothing over there reads it and the same totality has to be kept here.
 */
const spelled = (text: string): string | undefined => {
  try {
    return decodeURIComponent(text)
  } catch {
    return undefined
  }
}

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
 * The reading itself is {@link routeNamed}'s, which answers `null` where this
 * answers the front page — one grammar, read once, with the KINDNESS added
 * here rather than baked into it.
 */
export const routeOf = (address: string): Route => {
  const named = routeNamed(address)
  if (named !== null) return named
  /** What an address this does not recognise means, and — since {@link spelled}
   *  — what one it cannot READ means too. The kindness is the same either way:
   *  somebody typed something, and the app they wanted is the one at `/`. It
   *  keeps whatever the address was NARROWED by, because a query is read by
   *  `URLSearchParams`, which is lenient where a path is not. */
  const filter = filterIn(splitAddress(address).search)
  return { kind: "outline", file: null, ...(filter === undefined ? {} : { filter }) }
}

/**
 * The route an address NAMES, or `null` for a string that names no page of
 * this app — the whole of the grammar, and the only place it is read.
 *
 * The `null` is what {@link routeIn} needs and what {@link routeOf} spends: a
 * parser that answered the front page for everything could never say whether
 * it had recognised anything, and both callers want that answer for opposite
 * reasons.
 *
 * THE COMPUTED PAGES ARE READ FIRST, and that ordering is the only precedence
 * in this file: `/today`, `/agenda`, `/trash` and `/d/…` are words this app
 * claimed, and everything else is asked of the address grammar. They cannot
 * collide with a file — a served file carries a suffix the registry claims and
 * these spell none — so the order is a reading order and not a rule.
 */
const routeNamed = (address: string): Route | null => {
  const { pathname, search, fragment } = splitAddress(address)
  const filter = search === "" ? undefined : filterIn(search)
  const narrowed = filter === undefined ? {} : { filter }

  if (pathname.startsWith(DAY_PREFIX)) {
    const date = spelled(pathname.slice(DAY_PREFIX.length))
    return date === undefined ? null : { kind: "day", date, ...narrowed }
  }
  if (pathname === TODAY) return { kind: "today", ...narrowed }
  if (pathname === AGENDA) return { kind: "agenda", ...narrowed }
  if (pathname === TRASH) return { kind: "trash", ...narrowed }
  if (!pathname.startsWith(HOME)) return null
  // The front page names no file — "whichever outline was found first" — which
  // is a page of this app and not a fallback, so a link may be written to it.
  if (pathname === HOME && fragment === undefined) {
    return { kind: "outline", file: null, ...narrowed }
  }

  const named = parseAddress(
    pathname.slice(HOME.length) + (fragment === undefined ? "" : `#${fragment}`),
  )
  if (named === null) return null
  if (named.kind === "node") return { kind: "node", id: named.id, ...narrowed }
  if (named.kind === "heading") {
    return { kind: "document", file: named.path, at: named.slug }
  }
  // WHICH PAGE a document opens is the suffix's answer and not the address's:
  // an outline is a tree of rows to zoom into and narrow, everything else is a
  // body drawn whole. The registry is asked rather than a second list here,
  // for the reason it exists (`@olai/format`'s `kinds.ts`).
  return fileKind(named.path) === "outline"
    ? { kind: "outline", file: named.path, ...narrowed }
    : { kind: "document", file: named.path }
}

/**
 * Which addresses may be narrowed — every one but a document's, and the one
 * place that list is written down.
 *
 * It was said three times before it was a function: once in the arms that carry
 * a `filter`, once in {@link narrowedTo}'s guard and once in {@link filterOf}'s.
 * Three spellings of the same list is three edits the day another page grows a
 * filter, and two of them are easy to miss because nothing fails when they
 * disagree — the filter simply goes nowhere. The day a day page grew one, this
 * was the only line that changed.
 *
 * Written as the ONE EXCLUSION rather than as a list of five, because that is
 * the shape of the rule now: a filter selects nodes, and a document is the one
 * page here that is not made of them.
 */
export const narrowable = (route: Route): route is Extract<Route, { filter?: string }> =>
  route.kind !== "document"

/**
 * The same page, narrowed — or not, when `filter` is blank.
 *
 * Here rather than at the call site because a filter typed on a document page
 * has nowhere to go, and a caller that spread it onto the route anyway would
 * mint an address {@link hrefOf} silently drops and {@link routeOf} never
 * returns.
 */
export const narrowedTo = (route: Route, filter: string): Route => {
  if (!narrowable(route)) return route
  return { ...route, filter: filter.trim() === "" ? undefined : filter }
}

/** What a page is narrowed BY, for the one component that draws it and the
 *  memo that parses it. Read off the route for the reason `fileNamed` is: the
 *  route is what an address decodes to, and a copy beside it could differ. */
export const filterOf = (route: Route): string =>
  (narrowable(route) ? route.filter : undefined) ?? ""

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
export const samePage = (a: Route, b: Route): boolean =>
  hrefOf(narrowedTo(a, "")) === hrefOf(narrowedTo(b, ""))
