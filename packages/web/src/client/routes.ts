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
 * ## What a URL is made of
 *
 * Two things, and everything below is one of them:
 *
 *   - a PLACE — an address in the served directory, or one of the computed
 *     pages, which are questions asked of the set and spell a word instead;
 *   - a NARROWING — `?q=`, and nothing else rides in a query here.
 *
 * The bijection is over that pair, in both directions, which is why
 * {@link hrefOf} reads as *place, then narrowing, then the element half* and
 * {@link routeNamed} reads as *the words this app claimed, then the grammar*.
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
 * bundle's own — `/index.html` and `/assets/…` (`@kolu/surface-app`).
 *
 * ONE of those two is a collision, and which one was MEASURED rather than
 * reasoned about (`packages/server/src/serve.test.ts`, the two tests at the
 * foot of the install surface). A served directory holding an `index.html` at
 * its top level is reachable: the bundle answers that path with the shell, and
 * the shell is byte for byte what the SPA fallback would have answered with, so
 * the address reaches this parser and the page opens like any other file's. A
 * file under an `assets/` folder is not, and cannot be made so from here: that
 * prefix is the immutable, content-hashed one, and a miss under it has to 404
 * rather than fall through — a `.js` URL answered with the HTML shell is the
 * wrong MIME pinned `immutable` for a year (kolu#1319). So the reader gets
 * `not found`, and no page at all.
 *
 * The fix is to move the bundle's hashed dir under a prefix this app already
 * owns — `/_olai/assets/`, the same `_olai/` the shelf and the trash are
 * minted into, so what it shadows is olai's own namespace rather than the
 * reader's — and it is a SERVER change. `@kolu/surface-app`'s serving half has
 * taken an `assetPrefix` since the freshness contract was written; its Bun
 * build hardcoded the directory, so the input had no producer and nothing here
 * could reach it. That socket is kolu#2197, and the move lands when the pin
 * carries it.
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
 * set — every `_olai/Trash.olai` under the directory — not a file's address. The
 * files it reads still HAVE addresses (`/_olai/Trash.olai` parses like any
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
  parseAddress,
  type Split,
  splitAddress,
  writtenAddress,
} from "@olai/format"

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
  /** One day of the journal, by its ISO date. */
  | { readonly kind: "day"; readonly date: string; readonly filter?: string }
  /** Whichever day it is when this is read. */
  | { readonly kind: "today"; readonly filter?: string }
  /** What is owed, read forward from whatever day it is. */
  | { readonly kind: "agenda"; readonly filter?: string }
  /** What was put away: every `_olai/Trash.olai` under the directory, read-only.
   *  It spells no file for the reason `/agenda` spells no horizon — which
   *  archives exist is the set's answer, and an address that named one would
   *  mean something different the day a subdirectory gets its own. */
  | { readonly kind: "trash"; readonly filter?: string }

/** The front page: the address that names no place at all, and what every
 *  string this cannot read comes back as. */
const HOME = "/"

/**
 * THE PAGES THIS APP CLAIMS BY NAME, as ONE table read in both directions.
 *
 * They were three constants printed in {@link hrefOf} and compared again in
 * {@link routeNamed} — two lists of the same fact, which is the shape where a
 * page can end up printed and not parsed: a link the app writes, that loads as
 * the front page. Nothing fails when they disagree, which is why it is worth
 * making impossible rather than watching for.
 *
 * It is a table because this is the VOLATILE half of the URL space. What an
 * address is has settled — it is the format's grammar now, and a statement
 * about the directory — while this list has grown three times in as many
 * releases (the trash, the agenda, today) and will grow again the day another
 * question about the set is worth a bookmark. The `satisfies` is the socket:
 * a kind named in {@link Named} and missing here is a compile error at the one
 * place the app says which words it has taken.
 *
 * NOT its own module, though it is the volatile part: the seam that matters is
 * this table, it has exactly one consumer, and a file per twenty lines is
 * decomposition by size rather than by what changes together.
 */
type Named = Extract<Route, { readonly kind: "today" | "agenda" | "trash" }>["kind"]

const NAMED = {
  today: "/today",
  agenda: "/agenda",
  trash: "/trash",
} as const satisfies { readonly [K in Named]: `/${string}` }

/** The same table read backwards — spelling to page — built once rather than
 *  per parse. */
const NAMED_AT = new Map<string, Named>(
  Object.entries(NAMED).map(([kind, at]) => [at, kind as Named]),
)

/** Whether a route is one of the pages that spell a word — asked of the table
 *  itself, so the three kinds are not written out a second time and the answer
 *  narrows the type rather than casting it away. */
const isNamed = (kind: Route["kind"]): kind is Named => Object.hasOwn(NAMED, kind)

/**
 * The one computed page that carries a VALUE, so it is a prefix rather than a
 * row of the table above: a day is named by its date, and reading one back
 * needs the totality rule a bare word does not ({@link spelled}).
 */
const DAY_PREFIX = "/d/"

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

/** The front page: the address that names no place. One value, since it is
 *  only ever read. */
export const HOME_ROUTE: Route = { kind: "at", address: null }

/**
 * WHERE AN ADDRESS OPENS.
 *
 * The one constructor for a content route, so that no caller assembles the arm
 * itself — which is what makes "the page kind is derived" true rather than
 * merely intended. `null` is the front page, and it is what an unnameable
 * pair falls back to, on {@link routeOf}'s own kindness: a route that names
 * nothing is the page that names nothing.
 */
const atAddress = (address: Address | null): Route => ({ kind: "at", address })

/** The page a served FILE opens — an outline drawn as a tree, a body drawn
 *  whole, and which of those is nobody's decision here (`./page.ts` asks the
 *  registry when it picks the page). */
export const atFile = (file: string): Route => atAddress(addressOf(file, null))

/** One node's page, by the id that is the whole of its address: bare, global,
 *  and right about where the node lives after every move short of a delete. */
export const atNode = (id: string): Route => atAddress(addressOf(null, id))

/** A place INSIDE a file — a heading of a body, or a node of an outline, which
 *  is the grammar's own reading of what a `#` after a path means. */
export const atElement = (file: string, element: string | null): Route =>
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
export const hrefOf = (route: Route): string => {
  const narrowed = narrowing(filterOf(route))
  if (isNamed(route.kind)) return NAMED[route.kind] + narrowed
  if (route.kind === "day") {
    return DAY_PREFIX + encodeURIComponent(route.date) + narrowed
  }
  const address = addressNamed(route)
  if (address === null) return HOME + narrowed
  const { path, element } = writtenAddress(address)
  return HOME + path + narrowed + (element === undefined ? "" : `#${element}`)
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
  href.startsWith("/") ? routeNamed(splitAddress(href)) : null

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
  const parts = splitAddress(address)
  const named = routeNamed(parts)
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
const routeNamed = (parts: Split): Route | null => {
  const { pathname, search, fragment } = parts
  const narrowed = narrowedBy(search)

  const word = NAMED_AT.get(pathname)
  if (word !== undefined) return { kind: word, ...narrowed }
  if (pathname.startsWith(DAY_PREFIX)) {
    // TOTAL, for the reason the grammar's own reading is (`@olai/format`'s
    // `parseAddress`): `decodeURIComponent` throws on a malformed escape, and
    // a throw during render is a blank app rather than a bad address. Written
    // here rather than borrowed, because a DATE is not a place in the
    // directory and nothing over there reads one — and inline rather than
    // behind a helper, because it is the only address of this app that is not
    // the format's.
    try {
      const date = decodeURIComponent(pathname.slice(DAY_PREFIX.length))
      return { kind: "day", date, ...narrowed }
    } catch {
      return null
    }
  }
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
  return narrowable(route) ? { ...route, ...narrowed } : route
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
 *
 * IT IS A DERIVATION SINCE THE ARMS COLLAPSED, and that is the same move the
 * page kind made: which page an address opens is the registry's answer, so
 * "does this page hold nodes" is too. It used to be an arm that had no
 * `filter` field, which was the rule spelled in the TYPE — a stronger promise,
 * and one the type could only make while the route stored what it drew. What
 * replaces it is that nothing can build a document route with a filter without
 * going through {@link narrowedTo}, which asks this.
 */
export const narrowable = (route: Route): boolean => {
  const address = addressNamed(route)
  return address === null || address.kind === "node" ||
    fileKind(address.path) === "outline"
}

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
