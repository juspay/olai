/**
 * WHAT THE SERVER'S PLUGIN POLICY DOES TO THE ROWS THAT READ IT.
 *
 * The rules are small and the reason they are a module at all is the reason the
 * git rows' are: a row's VALUE and the sentence about it are read off the same
 * cell, and asked separately a browser could be drawn a default whose line
 * quotes a flag nobody gave — a policy quietly not applying.
 *
 * There IS a write half now (`plugins.set`, the human's ruling of 2026-09-04),
 * and it did not come in here: what a press does is `./Panel.tsx`'s, and what
 * this module holds is the decision that press is drawn from —
 * {@link pluginSwitch} — which is a function of one row and one boolean and is
 * asked here with both built by hand.
 *
 * **THE SHAPE OF THE PANEL IS A CLAIM, and half these cases are about it.** A
 * serve running six plugins drew the same two paragraphs under all eight rows;
 * what replaced it is a name and a switch per row, a sentence only where the row
 * has one, and one line at the foot. Every one of those is asserted, including
 * the ABSENCES — a running row saying nothing is the whole of the fix, and an
 * absence nothing tests is an absence that comes back.
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

import {
  pluginConfig,
  pluginHint,
  PLUGINS_SESSION_ONLY,
  pluginRows,
  pluginsStarted,
  pluginSwitch,
} from "./rows.ts"
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
    pluginHint(only(row("running", undefined, undefined, ["kolu"]))),
  ]
  for (const said of every) {
    expect([said, said !== null && said.length < 100]).toEqual([said, true])
  }
})

/**
 * THE FOUR ABSENCES ARE FOUR SENTENCES, and the boolean could only ever say
 * one of them.
 *
 * `running: false` covers the flag leaving it out, the BUILD leaving it out
 * until somebody asks, A PERSON SWITCHING IT OFF HERE, a start that died, and a
 * plugin still waiting on a service. All five cost exactly the same — total
 * absence — so the account of the cost is the same in each; what differs is the
 * WHY, which is the only thing a person can act on and the only thing the
 * boolean discarded.
 *
 * THE PRESS IS THE NEWEST OF THEM and is why the count moved from four. Absence
 * had two authors a serve could tell apart, the flag and the build; the switch
 * is a third, and until the serve learned to say so this row read `optIn` and
 * told a person who had just pressed the switch that the BUILD ships this off by
 * default, with a flag to go and type.
 */
test("each absence says its own why, and they are five different whys", () => {
  const optIn = row("optIn")
  const failed = row("failed", "no socket at /run/nothing")
  const waiting = row("waiting")
  const off = row("off")
  const switched = row("switched")

  expect(pluginHint(only(optIn))).toContain("by default")
  expect(pluginHint(only(off))).toContain("was not asked for")
  expect(pluginHint(only(waiting))).toContain("waiting for something it needs")
  expect(pluginHint(only(failed))).toContain("Failed to start")
  expect(pluginHint(only(switched))).toContain("Switched off here")

  // FIVE DISTINCT SENTENCES, asserted as a set rather than one at a time: the
  // way this collapses back is two arms drifting into one wording, which every
  // `toContain` above would still pass.
  const said = [optIn, off, waiting, failed, switched].map((sent) => pluginHint(only(sent)))
  expect(new Set(said).size).toBe(5)
})

/**
 * ...AND THE PRESS IS THE ONE ABSENCE THAT UNDOES ITSELF, which is the whole of
 * what its sentence has to add.
 *
 * The other three all send a reader somewhere else — a flag to type, a build to
 * rebuild, a plugin to compose. This one is answered by the switch beside the
 * sentence, so naming a flag here would be telling somebody to restart the
 * server to undo a press they can undo by pressing again. What it owes instead
 * is the fact a reader might not have: it does not survive the serve.
 */
