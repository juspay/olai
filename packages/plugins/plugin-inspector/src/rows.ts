import { type EnvironmentReading, CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
/**
 * WHICH PLUGINS THIS SERVE RUNS, read as the plugins panel reads it.
 *
 * ## THE ROWS ARE NOT READ-ONLY ANY MORE, and this file's whole shape moved
 * with that
 *
 * It said: *a plugin's enablement is not a preference. It is CLI/nix only —
 * `--plugins`, or the nix module that passes the same flag — with no settings
 * file and no browser toggle, so these rows draw the server's answer and are
 * always read-only.* Every clause of that was true and the conclusion is
 * overturned (the human, 2026-09-04): the panel gets a SWITCH, and
 * `plugins.set` is the verb behind it.
 *
 * Policy and enablement now live in the directory's configuration file.
 * The panel names that file and private memory once; a session-only exception
 * belongs on its row. Legacy boot flags remain until the next series step.
 *
 * ## A ROW WITH NOTHING TO SAY SAYS NOTHING, and that took a screenshot
 *
 * Both readings here used to answer a string, always. On a serve started with
 * `--plugins=claude,codex,chat,kolu,odu` that drew, under every one of eight
 * rows, the same two blocks: *Running — its chips, panels and delivered
 * messages all work*, and the flag, quoted in full, wrapped over three lines,
 * eight times. Roughly nine tenths of the panel was one paragraph repeated. The
 * human, 2026-09-04, with the picture: *portrait spammy*.
 *
 * The old header called that arrangement a feature — no panel-wide line was
 * needed *because every row already says so on its own line* — which is the
 * repetition noticed and then argued for. It is not a per-row fact if it is
 * byte-identical on every row; it is a panel fact drawn N times. So:
 *
 *   - What is the SAME for every row is said ONCE, at the foot
 *     ({@link pluginsStarted}): where policy lives and how this serve was started.
 *   - What DIFFERS is per row, and only then. Both readings answer `null` for a
 *     row with nothing to add, and the ordinary running row is exactly that —
 *     the switch already reads On, and a sentence under it saying so is the
 *     control announcing itself.
 *
 * WHAT SURVIVES PER ROW is the list the old argument was actually built for:
 * a `failed` row (the plugin's own words), a `waiting` row (which door, and so
 * which plugin would offer it), an absent row (what to type so it starts at
 * boot — and that names THIS row, so it is not the same line twice), and a
 * `running` row that carries others (what stops with it). Every one of those is
 * different on the row beside it.
 *
 * **THE ROWS ARE A WALK, and this module spells no plugin's name.** What
 * arrives on the `plugins` cell is a row per plugin the BUILD has, each saying
 * whether this serve runs it — so a third plugin reaches this panel without a
 * line here or in `./Panel.tsx` moving, and nothing in `@olai/web` can be the
 * place a plugin's name is hardcoded. The fence one package over holds that as
 * an equality per package (`@olai/bundle`'s `fence.test.ts`); this module is
 * written so there is nothing for it to catch.
 *
 * **PURE FUNCTIONS OF THE CELL, and nothing else.** There is no state here, no
 * store, and no subscription: the one reader is `./Panel.tsx`, which holds the
 * cell and the one signal a press needs, and a unit test asks these with a
 * roster built by hand. {@link pluginSwitch} is the newest of them and is the
 * reason the press did not drag state in here with it: what a strip SHOWS and
 * whether it may be pressed are a function of the row and one boolean, so they
 * are asked here and proved here rather than read off a rendered panel.
 *
 * ## TWO QUESTIONS PER ROW, and they were one
 *
 * A row used to draw one sentence off a boolean and share a second sentence
 * with every other row. That was exact while a plugin's presence was decided
 * once, by one flag, before anything ran. A plugin is a fiber now, and
 * `running: false` covers five different mornings — the flag left it out, the
 * BUILD leaves it out until somebody asks, a PERSON switched it off here, its
 * `apply` died, or it is waiting on a service — of which exactly one is a fault
 * and exactly one is something a person can act on.
 *
 * So the two questions were split, and both were per row. ONE of them stayed
 * there:
 *
 *   - {@link pluginHint} is WHAT THIS ROW ADDS to what the switch beside it
 *     already says — the why of an absence, the plugin's own failure words,
 *     the door a wait is short of, what stops if this one is turned off, and
 *     what to type so it starts at boot. `null` where the switch has said it
 *     all.
 *   - HOW THIS SERVE STARTED is {@link pluginsStarted} and is the PANEL's, not
 *     the row's, because under a given flag the answer is one string for every
 *     row. It was per row on the argument that an opt-in row and its neighbour
 *     have different built-in defaults — which is true, and is why THAT
 *     difference is still drawn per row, in the hint, where it names the flag
 *     value a person would type. What moved is only the part that was the same
 *     everywhere.
 *
 * The word itself is narrowed by `@olai/surface`'s `pluginState`, which is
 * where an absent or unknown one is answered — a serve too old to send one, or
 * newer than this tab. Nothing here re-derives it.
 */

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
 * ## The value is the BOOLEAN, never the six-word state
 *
 * `running` is the field the two ends have always agreed on and the one every
 * mount licence is read from (`@olai/surface`'s `pluginState` argues it from
 * the other side). A strip that showed On for `waiting` — a plugin that was
 * asked for and has not arrived — would be a control claiming a fact the rest
 * of the page is drawn from the negation of. The WHY of an absence is the
 * hint's job and it has six words for it; the switch has two, and it answers
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

/**
 * WHAT THIS ROW ADDS TO WHAT THE SWITCH ALREADY SAYS — one short line, or
 * NOTHING.
 *
 * ## SHORT, and that is a ruling rather than a preference
 *
 * These were paragraphs. Each absent arm recited the four things a missing
 * plugin costs — no member served, no probe, no face drawn, a property
 * validated as plain text — and every one of those is TRUE and is a claim the
 * code keeps. None of them is what a person opening this panel wants. The human
 * (2026-09-02): *users are not going to read novels*.
 *
 * So the long account moved to where long accounts belong — this comment, the
 * package READMEs, `docs/running.md` — and what is on screen is the state and
 * the ONE thing a reader can act on. A hint that is not read is worth nothing,
 * however true it is.
 *
 * ## ...AND THE SHORTEST LINE IS NO LINE
 *
 * The ordinary running row said *Running — its chips, panels and delivered
 * messages all work*, under a switch reading On, on every row of a serve
 * running six plugins. That is the control announcing itself, six times, and it
 * is most of what made this panel a scroll (the human, 2026-09-04, with the
 * screenshot: *portrait spammy*).
 *
 * So this answers `null` wherever the switch has already said everything true
 * about the row, and the panel draws no paragraph at all there. Which leaves
 * exactly the arms that carry something the switch cannot:
 *
 *   - `failed`  the plugin's OWN words, verbatim, because core composes no
 *               clause of a plugin's failure prose. A throw with nothing to say
 *               says so. The one arm that is a FAULT.
 *   - `waiting` WHICH DOOR nobody is behind. "Something it needs" is the
 *               sentence that sends a person nowhere; a service is another
 *               ROW's to offer, so naming the door is naming the plugin to
 *               compose, one step removed.
 *   - `optIn` / `off`  WHAT TO TYPE so it starts that way at boot. The switch
 *               starts it NOW; the flag is how it comes back after a restart,
 *               and both name THIS row's word, so no two of these lines are the
 *               same.
 *   - `running` + `carrying`  WHAT ELSE STOPS if this is turned off.
 *
 * ## THE CARRYING ARM IS THE OTHER END OF THE WAIT
 *
 * A row that stands behind doors carries the rows that named them
 * ({@link BuiltPlugin}'s `carrying`), and the moment it is worth saying is the
 * moment somebody is about to press Off. The panel drew nothing about it while
 * the rows were frozen — there was no press to warn about — and a switch that
 * took chat down and left kolu, odu and every engine `waiting` with no warning
 * would be the most expensive control in the product.
 *
 * `waiting` names the DOORS a row is short of; this names the ROWS that would
 * go short. One fact from either side, both read live off the serve, so neither
 * can be the copy that rots.
 *
 * UNBOUNDED IN LENGTH, exactly as `waiting`'s is, and for the same reason: the
 * names are the serve's and core caps neither list. A build whose chat row
 * carried a dozen plugins would draw a dozen names, which is a longer sentence
 * and a true one — where a cap would be this panel deciding which of somebody's
 * plugins was worth telling them about.
 */

export const pluginHint = (
  plugin: BuiltPlugin,
  roster: PluginRoster = { built: [], pinned: null },
  look: PluginLook = {},
): string | null => {
  if (pluginState(plugin) === "off" && plugin.desiredOn === false && roster.configurationFile !== undefined) {
    return `Off — ${roster.configurationFile} says on: no.`
  }
  switch (pluginState(plugin)) {
    case "running":
      return null
    case "optIn":
      return `Off by default — switch on here or set on: yes in the ${plugin.name} policy node.`
    case "pending":
      // A PERSON HAS NOT DECIDED, and this is the one absence whose answer is
      // on this very panel: the source is drawn under the rows and the verb is
      // beside it. So the line says what is being asked rather than where to go
      // — the other absences all send a reader somewhere else, and this one is
      // waiting on them here.
      return `Waiting for you: read the source below and approve it, or leave it.`
    case "switched":
      // THE PRESS A PERSON JUST MADE, and the one absence that undoes itself.
      // The other three all send a reader somewhere else — a flag to type, a
      // build to rebuild, a plugin to compose — and this one is answered by the
      // switch beside the sentence, so what it owes is not an instruction but
      // the fact a reader might not have: it does not survive the serve. Without
      // this arm the row read `optIn` and told a person who had just pressed it
      // that the BUILD ships this off by default.
      return `Switched off here. A restart brings it back.`
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
      // ADDED TO the flag rather than replacing it: this arm is only reachable
      // under a flag that was given (`@olai/server`'s `stateOf` answers `optIn`
      // where none was), and the panel's foot quotes that flag in full — so the
      // useful thing here is the row's own word and where to put it.
      return `Off — switch on here or set on: yes in the ${plugin.name} policy node.`
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
 * the honest thing to draw about them is the sentence that was always there.
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

const withoutConfiguration = (roster: PluginRoster): boolean =>
  roster.configurationAvailable === false

/** What applies to every row is said once, at the foot: policy location,
 * private memory, startup selection, and loss of the configuration reader.
 * Repeating the same caveat under each row made the panel a scroll of identical
 * paragraphs (#543). A row keeps only what differs, including its own
 * session-only exception while the shared reader is available.
 * Boot flags remain visible until their removal in step 4. */
export const pluginsStarted = (roster: PluginRoster): string =>
  `Policy lives in ${roster.configurationFile ?? CONFIGURATION_FILE} and travels with this directory. ${withoutConfiguration(roster) ? " Switches are session-only while the configuration reader is absent; they last until this serve stops." : ""} Memory: LocalState, $XDG_STATE_HOME/olai/<plugin>/<hash>.json; private to the serve.`

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
  roster: PluginRoster = { built: [], pinned: null },
  look: PluginLook = {},
  reports: ReadonlyMap<string, RowReport> = new Map(),
): string | null => {
  const hint = pluginHint(plugin, roster, look)
  const browser = plugin.running ? browserHint(plugin.name, reports, plugin.browserOnly) : null
  const duration = plugin.switchPersistence === "session" && !withoutConfiguration(roster) ? "Switch is session-only; it lasts until this serve stops." : null
  return [hint, browser, duration].filter(Boolean).join(" ") || null
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

/** Unset doors and wrapper provisions belong with defaults, not operator inputs. */
export const environmentAtDefault = (one: EnvironmentReading): boolean =>
  !one.set || (one.kind === "resource" && one.source === "wrapper")
