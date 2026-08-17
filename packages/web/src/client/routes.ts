/**
 * What a URL means, and nothing else.
 *
 * Five addresses, and the difference between them is what each one is a
 * property OF. `/o/<file>` names a file on disk, so it spells the path.
 * `/n/<id>` names a node, and an id is all it may spell: ids are unique across
 * the loaded set and survive renames and moves across files, so the permalink
 * outlives every edit short of a delete — while a URL that also carried the
 * outline would be a URL that could disagree with the file it named.
 *
 * `/doc/<file>` names a file that is READ — a document, or a `.html` — which is
 * also a file and also spells its path. It is a SECOND prefix rather than more
 * work for `/o/` because an outline is a different KIND OF PAGE: a tree with
 * rows to zoom into and a filter to narrow by, against a body drawn whole. The
 * address says which, so a URL means one kind of page before the set is in
 * hand, and renaming a `.md` to a `.olai` is a different page rather than the
 * same address quietly changing what it draws.
 *
 * ONE prefix for both bodied kinds, and not a third for hypertext, because the
 * path already says which: the suffix is what `fileKind` reads, and it is in
 * the address either way. A `/html/` prefix would be the same fact spelled
 * twice — free to disagree with the name it carries — and it would make the
 * kind of a file a property of the LINK that was clicked rather than of the
 * file, which is the seam this app keeps putting back in the format.
 *
 * `/d/<ISO-date>` names a DAY, which is not a thing on disk at all: it is a
 * question asked of every dated node in the set, and the answer is computed at
 * view time (`@olai/format`'s date derivations). `/today` is the same page and
 * a different address — it names no day, it names the day it IS, which is what
 * a bookmark, a home screen and an agent can all keep. Resolving it needs a
 * clock, and a clock is exactly what parsing a URL must not have: the two are
 * kept apart, so this stays pure and `page.ts` is handed the day.
 *
 * `/agenda` names no day either, and unlike `/today` it never will: it is the
 * same dates read FORWARD — what is overdue, what is on today, what is coming —
 * so it spells nothing at all. A horizon in the URL would be an address that
 * meant something different tomorrow, which is the one thing a link may not do.
 *
 * `/trash` spells nothing for the same reason: it is a question asked of the
 * set — every `Archive.olai` under the directory — not a file's address. The
 * files it reads still HAVE addresses (`/o/Archive.olai` parses like any
 * outline path), and what such an address opens is the trash view, because an
 * archive is not a place you edit (`page.ts` decides that, not this parser).
 *
 * Most of them carry a QUERY as well as a path, and only one thing rides in it:
 * `?q=<filter>`, which is what the page is narrowed by. That is an address
 * rather than a signal for the same reason the pages are — a filtered page is a
 * link somebody can send, and Back is the browser's own history. See
 * {@link FILTER_KEY}.
 *
 * Pure, and parsing and printing live beside each other on purpose: they are
 * one bijection, and the test that says so (`routes.test.ts`) is the only
 * thing standing between a link the app writes and a link it cannot read back.
 */

export type Route =
  /** One outline. `null` is "whichever was found first" — the bare `/`. */
  | { readonly kind: "outline"; readonly file: string | null; readonly filter?: string }
  /**
   * One document, by its path — and optionally by a place INSIDE it.
   *
   * `at` is a heading's own id, the thing a `#` in an address has always
   * meant, and it is on this arm alone because it is the only page made of
   * prose: a `.md` renders headings that `rehype-slug` gives ids to, and a
   * `.html` is a document with whatever ids its author wrote. The tree pages
   * have nothing of the kind — a row's address is a node id and it has a route
   * of its own (`/n/`) — so a fragment there would be a part of an address
   * that meant nothing, which is worse than not carrying one.
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

const OUTLINE_PREFIX = "/o/"
const DOCUMENT_PREFIX = "/doc/"
const NODE_PREFIX = "/n/"
const DAY_PREFIX = "/d/"
const TODAY = "/today"
const AGENDA = "/agenda"
const TRASH = "/trash"

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

/** Encoded per segment, so a path with a directory in it stays readable in the
 *  URL bar rather than turning into a run of `%2F`. */
export const hrefOf = (route: Route): string => {
  if (route.kind === "node") {
    return NODE_PREFIX + encodeURIComponent(route.id) + narrowing(route.filter)
  }
  if (route.kind === "day") {
    return DAY_PREFIX + encodeURIComponent(route.date) + narrowing(route.filter)
  }
  if (route.kind === "today") return TODAY + narrowing(route.filter)
  if (route.kind === "agenda") return AGENDA + narrowing(route.filter)
  if (route.kind === "trash") return TRASH + narrowing(route.filter)
  if (route.kind === "document") {
    return DOCUMENT_PREFIX + spell(route.file) + landing(route.at)
  }
  const path = route.file === null ? "/" : OUTLINE_PREFIX + spell(route.file)
  return path + narrowing(route.filter)
}

/**
 * The `#…` a document address wears when it names a place inside the page —
 * and nothing at all when it does not, so the ordinary address is exactly the
 * address it always was.
 *
 * ENCODED as one component, because an id is somebody's heading run through
 * `rehype-slug` — or, in a `.html`, whatever its author wrote — and neither is
 * promised to be free of characters an address gives its own meaning to. The
 * safe ones survive untouched, so the common case reads as it is written.
 */
