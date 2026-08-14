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
 * optional, and when it is required it fails only at whichever producer happens
 * not to supply it — which may be nowhere. So the test is type IDENTITY, and
 * `Types.EqualsWith` is Effect's own, documented for exactly this ("assert type
 * equality in conditional types or type-level tests").
 *
 * Used by {@link ./search.ts} (the palette's answer against the agent's) and by
 * `mcp/tools.test.ts` (the refusal kinds pinned there against the format's
 * closed table).
 */

import type { Types } from "effect"

/**
 * `true` when `A` and `B` are the same type, and otherwise the SENTENCE a
 * reader should be shown.
 *
 * The complaint is the whole reason this wraps `EqualsWith` rather than
 * `Equals`. A bare equality fails as "Type 'false' does not satisfy the
 * constraint 'true'", which tells whoever broke it nothing about what they
 * broke; carrying the sentence as the failing type puts it in the compiler's
 * own output, where it is read.
 */
export type Same<A, B, complaint extends string> = Types.EqualsWith<A, B, true, complaint>

/**
 * The constraint that does the failing. Wrap a {@link Same} in it and the pair
 * is checked wherever the alias is declared:
 *
 * ```ts
 * export type WeAgree = Agree<Same<A, B, "A and B have drifted, and here is what that costs">>
 * ```
 *
 * Two types rather than one because a single generic cannot do it: TypeScript
 * checks a constraint against the UNRESOLVED conditional when the arguments are
 * still parameters, so the equality has to be spelled where `A` and `B` are
 * concrete — which is the call site, and is also where the sentence belongs.
 *
 * It resolves to `never` because nothing reads it. What is load-bearing is
 * whether it INSTANTIATES.
 */
export type Agree<_ extends true> = never
