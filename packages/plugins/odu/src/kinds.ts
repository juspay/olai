import { name } from "./wire.ts"

export const RUN_KIND = "run"

export const RUN_TYPE = `${name}-${RUN_KIND}`

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
