/**
 * THE ROSTER AS THE TAB COMPARES IT: what a wire carries, and which browser
 * halves that roster says must start again.
 *
 * `wire.ts` dials at module load, so neither rule can be tested there; both are
 * pure and live here.
 */

/** One plugin the roster names, and where its browser half comes from.
 *
 * `chunk` is `null` for a built-in half and a served URL for a vault-defined
 * one. The version is in the URL, so a re-approved edit is different code.
 *
 * `generation` is absent on older serves and on rows that are not running; both
 * read as 0, the honest answer to "which mount?" from a roster that did not
 * say. */
export interface Named {
  readonly id: string
  readonly chunk: string | null
  readonly generation?: number
}

/** What a tab compares to decide whether its wire still describes the roster.
 * Three facts per row, each a way its browser half goes stale: it arrived or
 * left, its code moved, or the server remounted it. A config-only frame with
 * the same generation is deliberately the same signature — a value a row
 * handles itself must not cost the page a redial. */
export const signatureOf = (names: ReadonlyArray<Named>): string =>
  names
    .map((one) => `${one.id}\t${one.chunk ?? ""}\t${one.generation ?? 0}`)
    .join("\n")

/**
 * THE ROWS WHOSE BROWSER HALF MUST START AGAIN: the server remounted it, or its
 * served code moved.
 *
 * Arrivals and departures are the composition's own business, so only a row the
 * tab already composed can be stale. A composed row with no generation is one
 * the serve never described (the bootstrap race); zero means "never said", not
 * "mount zero", and restarting every plugin for it would discard state over a
 * roster that has not moved.
 */
export const restartRows = (
  before: ReadonlyArray<Named>,
  after: ReadonlyArray<Named>,
): ReadonlyArray<string> => {
  const was = new Map(before.map((one) => [one.id, one]))
  return after
    .filter((one) => {
      const old = was.get(one.id)
      if (old === undefined) return false
      if (old.chunk !== one.chunk) return true
      return (old.generation ?? 0) !== 0 && (old.generation ?? 0) !== (one.generation ?? 0)
    })
    .map((one) => one.id)
}
