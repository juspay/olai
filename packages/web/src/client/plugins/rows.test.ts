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

import { pluginHint, pluginRows, pluginSetBy } from "./rows.ts"
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
 * ...and a build whose ONE row is in a named state — what a serve that sends
 * the word looks like.
 *
 * A separate helper rather than a third parameter on the one above, because
 * every case up there is about a serve that sends no word at all, which is both
 * the shape an older server has and the shape the narrowing falls back to. Two
 * helpers keep that reading honest: nothing here quietly starts sending a state
 * to the cases that are about not having one.
 */
const row = (
  state: string,
  fault?: string,
  missing?: ReadonlyArray<string>,
): PluginRoster => ({
  built: [{
    name: "alpha",
    running: state === "running",
    state,
    ...(fault === undefined ? {} : { fault }),
    ...(missing === undefined ? {} : { missing }),
  }],
  pinned: null,
})

/** That row, for the readings that take one. */
const only = (sent: PluginRoster) => sent.built[0]!

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
 * THE HINT SAYS WHICH STATE THE APP IS IN — running, or one of four absences —
 * and it says it SHORT.
 *
 * It used to recite the four things an absent plugin costs: no member served,
 * no probe, no face drawn, a value under its kind held to nothing but text.
 * Every clause was true and none of them was read (the human, 2026-09-02:
 * *users are not going to read novels*). The long account is in the code and
 * the docs now; what this holds is that the row still tells a reader WHICH
 * state it is in, which is the only part they can act on.
 *
 * A LENGTH BOUND, and it is a real assertion rather than a gesture: the arms
 * are one sentence each, and the way copy like this rots is one clause at a
 * time with nobody noticing until it is a paragraph again.
 */
test("the hint says which state the app is in, and stays one short line", () => {
  const [alpha, beta] = pluginRows(roster(["alpha"]))
  expect(pluginHint(alpha!)).toContain("Running")
  expect(pluginHint(beta!)).toContain("Off")
  // ...and neither is a paragraph. The failed arm is exempt from the bound
  // because the plugin's own message rides on it and its length is not core's
  // to bound (`./rows.ts`); every arm core writes in full is held here.
  for (const row of [alpha!, beta!]) {
    expect([row.name, pluginHint(row).length < 100]).toEqual([row.name, true])
  }
})

/**
 * WHETHER A ROW NAMES A FLAG and WHAT IT SAYS are read off the one pin, so they
 * cannot come apart — the same pairing the git rows keep, and the same failure
 * it makes unspellable.
 */
test("a given flag is named with its value, and an omitted one is the default", () => {
  const nobody = roster(["alpha", "beta"])
  expect(pluginSetBy(nobody, nobody.built[0]!)).toContain("built-in default")
  expect(pluginSetBy(nobody, nobody.built[0]!)).not.toContain("--plugins=")
  // ...and the flag is still NAMED where nobody gave it, because the reader who
  // wants this changed needs the door even when there is no value to quote.
  expect(pluginSetBy(nobody, nobody.built[0]!)).toContain("--plugins")

  const said = roster(["alpha"], ["alpha"])
  const pinned = pluginSetBy(said, said.built[0]!)
  expect(pinned).toContain("--plugins=alpha")
  expect(pinned).not.toContain("built-in default")
})

/** A list is spelled the way it is typed — comma-separated, no spaces — so the
 *  line is something a reader can hand to whoever runs the instance verbatim. */
test("a multi-name flag is quoted as one word", () => {
  const said = roster(["alpha", "beta"], ["alpha", "beta"])
  expect(pluginSetBy(said, said.built[0]!)).toContain("--plugins=alpha,beta")
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
  const said = roster([], [])
  const none = pluginSetBy(said, said.built[0]!)
  expect(none).toContain("--plugins=")
  expect(none).toContain("none")
  expect(none).not.toContain("default")
})

/** Every one of these lines is SHORT, for the reason the hints are: a line
 *  nobody reads is worth nothing however true it is. What it may never lose is
 *  the flag a reader would have to type, which the cases above hold. */
test("every arm is one short line", () => {
  const flagless = roster(["alpha", "beta"])
  const pinned = roster(["alpha"], ["alpha"])
  const optIn = row("optIn")
  const every = [
    pluginSetBy(flagless, flagless.built[0]!),
    pluginSetBy(pinned, pinned.built[0]!),
    pluginSetBy(optIn, only(optIn)),
  ]
  for (const said of every) expect([said, said.length < 80]).toEqual([said, true])
})

/**
 * THE FOUR ABSENCES ARE FOUR SENTENCES, and the boolean could only ever say
 * one of them.
 *
 * `running: false` covers the flag leaving it out, the BUILD leaving it out
 * until somebody asks, a start that died, and a plugin still waiting on a
 * service. All four cost exactly the same — total absence — so the account of
 * the cost is the same in each; what differs is the WHY, which is the only
 * thing a person can act on and the only thing the boolean discarded.
 */
