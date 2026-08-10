/**
 * What a URL means, and nothing else.
 *
 * Four addresses, and the difference between them is what each one is a
 * property OF. `/o/<file>` names a file on disk, so it spells the path.
 * `/n/<id>` names a node, and an id is all it may spell: ids are unique across
 * the loaded set and survive renames and moves across files, so the permalink
 * outlives every edit short of a delete — while a URL that also carried the
 * outline would be a URL that could disagree with the file it named.
 *
 * `/d/<ISO-date>` names a DAY, which is not a thing on disk at all: it is a
 * question asked of every dated node in the set, and the answer is computed at
 * view time (`@olai/format`'s date derivations). `/today` is the same page and
 * a different address — it names no day, it names the day it IS, which is what
 * a bookmark, a home screen and an agent can all keep. Resolving it needs a
 * clock, and a clock is exactly what parsing a URL must not have: the two are
 * kept apart, so this stays pure and `page.ts` is handed the day.
 *
 * Pure, and parsing and printing live beside each other on purpose: they are
 * one bijection, and the test that says so (`routes.test.ts`) is the only
 * thing standing between a link the app writes and a link it cannot read back.
 */

export type Route =
  /** One outline. `null` is "whichever was found first" — the bare `/`. */
  | { readonly kind: "outline"; readonly file: string | null }
  | { readonly kind: "node"; readonly id: string }
  /** One day of the journal, by its ISO date. */
  | { readonly kind: "day"; readonly date: string }
  /** Whichever day it is when this is read. */
  | { readonly kind: "today" }

const OUTLINE_PREFIX = "/o/"
const NODE_PREFIX = "/n/"
const DAY_PREFIX = "/d/"
const TODAY = "/today"

/** Encoded per segment, so a path with a directory in it stays readable in the
 *  URL bar rather than turning into a run of `%2F`. */
export const hrefOf = (route: Route): string => {
  if (route.kind === "node") return NODE_PREFIX + encodeURIComponent(route.id)
  if (route.kind === "day") return DAY_PREFIX + encodeURIComponent(route.date)
  if (route.kind === "today") return TODAY
  return route.file === null
    ? "/"
    : OUTLINE_PREFIX + route.file.split("/").map(encodeURIComponent).join("/")
}

/** Anything this does not recognise is the default outline: an unknown path is
 *  a reader who typed something, and the app they wanted is the one at `/`. */
export const routeOf = (pathname: string): Route =>
  pathname.startsWith(NODE_PREFIX)
    ? { kind: "node", id: decodeURIComponent(pathname.slice(NODE_PREFIX.length)) }
    : pathname.startsWith(DAY_PREFIX)
    ? { kind: "day", date: decodeURIComponent(pathname.slice(DAY_PREFIX.length)) }
    : pathname === TODAY
    ? { kind: "today" }
    : pathname.startsWith(OUTLINE_PREFIX)
    ? { kind: "outline", file: decodeURIComponent(pathname.slice(OUTLINE_PREFIX.length)) }
    : { kind: "outline", file: null }
