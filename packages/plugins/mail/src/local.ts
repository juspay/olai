import type { LocalState, Refusal } from "@olai/plugin-api/services"
import { Effect, Semaphore } from "effect"

export interface MemoryRecord {
  readonly refreshToken: string
  readonly address: string | null
  readonly scope: string | null
  readonly historyId: string | null
  readonly connectedAt: string
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

export const recordOf = (raw: Record<string, unknown> | null): MemoryRecord | undefined => {
  if (raw === null) return undefined
  const refreshToken = text(raw["refreshToken"])
  if (refreshToken === null) return undefined
  return {
    refreshToken,
    address: text(raw["address"]),
    scope: text(raw["scope"]),
    connectedAt: text(raw["connectedAt"]) ?? "",
    historyId: text(raw["historyId"]),
  }
}

export const valuesOf = (record: MemoryRecord): Record<string, unknown> => ({
  refreshToken: record.refreshToken,
  address: record.address,
  scope: record.scope,
  connectedAt: record.connectedAt,
  historyId: record.historyId,
})

export interface Memory {
  readonly current: () => MemoryRecord | undefined
  readonly remember: (record: MemoryRecord) => Effect.Effect<void, Refusal>
  readonly advance: (connection: string, historyId: string | null) => Effect.Effect<void, Refusal>
  readonly forget: () => Effect.Effect<void, Refusal>
}

export const openMemory = (door: LocalState, warn: (line: string) => void): Effect.Effect<Memory> =>
  Effect.gen(function*() {
    const raw = yield* door.load
    const loaded = recordOf(raw)
    if (loaded === undefined && raw !== null && Object.keys(raw).some((key) => key !== "cwd")) {
      warn("mail: the memory record is not a record olai wrote — reading it as no account")
    }
    let held: MemoryRecord | undefined = loaded
    const writing = yield* Semaphore.make(1)
    return {
      current: () => held,
      remember: (record) =>
        writing.withPermit(Effect.gen(function*() {
          const next = held?.connectedAt === record.connectedAt && held.address === record.address ? { ...record, historyId: held.historyId } : record
          yield* door.save(valuesOf(next))
          held = next
        })),
      advance: (connection, historyId) => writing.withPermit(Effect.gen(function*() {
        if (!held || held.connectedAt !== connection) return
        const next = { ...held, historyId }
        yield* door.save(valuesOf(next))
        held = next
      })),
      forget: () =>
        writing.withPermit(Effect.gen(function*() {
          yield* door.save({})
          held = undefined
        })),
    }
  })
