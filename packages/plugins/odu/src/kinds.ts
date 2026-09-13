/**
 * WHAT ODU TEACHES THE VAULT'S VOCABULARY — one word, and what a value of it
 * has to be.
 *
 * A `run` value is an odu run id (`<base36 instant>-<random>`), which is why
 * this kind exists at all rather than the key staying `text`. The vault says
 * which column is which, in the one place it says everything else about its
 * keys.
 *
 * The shape is a pair of lowercase alphanumeric runs joined by one hyphen —
 * a shape, not a lookup. The catalog is the service's to know; this kind only
 * refuses a string that could not be an id.
 */

import { name } from "./wire.ts"

/** The BARE word this plugin contributes. The registry prefixes it, so what a
 *  vault actually writes is {@link RUN_TYPE}. */
export const RUN_KIND = "run"

/** ...and the word a DECLARATION writes: `{"title":"run","custom":{"type":"odu-run"}}`. */
export const RUN_TYPE = `${name}-${RUN_KIND}`

/** A lowercase alphanumeric pair joined by one hyphen. */
export const isRunIdShaped = (value: string): boolean => /^[0-9a-z]+-[0-9a-z]+$/.test(value)

export const kinds = [{
  kind: RUN_KIND,
  takes: `\`${RUN_TYPE}\` (an odu run id, \`<base36>-<base36>\`)`,
  admits: isRunIdShaped,
}] as const

const OWN = new Map(
  kinds.map((one) => [RUN_TYPE, { ...one, kind: RUN_TYPE, claims: RUN_TYPE }]),
)
export const ownKinds = { built: OWN, enabled: OWN }
