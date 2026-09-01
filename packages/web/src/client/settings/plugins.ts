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
 */

import type { BuiltPlugin, PluginRoster } from "@olai/surface"

import { builtInDefault, setByServer } from "./instance.ts"

/** The rows to draw, in the order the build lists its plugins. A build with no
 *  plugins, and a page that has not heard from the server yet, both draw none —
 *  see `@olai/surface`'s `NO_ROSTER` for why those two are one value. */
export const pluginRows = (roster: PluginRoster): ReadonlyArray<BuiltPlugin> => roster.built

/**
 * WHAT THE ROW IN FORCE MEANS — and the two arms are two states of the app,
 * not two settings of a switch.
 *
 * Running is the ordinary state and it is described in what a reader can SEE:
 * members on the wire, faces on screen, a property held to the kind the plugin
 * declares. Not running is TOTAL ABSENCE rather than a degraded arm — that is
 * what `--plugins` means, and it is the half worth spelling out, because
 * everything it costs is invisible: nothing is drawn, so nothing looks broken,
 * and a person hunting for a chip that is not there has no other way to learn
 * why.
 *
 * Each clause is a claim the code keeps (`@olai/plugin-api`'s README): a plugin
 * left out composes no sibling surface, so no tag of its is served; it never
 * probes, because the probe list is filtered before the chat is built; it
 * registers no dressing and mounts no chrome; and a value under a kind it
 * declared is validated as plain text, because `admits` is a promise only a
 * plugin that is here can make.
 */
export const pluginHint = (plugin: BuiltPlugin): string =>
  plugin.running
    ? `${plugin.name} is running: its members are on the wire, it looks for its ` +
      `tool once per chat session, it draws its own faces, and a property ` +
      `declared with one of its kinds is held to it.`
    : `${plugin.name} is not running, which is total absence rather than a ` +
      `quiet mode: no member of it is served, it never looks for its tool, it ` +
      `draws nothing, and a property declared with one of its kinds is plain ` +
      `text.`

/**
 * WHO SET THESE ROWS — one sentence for all of them, because one flag decides
 * all of them.
 *
 * Read off `pinned` rather than off the rows, which is the pairing that keeps
 * the panel honest: whether a row names a flag and what that flag says are the
 * same reading, so a browser cannot be drawn a default whose line quotes a flag
 * nobody gave.
 *
 * `--plugins=` — an empty value — is somebody saying NONE out loud, and it is
 * spelled as itself rather than described. It is a different answer from saying
 * nothing, and the row a reader is looking at is Off in both cases: the line
 * under it is the only place the two are told apart.
 */
export const pluginsSetBy = (roster: PluginRoster): string => {
  const pinned = roster.pinned
  if (pinned === null) return builtInDefault("--plugins")
  return setByServer(
    pinned.length === 0
      ? "--plugins= — an empty value, which is none of them"
      : `--plugins=${pinned.join(",")}`,
  )
}
