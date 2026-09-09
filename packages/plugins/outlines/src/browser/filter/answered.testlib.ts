/**
 * WHAT THE SERVER WOULD SAY about a query on a page — the browser's stand-in
 * for the `narrowing` stream, for the two suites that ask what this client does
 * with an answer (`./narrowing.test.ts`, `./why.test.ts`).
 *
 * A STAND-IN RATHER THAN A MOCK: every part of it is the real thing — the
 * reading (`@olai/format`'s `narrowedIn`, which is exactly what `@olai/ops`'
 * `Query.narrowing` runs) over the page the suite is drawing, and the answer's
 * own two fields. So a case built on it is asking what the page does with a
 * TRUE answer, and the archive cases still fail if that reading regresses. What
 * is not here is the wire, the debounce and the holding rule, which are
 * `./asking.ts`'s and are a browser's to prove.
 *
 * IT TAKES A `Shown` where it used to take a `Drawn`, and that is the change
 * `filter-rides-the-page` made visible in a testlib: the narrowing is asked of
 * the page the SERVER computed, and what a browser draws of one is `../page.ts`'s
 * `drawnBy` over that same value. The suites build the reading and derive the
 * drawn page from it, which is the order the app is in.
 *
 * Its own file because it is the same few lines in both suites, and one of them
 * said so out loud while spelling them again.
 */

import { type MatchedDocument, matchedDocumentsIn, narrowedIn, parseFilter, type Reading, type Shown } from "@olai/format"

import type { Matches } from "./matches.ts"

/** Both halves of the ONE answer the wire would send — the read is taken
 *  off the same query in the same breath, or a bench reading the two would
 *  walk a drift the wire's `NarrowingAnswer` never holds. */
export interface Answered {
  readonly matched: Matches
  readonly documents: ReadonlyMap<string, MatchedDocument>
}

export const answered = (
  at: Reading,
  shows: Shown,
  text: string,
  today: string,
): Answered => {
  const filter = parseFilter(text, today)
  return {
    matched: new Map(
      narrowedIn(at.derived, shows, filter).map((one) => [one.id as string, one]),
    ),
    documents: new Map(
      matchedDocumentsIn(at, shows, filter).map((one) => [one.path, one]),
    ),
  }
}
