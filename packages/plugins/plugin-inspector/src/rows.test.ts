import { TESTID } from "./testids.ts"
import { PLUGIN_PREF } from "olai-plugin-plugin-inspector/testids"
import { pluginPref } from "olai-plugin-plugin-inspector/testids"


import { NO_ROSTER, type BuiltPlugin, type PluginRoster } from "@olai/surface"
import type { PreferencesPanel } from "olai-plugin-preferences/contract"
import type { RowReport } from "@olai/plugin-api"
import { expect, test } from "bun:test"

import {
  CONDITION_TONE,
  CONDITION_WORDS,
  conditionSaid,
  displayName,
  environmentValue,
  groupCount,
  sentenceOf,
  NEEDS_YOU,
  pluginConfig,
  pluginFolder,
  pluginPage,
  pluginPageLabel,
  pluginConfirm,
  pluginGroups,
  pluginRows,
  pluginSwitch,
  rowCondition,
  THIS_VAULT,
} from "./rows.ts"

const pluginHint = (plugin: BuiltPlugin, reports?: ReadonlyMap<string, RowReport>): string | null => {
  const now = rowCondition(plugin, reports)
  return now === null ? null : conditionSaid(now)
}

const rowStatus = (plugin: BuiltPlugin, reports?: ReadonlyMap<string, RowReport>, needs = false): string | null => {
  const now = rowCondition(plugin, reports, needs)
  return now === null ? null : CONDITION_WORDS[now.kind]
}


const roster = (
  running: ReadonlyArray<string>,
): PluginRoster => ({
  built: [
    { name: "alpha", running: running.includes("alpha") },
    { name: "beta", running: running.includes("beta") },
  ],
})

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

const only = (sent: PluginRoster) => sent.built[0]!

test("every plugin the build has gets a row, running or not", () => {
  const rows = pluginRows(roster(["alpha"]))
  expect(rows.map((one) => one.name)).toEqual(["alpha", "beta"])
  expect(rows.map((one) => one.running)).toEqual([true, false])
})

test("the rows come in the order the server sent them", () => {
  const sent: PluginRoster = {
    built: [{ name: "zulu", running: true }, { name: "alpha", running: true }],
  }
  expect(pluginRows(sent).map((one) => one.name)).toEqual(["zulu", "alpha"])
})

test("a page that has heard nothing draws no plugin rows", () => {
  expect(pluginRows(NO_ROSTER)).toEqual([])
})

test("a running row with nothing to add draws no sentence at all", () => {
  const [alpha] = pluginRows(roster(["alpha"]))
  expect(pluginHint(alpha!)).toBe(null)
  expect(pluginHint(only(row("running")))).toBe(null)
})

test("every arm core writes in full is one short line", () => {
  const every = [
    pluginHint(only(row("optIn"))),
    pluginHint(only(row("off"))),
    pluginHint(only(row("waiting"))),
    pluginConfirm(only(row("running", undefined, undefined, ["kolu"]))),
  ]
  for (const said of every) {
    expect(said === null || said.length < 100).toBe(true)
  }
})


test("only failed and waiting rows explain their absence", () => {
  const optIn = row("optIn")
  const failed = row("failed", "no socket at /run/nothing")
  const waiting = row("waiting")
  const off = row("off")
  const switched = row("switched")

  expect(pluginHint(only(optIn))).toBeNull()
  expect(pluginHint(only(off))).toBeNull()
  expect(pluginHint(only(waiting))).toBe("Starting…")
  expect(pluginHint(only(failed))).toContain("Failed to start")
  expect(pluginHint(only(failed))).toContain("Switch it off and on to try again.")
  expect(pluginHint(only(switched))).toBeNull()

  const said = [optIn, off, waiting, failed, switched].map((sent) => pluginHint(only(sent)))
  expect(new Set(said).size).toBe(3)
})


test("a session-switched row has no prose and remains pressable", () => {
  const said = pluginHint(only(row("switched")))
  expect(said).toBeNull()
  expect(pluginSwitch(only(row("switched")), false)).toEqual({ value: "off", frozen: false })
})

test("a failed row quotes what the plugin said, or says it said nothing", () => {
  expect(pluginHint(only(row("failed", "no socket at /run/nothing"))))
    .toContain("“no socket at /run/nothing”")
  expect(pluginHint(only(row("failed")))).toContain("gave no message")
})


test("off, opt-in, switched and pending rows have no prose", () => {
  for (const state of ["off", "optIn", "switched", "pending"]) expect(pluginHint(only(row(state)))).toBeNull()
})

