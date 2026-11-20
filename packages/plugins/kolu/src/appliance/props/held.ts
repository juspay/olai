import type { FleetTerminal } from "olai-plugin-kolu/appliance/wire"

export interface Held<T = FleetTerminal> {
  readonly rows: Map<string, T>
  readonly at: number
}

export const holdingNothing = <T = FleetTerminal,>(): Held<T> => ({ rows: new Map(), at: 0 })

export const after = <T,>(
  held: Held<T>,
  upserts: ReadonlyArray<readonly [string, T]>,
  removes: ReadonlyArray<string>,
): Held<T> => {
  for (const [id, row] of upserts) held.rows.set(id, row)
  for (const id of removes) held.rows.delete(id)
  return { rows: held.rows, at: held.at + 1 }
}

export const seeded = <T,>(
  entries: ReadonlyArray<readonly [string, T]>,
): Held<T> => after(holdingNothing<T>(), entries, NO_REMOVES)

const NO_REMOVES: ReadonlyArray<string> = []
