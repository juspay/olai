import { type EnvironmentReading, CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import type { BuiltPlugin } from "@olai/surface"

export type PolicyReading = NonNullable<BuiltPlugin["configurationValues"]>[number]

export const labelOf = (key: string): string => {
  const words = key.replace(/[.-]/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const controlOf = (value: PolicyReading | EnvironmentReading) => "control" in value ? value.control : undefined

export const configurationAuthored = `set in ${CONFIGURATION_FILE.split("/").pop()}`

export const knobLabel = (key: string): string => key.split(".").at(-1)!.split("-")[0]!.toLowerCase()
export const knobUnit = (key: string): string | undefined => {
  const suffix = key.split("-").at(-1)!
  return ["ms", "seconds", "minutes", "bytes"].includes(suffix) ? suffix : undefined
}
export const knobWidth = (value: PolicyReading): string => value.control?.kind === "number" ? "9ch"
  : /(?:header|template)$/.test(value.key) ? "22ch" : "6ch"
export const knobAuthored = (value: PolicyReading): boolean => value.setBy !== "default"

export const pluginConfig = (
  plugin: BuiltPlugin,
): ReadonlyArray<readonly [string, string]> => {
  const config = plugin.config
  if (config === undefined) return []
  return Object.entries(config).map(([key, value]) => [key, typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)] as const)
}

export const rowValues = (plugin: BuiltPlugin): ReadonlyArray<PolicyReading> =>
  plugin.configurationValues ?? pluginConfig(plugin).map(([key, value]) => ({ key, value, setBy: "default" as const, says: "" }))
