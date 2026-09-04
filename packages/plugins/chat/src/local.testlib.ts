import type { ChatLocalState, LocalSection } from "./local.ts"
import { Effect } from "effect"
import { resolve } from "node:path"

/** A machine-local door with the filesystem taken out: unit tests below the
 *  plugin boundary own section parsing and read-modify-write, while core's
 *  local-state tests own paths, atomic writes and migration. */
export interface LocalHarness {
  readonly forDirectory: (cwd: string) => ChatLocalState
  readonly read: (cwd: string, section: LocalSection) => Record<string, unknown> | null
  readonly write: (
    cwd: string,
    section: LocalSection,
    value: Record<string, unknown> | null,
  ) => void
  readonly writes: (cwd: string) => number
}

export const localHarness = (): LocalHarness => {
  const records = new Map<string, Partial<Record<LocalSection, Record<string, unknown>>>>()
  const counts = new Map<string, number>()
  const key = (cwd: string): string => resolve(cwd)
  const read = (cwd: string, section: LocalSection): Record<string, unknown> | null =>
    records.get(key(cwd))?.[section] ?? null
  const write = (
    cwd: string,
    section: LocalSection,
    value: Record<string, unknown> | null,
  ): void => {
    const at = key(cwd)
    const before = records.get(at) ?? {}
    if (value === null) {
      const { [section]: _removed, ...rest } = before
      records.set(at, rest)
    } else {
      records.set(at, { ...before, [section]: value })
    }
  }
  return {
    forDirectory: (cwd) => ({
      load: (section) => read(cwd, section),
      save: (section, value) =>
        Effect.sync(() => {
          write(cwd, section, value)
          const at = key(cwd)
          counts.set(at, (counts.get(at) ?? 0) + 1)
        }),
    }),
    read,
    write,
    writes: (cwd) => counts.get(key(cwd)) ?? 0,
  }
}
