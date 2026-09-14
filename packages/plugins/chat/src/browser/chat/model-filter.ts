/**
 * WHICH models the picker's filter offers for what was typed.
 *
 * The rule is a CASE-INSENSITIVE SUBSTRING over the row's `name` AND its
 * `value`, the query trimmed of whitespace. The value matters as much as the
 * name: an engine whose values spell `provider/id` (omp's
 * `litellm/kimi-k3`) can be narrowed BY PROVIDER even though no label ever
 * says it.
 *
 * No fuzzy matching, no ranking — the order stays the agent's, because the
 * agent's own ordering is information olai did not invent and has no business
 * second-guessing.
 *
 * Here rather than inside `./Model.tsx` because the rule is the thing with
 * edges worth pinning (case, trimming, the value being read at all, an empty
 * query being the whole list), and each of those is one line of test with no
 * DOM in it.
 */

/** One row the agent offers: what a choice SENDS, and what it says. */
export interface Offered {
  readonly value: string
  readonly name: string
}

/**
 * The models the picker may draw for `query`, in the agent's own order.
 *
 * An EMPTY query — nothing typed, or only whitespace — is the whole list, so
 * the first thing a person sees after opening the menu is everything the
 * agent offers, and a filter typed at a previous opening is nowhere to be
 * found (that forgetting is `./Model.tsx`'s: the query signal dies with the
 * list).
 */
export const visibleModels = (
  models: ReadonlyArray<Offered>,
  query: string,
): ReadonlyArray<Offered> => {
  const wanted = query.trim().toLowerCase()
  if (wanted === "") return models
  return models.filter(
    (model) =>
      model.name.toLowerCase().includes(wanted) ||
      model.value.toLowerCase().includes(wanted),
  )
}
