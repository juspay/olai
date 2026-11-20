export const DEAD_LANE = "\u0000dead"

export type LaneRows = ReadonlyMap<number, string | null>

export type Seek = "apply" | "seek" | "bounce"

const ours = (rows: LaneRows, at: number, lane: string): boolean => rows.get(at) === lane

export const seek = (
  rows: LaneRows,
  currentAt: number,
  targetAt: number,
  lane: string | null,
): Seek => {
  if (lane === null || ours(rows, targetAt, lane)) return "apply"
  const direction = Math.sign(targetAt - currentAt)
  if (direction === 0) return "apply"
  for (const [at, owner] of rows) {
    if (owner === lane && (at - targetAt) * direction > 0) return "seek"
  }
  return "bounce"
}

export const pushedAt = (rows: LaneRows, at: number, lane: string | null): LaneRows =>
  new Map([...[...rows].filter(([one]) => one < at), [at, lane]])

export const forgotten = (rows: LaneRows, lane: string): LaneRows =>
  new Map([...rows].map(([at, owner]) => [at, owner === lane ? DEAD_LANE : owner] as const))

export const adopted = (rows: LaneRows, lane: string): LaneRows =>
  new Map([...rows].map(([at, owner]) => [at, owner ?? lane] as const))
