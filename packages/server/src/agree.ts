/**
 * Two spellings of one thing, checked against each other at compile time.
 *
 * This package is where olai's layers meet — the wire spec a browser compiles
 * against, the ops layer that answers, the format's own closed tables — and
 * more than one thing here is DECLARED twice because the packages that own the
 * two declarations may not import each other. Those pairs cannot be deduped;
 * what they can be is checked, and this is the two lines that check them.
 *
 * **Assignability is not the check to want.** It is what the call sites already
 * get for free, and it is exactly what lets a pair drift: a field present on
 * one side and not the other is assignable in both directions when it is
 * optional, and when it is required it only fails at whichever producer happens
 * not to supply it — which may be nowhere. So the test is type IDENTITY.
 *
 * Used by {@link ./search.ts} (the palette's answer against the agent's) and by
 * `mcp/tools.test.ts` (the refusal kinds pinned there against the format's
 * closed table).
 */

/**
 * Type identity, the conditional-type way.
 *
 * Two deferred conditionals are the same type only when their checked types
 * are the same type — so this sees optionality, `readonly`, and a field on one
 * side that the other has never heard of, none of which mutual assignability
 * sees. It is the standard formulation, and it is four lines here rather than a
 * dependency because it is four lines.
 */
export type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

/**
 * A compile error when the two are not the same type, and one that SAYS SO.
 *
 * The straightforward spelling — a bare `T extends true` parameter — reports
 * "Type 'false' does not satisfy the constraint 'true'", which tells whoever
 * broke it nothing about what they broke. So a caller passes the complaint
 * through as the failing type and the sentence lands in the compiler's own
 * output, where it is read:
 *
 * ```ts
 * export type WeAgree = Agree<
 *   Identical<A, B> extends true ? true : "A and B have drifted, and here is why that matters"
 * >
 * ```
 *
 * The alias resolves to `never` because nothing reads it. What is load-bearing
 * is whether it INSTANTIATES.
 */
export type Agree<_ extends true> = never
