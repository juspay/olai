/**
 * WHICH PLUGINS THIS SERVE RUNS, read as the preferences panel reads it.
 *
 * A plugin's enablement is not a preference. It is CLI/nix only — `--plugins`,
 * or the nix module that passes the same flag — with no settings file and no
 * browser toggle, so these rows draw the server's answer and are always
 * read-only. That is the git rows' arrangement exactly (`./policy.ts`), and it
 * is deliberately the same one: a person reading two kinds of frozen row on one
 * panel is owed one explanation, which is `./instance.ts`.
 *
 * **THE ROWS ARE A WALK, and this module spells no plugin's name.** What
 * arrives on the `plugins` cell is a row per plugin the BUILD has, each saying
 * whether this serve runs it — so a third plugin reaches this panel without a
 * line here or in `./Panel.tsx` moving, and nothing in `@olai/web` can be the
 * place a plugin's name is hardcoded. The fence one package over holds that as
 * an equality per package (`@olai/plugin-api`'s `fence.test.ts`); this module is
 * written so there is nothing for it to catch.
 *
 * **PURE FUNCTIONS OF THE CELL, and nothing else** — the shape `./policy.ts`
 * keeps and for the same reason. There is no state here, no store, and no
 * subscription: the one reader is `./Panel.tsx`, which already holds the cell,
 * and a unit test asks these with a roster built by hand.
 *
 * ## TWO QUESTIONS PER ROW, and they were one
 *
 * A row used to draw one sentence off a boolean and share a second sentence
 * with every other row. That was exact while a plugin's presence was decided
 * once, by one flag, before anything ran. A plugin is a Cordis fiber now, and
 * `running: false` covers four different mornings — the flag left it out, the
 * BUILD leaves it out until somebody asks, its `apply` threw, or it is waiting
 * on a service — of which exactly one is a fault and exactly one is something a
 * person can act on.
 *
 * So the two questions are split and both are per row:
 *
 *   - {@link pluginHint} is WHAT HAPPENED, off the row's own state word.
 *   - {@link pluginSetBy} is WHO ASKED, off `pinned` and that same word. It is
 *     per row rather than one line for all of them because an opt-in row under
 *     no flag and its neighbour under no flag are two different answers: one is
 *     a built-in default that says ON, the other a built-in default that says
 *     OFF and names the flag that changes it.
 *
 * The word itself is narrowed by `@olai/surface`'s `pluginState`, which is
 * where an absent or unknown one is answered — a serve too old to send one, or
 * newer than this tab. Nothing here re-derives it.
 */

import type { BuiltPlugin, PluginRoster } from "@olai/surface"
import { pluginState } from "@olai/surface"

import { builtInDefault, setByServer } from "./instance.ts"

/** The rows to draw, in the order the build lists its plugins. A build with no
 *  plugins, and a page that has not heard from the server yet, both draw none —
 *  see `@olai/surface`'s `NO_ROSTER` for why those two are one value. */
export const pluginRows = (roster: PluginRoster): ReadonlyArray<BuiltPlugin> => roster.built

/**
 * WHAT THE ROW IN FORCE MEANS — five arms, and every one of them is a state of
 * the app rather than a setting of a switch.
 *
 * Running is the ordinary state and it is described in what a reader can SEE:
 * members on the wire, faces on screen, a property held to the kind the plugin
 * declares. Every other arm is TOTAL ABSENCE rather than a degraded mode — that
 * is what `--plugins` has always meant — and absence is the half worth spelling
 * out, because everything it costs is invisible: nothing is drawn, so nothing
 * looks broken, and a person hunting for a chip that is not there has no other
 * way to learn why.
 *
 * Each clause of the absent arms is a claim the code keeps (`@olai/plugin-api`'s
 * README): a plugin that is not composed serves no tag, never probes, registers
 * no dressing, mounts no chrome, and a value under a kind it declared is
 * validated as plain text, because `admits` is a promise only a plugin that is
 * here can make. The four absences differ in WHY, not in what they cost, so the
 * sentence about the cost is written once and each arm says its own why.
 *
 * `failed` is the one arm that is a FAULT — it was asked for, it is not here,
 * and nothing else on screen says so — and it is the one arm that carries words
 * that are not core's. The plugin's message is QUOTED and attributed; core
 * composes no clause of it, for the same reason the doorbell's three strings are
 * the plugin's. A throw with nothing to say is quoted as nothing rather than as
 * core's paraphrase of it.
 */
