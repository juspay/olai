import type { Conversing } from "../../sessions.ts"

export interface BoundTo {
  readonly engine: string
  readonly session: string | null
}

export const isPast = (
  pair: Conversing | undefined,
  row: BoundTo | undefined,
): boolean =>
  pair !== undefined
  && (pair.agent !== row?.engine || pair.session !== row?.session)
