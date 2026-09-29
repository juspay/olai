/** Pure readings of the roster, independent of this tab's mounted controls.
 * The panel walks the build: no plugin names or configuration keys belong here.
 * Enablement is visible in the switch. Only failures and waits add a reason,
 * a few words at rest and the full sentence in the row's detail; repeating a
 * shared explanation beneath each row hides the rows needing help.
 * Drafts and pending requests belong to the mounted controls, while section
 * state belongs to the inspector activation. Neither is another policy store.
 */
import { type EnvironmentReading, CONFIGURATION_FILE, configurationBroken, configurationUnavailable } from "@olai/plugin-api/configuration"
import type { RowReport } from "@olai/plugin-api"
import type { BuiltPlugin, PluginRoster } from "@olai/surface"
import { pluginState } from "@olai/surface"
import type { PluginLook } from "@olai/surface/management"
import type { PreferencesPanel } from "olai-plugin-preferences/contract"

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

/** One component of a running row that is stuck in this tab — `component` is
 *  the part after the row's name (`shell/palette` → `palette`), or `undefined`
 *  for the row's own browser half. */
export type TabPart = { readonly component: string | undefined; readonly report: RowReport }

/**
 * WHAT IS WRONG WITH A ROW, as one tagged reading — or `null`, the ordinary
 * answer: a row that is on and fine, or off because somebody left it off, is
 * said by its switch. The few words at rest ({@link CONDITION_WORDS}), the full
 * sentence in the detail ({@link conditionSaid}) and the tone
 * ({@link CONDITION_TONE}) are tables over this tag, so no reader classifies a
 * row by its words.
 *
 * `blocked` names the doors a waiting row is short of, because "something it
 * needs" is the sentence that sends a person to the source: a service with
 * nobody behind it is another ROW's to offer. A running row can still be stuck
 * in this tab (`tabFailed`, `tabStarting`); a browser-only row that has not
 * reported once the tab has heard from others is `tabStarting` with no parts.
 * `setup` is the one arm only the row's own plugin can answer (`needs`).
 */
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

/** THE ROW'S STATE IN A FEW WORDS, beside its name at rest. */
export const CONDITION_WORDS: { readonly [K in ConditionKind]: string } = {
  failed: "Failed",
  pending: "Needs approval",
  starting: "Starting…",
  blocked: "Can't start",
  tabFailed: "Failed in this tab",
  tabStarting: "Starting in this tab",
  setup: "Needs setup",
}

/** How the words are coloured: a fault is an alarm, a wait is in progress. */
export const CONDITION_TONE: { readonly [K in ConditionKind]: "alarm" | "doing" | undefined } = {
  failed: "alarm",
  pending: undefined,
  starting: "doing",
  blocked: "doing",
  tabFailed: "alarm",
  tabStarting: "doing",
  setup: undefined,
}

/** THE PLUGIN'S OWN SENTENCE, verbatim — or the honest nothing. */
const said = (fault: string | undefined): string =>
  fault === undefined ? `It gave no message.` : `It said: “${fault}”.`

/** What each stuck part of this tab says, in the order the tab reported them. */
const inTab = (parts: ReadonlyArray<TabPart>): string =>
  parts.map(({ component, report }) => {
    const label = component === undefined ? "In this tab" : `In this tab (${component})`
    return report.state === "failed"
      ? `${label}: failed to start. ${report.fault ?? "It gave no message."}`
      : `${label}: still starting${report.state === "waiting" && report.missing?.length ? ` (needs ${report.missing.join(", ")})` : ""}.`
  }).join(" ") || "Not started in this tab yet."

/** THE FULL SENTENCE in the row's detail. Approval and setup say nothing
 *  here: the definition's own block and the plugin's own face are what to do. */
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
const carries = (plugin: BuiltPlugin, named: (name: string) => string): string | undefined =>
  plugin.carrying === undefined || plugin.carrying.length === 0
    ? undefined
    : plugin.carrying.map(named).join(", ")

/**
 * WHAT PRESSING OFF WILL COST — carrying, or the row's own switchHint.
 *
 * On the running row this used to be a caption. It is a confirm now: the
 * ordinary On says nothing, and the sentence appears when the switch is about
 * to move. {@link rowCondition} is `null` for the same rows.
 */
export const pluginConfirm = (
  plugin: BuiltPlugin,
  look: (name: string) => PluginLook = () => ({}),
  /** Where a carried row is found, so it is named as its own row is. */
  roster: PluginRoster = { built: [] },
): string | null => {
  const carry = carries(plugin, (name) => displayName(roster.built.find((one) => one.name === name) ?? { name, running: false }, look(name)))
  if (carry !== undefined) return `Turning it off also stops ${carry}.`
  return look(plugin.name).switchHint ?? null
}

