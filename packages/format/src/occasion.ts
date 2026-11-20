import type { Claims } from "./kinds.ts"
import { Schema } from "effect"

import {
  isPutAway,
  isRegular,
  type Located,
  type LocatedRegular,
  type RegularNode,
  settles,
  storedMarker,
} from "./node.ts"

const DAY = 10
const MONTH = 7

export const dayOf = (value: string): string => value.slice(0, DAY)

export const monthOf = (value: string): string => value.slice(0, MONTH)

export const timeOf = (value: string): string | undefined =>
  value.length > DAY && (value[DAY] === "T" || value[DAY] === " ")
    ? value.slice(DAY + 1, DAY + 1 + "HH:MM".length)
    : undefined

export const Occasion = Schema.Literals(["date", "done", "cancelled"])
export type Occasion = typeof Occasion.Type

export const Occasioned = Schema.Struct({
  occasion: Occasion,
  date: Schema.String,
})
export type Occasioned = typeof Occasioned.Type

export interface Dated extends Occasioned {
  readonly at: LocatedRegular
}

/**
 * The dates one record puts on a calendar, in PRECEDENCE order: what it is
 * scheduled for, then the instant it was SETTLED at — finished, or called off.
 * The order decides exactly one thing, and only for a node whose two dates land
 * on the SAME day: which occasion that day names (`./dates.ts`'s `datedOn`).
 */
export const datesOf = (node: RegularNode): ReadonlyArray<Occasioned> => {
  const dates: Array<Occasioned> = []
  if (node.date !== undefined) dates.push({ occasion: "date", date: node.date })
  const mark = storedMarker(node)
  if (mark !== undefined && settles(mark)) {
    const value = node[mark]
    if (typeof value === "string") dates.push({ occasion: mark, date: value })
  }
  return dates
}

export const dateInto = (
  claims: Claims,
  byDay: Map<string, Array<Dated>>,
  located: Located,
): void => {
  if (!isRegular(located) || isPutAway(claims, located.file)) return
  for (const dated of datesOf(located.node)) {
    const day = dayOf(dated.date)
    const held = byDay.get(day)
    if (held === undefined) byDay.set(day, [{ at: located, ...dated }])
    else held.push({ at: located, ...dated })
  }
}
