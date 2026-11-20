import type { VaultViews } from "@olai/plugin-api/services"
import { NO_LEDGER, NO_SEARCH, type Ledger as OpsLedger, type Search as OpsSearch } from "@olai/ops"
import { Effect } from "effect"
import { openFileKinds } from "./file-kinds.ts"

export interface Views {
  readonly fileKinds: ReturnType<typeof openFileKinds>
  readonly ledger: () => OpsLedger
  readonly search: () => OpsSearch
  readonly door: VaultViews
}

const holding = <Door>(what: string) => {
  let held: Door | undefined
  return {
    read: () => held,
    hold: (door: Door) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (held !== undefined) return false
          held = door
          return true
        }),
        (won) => Effect.sync(() => { if (won && held === door) held = undefined }),
      ).pipe(Effect.flatMap((won) =>
        won ? Effect.void : Effect.die(new Error(
          `olai-plugin-vault: a second row registered the ${what} this vault records `
            + "through — a store reads one, and the second would leave every write "
            + "landing in whichever was mounted last.",
        )),
      )),
  }
}

export const openViews = (): Views => {
  const ledger = holding<OpsLedger>("ledger")
  const search = holding<OpsSearch>("matcher")
  return {
    fileKinds: openFileKinds(),
    ledger: () => ledger.read() ?? NO_LEDGER,
    search: () => search.read() ?? NO_SEARCH,
    door: {
      ledger: ledger.hold as VaultViews["ledger"],
      search: search.hold as VaultViews["search"],
    },
  }
}
