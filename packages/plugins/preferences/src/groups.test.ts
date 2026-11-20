import { expect, test } from "bun:test"
import type { Contribution } from "@olai/plugin-api"
import { groupsOf, runsOf, SCOPE_WORDS } from "./groups.ts"
import type { Scope, Section } from "./index.ts"

const at = (heading: Section["heading"], order: number, scope: Scope): Contribution<Section> =>
  ({ owner: "test", value: { heading, order, scope, body: () => null } })

const plugin = (name: string): Section["heading"] => ({ plugin: name, label: () => name })

test("fixed headings draw in table order, plugin headings after them by label", () => {
  const groups = groupsOf([
    at(plugin("mail"), 0, "shared"),
    at("notifications", 0, "browser"),
    at(plugin("git"), 0, "shared"),
    at("appearance", 0, "browser"),
    at("outlines", 0, "browser"),
  ])
  expect(groups.map((one) => one.key)).toEqual(["appearance", "outlines", "notifications", "git", "mail"])
  expect(groupsOf([])).toEqual([])
  expect(groupsOf([at("outlines", 1, "browser")]).map((one) => one.key)).toEqual(["outlines"])
})

test("a contribution's place is among its own heading's rows only", () => {
  const groups = groupsOf([
    at("notifications", 1, "browser"),
    at("notifications", 0, "browser"),
    at("appearance", 0, "browser"),
  ])
  expect(groups.map((one) => [one.key, one.entries.map((entry) => entry.value.order)])).toEqual([
    ["appearance", [0]],
    ["notifications", [0, 1]],
  ])
})

test("a heading's scope is read off its entries, and the strictest wins", () => {
  const groups = groupsOf([
    at(plugin("local"), 0, "browser"),
    at(plugin("mixed"), 0, "browser"),
    at(plugin("mixed"), 1, "shared"),
  ])
  expect(groups.map((one) => [one.key, one.scope])).toEqual([
    ["local", "browser"],
    ["mixed", "shared"],
  ])
})

test("one scope line closes a run of adjacent groups, and it is the run's", () => {
  const runs = runsOf(groupsOf([
    at("appearance", 0, "browser"),
    at("outlines", 0, "browser"),
    at("notifications", 0, "browser"),
    at(plugin("git"), 0, "shared"),
    at(plugin("mail"), 0, "shared"),
  ]))
  expect(runs.map((run) => [run.scope, run.groups.map((one) => one.key)])).toEqual([
    ["browser", ["appearance", "outlines", "notifications"]],
    ["shared", ["git", "mail"]],
  ])
  expect(runs.map((run) => SCOPE_WORDS[run.scope])).toEqual([
    "Saved in this browser only.",
    "Saved in Settings.olai, for everyone using this directory.",
  ])
})

test("a run of one group is a run, and runs follow draw order", () => {
  const runs = runsOf(groupsOf([at(plugin("git"), 0, "shared"), at("appearance", 0, "browser")]))
  expect(runs.map((run) => [run.scope, run.groups.length])).toEqual([["browser", 1], ["shared", 1]])
})
