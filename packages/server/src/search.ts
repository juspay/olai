/**
 * The palette's search, and the fence that keeps it the agent's search.
 *
 * Pure over a `Reading`, like {@link ./edit.ts} and {@link ./context.ts}: the
 * whole of it is one call into `@olai/ops`' `Query.search`, which is also what
 * the `search_nodes` tool calls. That much was already true — the browser has
 * never held a matcher of its own, deliberately (`@olai/surface`'s
 * `search.ts`). What was NOT true is the claim written beside it.
 *
 * **The two faces declare the same question twice, and could not both be
 * checked.** `@olai/surface` is the wire spec the browser compiles against and
 * `@olai/ops` is the layer that answers; neither may import the other (the
 * spec would drag a store into the bundle, and an op does not know it is being
 * called over a wire). So the search REQUEST and ANSWER are spelled in both —
 * once as Effect Schema for the wire, once as TypeScript for the reader — and
 * `@olai/server` is the only module in the tree that can see both at once.
 *
 * Structural typing does not close that on its own, and the gap is silent in
 * the direction that matters. A field added to `Query.Found` and produced by
 * `foundOf` type-checks CLEAN across every package: `search_nodes` starts
 * answering an agent with it, and the palette's procedure encodes against a
 * schema that has never heard of it and drops it on the way out. Two faces,
 * one matcher, different answers — which is the deviation HACKING.md forbids,
 * arriving through the one seam nobody was watching.
 *
 * So the agreement is ASSERTED here, at the only place both spellings are in
 * scope, and asserted as IDENTITY rather than as assignability. Assignability
 * is what fails to catch this: an extra optional field on either side is
 * assignable in both directions, and an extra required field is only caught if
 * some producer inside `@olai/ops` happens not to supply it.
 */

import type { Reading } from "@olai/ops"
import { Query } from "@olai/ops"
import type { SearchAnswer, SearchRequest } from "@olai/surface"

/**
 * The browser's door to the one reading.
 *
 * The return type is the WIRE's (`SearchAnswer`) and the value is the ops
 * layer's (`Query.Search`), which is the whole point of the assertions below:
 * this line compiles because the two are the same type, not because one
 * happens to be assignable to the other today.
 */
export const searchFor = (at: Reading, request: SearchRequest): SearchAnswer =>
  Query.search(at.derived, request)

// ── the fence ──────────────────────────────────────────────────────────

/**
 * Type identity, the conditional-type way.
 *
 * Two deferred conditionals are the same type only if their checked types are
 * the same type — so this sees optionality, `readonly`, and a field present on
 * one side and not the other, none of which mutual assignability sees. It is
 * the standard formulation and it is here rather than imported because it is
 * four lines and a dependency for four lines is worse.
 */
type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

/**
 * A compile error when the two are not the same type, and one that SAYS SO.
 *
 * The straightforward spelling — a `T extends true` parameter — reports "Type
 * 'false' does not satisfy the constraint 'true'", which tells whoever broke it
 * nothing about what they broke. Passing the complaint through as the failing
 * type instead puts the sentence in the compiler's own output, where it is read.
 */
type Agree<_ extends true> = never

/**
 * What both faces ASK — `@olai/ops`' `SearchQuery` (the JSON Schema an agent
 * fills in) against `@olai/surface`'s `SearchRequest` (the palette's wire
 * input).
 *
 * Break it by adding a filter to one and not the other, which is exactly how a
 * palette that can narrow by tag and an agent that cannot would be born.
 */
export type RequestsAgree = Agree<
  Identical<SearchRequest, Query.SearchQuery> extends true ? true
    : "@olai/ops' SearchQuery and @olai/surface's SearchRequest have drifted: the agent and the palette would ask different questions. See packages/server/src/search.ts."
>

/**
 * What both faces ANSWER — `Query.Search` (what `search_nodes` hands an agent
 * verbatim) against `SearchAnswer` (what the procedure encodes for a browser).
 *
 * This is the one that was actually open, and what it protects is every field
 * of a hit: `id`, `title`, `file`, `line`, `status`, `path`, `see`, `after`,
 * `matched`. Add a tenth to `Query.Found` and this is where the build stops,
 * one edit before an agent and a person start seeing different rows.
 */
export type AnswersAgree = Agree<
  Identical<SearchAnswer, Query.Search> extends true ? true
    : "@olai/ops' Query.Search and @olai/surface's SearchAnswer have drifted: a field one face answers with is dropped on the other. See packages/server/src/search.ts."
>
