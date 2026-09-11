import { serviceTag } from "@olai/plugin-api/services"
export const name = "plugin-inspector"

/** Open one row's controls without exposing the inspector's state or renderer. */
export interface ConfigurationPanel { readonly open: (name: string) => void }
export const configurationPanel = serviceTag<ConfigurationPanel>("plugin-inspector.configuration")