export const pluginHint = (plugin: BuiltPlugin): string => {
  const name = plugin.name
  switch (pluginState(plugin)) {
    case "running":
      return `${name} is running: its members are on the wire, it looks for its ` +
        `tool once per chat session, it draws its own faces, and a property ` +
        `declared with one of its kinds is held to it.`
    case "optIn":
      return `${name} is not running, which is total absence rather than a ` +
        `quiet mode: ${ABSENT} It is off because this build ships it off — ` +
        `it needs something this machine may not have — and nothing here is ` +
        `wrong.`
    case "failed":
      return `${name} was asked for and its start threw, so it is not ` +
        `running: ${ABSENT} ${quoted(plugin.fault)}`
    case "waiting":
      return `${name} was asked for and has not finished starting: ${ABSENT} ` +
        `It is waiting on something it needs, and it will draw nothing until ` +
        `it has it.`
    default:
      return `${name} is not running, which is total absence rather than a ` +
        `quiet mode: ${ABSENT} It is off because it was not asked for.`
  }
}

/** WHAT EVERY ABSENCE COSTS, written once — the four arms differ in why, and
 *  a reader is owed the same account of the cost in all of them. */
const ABSENT = `no member of it is served, it never looks for its tool, it ` +
  `draws nothing, and a property declared with one of its kinds is plain text.`

/** THE PLUGIN'S OWN SENTENCE, quoted and attributed — or the honest nothing. */
const quoted = (fault: string | undefined): string =>
  fault === undefined ? `It gave no message.` : `It said: “${fault}”.`

/**
 * WHO ASKED FOR THIS ROW — per row, because the answer is not the same for
 * every row under the same flag.
 *
 * Read off `pinned` and the row's own word together, which is the pairing that
 * keeps the panel honest: whether a row names a flag and what that flag says
 * are the same reading, so a browser cannot be drawn a default whose line
 * quotes a flag nobody gave.
 *
 * `--plugins=` — an empty value — is somebody saying NONE out loud, and it is
 * spelled as itself rather than described. It is a different answer from saying
 * nothing, and a row is Off in both cases: this line is the only place the two
 * are told apart.
 *
 * **THE OPT-IN ROW IS WHY THIS IS PER ROW.** Under no flag at all, one row's
 * built-in default is ON and its neighbour's is OFF — the second is a plugin
 * this build ships disabled because it needs a secret the machine may not have.
 * One line for the whole panel could only name one of those two defaults, and
 * the row a reader is actually looking at would be the other one. The line here
 * also names the flag VALUE that turns it on, which is the one screen in the
 * product that tells you what to type.
 */
export const pluginSetBy = (roster: PluginRoster, plugin: BuiltPlugin): string => {
  const pinned = roster.pinned
  if (pinned !== null) {
    return setByServer(
      pinned.length === 0
        ? "--plugins= — an empty value, which is none of them"
        : `--plugins=${pinned.join(",")}`,
    )
  }
  // NOBODY GAVE THE FLAG, so what is in force is the built-in default — and
  // which default that is, is the row's own.
  return pluginState(plugin) === "optIn"
    ? `Nobody gave --plugins, and this build ships ${plugin.name} off. ` +
      `--plugins=${plugin.name} is what turns it on. It is the instance's ` +
      `policy: the same in every browser, and it cannot be changed from one.`
    : builtInDefault("--plugins")
}
