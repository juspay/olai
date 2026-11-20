import { serviceTag } from "@olai/plugin-api/contracts"
import type { RowReport } from "@olai/plugin-api"
import type { Effect } from "effect"
import type { PluginRoster } from "./plugins.ts"

export type PluginLook = {
  readonly switchHint?: string
  readonly section?: string
  readonly label?: string
  readonly quiet?: boolean
  readonly optIn?: boolean
}

export interface BrowserManagement {
  readonly roster: () => () => PluginRoster | undefined
  readonly reports: () => ReadonlyMap<string, RowReport>
  readonly changing: () => boolean
  readonly look: (name: string) => PluginLook
  readonly set: (name: string, enabled: boolean) => Effect.Effect<unknown, unknown>
  readonly configure: (name: string, key: string, value: string | null) => Effect.Effect<unknown, unknown>
  readonly retry: () => Promise<void>
  readonly requiresReload: (name: string) => boolean
  readonly reload: () => void
}
export const browserManagement = serviceTag<BrowserManagement>("browser-management")