/**
 * A plugin the VAULT defines — presence of {@link BuiltPlugin.source} is the
 * whole distinction. Not a YAML section: these rows are not in `olai.yml`, and
 * a section spelled here would be the inspector naming a plugin's origin in
 * the one file that must not.
 */
export const THIS_VAULT = "Your plugins"

export const NEEDS_YOU = "Needs attention"

/** THE NAME A PERSON READS — the build's own label for the row (`olai.yml`'s
 *  `label`), or the plugin's name where the build gives none, which is every
 *  vault-defined row. The name itself stays the settings namespace and is
 *  shown in the row's detail. */
export const displayName = (plugin: BuiltPlugin, look: PluginLook = {}): string =>
  plugin.source === undefined ? look.label ?? plugin.name : plugin.name

/** A group whose every row is off by the BUILD's own default — maintained test
 *  fixtures nobody asked for — is not listed at all. It reappears the moment
 *  one of its rows is switched on (a test serve selecting it), so nothing a
 *  scenario turns on is hidden from it. */
const unasked = (members: ReadonlyArray<BuiltPlugin>, look: (name: string) => PluginLook): boolean =>
  members.every((plugin) => look(plugin.name).optIn === true && !plugin.running)

export type PluginGroup = {
  readonly label: string
  readonly needs: boolean
  readonly collapsed: boolean
  readonly rows: ReadonlyArray<BuiltPlugin>
}

/**
 * DOES THIS ROW STOP WITHOUT A PERSON?
 *
 * Three arms the ROSTER answers — a serve that failed, is still settling, or
 * cannot start for want of a door nobody offers — and the browser's own reports
 * beside them (the serve can be perfectly healthy while the half that draws in
 * this tab failed or waits).
 *
 * ...and ONE ARM ONLY THE ROW'S OWN PLUGIN CAN ANSWER, which is why this takes
 * a reader rather than reading a table: some plugins are running, faultless and
 * still of no use until somebody does something only that plugin knows about —
 * a mail row with no account connected is the case the slot was minted for. The
 * reader is a PARAMETER and never a module variable, so this file stays a
 * function of what the panel handed it, and a caller with no faces at all (a
 * test, a tab that hung none) asks nothing.
 */
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

/**
 * THE PANEL'S WALK, grouped.
 *
 * Needs-you first (failed, pending, waiting, a browser that failed or waits, or
 * a row whose own plugin says it needs a person — {@link needsYou}). Then YAML
 * sections in roster order. Vault-defined rows that are not in Needs you sit in
 * {@link THIS_VAULT}, after the built-in catalogue, because that is where they
 * arrive on the cell.
 *
 * A group of only `optIn` rows none of which is running is hidden — fixtures
 * nobody asked for. Every ordinary group starts collapsed, and a group of only
 * quiet rows sorts after the others.
 *
 * `needs` is the panel's reader over the faces its rows hung
 * (`olai-plugin-plugin-inspector`'s `plugins.row`), passed in rather than
 * reached for: this file is a function of the roster, the look and the reports,
 * a build with no faces is the default answer below, and nothing here has ever
 * heard of a renderer.
 */
