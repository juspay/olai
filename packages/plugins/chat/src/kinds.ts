import { canonicalDate, OPENS_ALONE, OPENS_BESIDE, sessionIn } from "@olai/format"

export { OPENS_KIND, OPENS_TYPE, SESSION_KIND, SESSION_TYPE, SLEEPING_KIND, SLEEPING_TYPE, SLEPT_KIND, SLEPT_TYPE } from "./binding.ts"
import { OPENS_KIND, OPENS_TYPE, SLEEPING_KIND, SLEEPING_TYPE, SLEPT_KIND, SLEPT_TYPE, SESSION_KIND, SESSION_TYPE } from "./binding.ts"

const SESSION = {
  kind: SESSION_KIND,
  takes: `\`${SESSION_TYPE}\` (an engine, optionally \`:\` and a session id)`,
  admits: (value: string) => sessionIn(value) !== null,
} as const

const SLEPT = {
  kind: SLEPT_KIND,
  takes: `\`${SLEPT_TYPE}\` (an ISO day or instant)`,
  admits: (value: string) => canonicalDate(value.trim(), null) === value.trim(),
} as const

const SLEEPING = {
  kind: SLEEPING_KIND,
  takes: `\`${SLEEPING_TYPE}\` (\`on\` or \`off\`)`,
  admits: (value: string) => {
    const word = value.trim()
    return word === "on" || word === "off"
  },
} as const

const OPENS = {
  kind: OPENS_KIND,
  takes: `\`${OPENS_TYPE}\` (\`${OPENS_ALONE}\` or \`${OPENS_BESIDE}\`)`,
  admits: (value: string) => {
    const word = value.trim()
    return word === OPENS_ALONE || word === OPENS_BESIDE
  },
} as const

export const kinds = [SESSION, SLEPT, SLEEPING, OPENS] as const

const OWN = new Map([
  [SESSION_TYPE, { ...SESSION, kind: SESSION_TYPE, claims: SESSION_TYPE }],
  [SLEPT_TYPE, { ...SLEPT, kind: SLEPT_TYPE, claims: SLEPT_TYPE }],
  [SLEEPING_TYPE, { ...SLEEPING, kind: SLEEPING_TYPE, claims: SLEEPING_TYPE }],
  [OPENS_TYPE, { ...OPENS, kind: OPENS_TYPE, claims: OPENS_TYPE }],
])
export const ownKinds = { built: OWN, enabled: OWN }
