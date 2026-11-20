import { name } from "./wire.ts"

export const TERMINAL_KIND = "terminal"

export const TERMINAL_TYPE = `${name}-${TERMINAL_KIND}`

export const admitsTerminal = (value: string): boolean => /^[0-9a-fA-F-]+$/.test(value)

export const kinds = [{
  kind: TERMINAL_KIND,
  takes: `\`${TERMINAL_TYPE}\` (a padi terminal id, or a prefix of one)`,
  admits: admitsTerminal,
}] as const

/** What it must NOT do is spell the
 *  precedence itself — it hands this to the shared fold and gets back one map,
 *  like every consumer in the tree. */
const OWN = new Map(
  kinds.map((one) => [TERMINAL_TYPE, { ...one, kind: TERMINAL_TYPE, claims: TERMINAL_TYPE }]),
)
export const ownKinds = { built: OWN, enabled: OWN }
