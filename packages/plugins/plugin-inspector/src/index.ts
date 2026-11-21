import { serviceTag } from "@olai/plugin-api/services"
export const name = "plugin-inspector"

/** Open one row's controls without exposing the inspector's state or renderer. */
export interface ConfigurationPanel { readonly open: (name: string) => void }
export const configurationPanel = serviceTag<ConfigurationPanel>("plugin-inspector.configuration")

/** The seat a plugin hangs its own row's drawing in (`./slots.ts`). Re-exported
 *  here because `./contract` and `.` are this package's one door, and a
 *  contributor opens that door rather than reaching into `src/`. The catalog
 *  `vault-plugins_inspect` lists reads the `./slots` door itself
 *  (`@olai/bundle`'s `mountBundle`). */
export { pluginsRow, slotContracts, type PluginsRowFace } from "./slots.ts"
