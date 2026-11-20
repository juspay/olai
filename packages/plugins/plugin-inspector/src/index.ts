import { serviceTag } from "@olai/plugin-api/services"
export const name = "plugin-inspector"

export interface ConfigurationPanel { readonly open: (name: string) => void }
export const configurationPanel = serviceTag<ConfigurationPanel>("plugin-inspector.configuration")

export { pluginsRow, slotContracts, type PluginsRowFace } from "./slots.ts"
export { slotContracts as slots } from "./slots.ts"
