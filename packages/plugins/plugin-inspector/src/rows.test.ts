import { PLUGIN_PREF } from "olai-plugin-plugin-inspector/testids"
import { pluginPref } from "olai-plugin-plugin-inspector/testids"


import { NO_ROSTER, type BuiltPlugin, type PluginRoster } from "@olai/surface"
import { expect, test } from "bun:test"

import {
  groupCount,
  NEEDS_YOU,
  pluginConfig,
  pluginConfirm,
  pluginGroups,
  pluginHint,
  pluginRows,
  pluginsStarted,
  rowCopy,
  pluginSwitch,
  THIS_VAULT,
} from "./rows.ts"



const roster = (
  running: ReadonlyArray<string>,
): PluginRoster => ({
  built: [
    { name: "alpha", running: running.includes("alpha") },
    { name: "beta", running: running.includes("beta") },
  ],
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
  carrying?: ReadonlyArray<string>,
): PluginRoster => ({
  built: [{
    name: "alpha",
    running: state === "running",
    state,
    ...(fault === undefined ? {} : { fault }),
    ...(missing === undefined ? {} : { missing }),
    ...(carrying === undefined ? {} : { carrying }),
  }],
})

/** That row, for the readings that take one. */
const only = (sent: PluginRoster) => sent.built[0]!

/**
 * A ROW PER PLUGIN THE BUILD HAS, not per plugin that is running — which is the
 * whole feature and the one thing a filter over the enabled ones could not do.
 * A plugin left out of the file’s row selection is absent from every structure the server
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
 * THE ORDINARY ROW SAYS NOTHING, and that is the fix rather than an omission.
 *
 * It said *Running — its chips, panels and delivered messages all work*, under a
 * switch reading On, on every running row. Six of those on one panel is the
 * control announcing itself six times, and it was most of what made this panel
 * a scroll (the human, 2026-09-04, with the screenshot: *portrait spammy*).
 *
 * ASSERTED AS AN ABSENCE, because that is how it comes back: not by anybody
 * arguing for the sentence again, but by an arm that needed a string for some
 * other reason quietly acquiring one.
 */
test("a running row with nothing to add draws no sentence at all", () => {
  const [alpha] = pluginRows(roster(["alpha"]))
  expect(pluginHint(alpha!)).toBe(null)
  // ...and a serve that sends the word explicitly is the same row.
  expect(pluginHint(only(row("running")))).toBe(null)
})

/**
 * ...AND THE ROWS THAT DO SAY SOMETHING SAY IT SHORT.
 *
 * A LENGTH BOUND, and it is a real assertion rather than a gesture: the arms
 * are one sentence each, and the way copy like this rots is one clause at a
 * time with nobody noticing until it is a paragraph again. The `failed` arm is
 * exempt because the plugin's own message rides on it and its length is not
 * core's to bound; so is `waiting`, whose list of doors is the serve's.
 */
test("every arm core writes in full is one short line", () => {
  const every = [
    pluginHint(only(row("optIn"))),
    pluginHint(only(row("off"))),
    pluginHint(only(row("waiting"))),
    pluginConfirm(only(row("running", undefined, undefined, ["kolu"]))),
  ]
  for (const said of every) {
    expect([said, said !== null && said.length < 100]).toEqual([said, true])
  }
})


test("each absence says its own why, and they are five different whys", () => {
  const optIn = row("optIn")
  const failed = row("failed", "no socket at /run/nothing")
  const waiting = row("waiting")
  const off = row("off")
  const switched = row("switched")

  expect(pluginHint(only(optIn))).toContain("by default")
  expect(pluginHint(only(off))).toContain("switch on here")
  expect(pluginHint(only(waiting))).toContain("waiting for something it needs")
  expect(pluginHint(only(failed))).toContain("Failed to start")
  expect(pluginHint(only(switched))).toContain("Switched off here")

  const said = [optIn, off, waiting, failed, switched].map((sent) => pluginHint(only(sent)))
  expect(new Set(said).size).toBe(5)
})


test("a session-switched row explains its lifetime", () => {
  const said = pluginHint(only(row("switched")))
  expect(said).toContain("restart")
  expect(said).not.toContain("--plugins")
  // ...and the switch beside it is still drawn and still pressable, because
  // pressing it is the undo.
  expect(pluginSwitch(only(row("switched")), false)).toEqual({ value: "off", frozen: false })
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


test("an absent row names its own word and what to type at boot", () => {
  const optIn = pluginHint(only(row("optIn")))
  expect(optIn).toContain("on: yes")

  const off = pluginHint(only(row("off")))
  expect(off).toContain("alpha")
  expect(off).toContain("on: yes")
  // sentence telling somebody to turn every other plugin off.
  expect(off).not.toContain("--plugins=")
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
  expect(pluginHint(only(row("hibernating")))).toContain("switch on here")
  // ...and a serve too old to send one at all is the same fallback, which is
  // exactly how this panel drew every row before the word existed.
  const old = roster(["alpha"])
  expect(pluginHint(old.built[0]!)).toBe(null)
  expect(pluginHint(old.built[1]!)).toContain("switch on here")
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
 * the ruling created: a policy selecting only kolu composes no chat row, so `deliveries` has
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
 * the names go, and it must not fall through to the `null` the ordinary running
 * row draws: a row that IS short of something and cannot say what still owes a
 * reader the first half.
 */
test("a wait with nothing named yet keeps the sentence it always had", () => {
  expect(pluginHint(only(row("waiting")))).toContain("waiting for something it needs")
  expect(pluginHint(only(row("waiting", undefined, [])))).toContain(
    "waiting for something it needs",
  )
})

/**
 * A ROW THAT CARRIES OTHERS NAMES THEM, and the moment that matters is the
 * moment before a press.
 *
 * The panel drew nothing about this while the rows were frozen, and correctly:
 * there was no press to warn about. There is one now, and the row a person is
 * most likely to press is the one everything else stands behind — chat, which
 * offers `agents`, `deliveries`, `watching` and the session-start door, and
 * whose Off leaves every engine and every tenant `waiting`. A switch that did
 * that with no warning would be the most expensive control in the product.
 *
 * IT IS THE OTHER END OF THE WAIT. The `waiting` arm names the DOORS a row is
 * short of; this names the ROWS that go short. Both are read live off the serve,
 * so neither can be the copy that rots.
 */
test("a running row that carries others names them", () => {
  const carrier = only(row("running", undefined, undefined, ["kolu", "odu"]))
  expect(pluginHint(carrier)).toBe(null)
  const said = pluginConfirm(carrier)
  expect(said).toContain("kolu, odu")
  // ...and it says what pressing Off would DO, which is the whole of why the
  // names are on screen rather than the fact that they exist.
  expect(said).toContain("Turning it off")
})

/**
 * ...AND A ROW THAT CARRIES NOBODY IS BACK TO SAYING NOTHING, which is most
 * rows.
 *
 * ABSENT AND EMPTY ARE ONE ANSWER here, deliberately unlike the `waiting` arm
 * two cases up. A `waiting` row with no `missing` is a settle still in flight —
 * it IS short of something and cannot yet say what — so that sentence has to
 * survive having no names. A `running` row with no `carrying` is a row nothing
 * depends on, which is a complete answer and the ordinary one.
 *
 * A serve too old to send the field lands here too, and correctly: silence
 * about what depends on what must not be drawn as a warning.
 */
test("a running row that carries nobody says nothing", () => {
  expect(pluginHint(only(row("running")))).toBe(null)
  expect(pluginHint(only(row("running", undefined, undefined, [])))).toBe(null)
})

/**
 * THE STRIP READS THE BOOLEAN, never the five-word state.
 *
 * `running` is the field the two ends have always agreed on and the one every
 * mount licence is read from. A strip showing On for `waiting` — asked for, not
 * arrived — would be a control claiming a fact the rest of the page is drawn
 * from the negation of. The WHY of an absence is the hint's job; the switch has
 * two words and answers the question it is asking.
 */
test("the switch shows what is running, not which of five mornings it is having", () => {
  expect(pluginSwitch(only(row("running")), false).value).toBe("on")
  for (const state of ["waiting", "failed", "optIn", "off"]) {
    expect([state, pluginSwitch(only(row(state)), false).value]).toEqual([state, "off"])
  }
})

/**
 * A FAILED ROW STILL DRAWS A SWITCH, and that is a ruling rather than a
 * leftover.
 *
 * Pressing On over a plugin whose `apply` died is the gesture for *try that
 * again* — the loader re-imports the module and re-runs the apply, which is the
 * only retry this product has. Hiding it there would leave the one row on the
 * panel that is a FAULT as the one row with nothing to do about it.
 */
test("a failed row is pressable, and its own message still rides on the hint", () => {
  const dead = only(row("failed", "no socket at /run/nothing"))
  expect(pluginSwitch(dead, false).frozen).toBe(false)
  expect(pluginSwitch(dead, false).value).toBe("off")
  expect(pluginHint(dead)).toContain("“no socket at /run/nothing”")
})

/**
 * FROZEN IS THIS TAB'S OWN REQUEST AND NOTHING ELSE — the distinction
 * `../commit/state.ts` draws for Commit and Push, kept here for the same
 * reason.
 *
 * The roster cannot stand in for it: the serve does not move the roster until
 * the bundle has SETTLED, so between the press and the settle the cell still
 * carries the value the strip already shows. Without this the strip would sit
 * there live, reading the old value, inviting the second press that starts a
 * second flip across the first.
 *
 * AND THE VALUE STAYS PUT while frozen, rather than jumping to what was
 * pressed: an optimistic strip is this tab asserting a fact it has not been
 * told, on the one panel whose whole job is to say what is actually running.
 */
test("a press freezes only that row's strip, and does not move it", () => {
  const live = only(row("running"))
  expect(pluginSwitch(live, false).frozen).toBe(false)
  expect(pluginSwitch(live, true).frozen).toBe(true)
  expect(pluginSwitch(live, true).value).toBe("on")
})


test("the foot names the file instead of retired startup flags", () => {
  for (const value of [roster(["alpha"]), roster(["alpha"]), roster([])]) {
    expect(pluginsStarted(value)).toContain("_olai/Settings.olai")
    expect(pluginsStarted(value)).not.toContain("--plugins")
  }
})

test("the foot names durable policy and private memory; session exceptions belong on rows", () => {
  const value = roster(["alpha"])
  const said = pluginsStarted(value)
  expect(said).toContain("_olai/Settings.olai")
  expect(said).toContain("travels with this directory")
  expect(said).toContain("LocalState")
  expect(said).not.toContain("session-only")
  expect(rowCopy({ name: "alpha", running: true, switchPersistence: "session" }, value)).toContain("session-only")
  expect(rowCopy({ name: "alpha", running: true, switchPersistence: "file" }, value)).toBe(null)
})


test("no row repeats what the panel says once", () => {
  const every = [
    pluginHint(only(row("running"))),
    pluginHint(only(row("running", undefined, undefined, ["kolu"]))),
    pluginHint(only(row("optIn"))),
    pluginHint(only(row("off"))),
    pluginHint(only(row("waiting", undefined, ["deliveries"]))),
    pluginHint(only(row("failed", "no socket"))),
  ]
  for (const said of every) {
    if (said === null) continue
    expect([said, said.includes("restart")]).toEqual([said, false])
    expect([said, said.includes("Started with")]).toEqual([said, false])
    // ...and none of them still claims a browser cannot change it, which is the
    // sentence they all used to end with (`../settings/instance.ts`, which the
    // git rows still use and still mean). It would come back not by being
    // rewritten but by a row going back to borrowing that helper, which reads
    // correct at the import and is false on screen.
    expect([said, said.includes("cannot be changed")]).toEqual([said, false])
  }
})

test("a row's config is pairs of the keys it carries, and nothing without one", () => {
  expect(pluginConfig({ name: "alpha", running: true })).toEqual([])
  expect(pluginConfig({
    name: "alpha",
    running: true,
    config: { commit: "auto", push: "off" },
  })).toEqual([
    ["commit", "auto"],
    ["push", "off"],
  ])
})

test("a structured policy is readable instead of an object placeholder", () => {
  expect(pluginConfig({ name: "alpha", running: true, config: { section: { interval: "1m" } } }))
    .toEqual([["section", '{"interval":"1m"}']])
})

/**
 * A PLUGIN THE VAULT DEFINES IS NOT A YAML SECTION. It has no `section` in
 * `olai.yml` because it is not in `olai.yml`. Presence of `source` is the
 * whole of the distinction, and the group is one word for every such row —
 * so a second definition does not invent a second heading, and a pending
 * one is Needs you rather than a silent neighbour of an approved one.
 */
test("vault-defined plugins are Defined here; pending ones are Needs you", () => {
  const defined = (
    name: string,
    state: "running" | "pending",
  ): BuiltPlugin => ({
    name,
    running: state === "running",
    state,
    source: {
      node: name,
      file: "plugins.olai",
      version: "v",
      approved: state === "running",
      server: "export {}",
    },
  })
  const sent: PluginRoster = {
    built: [
      { name: "alpha", running: true, state: "running" },
      defined("gamma", "running"),
      defined("delta", "pending"),
      { name: "beta", running: false, state: "failed", fault: "no" },
    ],
  }
  const look = (name: string) =>
    name === "alpha" || name === "beta" ? { section: "Conversation" } : {}
  const groups = pluginGroups(sent, look)
  expect(groups.map((group) => group.label)).toEqual([NEEDS_YOU, "Conversation", THIS_VAULT])
  expect(groups[0]!.rows.map((row) => row.name)).toEqual(["delta", "beta"])
  expect(groups[1]!.rows.map((row) => row.name)).toEqual(["alpha"])
  expect(groups[2]!.rows.map((row) => row.name)).toEqual(["gamma"])
  expect(groups[2]!.collapsed).toBe(false)
})

test("a quiet healthy group starts collapsed, and opt-in rows remain reachable", () => {
  const sent: PluginRoster = {
    built: [
      { name: "alpha", running: true, state: "running" },
      { name: "beta", running: false, state: "optIn" },
    ],
  }
  const look = (name: string) =>
    name === "alpha"
      ? { section: "Shell", quiet: true }
      : { section: "Fixtures", quiet: true, optIn: true }
  const groups = pluginGroups(sent, look)
  expect(groups.map((group) => group.label)).toEqual(["Shell", "Fixtures"])
  expect(groups[0]!.collapsed).toBe(true)
  expect(groupCount(groups[0]!.rows)).toBe("1 on")
})

test("a file-authored off state names the file that decided it", () => {
  expect(pluginHint({ name: "alpha", running: false, state: "off", desiredOn: false }, { built: [], configurationFile: "_olai/Settings.olai" }))
    .toBe("Off — _olai/Settings.olai says on: no.")
})


test("an absent configuration reader is one panel fact, not a caveat repeated on every row", () => {
  const absent: PluginRoster = { configurationAvailable: false, built: ["alpha", "beta"].map(name => ({
    name, running: true, switchPersistence: "session",
  })) }
  expect(pluginsStarted(absent)).toContain("Switches are session-only while the configuration reader is absent")
  for (const row of absent.built) expect(rowCopy(row, absent)).toBeNull()
  const present: PluginRoster = { ...absent, configurationAvailable: true }
  expect(pluginsStarted(present)).not.toContain("Switches are session-only")
  expect(rowCopy(present.built[0]!, present)).toContain("Switch is session-only")
})


import { environmentAtDefault } from "./rows.ts"
test("environment disclosure distinguishes wrapper defaults from explicit store paths", () => {
  const resource = { key: "EXECUTABLE", kind: "resource" as const, set: true, value: "/nix/store/operator/bin/tool", says: "the executable" }
  expect(environmentAtDefault(resource)).toBe(false)
  expect(environmentAtDefault({ ...resource, source: "wrapper" })).toBe(true)
  expect(environmentAtDefault({ ...resource, set: false })).toBe(true)
  expect(environmentAtDefault({ key: "TOKEN", kind: "secret", set: true, says: "credential" })).toBe(false)
  expect(environmentAtDefault({ key: "TOKEN", kind: "secret", set: false, says: "credential" })).toBe(true)
})