test("a state this tab has never heard of falls back to the boolean", () => {
  expect(pluginHint(only(row("hibernating")))).toBeNull()
  const old = roster(["alpha"])
  expect(pluginHint(old.built[0]!)).toBe(null)
  expect(pluginHint(old.built[1]!)).toBeNull()
})

test("a plugin row is found by prefix, and cannot collide with a fixed row", () => {
  expect(pluginPref("alpha")).toBe("plugin-alpha")
  expect(pluginPref("done").startsWith(PLUGIN_PREF)).toBe(true)
  expect(pluginPref("done")).not.toBe("done")
})

test("a waiting row names the services nobody is behind", () => {
  const waiting = only(row("waiting", undefined, ["deliveries"]))
  expect(pluginHint(waiting)).toContain("deliveries")
  const two = only(row("waiting", undefined, ["deliveries", "watching"]))
  expect(pluginHint(two)).toContain("deliveries, watching")
  expect(pluginHint(waiting)).toBe("Can't start: another plugin it needs isn't running (deliveries).")
})

test("a wait with nothing named yet keeps the sentence it always had", () => {
  expect(pluginHint(only(row("waiting")))).toBe("Starting…")
  expect(pluginHint(only(row("waiting", undefined, [])))).toBe("Starting…")
})

test("a running row that carries others names them", () => {
  const carrier = only(row("running", undefined, undefined, ["kolu", "odu"]))
  expect(pluginHint(carrier)).toBe(null)
  const said = pluginConfirm(carrier)
  expect(said).toContain("kolu, odu")
  expect(said).toContain("Turning it off")
  const labels: Record<string, string> = { kolu: "Kolu" }
  expect(pluginConfirm(carrier, (name) => ({ label: labels[name] }))).toBe("Turning it off also stops Kolu, odu.")
  expect(pluginConfirm(only(row("running")))).toBeNull()
  expect(pluginConfirm(only(row("running")), () => ({ switchHint: "Careful." }))).toBe("Careful.")
})

test("a running row that carries nobody says nothing", () => {
  expect(pluginHint(only(row("running")))).toBe(null)
  expect(pluginHint(only(row("running", undefined, undefined, [])))).toBe(null)
})

test("the switch shows what is running, independently of its absence reason", () => {
  expect(pluginSwitch(only(row("running")), false).value).toBe("on")
  for (const state of ["waiting", "failed", "optIn", "off"]) {
    expect([state, pluginSwitch(only(row(state)), false).value]).toEqual([state, "off"])
  }
})

test("a failed row is pressable, and its own message still rides on the hint", () => {
  const dead = only(row("failed", "no socket at /run/nothing"))
  expect(pluginSwitch(dead, false).frozen).toBe(false)
  expect(pluginSwitch(dead, false).value).toBe("off")
  expect(pluginHint(dead)).toContain("“no socket at /run/nothing”")
})

test("a press freezes only that row's strip, and does not move it", () => {
  const live = only(row("running"))
  expect(pluginSwitch(live, false).frozen).toBe(false)
  expect(pluginSwitch(live, true).frozen).toBe(true)
  expect(pluginSwitch(live, true).value).toBe("on")
})