export const pluginGroups = (
  roster: PluginRoster,
  look: (name: string) => PluginLook,
  reports: ReadonlyMap<string, RowReport> = new Map(),
  needs: (plugin: string) => boolean = () => false,
): ReadonlyArray<PluginGroup> => {
  const rows = pluginRows(roster)
  // ONE PASS, so each row is asked once whether it needs a person. Two filters
  // asking the same question took two answers from `needs`, which is LIVE state
  // the row's own plugin holds (`olai-plugin-plugin-inspector`'s `plugins.row`):
  // a face that answered differently between the passes would put its row in
  // both groups, or in neither.
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
  // Every ordinary group starts shut: at rest the panel is its headings and
  // their counts, and the rows are a press away. Quiet groups — the app's own
  // machinery — sort after the ones a person is likelier to look for.
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
export const configurationLinkLabel = `Open in ${CONFIGURATION_FILE.split("/").pop()}`
/** ONE LINK REPLACES A PROMOTED LEAF'S CONTROL, where the panel that drew it
 *  is up. The words say where the setting went, not what the control does. */
export const promotedLinkLabel = "Set in Preferences"

/** An environment reading's own description as a label: its first letter
 *  raised, nothing else touched. */
export const sentenceOf = (said: string): string => said.charAt(0).toUpperCase() + said.slice(1)
/** What an environment reading holds, in words — a secret says only whether
 *  it is there. */
export const environmentValue = (one: EnvironmentReading): string =>
  one.kind === "secret" ? (one.set ? "set" : "unset") : (one.value ?? "unset")

/** Compact spelling is derived from the leaf, never a plugin-specific table. */
export const knobLabel = (key: string): string => key.split(".").at(-1)!.split("-")[0]!.toLowerCase()
export const knobUnit = (key: string): string | undefined => {
  const suffix = key.split("-").at(-1)!
  return ["ms", "seconds", "minutes", "bytes"].includes(suffix) ? suffix : undefined
}
export const knobWidth = (value: PolicyReading): string => value.control?.kind === "number" ? "9ch"
  : /(?:header|template)$/.test(value.key) ? "22ch" : "6ch"
export const knobAuthored = (value: PolicyReading): boolean => value.setBy !== "default"

/** WHAT A ROW'S SETTINGS ARE, read in one place: the reader's published values
 *  where a serve has them, and the build-patch pairs the row carries where it
 *  has not — an older serve publishes no `configurationValues`, and its rows
 *  still draw their `config`. */
export const rowValues = (plugin: BuiltPlugin): ReadonlyArray<PolicyReading> =>
  plugin.configurationValues ?? pluginConfig(plugin).map(([key, value]) => ({ key, value, setBy: "default" as const, says: "" }))

/** WHAT THIS ROW PROMOTED — the leaves its declaration marked as preferences
 *  (`@olai/plugin-api/configuration`'s `preference`). Empty on every row that
 *  promoted nothing, which is every row with no annotation. */
export const promotedValues = (values: ReadonlyArray<PolicyReading>): ReadonlyArray<PolicyReading> =>
  values.filter((one) => one.preference === true)

/** THE PLUGINS THAT PROMOTED ANYTHING AND ARE RUNNING NOW, in build order —
 *  the headings the preferences panel needs, discovered from the roster rather
 *  than by naming any plugin's package. A plugin that is off contributes no
 *  heading: its rows would draw nothing, and a heading drawn over nothing is
 *  the one thing this panel refuses. */
export const promotingPlugins = (roster: PluginRoster): ReadonlyArray<string> =>
  pluginRows(roster).filter((plugin) => plugin.running && promotedValues(rowValues(plugin)).length > 0).map((plugin) => plugin.name)

/** WHAT THIS ROW DRAWS, as ONE reading — because two places ask it and they
 *  may not disagree: the row itself (which control, or the link) and the
 *  inspector's own `open(name)` (whether there is anything here to open at all).
 *
 *  `preferences` is the panel that draws a promoted leaf, held or absent — the
 *  second fact the rule needs, since a promoted leaf is away only while its
 *  plugin runs AND that panel is there to take it. */
export interface RowSettings {
  /** The leaves the row's detail still draws. */
  readonly knobs: ReadonlyArray<PolicyReading>
  /** Whether the one link stands in place of the promoted leaves. */
  readonly link: boolean
  /** Whether EVERY leaf the row declares is drawn in the other panel — nothing
   *  here to open, which is what sends `open(name)` there instead. */
  readonly allAway: boolean
}

export const rowSettings = (plugin: BuiltPlugin, preferences: PreferencesPanel | undefined): RowSettings => {
  const values = rowValues(plugin)
  const promoted = promotedValues(values)
  const away = plugin.running && preferences !== undefined && promoted.length > 0
  const knobs = away ? values.filter((one) => one.preference !== true) : values
  return { knobs, link: away, allAway: away && knobs.length === 0 }
}

/**
 * WHY THE CONTROLS WILL NOT MOVE — the reader is absent, or the file is broken:
 * reasons that STAY. The same sentence every knob's tooltip carries.
 *
 * NOT "a change is landing", which used to be here: that one passes in a few
 * milliseconds, and a control that becomes `disabled` while it has the caret is
 * blurred BY THE BROWSER, to `<body>`. The reconnect dialog that follows
 * (`@olai/web/client/connection/Offline.tsx`'s `showModal`) then records the
 * BODY as the focus it took, so `close()` hands the caret back there instead of
 * to the field — and `Control.tsx`'s blur, which commits a draft, fires on the
 * way past. Somebody who typed nothing and asked for nothing loses the caret
 * and the text. A press made while a change is landing needs no freeze: it goes
 * out and the transport answers it. The ENABLE SWITCHES keep the guard, drawn
 * `aria-disabled` rather than `disabled` (`@olai/ui-primitives/Switch.tsx`), so
 * a flip cannot be pressed on either side of a redial and cannot be blurred
 * either.
 */
export const configurationFrozen = (roster: PluginRoster): string | undefined =>
  roster.configurationAvailable !== true ? configurationUnavailable
    : roster.configurationError !== undefined ? configurationBroken(roster.configurationFile)
    : undefined
