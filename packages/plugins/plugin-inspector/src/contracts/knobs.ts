/**
 * WHAT A SETTINGS KNOB IS DRAWN FROM — the pure readings `./Control.tsx` needs
 * and nothing the panel keeps.
 *
 * These lived in `../rows.ts` beside the panel's walk, which was right while
 * the panel was the only thing that drew a knob. It is not: a plugin the vault
 * defines has a page of its own, that page draws the same settings, and the
 * page must draw them with the same control rather than a second one that
 * agrees for a release. So the few readings a KNOB makes are separated from the
 * many a LIST OF ROWS makes, and only the first set crosses the package
 * boundary (`../contracts/control.ts` has the whole argument).
 *
 * `../rows.ts` re-exports every name here, so the panel's own files go on
 * importing them from the one place they always did; this is where they are
 * defined, not a second spelling of them.
 *
 * Every one of them is a function of its argument. None reads a roster, a
 * holder or an activation, which is why this file may sit behind a door at all.
 */
import { type EnvironmentReading, CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import type { BuiltPlugin } from "@olai/surface"

/** One published setting, as the roster carries it. */
export type PolicyReading = NonNullable<BuiltPlugin["configurationValues"]>[number]

/** The key in words, for a label a person reads: dots and hyphens become
 *  spaces and the first letter is raised. Derived from the key, never a table
 *  of any plugin's own words. */
export const labelOf = (key: string): string => {
  const words = key.replace(/[.-]/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** WHICH CONTROL A READING ASKS FOR, or `undefined` for a value nothing here
 *  can move. An environment reading never carries one, which is the honest
 *  answer rather than a missing case: those are the operator's and are shown
 *  read-only. */
export const controlOf = (value: PolicyReading | EnvironmentReading) => "control" in value ? value.control : undefined

/** WHERE AN AUTHORED VALUE WAS AUTHORED, for the ● beside it. The settings
 *  file names itself (`@olai/plugin-api/configuration`), so nothing here
 *  spells a filename. */
export const configurationAuthored = `set in ${CONFIGURATION_FILE.split("/").pop()}`

/** Compact spelling is derived from the leaf, never a plugin-specific table. */
export const knobLabel = (key: string): string => key.split(".").at(-1)!.split("-")[0]!.toLowerCase()
export const knobUnit = (key: string): string | undefined => {
  const suffix = key.split("-").at(-1)!
  return ["ms", "seconds", "minutes", "bytes"].includes(suffix) ? suffix : undefined
}
export const knobWidth = (value: PolicyReading): string => value.control?.kind === "number" ? "9ch"
  : /(?:header|template)$/.test(value.key) ? "22ch" : "6ch"
export const knobAuthored = (value: PolicyReading): boolean => value.setBy !== "default"

/**
 * THE ROW'S CONFIG, as pairs core can draw without knowing any plugin's
 * words. Empty when the row has none — the panel draws nothing extra.
 */
export const pluginConfig = (
  plugin: BuiltPlugin,
): ReadonlyArray<readonly [string, string]> => {
  const config = plugin.config
  if (config === undefined) return []
  return Object.entries(config).map(([key, value]) => [key, typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)] as const)
}

/** WHAT A ROW'S SETTINGS ARE, read in one place: the reader's published values
 *  where a serve has them, and the build-patch pairs the row carries where it
 *  has not — an older serve publishes no `configurationValues`, and its rows
 *  still draw their `config`. */
export const rowValues = (plugin: BuiltPlugin): ReadonlyArray<PolicyReading> =>
  plugin.configurationValues ?? pluginConfig(plugin).map(([key, value]) => ({ key, value, setBy: "default" as const, says: "" }))
