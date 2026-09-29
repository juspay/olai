/**
 * THE PANEL'S TWO READINGS, held as data — because the drawing is three lines
 * of JSX around them and the structure they produce is what the scope lines
 * hang on.
 *
 * WHAT THESE CANNOT REACH, said here rather than left to be discovered: whether
 * a run's line is *on screen* when every group of that run drew no row is the
 * browser's `:has([data-pref])` on the run's container, and no unit test in
 * this tree has a DOM (and no `.tsx` module can even be imported by one — bun
 * resolves the React runtime). So the claim covered here is the structural one
 * the rule depends on: THE LINE BELONGS TO THE RUN, a group carries none, and a
 * group whose body drew nothing is still a group of its run — which is why
 * hiding it cannot take the run's line with it. The nesting itself is asserted
 * in a real browser by `preferences/e2e/.../promoted_settings.feature`'s
 * `the preferences run that holds "…" carries one scope line`.
 */
import { expect, test } from "bun:test"
import type { Contribution } from "@olai/plugin-api"
import { groupsOf, runsOf } from "./groups.ts"
import { SCOPE_WORDS, type Scope, type Section } from "./index.ts"

/** One contribution whose body draws nothing: what this file is about is the
 *  structure, and a body that drew a row would change nothing about it. */
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
  // A heading nobody named is not a group, and neither is one whose
  // contributors have all gone: what is asked here is what was contributed.
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
  // DECLARED, never inferred from the shape of a heading: a plugin heading that
  // says `browser` draws with this browser's rows, and one whose entries
  // disagree draws as shared — the direction that cannot put a shared row under
  // the browser-only line.
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
  // THE LINE IS A PROPERTY OF THE RUN: the panel picks its words from
  // `run.scope`, so a group whose body drew nothing (hidden by CSS — every body
  // here draws nothing) takes its own drawing away and not its run's line.
  expect(runs.map((run) => SCOPE_WORDS[run.scope])).toEqual([
    "Saved in this browser only.",
    "Saved in Settings.olai, for everyone using this directory.",
  ])
})

test("a run of one group is a run, and runs follow draw order", () => {
  const runs = runsOf(groupsOf([at(plugin("git"), 0, "shared"), at("appearance", 0, "browser")]))
  // Browser-local groups draw first, so the browser run is the first run even
  // though the contribution that made the shared heading arrived first.
  expect(runs.map((run) => [run.scope, run.groups.length])).toEqual([["browser", 1], ["shared", 1]])
})
