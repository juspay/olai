/**
 * WHAT THE SERVER'S PLUGIN POLICY DOES TO THE ROWS THAT READ IT.
 *
 * The rules are small and the reason they are a module at all is the reason the
 * git rows' are: a row's VALUE and the instance line under it are read off the
 * same cell, and asked separately a browser could be drawn a default whose line
 * quotes a flag nobody gave — a policy quietly not applying.
 *
 * There is no write half. `--plugins` is CLI/nix only, so these rows are always
 * the instance's and always frozen, and a unit test asks the readings with a
 * roster built by hand.
 *
 * **NO PLUGIN IS NAMED HERE EITHER.** The rosters below are built out of words
 * this file made up — `alpha`, `beta` — which is not a shortcut but the claim:
 * every one of these readings is a walk over what the cell carries, so a test
 * that had to spell a real plugin's name would be evidence that the panel does
 * too. It also means a third plugin, or a build with none, changes nothing
 * here.
 */

import { NO_ROSTER, type PluginRoster } from "@olai/surface"
import { expect, test } from "bun:test"

import { pluginHint, pluginRows, pluginsSetBy } from "./plugins.ts"
import { pluginPref, PLUGIN_PREF } from "../testids.ts"

/** A build with two plugins, and whichever of them this case is about running.
 *  `pinned` defaults to nobody having said, which is the ordinary serve. */
const roster = (
  running: ReadonlyArray<string>,
  pinned: ReadonlyArray<string> | null = null,
): PluginRoster => ({
  built: [
    { name: "alpha", running: running.includes("alpha") },
    { name: "beta", running: running.includes("beta") },
  ],
  pinned,
})

/**
 * A ROW PER PLUGIN THE BUILD HAS, not per plugin that is running — which is the
 * whole feature and the one thing a filter over the enabled ones could not do.
 * A plugin left out of `--plugins` is absent from every structure the server
 * holds, so the row saying so is the only place its absence is visible at all.
 */
test("every plugin the build has gets a row, running or not", () => {
  const rows = pluginRows(roster(["alpha"]))
  expect(rows.map((one) => one.name)).toEqual(["alpha", "beta"])
  expect(rows.map((one) => one.running)).toEqual([true, false])
})

/** Registry order, not sorted: the order a build lists its plugins in is the
 *  order `--help` names them in, and a panel that re-sorted would put the rows
 *  in an order nothing else in the product uses. */
test("the rows come in the order the server sent them", () => {
  const sent: PluginRoster = {
    built: [{ name: "zulu", running: true }, { name: "alpha", running: true }],
    pinned: null,
  }
  expect(pluginRows(sent).map((one) => one.name)).toEqual(["zulu", "alpha"])
})

/**
 * A page that has not heard, and a runtime that composes no plugins at all,
 * draw the same nothing — and it is deliberately not a set of rows saying
 * everything is off, which would flash "not running" at a serve that is running
 * them on its way to the truth.
 */
test("a page that has heard nothing draws no plugin rows", () => {
  expect(pluginRows(NO_ROSTER)).toEqual([])
})

/**
 * NOT RUNNING IS TOTAL ABSENCE, and the hint has to say so, because everything
 * it costs is invisible: nothing is drawn, so nothing looks broken, and a
 * person hunting for a face that is not there has no other way to find out why.
 * The row's Off is not a quiet mode of a thing that is still here.
 */
test("the hint says which state the app is in, and names the plugin", () => {
  const [alpha, beta] = pluginRows(roster(["alpha"]))
  expect(pluginHint(alpha!)).toContain("alpha")
  expect(pluginHint(alpha!)).toContain("is running")
  expect(pluginHint(beta!)).toContain("beta")
  expect(pluginHint(beta!)).toContain("is not running")
  // The four things an absent plugin costs, each of which is a claim the server
  // keeps: no member served, no probe, no face, and a value under its kind held
  // to nothing but text.
  expect(pluginHint(beta!)).toContain("no member of it is served")
  expect(pluginHint(beta!)).toContain("never looks for its tool")
  expect(pluginHint(beta!)).toContain("draws nothing")
  expect(pluginHint(beta!)).toContain("plain text")
})

/**
 * WHETHER A ROW NAMES A FLAG and WHAT IT SAYS are read off the one pin, so they
 * cannot come apart — the same pairing the git rows keep, and the same failure
 * it makes unspellable.
 */
test("a given flag is named with its value, and an omitted one is the default", () => {
  expect(pluginsSetBy(roster(["alpha", "beta"]))).toContain("built-in default")
  expect(pluginsSetBy(roster(["alpha", "beta"]))).not.toContain("--plugins=")
  // ...and the flag is still NAMED where nobody gave it, because the reader who
  // wants this changed needs the door even when there is no value to quote.
  expect(pluginsSetBy(roster(["alpha", "beta"]))).toContain("--plugins")

  const pinned = pluginsSetBy(roster(["alpha"], ["alpha"]))
  expect(pinned).toContain("--plugins=alpha")
  expect(pinned).not.toContain("built-in default")
})

/** A list is spelled the way it is typed — comma-separated, no spaces — so the
 *  line is something a reader can hand to whoever runs the instance verbatim. */
test("a multi-name flag is quoted as one word", () => {
  expect(pluginsSetBy(roster(["alpha", "beta"], ["alpha", "beta"])))
    .toContain("--plugins=alpha,beta")
})

/**
 * `--plugins=` IS NOT THE SAME ANSWER AS SAYING NOTHING, and the row cannot
 * tell them apart on its own: a strip reading Off looks identical whether
 * somebody said NONE out loud or left this one name out of a list. The line
 * under it is where the two are told apart, and it quotes the empty value as
 * itself rather than describing it — "no plugins" would name no flag a reader
 * could hand to whoever runs the instance.
 */
test("an empty flag is somebody saying none, and says so as itself", () => {
  const none = pluginsSetBy(roster([], []))
  expect(none).toContain("--plugins=")
  expect(none).toContain("none of them")
  expect(none).not.toContain("built-in default")
})

/** Every read-only row says the same two things — who set it, and that this
 *  browser cannot — because they are one doctrine (`./instance.ts`). A second
 *  copy of it is the copy somebody softens. */
test("both arms carry the instance doctrine", () => {
  const both = [
    pluginsSetBy(roster(["alpha", "beta"])),
    pluginsSetBy(roster(["alpha"], ["alpha"])),
  ]
  for (const said of both) {
    expect(said).toContain("instance's policy")
    expect(said).toContain("cannot be changed")
  }
})

/**
 * THE ROW'S HANDLE IS A GRAMMAR, not a name. A suite may not spell a plugin's
 * name any more than this client may, so it finds the rows by the prefix and
 * reads the names off the DOM — and the prefix is what keeps the rest of the
 * `data-pref` vocabulary a closed set a plugin cannot collide with.
 */
test("a plugin row is found by prefix, and cannot collide with a fixed row", () => {
  expect(pluginPref("alpha")).toBe("plugin-alpha")
  expect(pluginPref("done").startsWith(PLUGIN_PREF)).toBe(true)
  expect(pluginPref("done")).not.toBe("done")
})
