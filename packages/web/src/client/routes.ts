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
 * `/doc/<file>` names a document, which is also a file and also spells its
 * path — and it is a SECOND prefix rather than more work for `/o/` because an
 * outline and a document are two different things a file can be (`fileKind`,
 * in the format). The address says which, so a URL means one kind of page
 * before the set is in hand, and renaming a `.md` to a `.jsonl` is a different
 * page rather than the same address quietly changing what it draws.
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
 * set — every `Archive.jsonl` under the directory — not a file's address. The
 * files it reads still HAVE addresses (`/o/Archive.jsonl` parses like any
 * outline path), and what such an address opens is the trash view, because an
 * archive is not a place you edit (`page.ts` decides that, not this parser).
 *
 * Pure, and parsing and printing live beside each other on purpose: they are
 * one bijection, and the test that says so (`routes.test.ts`) is the only
 * thing standing between a link the app writes and a link it cannot read back.
 */

export type Route =
  /** One outline. `null` is "whichever was found first" — the bare `/`. */
  | { readonly kind: "outline"; readonly file: string | null }
  /** One document, by its path. */
  | { readonly kind: "document"; readonly file: string }
  | { readonly kind: "node"; readonly id: string }
  /** One day of the journal, by its ISO date. */
  | { readonly kind: "day"; readonly date: string }
  /** Whichever day it is when this is read. */
  | { readonly kind: "today" }
  /** What is owed, read forward from whatever day it is. */
  | { readonly kind: "agenda" }
  /** What was put away: every `Archive.jsonl` under the directory, read-only.
   *  It spells no file for the reason `/agenda` spells no horizon — which
   *  archives exist is the set's answer, and an address that named one would
   *  mean something different the day a subdirectory gets its own. */
  | { readonly kind: "trash" }

const OUTLINE_PREFIX = "/o/"
const DOCUMENT_PREFIX = "/doc/"
const NODE_PREFIX = "/n/"
const DAY_PREFIX = "/d/"
const TODAY = "/today"
const AGENDA = "/agenda"
const TRASH = "/trash"

/** Encoded per segment, so a path with a directory in it stays readable in the
 *  URL bar rather than turning into a run of `%2F`. */
export const hrefOf = (route: Route): string => {
  if (route.kind === "node") return NODE_PREFIX + encodeURIComponent(route.id)
  if (route.kind === "day") return DAY_PREFIX + encodeURIComponent(route.date)
  if (route.kind === "today") return TODAY
  if (route.kind === "agenda") return AGENDA
  if (route.kind === "trash") return TRASH
  if (route.kind === "document") return DOCUMENT_PREFIX + spell(route.file)
  return route.file === null ? "/" : OUTLINE_PREFIX + spell(route.file)
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

/** Anything this does not recognise is the default outline: an unknown path is
 *  a reader who typed something, and the app they wanted is the one at `/`. */
export const routeOf = (pathname: string): Route =>
  pathname.startsWith(NODE_PREFIX)
    ? { kind: "node", id: decodeURIComponent(pathname.slice(NODE_PREFIX.length)) }
    : pathname.startsWith(DOCUMENT_PREFIX)
    ? {
      kind: "document",
      file: decodeURIComponent(pathname.slice(DOCUMENT_PREFIX.length)),
    }
    : pathname.startsWith(DAY_PREFIX)
    ? { kind: "day", date: decodeURIComponent(pathname.slice(DAY_PREFIX.length)) }
    : pathname === TODAY
    ? { kind: "today" }
    : pathname === AGENDA
    ? { kind: "agenda" }
    : pathname === TRASH
    ? { kind: "trash" }
    : pathname.startsWith(OUTLINE_PREFIX)
    ? { kind: "outline", file: decodeURIComponent(pathname.slice(OUTLINE_PREFIX.length)) }
    : { kind: "outline", file: null }
