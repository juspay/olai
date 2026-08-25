/**
 * A PROPERTY VALUE THAT NAMES A THING IS A LINK — which things, and how sure
 * the app has to be.
 *
 * `custom` is the one open field on a record and olai gives no key in it a
 * meaning (`@olai/format`'s `custom.ts`). That is the format's rule and it does
 * not move. But a lane node saying `brief briefs/pda.md` and `reviewer pi` is
 * pointing at two things that ARE in this directory, and a reader who has to
 * copy the text into the address bar to follow it is reading a link that was
 * never drawn. So the DISPLAY asks one question of each value — *does this
 * name something the app can open* — and draws a door for the values that say
 * yes.
 *
 * ## The rule: the WHOLE value, exactly, or nothing
 *
 * A WRONG DOOR IS WORSE THAN NO DOOR, and everything below is that sentence
 * spent. There is no fuzzy matching here, no "looks like", no title search, no
 * substring: the entire value has to BE the name of the thing, and if it is
 * not, it stays the text it always was. Two consequences worth stating because
 * they are what somebody will ask about:
 *
 *   - A value with a URL IN IT is not a URL. The live board writes
 *     `pr` values that open `#365 https://github.com/…/365 @ efc32b13 — reported
 *     12:45 …`; that is a paragraph, and pulling the URL out of it would be the
 *     display deciding which part of somebody's sentence was the point.
 *   - A NODE ID is matched by id and never by title. Titles are prose, two
 *     nodes may share one, and a value that merely reads like a title is a
 *     guess. `reviewer pi` becomes navigation because `agents.olai` declares a
 *     node whose id is literally `pi` — no other reason. The id-shaped values a
 *     page carries are resolved where the set is (`@olai/format`'s `page.ts`'s
 *     `namesFor`) and arrive in the names table; an id the set does not declare
 *     is simply absent here, exactly as a dangling `see` is.
 *
 * ## The five kinds, in the order they are read
 *
 *   1. **a URL** — `http:` or `https:`, whole. It leaves the tab
 *      ({@link Away}), under the same `noopener noreferrer` a link written into
 *      a note takes (`../markdown/rewrite.ts`'s `openExternal`).
 *   2. **a date** — what the FORMAT calls a date (`isIsoInstant`: a day, or an
 *      instant on one). It wears the date badge the row already speaks and
 *      opens that day's page. Read before the id match, though a date is
 *      id-shaped, because a value the format would call a date is a date
 *      wherever it appears — a node whose id happens to be `2026-08-31` is a
 *      coincidence, and letting it change what a date LOOKS like would put a
 *      caveat on the one face rule here that has none.
 *   3. **a node id** — an exact match against what this page's set declares.
 *   4. **a vault path** — resolved beside the file the value was WRITTEN in,
 *      exactly as a note's relative `[…](…)` is (`@olai/format`'s `pathedOf`,
 *      which is that same arithmetic and those same refusals), and then only if
 *      the directory actually serves it. The extra question is the difference
 *      between this and a written link, and it cuts both ways: markdown
 *      deliberately does not ask it, because a `[…](…)` is somebody STATING a
 *      link and the page that says "no such document" is the honest answer,
 *      while a property value states nothing — so a path the directory has not
 *      got is not a broken link, it is a string that turned out not to be a
 *      path. Asking the directory is also what lets an `.olai` be named: the
 *      suffix allowlist a renderer needs (`bodiedOf`) has no room for an
 *      outline, and existence has room for every kind of file this app draws a
 *      page for.
 *   5. **a GitHub reference** — `owner/repo#123`, GitHub's own unambiguous
 *      cross-repo spelling, which opens the issue or pull request (the issue
 *      URL redirects to the pull request when that is what the number is). A
 *      BARE `#123` or `123` is NOT one: which repository it means is a fact
 *      nothing on this screen holds, and inventing one is the wrong door this
 *      module exists to refuse. The board's own `pr` values carry the full URL,
 *      which rule 1 already opens.
 *
 * Anything else is text.
 *
 * ## Length is not a refusal
 *
 * A value that names something is a door HOWEVER LONG IT IS. That is the "whole
 * value, exactly" rule read the only way it can be: a URL of sixty-one
 * characters is exactly a name, and the two door kinds most likely to run long
 * are precisely the two made of paths. The DISPLAY has a length rule — a long
 * door is clamped to one line (`./PropsDrawer.tsx`'s `Clamped`) — and it is a
 * rule about pixels, applied after this module has answered. Nothing here asks
 * how long a value is.
 *
 * ## Why it is a module and not a branch inside the chip
 *
 * It is five decisions with an order between them and two lookups behind them,
 * which is exactly the shape that goes quietly wrong inside a component — the
 * argument `./drawer.ts` already makes for being a pure function with a unit
 * test beside it. And there is more than one caller: a row, a node's own page
 * and a document's frontmatter all draw the same run, so "what does this value
 * open" has to have one answer or three surfaces will drift into three.
 */

