import { type EnvironmentReading, CONFIGURATION_FILE, configurationBroken, configurationUnavailable } from "@olai/plugin-api/configuration"
import type { RowReport } from "@olai/plugin-api"
import type { BuiltPlugin, PluginRoster } from "@olai/surface"
import { pluginState } from "@olai/surface"
import type { PluginLook } from "@olai/surface/management"
import type { PreferencesPanel } from "olai-plugin-preferences/contract"
import { rowValues, type PolicyReading } from "./contracts/knobs.ts"

export const pluginRows = (roster: PluginRoster): ReadonlyArray<BuiltPlugin> => roster.built

export type PluginPick = "on" | "off"

export const pluginSwitch = (
  plugin: BuiltPlugin,
  flipping: boolean,
): { readonly value: PluginPick; readonly frozen: boolean } => ({
  value: plugin.running ? "on" : "off",
  frozen: flipping,
})

export type TabPart = { readonly component: string | undefined; readonly report: RowReport }

export type RowCondition =
  | { readonly kind: "failed"; readonly fault: string | undefined }
  | { readonly kind: "pending" }
  | { readonly kind: "starting" }
  | { readonly kind: "blocked"; readonly missing: ReadonlyArray<string> }
  | { readonly kind: "tabFailed"; readonly parts: ReadonlyArray<TabPart> }
  | { readonly kind: "tabStarting"; readonly parts: ReadonlyArray<TabPart> }
  | { readonly kind: "setup" }

export const rowCondition = (
  plugin: BuiltPlugin,
  reports: ReadonlyMap<string, RowReport> = new Map(),
  needs = false,
): RowCondition | null => {
  switch (pluginState(plugin)) {
    case "failed":
      return { kind: "failed", fault: plugin.fault }
    case "pending":
      return { kind: "pending" }
    case "waiting":
      return plugin.missing === undefined || plugin.missing.length === 0
        ? { kind: "starting" }
        : { kind: "blocked", missing: plugin.missing }
    case "running": {
      const parts: TabPart[] = []
      for (const [name, report] of reports) {
        if (name !== plugin.name && !name.startsWith(plugin.name + "/")) continue
        if (report.state === "waiting" || report.state === "failed")
          parts.push({ component: name === plugin.name ? undefined : name.slice(plugin.name.length + 1), report })
      }
      if (parts.some(({ report }) => report.state === "failed")) return { kind: "tabFailed", parts }
      if (parts.length > 0 || (plugin.browserOnly && reports.size > 0 && reports.get(plugin.name)?.state !== "running"))
        return { kind: "tabStarting", parts }
      return needs ? { kind: "setup" } : null
    }
    default:
      return null
  }
}

type ConditionKind = RowCondition["kind"]

export const CONDITION_WORDS: { readonly [K in ConditionKind]: string } = {
  failed: "Failed",
  pending: "Needs approval",
  starting: "Starting…",
  blocked: "Can't start",
  tabFailed: "Failed in this tab",
  tabStarting: "Starting in this tab",
  setup: "Needs setup",
}

export const CONDITION_TONE: { readonly [K in ConditionKind]: "alarm" | "doing" | undefined } = {
  failed: "alarm",
  pending: undefined,
  starting: "doing",
  blocked: "doing",
  tabFailed: "alarm",
  tabStarting: "doing",
  setup: undefined,
}

const said = (fault: string | undefined): string =>
  fault === undefined ? `It gave no message.` : `It said: “${fault}”.`

const inTab = (parts: ReadonlyArray<TabPart>): string =>
  parts.map(({ component, report }) => {
    const label = component === undefined ? "In this tab" : `In this tab (${component})`
    return report.state === "failed"
      ? `${label}: failed to start. ${report.fault ?? "It gave no message."}`
      : `${label}: still starting${report.state === "waiting" && report.missing?.length ? ` (needs ${report.missing.join(", ")})` : ""}.`
  }).join(" ") || "Not started in this tab yet."

const CONDITION_SAID: { readonly [K in ConditionKind]: (condition: Extract<RowCondition, { kind: K }>) => string | null } = {
  failed: ({ fault }) => `Failed to start. ${said(fault)} Switch it off and on to try again.`,
  pending: () => null,
  starting: () => `Starting…`,
  blocked: ({ missing }) => `Can't start: another plugin it needs isn't running (${missing.join(", ")}).`,
  tabFailed: ({ parts }) => inTab(parts),
  tabStarting: ({ parts }) => inTab(parts),
  setup: () => null,
}

export const conditionSaid = (condition: RowCondition): string | null =>
  (CONDITION_SAID[condition.kind] as (condition: RowCondition) => string | null)(condition)

const carries = (plugin: BuiltPlugin, named: (name: string) => string): string | undefined =>
  plugin.carrying === undefined || plugin.carrying.length === 0
    ? undefined
    : plugin.carrying.map(named).join(", ")

export const pluginConfirm = (
  plugin: BuiltPlugin,
  look: (name: string) => PluginLook = () => ({}),
  roster: PluginRoster = { built: [] },
): string | null => {
  const carry = carries(plugin, (name) => displayName(roster.built.find((one) => one.name === name) ?? { name, running: false }, look(name)))
  if (carry !== undefined) return `Turning it off also stops ${carry}.`
  return look(plugin.name).switchHint ?? null
}

export const THIS_VAULT = "Your plugins"

export const NEEDS_YOU = "Needs attention"

