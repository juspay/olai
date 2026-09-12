/** Pure readings of the roster, independent of this tab's mounted controls.
 * The panel walks the build: no plugin names or configuration keys belong here.
 * Enablement is visible in the switch. Only failures and waits add a reason;
 * repeating a shared explanation beneath each row hides the rows needing help.
 * File provenance and session persistence use the panel's shared legend.
 * Drafts and pending requests belong to the mounted controls, while section
 * state belongs to the inspector activation. Neither is another policy store.
 */
import { type EnvironmentReading, CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import type { RowReport } from "@olai/plugin-api"
import type { BuiltPlugin, PluginRoster } from "@olai/surface"
import { pluginState } from "@olai/surface"
import type { PluginLook } from "@olai/surface/management"

/** The rows to draw, in the order the build lists its plugins. A build with no
 *  plugins, and a page that has not heard from the server yet, both draw none —
 *  see `@olai/surface`'s `NO_ROSTER` for why those two are one value. */
export const pluginRows = (roster: PluginRoster): ReadonlyArray<BuiltPlugin> => roster.built

/** The two words a plugin's strip can read, and what each of them asks for. */
export type PluginPick = "on" | "off"

/**
 * WHAT THE STRIP SHOWS AND WHETHER IT MAY BE PRESSED — the whole of the switch's
 * state, as a function of the row and one fact this tab owns.
 *
 * ## The value is the BOOLEAN, independently of the detailed state
 *
 * `running` is the field the two ends have always agreed on and the one every
 * mount licence is read from (`@olai/surface`'s `pluginState` argues it from
 * the other side). A strip that showed On for `waiting` — a plugin that was
 * asked for and has not arrived — would be a control claiming a fact the rest
 * of the page is drawn from the negation of. The WHY of an absence is the
 * hint's job; the switch has two words, and it answers
 * the question the switch is asking.
 *
 * ## A FAILED ROW STILL DRAWS ONE, which is a ruling rather than a leftover
 *
 * A plugin whose `apply` died is off, and pressing On is exactly the gesture a
 * person has for *try that again* — the second half of it is the loader
 * re-importing the module and re-running the apply, which is the only retry
 * this product has. Hiding the switch there would leave the one row on the
 * panel that is a FAULT as the one row with nothing to do about it.
 *
 * ## FROZEN IS THIS TAB'S OWN REQUEST, and nothing else
 *
 * `flipping` is true between the press and the server's answer. It is not a
 * fact about the serve — it is about the button under this reader's finger,
 * which must not be pressed twice — and it is a signal in `./Panel.tsx` for
 * that reason.
 *
 * **The roster's own republish cannot stand in for it.** The serve does not
 * move the roster until the bundle has SETTLED — a flip disposes a row, and
 * every row that named one of its doors unloads with it — so between the press
 * and the settle the cell still carries the value the strip already shows.
 * Without this the strip would sit there reading On, live, inviting the second
 * press that starts a second flip across the first one.
 *
 * The value STAYS PUT while frozen rather than jumping to what was pressed: an
 * optimistic strip is this tab asserting a fact it has not been told, on the one
 * panel whose entire job is to say what is actually running.
 */
export const pluginSwitch = (
  plugin: BuiltPlugin,
  flipping: boolean,
): { readonly value: PluginPick; readonly frozen: boolean } => ({
  value: plugin.running ? "on" : "off",
  frozen: flipping,
})

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

/** Failed and waiting rows explain their own obstruction. All other states
 * are expressed by the enable switch, without an additional prose arm. */
export const pluginHint = (
  plugin: BuiltPlugin,
  roster: PluginRoster = { built: [] },
  look: PluginLook = {},
): string | null => {
  switch (pluginState(plugin)) {
    case "running":
    case "off":
    case "optIn":
    case "switched":
    case "pending":
      return null
    case "failed":
      return `Failed to start. ${said(plugin.fault)}`
    case "waiting":
      // NAMED WHERE THE ROW NAMES THEM, because "something it needs" is the
      // sentence that sends a person to the source. A service with nobody
      // behind it is another ROW's to offer, so what this line is really saying
      // is which plugin to compose — and it can only say it by naming the door.
      return plugin.missing === undefined || plugin.missing.length === 0
        ? `Starting — waiting for something it needs.`
        : `Waiting for ${plugin.missing.join(", ")} — no plugin in this build offers `
          + `${plugin.missing.length === 1 ? "it" : "them"}.`
    default:
      return null
  }
}

/** THE PLUGIN'S OWN SENTENCE, verbatim — or the honest nothing. */
const said = (fault: string | undefined): string =>
  fault === undefined ? `It gave no message.` : `It said: “${fault}”.`

/**
 * THE ROWS THAT STOP WITH THIS ONE, as one phrase — or nothing at all.
 *
 * ABSENT AND EMPTY ARE ONE ANSWER HERE, which is the opposite of the rule
 * `waiting`'s list keeps one arm up, and the difference is what each absence
 * MEANS. A `waiting` row with no `missing` is a settle still in flight — it IS
 * waiting on something and cannot yet say what — so the sentence has to survive
 * having no names. A `running` row with no `carrying` is a row nothing depends
 * on, which is a whole answer and the ordinary one: most rows carry nobody, and
 * the switch needs no dependency confirmation.
 *
 * A serve too old to send the field at all lands on the same arm, and correctly:
 * it is telling this tab nothing about what depends on what, and a panel that
 * invented a warning out of that silence would be worse than one that kept
 * quiet.
 */
const carries = (plugin: BuiltPlugin): string | undefined =>
  plugin.carrying === undefined || plugin.carrying.length === 0
    ? undefined
    : plugin.carrying.join(", ")

/** A running server row can have a waiting browser component. Keep the
 * server's switch semantics and name that component and its missing keys. */
export const browserHint = (plugin: string, reports: ReadonlyMap<string, RowReport>, browserOnly = false): string | null => {
  const lines: string[] = []
  for (const [name, report] of reports) {
    if (name !== plugin && !name.startsWith(plugin + "/")) continue
    const label = name === plugin ? "Browser" : `Browser ${name.slice(plugin.length + 1)}`
    if (report.state === "waiting") lines.push(`${label}: waiting for ${report.missing?.join(", ") || "initialization"}.`)
    if (report.state === "failed") lines.push(`${label}: failed to start. ${report.fault ?? "It gave no message."}`)
  }
  if (lines.length) return lines.join(" ")
  if (browserOnly && reports.get(plugin)?.state !== "running") return "Browser: awaiting activation."
  return null
}

/**
 * WHAT PRESSING OFF WILL COST — carrying, or the row's own switchHint.
 *
 * On the running row this used to be a caption. It is a confirm now: the
 * ordinary On says nothing, and the sentence appears when the switch is about
 * to move. {@link pluginHint}'s running arm is `null` for the same rows.
 */
export const pluginConfirm = (
  plugin: BuiltPlugin,
  look: PluginLook = {},
): string | null => {
  const carry = carries(plugin)
  if (carry !== undefined) return `Turning it off also stops ${carry}.`
  return look.switchHint ?? null
}

/** The sentence the panel draws under a row — hint plus a waiting/failed browser. */
export const rowCopy = (
  plugin: BuiltPlugin,
  roster: PluginRoster = { built: [] },
  look: PluginLook = {},
  reports: ReadonlyMap<string, RowReport> = new Map(),
): string | null => {
  const hint = pluginHint(plugin, roster, look)
  const browser = plugin.running ? browserHint(plugin.name, reports, plugin.browserOnly) : null
  return [hint, browser].filter(Boolean).join(" ") || null
}

/**
 * A plugin the VAULT defines — presence of {@link BuiltPlugin.source} is the
 * whole distinction. Not a YAML section: these rows are not in `olai.yml`, and
 * a section spelled here would be the inspector naming a plugin's origin in
 * the one file that must not.
 */
export const THIS_VAULT = "Defined here"

export const NEEDS_YOU = "Needs you"

export type PluginGroup = {
  readonly label: string
  readonly needs: boolean
  readonly collapsed: boolean
  readonly rows: ReadonlyArray<BuiltPlugin>
}

const needsYou = (
  plugin: BuiltPlugin,
  reports: ReadonlyMap<string, RowReport>,
): boolean => {
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

/**
 * THE PANEL'S WALK, grouped.
 *
 * Needs-you first (failed, pending, waiting, a browser that failed or waits).
 * Then YAML sections in roster order. Vault-defined rows that are not in
 * Needs you sit in {@link THIS_VAULT}, after the built-in catalogue, because
 * that is where they arrive on the cell.
 *
 * A group of only `optIn` rows is hidden — fixtures nobody asked for. A quiet
 * group whose every row is running and silent starts collapsed.
 */
export const pluginGroups = (
  roster: PluginRoster,
  look: (name: string) => PluginLook,
  reports: ReadonlyMap<string, RowReport> = new Map(),
): ReadonlyArray<PluginGroup> => {
  const rows = pluginRows(roster)
  const attention = rows.filter((plugin) => needsYou(plugin, reports))
  const rest = rows.filter((plugin) => !needsYou(plugin, reports))
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
  for (const label of order) {
    const members = buckets.get(label)!
    const quiet = members.every((plugin) => look(plugin.name).quiet === true)
    const healthy = members.every((plugin) =>
      pluginState(plugin) === "running" && rowCopy(plugin, roster, look(plugin.name), reports) === null
    )
    groups.push({ label, needs: false, collapsed: quiet && healthy, rows: members })
  }
  return groups
}

export const groupCount = (rows: ReadonlyArray<BuiltPlugin>): string => {
  const on = rows.filter((plugin) => plugin.running).length
  const off = rows.length - on
  if (off === 0) return `${on} on`
  if (on === 0) return `${off} off`
  return `${on} on · ${off} off`
}

/** Build defaults are not machine inputs a person can change here. */
export const environmentVisible = (one: EnvironmentReading): boolean =>
  one.kind !== "resource" || one.source !== "wrapper"

export type PolicyReading = NonNullable<BuiltPlugin["configurationValues"]>[number]
export const labelOf = (key: string): string => {
  const words = key.replace(/[.-]/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
export const controlOf = (value: PolicyReading | EnvironmentReading) => "control" in value ? value.control : undefined
export const enableLabel = (name: string): string => `Enable ${name}`

export const configurationAuthored = `set in ${CONFIGURATION_FILE.split("/").pop()}`
export const configurationLinkLabel = `Open ${CONFIGURATION_FILE.split("/").pop()!.split(".")[0]!.toLowerCase()} node`

/** Compact spelling is derived from the leaf, never a plugin-specific table. */
export const knobLabel = (key: string): string => key.split(".").at(-1)!.split("-")[0]!.toLowerCase()
export const knobUnit = (key: string): string | undefined => {
  const suffix = key.split("-").at(-1)!
  return ["ms", "seconds", "minutes", "bytes"].includes(suffix) ? suffix : undefined
}
export const knobWidth = (value: PolicyReading): string => value.control?.kind === "number" ? "9ch"
  : /(?:header|template)$/.test(value.key) ? "22ch" : "6ch"
export const knobAuthored = (value: PolicyReading): boolean => value.setBy !== "default"