import { dayOf, isIsoInstant, pathedOf } from "@olai/format"

import type { Names } from "../names.ts"
import { atFile, atNode, type Route } from "../routes.ts"

/**
 * WHAT A VALUE TURNS OUT TO NAME — or `null`, which is the ordinary answer and
 * the one every value gets until it earns another.
 *
 * The four arms carry a ROUTE or an `href` rather than the raw match, because
 * where a click goes is the whole point of asking; what each arm carries BESIDE
 * that is what a pointer is told the value names ({@link Door.says}), which is
 * the one thing a chip knows that the value's own text does not say.
 */
export type Door =
  /** A document of this directory — a `.md`, a `.html`, anything with a page. */
  | { readonly kind: "document"; readonly route: Route; readonly says: string }
  /** A node the set declares, by its id. */
  | { readonly kind: "node"; readonly route: Route; readonly says: string }
  /** A day of the journal. Wears the date badge as well as opening. */
  | { readonly kind: "day"; readonly route: Route; readonly says: string }
  /** Somewhere that is not this app. Opens in a tab of its own. */
  | { readonly kind: "away"; readonly href: string; readonly says: string }

/**
 * The two questions this rule cannot answer for itself, plus the one fact it
 * needs about where it is standing.
 *
 * Handed IN rather than read off a context, so the rule stays a function of its
 * inputs and its test needs no provider: the component that draws a chip is
 * where a context is read (`./PropsDrawer.tsx`).
 */
export interface Vault {
  /**
   * The file the value was WRITTEN in — the outline holding the record, or the
   * document whose frontmatter this is. A relative path resolves beside it,
   * which is what "a node names a file beside itself" means everywhere else in
   * olai (`@olai/format`'s `docOf`, `pictureOf`, `bodiedOf`).
   */
  readonly from: string
  /** Does the directory serve this path — asked of the one list a tab still
   *  holds of the vault (`../served.tsx`). */
  readonly serves: (file: string) => boolean
  /** What this page's ids name (`../names.ts`). An id the set does not declare
   *  answers `undefined`, which is what makes an unmatched value stay text. */
  readonly names: Names
}

/** `http:`/`https:` and nothing else, which is the narrowness `./drawer.ts`'s
 *  `isLink` had before this module took the question over: a value is text, and
 *  what becomes a link out of the app is what unambiguously already is one. */
const isHttp = (value: string): boolean =>
  value.startsWith("https://") || value.startsWith("http://")

/**
 * GitHub's own cross-repo reference: `owner/repo#123`.
 *
 * Deliberately anchored at both ends — this is the whole value or it is
 * nothing — and deliberately narrow about the halves: an owner and a repo are
 * the characters GitHub allows in a name, and the number is a number. A bare
 * `#123` does not match, and that is the point rather than an omission (see the
 * header's rule 5).
 */
const GITHUB_REF = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)#(\d+)$/

export const doorFor = (value: string, vault: Vault): Door | null => {
  if (value === "") return null

  if (isHttp(value)) return { kind: "away", href: value, says: value }

  if (isIsoInstant(value)) {
    // The DAY, for a value that says a minute too: `2026-08-24 16:20` is a day
    // with a time on it, and the page it opens is the day's — this app has a
    // page per day and none per minute, which is the same cut `dayOf` makes of
    // every other date reading in olai. The route is written out here as the
    // two other links to a day write it (`../calendar/Day.tsx`,
    // `../agenda/Day.tsx`): `/d/<ISO>` has no constructor because a day carries
    // a value and the named pages do not.
    const day = dayOf(value)
    return { kind: "day", route: { kind: "day", date: day }, says: `what is on ${day}` }
  }

  const named = vault.names(value)
  if (named !== undefined) {
    return { kind: "node", route: atNode(value), says: named.title }
  }

  const file = pathedOf(vault.from, value)
  if (file !== null && vault.serves(file)) {
    return { kind: "document", route: atFile(file), says: file }
  }

  const github = GITHUB_REF.exec(value)
  if (github !== null) {
    const [, owner, repo, number] = github as unknown as [string, string, string, string]
    // `/issues/<n>` for both kinds: GitHub redirects it to the pull request
    // when that is what the number turns out to be, and guessing `/pull/` for a
    // plain issue would 404 on the one it guessed wrong.
    return {
      kind: "away",
      href: `https://github.com/${owner}/${repo}/issues/${number}`,
      says: `${owner}/${repo}#${number} on GitHub`,
    }
  }

  return null
}