test("each absence says its own why, and they are four different whys", () => {
  const optIn = row("optIn")
  const failed = row("failed", "no socket at /run/nothing")
  const waiting = row("waiting")
  const off = row("off")

  expect(pluginHint(only(optIn))).toContain("Off by default")
  expect(pluginHint(only(off))).toContain("was not asked for")
  expect(pluginHint(only(waiting))).toContain("waiting for something it needs")
  expect(pluginHint(only(failed))).toContain("Failed to start")

  // FOUR DISTINCT SENTENCES, asserted as a set rather than one at a time: the
  // way this collapses back is two arms drifting into one wording, which every
  // `toContain` above would still pass.
  const said = [optIn, off, waiting, failed].map((sent) => pluginHint(only(sent)))
  expect(new Set(said).size).toBe(4)
})

/**
 * THE PLUGIN'S OWN WORDS, QUOTED — core composes no clause of them, which is
 * the rule the doorbell's three strings already keep.
 *
 * A start that died is the one arm that is a FAULT rather than a policy, and
 * it is the one arm where the useful half of the sentence is not core's to
 * write. A throw with nothing to say is quoted as nothing rather than as core's
 * paraphrase of it — `String(reason)` on a bare `Error` would put the word
 * "Error" on screen as if the plugin had said it.
 */
test("a failed row quotes what the plugin said, or says it said nothing", () => {
  expect(pluginHint(only(row("failed", "no socket at /run/nothing"))))
    .toContain("“no socket at /run/nothing”")
  expect(pluginHint(only(row("failed")))).toContain("gave no message")
})

/**
 * THE OPT-IN ROW IS WHY THE LINE IS PER ROW.
 *
 * Under no flag at all, one row's built-in default is ON and its neighbour's is
 * OFF. One line for the whole panel could name only one of those two defaults,
 * and the row a reader is looking at would be the other one. The opt-in row
 * also names the flag VALUE that turns it on, because this is the one screen in
 * the product that tells you what to type.
 */
test("an opt-in row names its own default and the flag that changes it", () => {
  const sent = row("optIn")
  const said = pluginSetBy(sent, only(sent))
  expect(said).toContain("off")
  // THE ONE THING THE SHORT COPY MAY NEVER CUT. Everything else on this panel
  // is a fact; this is the only actionable thing on it, and it is exact enough
  // to type.
  expect(said).toContain("--plugins=alpha")
  // ...and its neighbour under the same absent flag says the opposite default,
  // which is the whole reason this is not one line for the panel.
  const ordinary = roster(["alpha", "beta"])
  expect(pluginSetBy(ordinary, ordinary.built[0]!)).not.toContain("--plugins=alpha")
})

/**
 * A WORD THIS BUILD DOES NOT KNOW DRAWS THE ROW THE OLD WAY, rather than a
 * blank or a lie.
 *
 * The state travels as a plain optional string so that neither an older serve
 * (which sends none) nor a newer one (which may name a sixth) can fail the
 * roster's DECODE — and a roster that fails to decode takes every plugin's
 * mount down, not this row's. `@olai/surface`'s `pluginState` is where that
 * narrowing happens; this case is the panel's half of it.
 */
test("a state this tab has never heard of falls back to the boolean", () => {
  expect(pluginHint(only(row("hibernating")))).toContain("was not asked for")
  // ...and a serve too old to send one at all is the same fallback, which is
  // exactly how this panel drew every row before the word existed.
  const old = roster(["alpha"])
  expect(pluginHint(old.built[0]!)).toContain("Running")
  expect(pluginHint(old.built[1]!)).toContain("Off")
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

/**
 * A WAIT NAMES WHAT IT IS WAITING FOR, which is the half of `waiting` a person
 * can act on.
 *
 * The reading has had it all along — a PENDING fiber knows which tags nobody is
 * behind (`@olai/effect-cordis`'s `rowReport`) — and every wall between there
 * and here dropped it, so the panel said *waiting for something it needs* about
 * a serve whose whole answer was one word. It matters most in exactly the serve
 * the ruling created: `--plugins=kolu` composes no chat row, so `deliveries` has
 * nobody behind it, and what a person needs told is that word and not that
 * something is wrong.
 *
 * NAMING THE DOOR IS NAMING THE PLUGIN, one step removed: a service is offered
 * by a row, so "waiting for deliveries" is "compose the row that offers it".
 * That step is a person's to take, and this line is what lets them.
 */
test("a waiting row names the services nobody is behind", () => {
  const waiting = only(row("waiting", undefined, ["deliveries"]))
  expect(pluginHint(waiting)).toContain("deliveries")
  // ONE OR SEVERAL, because the sentence has to read either way: a row that
  // named two doors is short of two, and `it` would be wrong about both.
  const two = only(row("waiting", undefined, ["deliveries", "watching"]))
  expect(pluginHint(two)).toContain("deliveries, watching")
  expect(pluginHint(two)).toContain("them")
  expect(pluginHint(waiting)).toContain("it")
})

/**
 * ...AND A WAIT THAT NAMES NOTHING STILL SAYS SO, which is not the same as
 * saying nothing.
 *
 * A fiber can be PENDING with no tag named yet — a settle still in flight — and
 * the honest line there is the old one. An empty list is that case and not a
 * row waiting on nobody, so it must not compose a sentence with a hole where
 * the names go.
 */
test("a wait with nothing named yet keeps the sentence it always had", () => {
  expect(pluginHint(only(row("waiting")))).toContain("waiting for something it needs")
  expect(pluginHint(only(row("waiting", undefined, [])))).toContain(
    "waiting for something it needs",
  )
})