export const displayName = (plugin: BuiltPlugin, look: PluginLook = {}): string =>
  plugin.source === undefined ? look.label ?? plugin.name : plugin.name

export const pluginPage = (plugin: BuiltPlugin): string | undefined =>
  plugin.source === undefined ? undefined : `/${plugin.source.folder.replace(/\/+$/, "")}`

export const pluginFolder = (plugin: BuiltPlugin): string | undefined => plugin.source?.folder

export const pluginPageLabel = "Open its page"

const unasked = (members: ReadonlyArray<BuiltPlugin>, look: (name: string) => PluginLook): boolean =>
  members.every((plugin) => look(plugin.name).optIn === true && !plugin.running)

export type PluginGroup = {
  readonly label: string
  readonly needs: boolean
  readonly collapsed: boolean
  readonly rows: ReadonlyArray<BuiltPlugin>
}

const needsYou = (
  plugin: BuiltPlugin,
  reports: ReadonlyMap<string, RowReport>,
  needs: (plugin: string) => boolean,
): boolean => {
  if (needs(plugin.name)) return true
  const state = pluginState(plugin)
  if (state === "failed" || state === "pending" || state === "waiting") return true
  for (const [name, report] of reports) {
    if (name !== plugin.name && !name.startsWith(plugin.name + "/")) continue
    if (report.state === "waiting" || report.state === "failed") return true
  }
  return false
}

const sectionOf = (plugin: BuiltPlugin, look: PluginLook): string =>
  plugin.source !== undefined ? THIS_VAULT : look.section ?? plugin.name

export const pluginGroups = (
  roster: PluginRoster,
  look: (name: string) => PluginLook,
  reports: ReadonlyMap<string, RowReport> = new Map(),
  needs: (plugin: string) => boolean = () => false,
): ReadonlyArray<PluginGroup> => {
  const rows = pluginRows(roster)
  const attention: BuiltPlugin[] = []
  const rest: BuiltPlugin[] = []
  for (const plugin of rows) (needsYou(plugin, reports, needs) ? attention : rest).push(plugin)
  const groups: PluginGroup[] = []
  if (attention.length > 0) {
    groups.push({ label: NEEDS_YOU, needs: true, collapsed: false, rows: attention })
  }
  const order: string[] = []
  const buckets = new Map<string, BuiltPlugin[]>()
  for (const plugin of rest) {
    const label = sectionOf(plugin, look(plugin.name))
    const bucket = buckets.get(label)
    if (bucket === undefined) {
      order.push(label)
      buckets.set(label, [plugin])
    } else {
      bucket.push(plugin)
    }
  }
  const loud: PluginGroup[] = []
  const quietGroups: PluginGroup[] = []
  for (const label of order) {
    const members = buckets.get(label)!
    if (unasked(members, look)) continue
    const quiet = members.every((plugin) => look(plugin.name).quiet === true)
    ;(quiet ? quietGroups : loud).push({ label, needs: false, collapsed: true, rows: members })
  }
  return [...groups, ...loud, ...quietGroups]
}

export const groupCount = (rows: ReadonlyArray<BuiltPlugin>): string => {
  const on = rows.filter((plugin) => plugin.running).length
  const off = rows.length - on
  if (off === 0) return `${on} on`
  if (on === 0) return `${off} off`
  return `${on} on · ${off} off`
}

export const environmentVisible = (one: EnvironmentReading): boolean =>
  one.kind !== "resource" || one.source !== "wrapper"

export {
  configurationAuthored,
  controlOf,
  knobAuthored,
  knobLabel,
  knobUnit,
  knobWidth,
  labelOf,
  pluginConfig,
  rowValues,
  type PolicyReading,
} from "./contracts/knobs.ts"
export const enableLabel = (name: string): string => `Enable ${name}`

export const configurationLinkLabel = `Open in ${CONFIGURATION_FILE.split("/").pop()}`
export const promotedLinkLabel = "Set in Preferences"

export const sentenceOf = (said: string): string => said.charAt(0).toUpperCase() + said.slice(1)
export const environmentValue = (one: EnvironmentReading): string =>
  one.kind === "secret" ? (one.set ? "set" : "unset") : (one.value ?? "unset")


export const promotedValues = (values: ReadonlyArray<PolicyReading>): ReadonlyArray<PolicyReading> =>
  values.filter((one) => one.preference === true)

export const promotingPlugins = (roster: PluginRoster): ReadonlyArray<string> =>
  pluginRows(roster).filter((plugin) => plugin.running && promotedValues(rowValues(plugin)).length > 0).map((plugin) => plugin.name)

/** ONE reading — two places ask it (the row itself and the inspector's own
 *  `open(name)`) and they may not disagree. */
export interface RowSettings {
  readonly knobs: ReadonlyArray<PolicyReading>
  readonly link: boolean
  readonly allAway: boolean
}

export const rowSettings = (plugin: BuiltPlugin, preferences: PreferencesPanel | undefined): RowSettings => {
  const values = rowValues(plugin)
  const promoted = promotedValues(values)
  const away = plugin.running && preferences !== undefined && promoted.length > 0
  const knobs = away ? values.filter((one) => one.preference !== true) : values
  return { knobs, link: away, allAway: away && knobs.length === 0 }
}

export const configurationFrozen = (roster: PluginRoster, changing: boolean): string | undefined =>
  roster.configurationAvailable !== true ? configurationUnavailable
    : roster.configurationError !== undefined ? configurationBroken(roster.configurationFile)
    : changing ? "Applying the change…" : undefined
