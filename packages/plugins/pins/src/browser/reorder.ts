import type { Edit } from "@olai/surface"

import type { Pin } from "./pins.ts"

export const gapAt = (middles: ReadonlyArray<number>, y: number): number => {
  let gap = 0
  for (const middle of middles) {
    if (y < middle) break
    gap += 1
  }
  return gap
}

export const placing = (
  pins: ReadonlyArray<Pin>,
  from: number,
  gap: number,
): Edit | undefined => {
  const carried = pins[from]
  if (carried === undefined) return undefined
  const rest = pins.filter((_, at) => at !== from)
  const landing = gap > from ? gap - 1 : gap
  if (landing === from) return undefined
  const above = landing === 0 ? null : rest[landing - 1]?.id ?? null
  return {
    verb: "place",
    id: carried.id,
    parent: null,
    after: above,
  }
}