const landing = (at: string | undefined): string =>
  at === undefined || at === "" ? "" : `#${encodeURIComponent(at)}`

/** The `?q=…` a filtered page wears — and nothing at all for an unfiltered
 *  one, so the ordinary address is exactly the address it always was. Whitespace
 *  becomes `+` through `URLSearchParams`, which reads better in the bar than
 *  `%20` and decodes back identically. */
const narrowing = (filter: string | undefined): string =>
  filter === undefined || filter.trim() === ""
    ? ""
    : `?${new URLSearchParams({ [FILTER_KEY]: filter }).toString()}`

/** The place inside a page an address names, or `undefined` for one that names
 *  none — the other end of {@link landing}. A malformed escape is a fragment
 *  nobody could have written, so it names nothing rather than throwing on the
 *  way to a page that would have drawn fine without it. */
const landed = (fragment: string): string | undefined => {
  if (fragment === "") return undefined
  try {
    return decodeURIComponent(fragment)
  } catch {
    return undefined
  }
}

/** The filter an address carries, or `undefined` — one reading, so the parser
 *  below and anything that later wants it cannot disagree about a blank one. */
const filterIn = (search: string): string | undefined => {
  const value = new URLSearchParams(search).get(FILTER_KEY)
  return value === null || value.trim() === "" ? undefined : value
}

const spell = (file: string): string =>
  file.split("/").map(encodeURIComponent).join("/")

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
 * STRICTER than {@link routeOf} on purpose, and the difference is who is
 * asking. `routeOf` reads the address bar, where an unrecognised path is a
 * reader who typed something and the kindest answer is the app's front page.
 * This reads an `href` inside RENDERED MARKDOWN — a link somebody wrote in a
 * file — and there the same fallback would mean every link this app has no
 * page for silently opening the default outline instead of going where it says.
 *
 * So exactly one shape is claimed: a document's own page, which is the one this
 * app mints into rendered markdown (`markdown/rewrite.ts`). A FRAGMENT is not
 * claimed either — `/doc/x.md#beds` is left to the browser, because what a
 * fragment names on a rendered page is an id this app mints per block, and
 * pretending to answer an anchor it will not land on is worse than a plain
 * navigation that visibly does not.
 */
export const routeIn = (href: string): Route | null =>
  href.startsWith(DOCUMENT_PREFIX) && !href.includes("#") ? routeOf(href) : null

/**
 * Anything this does not recognise is the default outline: an unknown path is
 * a reader who typed something, and the app they wanted is the one at `/`.
 *
 * It takes the whole ADDRESS — path and query — rather than the pathname,
 * because the filter is part of what a URL means here and a parser handed half
 * of one could only ever answer half. Callers pass `location.pathname +
 * location.search`; a bare path parses exactly as it did before.
 */
/**
 * Path, query and fragment of an address, cut the way this app writes them.
 *
 * ONE split, so a lone page (`routeOf`) and a workspace that embeds those
 * pages (`workspaceOf`) cannot disagree about where the query ends and
 * the fragment starts. The fragment comes off first: a `#` ends the
 * query, so cutting on `?` before it would leave `#beds` inside a filter
 * and a page narrowed by a word nobody typed.
 */
export const splitAddress = (
  address: string,
): {
  readonly pathname: string
  readonly search: string
  readonly at: string | undefined
} => {
  const hash = address.indexOf("#")
  const whole = hash === -1 ? address : address.slice(0, hash)
  const at = hash === -1 ? undefined : landed(address.slice(hash + 1))
  const cut = whole.indexOf("?")
  return {
    pathname: cut === -1 ? whole : whole.slice(0, cut),
    search: cut === -1 ? "" : whole.slice(cut + 1),
    at,
  }
}

export const routeOf = (address: string): Route => {
  const { pathname, search, at } = splitAddress(address)
  const filter = search === "" ? undefined : filterIn(search)
  const narrowed = filter === undefined ? {} : { filter }
  return pathname.startsWith(NODE_PREFIX)
    ? {
      kind: "node",
      id: decodeURIComponent(pathname.slice(NODE_PREFIX.length)),
      ...narrowed,
    }
    : pathname.startsWith(DOCUMENT_PREFIX)
    ? {
      kind: "document",
      file: decodeURIComponent(pathname.slice(DOCUMENT_PREFIX.length)),
      ...(at === undefined ? {} : { at }),
    }
    : pathname.startsWith(DAY_PREFIX)
    ? {
      kind: "day",
      date: decodeURIComponent(pathname.slice(DAY_PREFIX.length)),
      ...narrowed,
    }
    : pathname === TODAY
    ? { kind: "today", ...narrowed }
    : pathname === AGENDA
    ? { kind: "agenda", ...narrowed }
    : pathname === TRASH
    ? { kind: "trash", ...narrowed }
    : pathname.startsWith(OUTLINE_PREFIX)
    ? {
      kind: "outline",
      file: decodeURIComponent(pathname.slice(OUTLINE_PREFIX.length)),
      ...narrowed,
    }
    : { kind: "outline", file: null, ...narrowed }
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
