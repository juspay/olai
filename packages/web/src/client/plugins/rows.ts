/**
 * WHICH PLUGINS THIS SERVE RUNS, read as the plugins panel reads it.
 *
 * A plugin's enablement is not a preference. It is CLI/nix only — `--plugins`,
 * or the nix module that passes the same flag — with no settings file and no
 * browser toggle, so these rows draw the server's answer and are always
 * read-only. That is the git rows' arrangement exactly
 * (`../settings/policy.ts`), and it is deliberately the same one: the sentence
 * both lean on — who set this, and that a browser cannot — is
 * `../settings/instance.ts`, shared across the two panels because it is one
 * doctrine and a second copy is the copy somebody softens.
 *
 * **THE ROWS ARE A WALK, and this module spells no plugin's name.** What
 * arrives on the `plugins` cell is a row per plugin the BUILD has, each saying
 * whether this serve runs it — so a third plugin reaches this panel without a
 * line here or in `./Panel.tsx` moving, and nothing in `@olai/web` can be the
 * place a plugin's name is hardcoded. The fence one package over holds that as
 * an equality per package (`@olai/bundle`'s `fence.test.ts`); this module is
 * written so there is nothing for it to catch.
 *
 * **PURE FUNCTIONS OF THE CELL, and nothing else** — the shape `../settings/policy.ts`
 * keeps and for the same reason. There is no state here, no store, and no
 * subscription: the one reader is `./Panel.tsx`, which already holds the cell,
 * and a unit test asks these with a roster built by hand.
 *
 * ## TWO QUESTIONS PER ROW, and they were one
 *
 * A row used to draw one sentence off a boolean and share a second sentence
 * with every other row. That was exact while a plugin's presence was decided
 * once, by one flag, before anything ran. A plugin is a fiber now, and
 * `running: false` covers four different mornings — the flag left it out, the
 * BUILD leaves it out until somebody asks, its `apply` died, or it is waiting
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

import { builtInDefault, setByServer } from "../settings/instance.ts"

/** The rows to draw, in the order the build lists its plugins. A build with no
 *  plugins, and a page that has not heard from the server yet, both draw none —
 *  see `@olai/surface`'s `NO_ROSTER` for why those two are one value. */
export const pluginRows = (roster: PluginRoster): ReadonlyArray<BuiltPlugin> => roster.built

/**
 * WHAT THE ROW IN FORCE MEANS — one short line, and five of them.
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
 * ## What survives the cut, in every arm
 *
 * The WHY, because that is the whole reason the five words exist: `running:
 * false` used to be one sentence covering four different mornings, and a person
 * hunting for a chip that is not there can act on exactly one of them. And any
 * FLAG VALUE they would have to type, which is never cut — this is the one
 * screen in the product that tells you what to type.
 *
 * `failed` is the one arm that is a FAULT and the one that carries words that
 * are not core's: the plugin's own message, verbatim, because core composes no
 * clause of a plugin's failure prose. A throw with nothing to say says so.
 */
export const pluginHint = (plugin: BuiltPlugin): string => {
  switch (pluginState(plugin)) {
    case "running":
      return `Running — its chips, panels and chat messages all work.`
    case "optIn":
      return `Off by default — it needs something this machine may not have.`
    case "failed":
      return `Failed to start. ${said(plugin.fault)}`
    case "waiting":
      return `Starting — waiting for something it needs.`
    default:
      return `Off — it was not asked for. Nothing of it is drawn.`
  }
}

/** THE PLUGIN'S OWN SENTENCE, verbatim — or the honest nothing. */
const said = (fault: string | undefined): string =>
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
    // `--plugins=` is somebody saying NONE out loud, and it is spelled as
    // itself: a row is Off either way, and this line is the only place a
    // reader can tell that from nobody having said anything.
    return setByServer(pinned.length === 0 ? "--plugins= (none)" : `--plugins=${pinned.join(",")}`)
  }
  // NOBODY GAVE THE FLAG, so what is in force is the built-in default — and
  // which default that is, is the row's own. The opt-in row names the flag
  // VALUE that turns it on, which is the one thing on this panel a reader can
  // act on and is therefore the one thing the short copy keeps.
  return pluginState(plugin) === "optIn"
    ? `Server default: off. Turn it on with --plugins=${plugin.name}`
    : builtInDefault("--plugins")
}