test("a switched-off row names no flag, and says the press does not survive a restart", () => {
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

/**
 * THE TWO ABSENT-AT-BOOT ARMS NAME THIS ROW'S OWN WORD, which is what keeps
 * them from being the repetition this panel just lost.
 *
 * The switch starts a plugin NOW; the flag is how it comes back after a
 * restart, and that is the one thing on this panel that outlives the process.
 * Both arms therefore name what to type — and because both spell the ROW's
 * name, no two of these lines are the same line, which is exactly the test the
 * shared clause failed.
 *
 * THEY ARE TWO ARMS AND NOT ONE. `optIn` is this build shipping the plugin off
 * until somebody asks, and it is only reachable under NO flag — so
 * `--plugins=alpha` is the whole of what to type. `off` is a flag that was
 * given and did not name this row, so what to type is this name ADDED to a list
 * the panel's foot is already quoting.
 */
test("an absent row names its own word and what to type at boot", () => {
  const optIn = pluginHint(only(row("optIn")))
  expect(optIn).toContain("--plugins=alpha")

  const off = pluginHint(only(row("off")))
  expect(off).toContain("alpha")
  expect(off).toContain("--plugins")
  // ...and it does not quote a VALUE, which under a given flag would be a
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
  expect(pluginHint(only(row("hibernating")))).toContain("was not asked for")
  // ...and a serve too old to send one at all is the same fallback, which is
  // exactly how this panel drew every row before the word existed.
  const old = roster(["alpha"])
  expect(pluginHint(old.built[0]!)).toBe(null)
  expect(pluginHint(old.built[1]!)).toContain("was not asked for")
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
  const said = pluginHint(carrier)
  expect(said).toContain("kolu, odu")
  // ...and it says what pressing Off would DO, which is the whole reason the
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

/**
 * HOW THIS SERVE STARTED IS ONE LINE FOR THE PANEL, and used to be one per row.
 *
 * Under a given flag `pluginSetBy` answered the same string for every plugin —
 * the flag quoted in full, wrapped over three lines, eight times. The panel's
 * header called that an argument for having no panel-wide line, on the grounds
 * that every row already said it, which is a repetition noticed and then
 * defended. `pinned` is one value for the serve; the sentence about it is one
 * sentence for the serve.
 *
 * WHETHER A ROW NAMES A FLAG and WHAT IT SAYS are still the same reading, which
 * is what the pairing was always for: the line is read off the same `pinned`
 * the rows are, so the flag it quotes and the rows it sits under cannot come
 * from two different frames.
 */
test("a given flag is quoted once, and an omitted one is the built-in default", () => {
  const nobody = pluginsStarted(roster(["alpha", "beta"]))
  expect(nobody).toContain("built-in default")
  expect(nobody).not.toContain("--plugins=")
  // ...and the flag is still NAMED where nobody gave it, because the reader who
  // wants this changed needs the door even when there is no value to quote.
  expect(nobody).toContain("--plugins")

  const said = pluginsStarted(roster(["alpha"], ["alpha"]))
  expect(said).toContain("--plugins=alpha")
  expect(said).not.toContain("built-in default")
})

/** A list is spelled the way it is typed — comma-separated, no spaces — so the
 *  line is something a reader can hand to whoever runs the instance verbatim. */
test("a multi-name flag is quoted as one word", () => {
  expect(pluginsStarted(roster(["alpha", "beta"], ["alpha", "beta"])))
    .toContain("--plugins=alpha,beta")
})

/**
 * `--plugins=` IS NOT THE SAME ANSWER AS SAYING NOTHING, and the rows cannot
 * tell them apart on their own: every strip reads Off either way. This line is
 * where the two are told apart, and it quotes the empty value as itself rather
 * than describing it — "no plugins" would name no flag a reader could hand to
 * whoever runs the instance.
 */
test("an empty flag is somebody saying none, and says so as itself", () => {
  const none = pluginsStarted(roster([], []))
  expect(none).toContain("--plugins=")
  expect(none).toContain("none")
  expect(none).not.toContain("built-in default")
})

/**
 * ...AND IT SAYS HOW LONG A FLIP LASTS, which is the other half of the one
 * thing this panel owes a person before they close the tab.
 *
 * A change here is the running process's. A restart comes back to the flag or
 * the built-in defaults — which is the sentence beside it, in the same
 * paragraph, which is why they are one string.
 */
test("the panel says once that a flip does not survive a restart", () => {
  expect(PLUGINS_SESSION_ONLY).toContain("restart")
  expect(PLUGINS_SESSION_ONLY).toContain("as long as this server runs")
  expect(pluginsStarted(roster(["alpha"], ["alpha"]))).toContain(PLUGINS_SESSION_ONLY)
})

/**
 * NO ROW REPEATS THE PANEL'S LINE, which is the whole of what was wrong and
 * the thing that would come back first.
 *
 * Asserted over every state a row can be in, as an absence: the way this
 * regresses is one arm acquiring a clause about the flag or the restart because
 * it read well on that arm alone — which is exactly how eight identical
 * paragraphs happened the first time.
 */
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
