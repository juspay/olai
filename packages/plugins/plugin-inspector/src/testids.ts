/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  pluginsTrigger: "plugins-trigger",
  pluginsPanel: "plugins-panel",
  pluginsRefused: "plugins-refused",
  pluginsStarted: "plugins-started",
  pluginConfig: "plugin-config",
  pluginsSource: "plugins-source",
  pluginsApprove: "plugins-approve",
  pluginsApproveAlways: "plugins-approve-always",
  pluginsMoved: "plugins-moved",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/plugin-inspector": OwnedTestIds }
}

/** Namespace for dynamically discovered provider preference rows. */
export const PLUGIN_PREF = "plugin-"
export const pluginPref = (name: string): string => `${PLUGIN_PREF}${name}`
