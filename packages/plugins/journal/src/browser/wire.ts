import type { SurfaceClient } from "@kolu/surface/solid"
import type { surface } from "../wire.ts"

export type JournalClient = SurfaceClient<typeof surface.spec>

let held: (() => JournalClient) | null = null

export const holdJournalWire = (read: () => JournalClient): void => {
  held = read
}

export const journalWire = (): JournalClient => {
  if (held === null) throw new Error("journal wire read before its browser half mounted")
  return held()
}
