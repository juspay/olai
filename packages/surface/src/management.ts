/** Host management is available independently of any inspector or shell.
 * The browser adapter owns transport access; consumers receive only these
 * operations and readings. Source approval belongs to its capability, whose
 * scoped client disappears with that provider. */
import { serviceTag } from "@olai/plugin-api/contracts"
import type { RowReport } from "@olai/plugin-api"
import type { Effect } from "effect"
import type { PluginRoster } from "./plugins.ts"

export interface BrowserManagement {
  /** Called under a consumer's Solid owner so its cell subscription is scoped. */
  readonly roster: () => () => PluginRoster | undefined
  readonly reports: () => ReadonlyMap<string, RowReport>
  readonly changing: () => boolean
  readonly switchHint: (name: string) => string | undefined
  readonly set: (name: string, enabled: boolean) => Effect.Effect<unknown, unknown>
  readonly retry: () => Promise<void>
  readonly requiresReload: (name: string) => boolean
  readonly reload: () => void
}
export const browserManagement = serviceTag<BrowserManagement>("browser-management")
