/**
 * WHAT THE SERVER WOULD SAY about a query on a page — the browser's stand-in
 * for `search.matching`, for the two suites that ask what this client does with
 * an answer (`./narrowing.test.ts`, `./why.test.ts`).
 *
 * A STAND-IN RATHER THAN A MOCK: every part of it is the real thing — the
 * matcher (`@olai/format`'s `matching`, which is what `@olai/ops`' `Query.matches`
 * runs), the scope the pane sends (`./drawn.ts`'s `showsTrashed`), and the
 * answer's own two fields. So a case built on it is asking what the page does
 * with a TRUE answer, and the archive cases still fail if that predicate
 * regresses. What is not here is the wire, the debounce and the staleness rule,
 * which are `./asking.ts`'s and are a browser's to prove.
 *
 * Its own file because it is the same eight lines in both suites, and one of
 * them said so out loud while spelling them again — including the `NodeId`
 * brand, which is the sort of detail two copies drift on the day
 * `MatchedNode` grows a field.
 */

import { type Derived, matching, NodeId, parseFilter } from "@olai/format"

import type { Matches } from "./asking.ts"
import { showsTrashed } from "./drawn.ts"
import type { Drawn } from "../page.ts"

export const answered = (
  derived: Derived,
  drawn: Drawn,
  text: string,
  today: string,
): Matches =>
  new Map(
    matching(derived, parseFilter(text, today), { trashed: showsTrashed(drawn) })
      .map(({ at, match }) => [at.node.id, {
        id: NodeId.make(at.node.id),
        ...(match.field === null ? {} : { matched: match.field }),
      }]),
  )