test("session exceptions use the legend and never add row prose", () => {
  expect(pluginHint({ name: "alpha", running: true, switchPersistence: "session" })).toBeNull()
  expect(pluginHint({ name: "alpha", running: true, switchPersistence: "file" })).toBeNull()
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

test("vault-defined plugins are Your plugins; pending ones are Needs attention", () => {
  const defined = (
    name: string,
    state: "running" | "pending",
  ): BuiltPlugin => ({
    name,
    running: state === "running",
    state,
    source: {
      folder: `plugins/${name}/`,
      title: name,
      description: "",
      version: "v",
      approved: state === "running",
      on: true,
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
    name === "alpha" || name === "beta" ? { section: "Agents" } : {}
  const groups = pluginGroups(sent, look)
  expect(THIS_VAULT).toBe("Your plugins")
  expect(NEEDS_YOU).toBe("Needs attention")
  expect(groups.map((group) => group.label)).toEqual([NEEDS_YOU, "Agents", THIS_VAULT])
  expect(groups[0]!.rows.map((row) => row.name)).toEqual(["delta", "beta"])
  expect(groups[0]!.collapsed).toBe(false)
  expect(groups[1]!.rows.map((row) => row.name)).toEqual(["alpha"])
  expect(groups[2]!.rows.map((row) => row.name)).toEqual(["gamma"])
  expect(groups[1]!.collapsed).toBe(true)
  expect(groups[2]!.collapsed).toBe(true)
})

test("every ordinary group starts collapsed, and quiet groups sort last", () => {
  const sent: PluginRoster = {
    built: [
      { name: "shell", running: true, state: "running" },
      { name: "claude", running: true, state: "running" },
      { name: "codex", running: false, state: "off" },
    ],
  }
  const look = (name: string) =>
    name === "shell" ? { section: "Interface", quiet: true } : { section: "Agents" }
  const groups = pluginGroups(sent, look)
  expect(groups.map((group) => group.label)).toEqual(["Agents", "Interface"])
  expect(groups.every((group) => group.collapsed && !group.needs)).toBe(true)
  expect(groupCount(groups[0]!.rows)).toBe("1 on · 1 off")
  expect(groupCount(groups[1]!.rows)).toBe("1 on")
  expect(groupCount([{ name: "x", running: false }])).toBe("1 off")
})

test("a group of opt-in rows none of which runs is hidden until one runs", () => {
  const fixtures = (running: boolean): PluginRoster => ({
    built: [
      { name: "alpha", running: true, state: "running" },
      { name: "beta", running, state: running ? "running" : "optIn" },
      { name: "gamma", running: false, state: "optIn" },
    ],
  })
  const look = (name: string) =>
    name === "alpha"
      ? { section: "Interface", quiet: true }
      : { section: "Test fixtures", quiet: true, optIn: true }
  expect(pluginGroups(fixtures(false), look).map((group) => group.label)).toEqual(["Interface"])
  const shown = pluginGroups(fixtures(true), look)
  expect(shown.map((group) => group.label)).toEqual(["Interface", "Test fixtures"])
  expect(shown[1]!.rows.map((row) => row.name)).toEqual(["beta", "gamma"])
  expect(groupCount(shown[1]!.rows)).toBe("1 on · 1 off")
  const mixed = (name: string) => name === "gamma" ? { section: "Connections", optIn: true } : { section: "Connections" }
  expect(pluginGroups(fixtures(false), mixed).map((group) => group.label)).toEqual(["Connections"])
})

test("a row reads the build's label; vault-defined rows and unlabelled rows read their name", () => {
  const built: BuiltPlugin = { name: "claude", running: true }
  expect(displayName(built, { label: "Claude Code" })).toBe("Claude Code")
  expect(displayName(built)).toBe("claude")
  const defined: BuiltPlugin = {
    name: "local-tool",
    running: true,
    source: {
      folder: "plugins/local-tool/", title: "Local tool", description: "", version: "v",
      approved: true, on: true, server: "export {}",
    },
  }
  expect(displayName(defined, { label: "Ignored" })).toBe("local-tool")
})

test("a vault row says its folder and the address of its page; a built row says neither", () => {
  const built: BuiltPlugin = { name: "claude", running: true }
  expect(pluginPage(built)).toBeUndefined()
  expect(pluginFolder(built)).toBeUndefined()
  const defined: BuiltPlugin = {
    name: "hex-swatch",
    running: true,
    source: {
      folder: "plugins/hex-swatch/", title: "Hex swatch", description: "A colour chip in the margin.",
      version: "v1", approved: true, on: true, server: "export {}",
    },
  }
  expect(pluginFolder(defined)).toBe("plugins/hex-swatch/")
  expect(pluginPage(defined)).toBe("/plugins/hex-swatch")
  expect(pluginPageLabel).toBe("Open its page")
})

test("a row's short state is drawn only when it is not fine", () => {
  for (const state of ["running", "off", "optIn", "switched"]) {
    expect([state, rowStatus(only(row(state)))]).toEqual([state, null])
  }
  expect(rowStatus(only(row("failed", "no")))).toBe("Failed")
  expect(rowStatus(only(row("pending")))).toBe("Needs approval")
  expect(rowStatus(only(row("waiting")))).toBe("Starting…")
  expect(rowStatus(only(row("waiting", undefined, ["deliveries"])))).toBe("Can't start")
  const live = only(row("running"))
  expect(rowStatus(live, new Map([["alpha", { state: "failed", fault: "x" }]]))).toBe("Failed in this tab")
  expect(rowStatus(live, new Map([["alpha/extra", { state: "waiting" }]]))).toBe("Starting in this tab")
  expect(rowStatus(live, new Map([["alphabet", { state: "failed" }]]))).toBeNull()
  expect(rowStatus(live, new Map(), true)).toBe("Needs setup")
  const shell: BuiltPlugin = { name: "shell", running: true, state: "running", browserOnly: true }
  expect(rowStatus(shell)).toBeNull()
  expect(rowStatus(shell, new Map([["other", { state: "running" }]]))).toBe("Starting in this tab")
  expect(rowStatus(shell, new Map([["shell", { state: "running" }]]))).toBeNull()
})

test("an environment reading reads as a sentence and a secret says only whether it is set", () => {
  expect(sentenceOf("the executable")).toBe("The executable")
  expect(environmentValue({ key: "TOKEN", kind: "secret", set: true, says: "credential" })).toBe("set")
  expect(environmentValue({ key: "TOKEN", kind: "secret", set: false, says: "credential" })).toBe("unset")
  expect(environmentValue({ key: "EXE", kind: "resource", set: true, value: "/bin/x", says: "x" })).toBe("/bin/x")
  expect(environmentValue({ key: "EXE", kind: "resource", set: false, says: "x" })).toBe("unset")
})

test("only the rows whose own plugin asks for a person are filed under Needs you", () => {
  const sent = roster(["alpha", "beta"])
  const groups = pluginGroups(sent, () => ({}), new Map(), (name) => name === "beta")
  expect(groups.map((group) => group.label)).toEqual([NEEDS_YOU, "alpha"])
  expect(groups[0]!.rows.map((row) => row.name)).toEqual(["beta"])
  expect(groups[0]!.needs).toBe(true)
  expect(groups[0]!.collapsed).toBe(false)
  expect(groups.slice(1).flatMap((group) => group.rows.map((row) => row.name))).toEqual(["alpha"])
})

test("a build whose faces ask for nothing keeps the groups it always had", () => {
  const sent = roster(["alpha", "beta"])
  const absent = pluginGroups(sent, () => ({}))
  expect(absent.map((group) => group.label)).toEqual(["alpha", "beta"])
  const loaded = pluginGroups(sent, () => ({}), new Map(), () => false)
  expect(loaded.map((group) => group.label)).toEqual(["alpha", "beta"])
  expect(loaded.every((group) => !group.needs)).toBe(true)
})

test("a file-authored off state and session exceptions have no row sentence", () => {
  expect(pluginHint({ name: "alpha", running: false, state: "off", desiredOn: false })).toBeNull()
  expect(pluginHint({ name: "alpha", running: true, switchPersistence: "session" })).toBeNull()
})

import { environmentVisible } from "./rows.ts"
test("environment readings distinguish wrapper defaults from explicit store paths", () => {
  const resource = { key: "EXECUTABLE", kind: "resource" as const, set: true, value: "/nix/store/operator/bin/tool", says: "the executable" }
  expect(environmentVisible(resource)).toBe(true)
  expect(environmentVisible({ ...resource, source: "wrapper" })).toBe(false)
  expect(environmentVisible({ ...resource, set: false })).toBe(true)
  expect(environmentVisible({ key: "TOKEN", kind: "secret", set: true, says: "credential" })).toBe(true)
  expect(environmentVisible({ key: "TOKEN", kind: "secret", set: false, says: "credential" })).toBe(true)
})


test("inline knobs derive compact labels and widths without hiding defaults", async () => {
  const { knobLabel, knobWidth, knobUnit, knobAuthored, enableLabel } = await import("./rows.ts")
  expect(knobLabel("watch.held-for")).toBe("held")
  expect(knobLabel("login-header")).toBe("login")
  expect(knobUnit("idle-ms")).toBe("ms")
  const value = { key: "login-header", value: "X-User", setBy: "default" as const, says: "" }
  expect(knobWidth(value)).toBe("22ch")
  expect(knobWidth({ ...value, key: "watch.nag" })).toBe("6ch")
  expect(knobWidth({ ...value, control: { kind: "number", integer: true } })).toBe("9ch")
  expect(knobAuthored(value)).toBe(false)
  expect(knobAuthored({ ...value, setBy: "vault" })).toBe(true)
  expect(knobAuthored({ ...value, problem: { raw: "bad", why: "refused" } })).toBe(false)
  expect(enableLabel("example")).toBe("Enable example")
})

test("environment and old-serve readings have no editable control", async () => {
  const { controlOf } = await import("./rows.ts")
  expect(controlOf({ key: "TOKEN", kind: "secret", set: true, says: "credential" })).toBeUndefined()
  expect(controlOf({ key: "EXECUTABLE", kind: "resource", set: true, value: "/bin/example", says: "executable" })).toBeUndefined()
  expect(controlOf({ key: "old", value: "quiet", setBy: "default", says: "old serve" })).toBeUndefined()
})


test("inline controls replace summary and defaults identifiers", () => {
  expect(Object.values(TESTID)).toContain("plugin-knob")
  expect(Object.values(TESTID)).not.toContain("plugin-summary")
  expect(Object.values(TESTID)).not.toContain("plugin-defaults")
})

test("a row's condition is read once, and its words and tone are tables over it", () => {
  const live: BuiltPlugin = { name: "alpha", running: true, state: "running" }
  const failed = rowCondition(live, new Map<string, RowReport>([["alpha/panel", { state: "failed", fault: "no canvas" }], ["alpha", { state: "waiting" }]]))
  expect(failed?.kind).toBe("tabFailed")
  expect(CONDITION_WORDS.tabFailed).toBe("Failed in this tab")
  expect(CONDITION_TONE.tabFailed).toBe("alarm")
  expect(conditionSaid(failed!)).toBe("In this tab (panel): failed to start. no canvas In this tab: still starting.")
  expect(rowCondition(live, new Map<string, RowReport>([["alpha", { state: "waiting", missing: ["slots"] }]]))?.kind).toBe("tabStarting")
  expect(rowCondition({ ...live, browserOnly: true }, new Map<string, RowReport>([["beta", { state: "running" }]]))?.kind).toBe("tabStarting")
  expect(rowCondition({ ...live, browserOnly: true })).toBeNull()
  expect(rowCondition(live, new Map(), true)?.kind).toBe("setup")
  expect(conditionSaid({ kind: "setup" })).toBeNull()
  expect(rowCondition(only(row("waiting", undefined, ["deliveries"])))?.kind).toBe("blocked")
  expect(CONDITION_TONE[rowCondition(only(row("failed")))!.kind]).toBe("alarm")
})

const PANEL_UP: PreferencesPanel = { open: () => {} }

test("a promoted leaf leaves the row's controls only while Preferences can draw it", async () => {
  const { rowValues, promotedValues, promotingPlugins, rowSettings } = await import("./rows.ts")
  const git: BuiltPlugin = {
    name: "git", running: true, state: "running",
    configurationValues: [
      { key: "commit", value: "manual", setBy: "default", says: "when a write is recorded", preference: true },
      { key: "log", value: "on", setBy: "default", says: "keep a log" },
    ],
  }
  const there = PANEL_UP
  expect(promotedValues(rowValues(git)).map(one => one.key)).toEqual(["commit"])
  expect(promotingPlugins({ built: [git, { name: "kolu", running: true, state: "running" }] })).toEqual(["git"])
  expect(promotingPlugins({ built: [{ ...git, running: false, state: "off" }] })).toEqual([])
  expect(promotingPlugins({ built: [{ ...git, running: false, state: "pending" }] })).toEqual([])
  expect(rowSettings(git, there).knobs.map(one => one.key)).toEqual(["log"])
  expect(rowSettings(git, undefined).knobs.map(one => one.key)).toEqual(["commit", "log"])
  expect(rowSettings(git, there).link).toBe(true)
  expect(rowSettings(git, undefined).link).toBe(false)
  const promoted: BuiltPlugin = { ...git, configurationValues: [git.configurationValues![0]!] }
  expect(rowSettings(promoted, there).allAway).toBe(true)
  expect(rowSettings(git, there).allAway).toBe(false)
  expect(rowSettings(promoted, undefined).allAway).toBe(false)
  const plain: BuiltPlugin = { name: "kolu", running: true, state: "running",
    configurationValues: [{ key: "watch", value: "1m", setBy: "default", says: "how often" }] }
  expect(rowSettings(plain, there).knobs.map(one => one.key)).toEqual(["watch"])
  expect(rowSettings(plain, there)).toMatchObject({ link: false, allAway: false })
  expect(rowSettings({ ...git, running: false, state: "off" }, there).knobs.map(one => one.key)).toEqual(["commit", "log"])
  expect(promotedValues(rowValues({ name: "off", running: false, state: "off" }))).toEqual([])
})

test("a serve with no configuration values still shows its patch pairs", async () => {
  const { rowValues, rowSettings } = await import("./rows.ts")
  const there = PANEL_UP
  const patched: BuiltPlugin = { name: "kolu", running: true, state: "running", config: { "held-for": "2m", watch: "on" } }
  expect(rowValues(patched)).toEqual([
    { key: "held-for", value: "2m", setBy: "default", says: "" },
    { key: "watch", value: "on", setBy: "default", says: "" },
  ])
  expect(rowSettings(patched, there).knobs.map(one => one.key)).toEqual(["held-for", "watch"])
  expect(rowSettings(patched, there).link).toBe(false)
  expect(rowValues({ name: "tabs", running: true, state: "running" })).toEqual([])
})
