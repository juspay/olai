import { declarationsOf, type Derived } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { RunNotice } from "olai-plugin-odu/appliance"
import type { CiRun } from "olai-plugin-odu/appliance/wire"
import { expect, test } from "bun:test"

import { bodyFor, claimedIn, claimingIn, coalesceOf, countsFor, type Claim } from "./doorbell.ts"
import { ownKinds, RUN_TYPE } from "./kinds.ts"

const rec = (
  id: string,
  title: string,
  fields: Record<string, string> = {},
): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

const marked = (
  id: string,
  title: string,
  mark: string,
  fields: Record<string, string> = {},
): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)},${
    JSON.stringify(mark)
  }:"2026-09-01T09:00:00.000Z"${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

const under = (
  id: string,
  parent: string,
  ord: string,
  title: string,
  mark: string,
  fields: Record<string, string> = {},
): string =>
  `{"id":${JSON.stringify(id)},"parent":${JSON.stringify(parent)},"ord":${JSON.stringify(ord)},"title":${
    JSON.stringify(title)
  },${JSON.stringify(mark)}:"2026-09-01T09:00:00.000Z"${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

const declaring = (key = "run"): string =>
  rec(`prop-${key}`, key, { type: RUN_TYPE })

const vaultOf = (files: Record<string, string>): { readonly derived: Derived } => ({
  derived: readingOf(setOf(files)).derived,
})

const claimsOf = (files: Record<string, string>, file: string) => {
  const { derived } = vaultOf(files)
  return claimedIn(declarationsOf(derived, ownKinds), derived, file)
}

const BOARD = {
  "_olai/Properties.olai": declaring(),
  "lanes.olai": [
    marked("lane-a", "the e2e lane", "doing", { run: "m1kb0e11-2c8d" }),
    marked("lane-b", "the docs lane", "doing", { run: "m1kb0e12-aaaa" }),
  ].join("\n"),
}

const row = (over: Partial<CiRun> = {}): CiRun => ({
  id: "m1kb0e11-2c8d",
  repoRoot: "/home/x/code/olai/.worktrees/a",
  name: "ci",
  sha7: "8f8fe56",
  dirty: false,
  seq: 2,
  state: "running",
  outcome: null,
  phase: "lanes",
  lanes: ["x86_64-linux=kolu-ci-9"],
  cells: [],
  ...over,
})

const RED_CELLS: CiRun["cells"] = [
  { id: "typecheck@x86_64-linux", name: "typecheck", platform: "x86_64-linux", status: "ok", hue: "green", glyph: "✔", red: false, startedAt: 100, ms: 12_000, attempt: 1, host: "h", logKey: "k:typecheck" },
  { id: "test@x86_64-linux", name: "test", platform: "x86_64-linux", status: "ok", hue: "green", glyph: "✔", red: false, startedAt: 100, ms: 60_000, attempt: 1, host: "h", logKey: "k:test" },
  { id: "e2e@x86_64-linux", name: "e2e", platform: "x86_64-linux", status: "failed", hue: "red", glyph: "✘", red: true, startedAt: 100, ms: 130_000, attempt: 1, host: "h", logKey: "k:e2e" },
  { id: "fmt-check@aarch64-darwin", name: "fmt-check", platform: "aarch64-darwin", status: "running", hue: "amber", glyph: "▶", red: false, startedAt: 100, ms: null, attempt: 1, host: null, logKey: "k:fmt" },
]

const firstRed = (cells: CiRun["cells"] = RED_CELLS): Extract<RunNotice, { kind: "first-red" }> => ({
  kind: "first-red",
  run: row({ cells }),
  cell: cells.find((cell) => cell.red) ?? (() => {
    throw new Error("a first-red bench without a red cell is not a bench")
  })(),
})

const repainted = (cell: CiRun["cells"][number], status: string): CiRun["cells"][number] => {
  const red = status === "failed" || status === "errored"
  return {
    ...cell,
    status,
    red,
    hue: red ? "red" : status === "ok" ? "green" : status === "running" ? "amber" : "grey",
    glyph: red ? "✘" : status === "ok" ? "✔" : status === "running" ? "▶" : "◦",
  }
}

const settled = (
  over: Partial<CiRun> = {},
  reddened: ReadonlyArray<string> = [],
): Extract<RunNotice, { kind: "settled" }> => ({
  kind: "settled",
  run: row({ cells: RED_CELLS.map((cell) => repainted(cell, "ok")), ...over }),
  reddened,
})

const CLAIM: Claim = { value: "m1kb0e11-2c8d", node: "lane-a", title: "the e2e lane", file: "lanes.olai" }

test("a file's un-done nodes claiming a run are the claimed set", () => {
  const claims = claimsOf(BOARD, "lanes.olai")
  expect(claims.map(({ value, node }) => ({ value, node }))).toEqual([
    { value: "m1kb0e11-2c8d", node: "lane-a" },
    { value: "m1kb0e12-aaaa", node: "lane-b" },
  ])
})

test("a mirrored lane claims through its TARGET", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a1","mirror":"lane-a"}`,
    "projects/the-thing/Records.olai": [
      marked("lane-a", "the e2e lane", "doing", { run: "m1kb0e11-2c8d" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([{
    value: "m1kb0e11-2c8d",
    node: "lane-a",
    title: "the e2e lane",
    file: "projects/the-thing/Records.olai",
  }])
})

test("a day-board mirror of a lane in another file claims through the target — both homes", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": rec("prop-run", "run", { type: "text" }),
    "orchestrator/lanes.olai": [
      rec("lanes", "Lanes"),
      rec("day-2026-09-01", "2026-09-01 day lanes"),
      `{"id":"day-mirror-nap","parent":"day-2026-09-01","ord":"a0","mirror":"node-agents-p1"}`,
      `{"id":"day-mirror-fsh","parent":"day-2026-09-01","ord":"aB","mirror":"flake-shakeout"}`,
    ].join("\n"),
    "projects/olai/roadmap/features.olai": marked(
      "node-agents-p1",
      "the agents roster",
      "doing",
      {
        "odu-run": "m1nap000-aaaa",
        "pr-url": "https://github.com/juspay/olai/pull/461",
      },
    ),
    "projects/olai/roadmap/infra.olai": marked("flake-shakeout", "the flake shakeout", "doing", {
      "odu-run": "m1fsh000-bbbb",
    }),
  }, "orchestrator/lanes.olai")
  expect(claims.map(({ value, node, file }) => ({ value, node, file }))).toEqual([
    {
      value: "m1nap000-aaaa",
      node: "node-agents-p1",
      file: "projects/olai/roadmap/features.olai",
    },
    {
      value: "m1fsh000-bbbb",
      node: "flake-shakeout",
      file: "projects/olai/roadmap/infra.olai",
    },
  ])
})

test("a DONE lane claims nothing — finishing the lane turns the doorbell off", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("lane-a", "the e2e lane", "done", { run: "m1kb0e11-2c8d" }),
  }, "lanes.olai")).toEqual([])
})

test("...and a CANCELLED lane claims nothing either — both marks end the wait", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("lane-a", "the e2e lane", "cancelled", { run: "m1kb0e11-2c8d" }),
  }, "lanes.olai")).toEqual([])
})

test("...and a BULLET nobody marked is not a task", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": rec("lane-a", "the e2e lane", { run: "m1kb0e11-2c8d" }),
  }, "lanes.olai")).toEqual([])
})

test("nothing declared ANYWHERE: the plugin's OWN key carries the claim", () => {
  expect(claimsOf({
    "lanes.olai": marked("lane-a", "the e2e lane", "doing", { "odu-run": "m1kb0e11-2c8d" }),
  }, "lanes.olai")).toEqual([{ value: "m1kb0e11-2c8d", node: "lane-a", title: "the e2e lane", file: "lanes.olai" }])
})

test("an UNDECLARED column claims nothing — the licence is the declaration", () => {
  expect(claimsOf({
    "lanes.olai": marked("lane-a", "the e2e lane", "doing", { worktree: ".worktrees/a" }),
  }, "lanes.olai")).toEqual([])
})

test("a settled CARRYING node under a live lane claims nothing", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane-a", "the e2e lane", "doing"),
      under("step-1", "lane-a", "a0", "fold the review", "done", { run: "m1kb0e11-2c8d" }),
    ].join("\n"),
  }, "lanes.olai")).toEqual([])
})

test("two rows naming ONE checkout coalesce into one claim, first writer wins", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane-a", "the e2e lane", "doing", { run: "m1kb0e11-2c8d" }),
      marked("lane-b", "a copied row", "doing", { run: "m1kb0e11-2c8d" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([{ value: "m1kb0e11-2c8d", node: "lane-a", title: "the e2e lane", file: "lanes.olai" }])
  expect(claimingIn(claims).get("m1kb0e11-2c8d")?.node).toBe("lane-a")
})

test("first-red names the lane, the node, and the counts so far", () => {
  const said = bodyFor(firstRed(), CLAIM, "2026-09-02T11:20:00.000Z", {
    total: 10,
    settled: 4,
    ok: 8,
    red: 1,
  })
  expect(said.split("\n")[0]).toContain("The e2e lane's CI went red on `lane-a`")
  expect(said).toContain("The e2e lane's CI went red")
  expect(said).not.toContain("the the")
  expect(said).toContain("`e2e@x86_64-linux` is the first red node of this run — 8/10 ok so far, 1 red.")
  expect(said).toContain("ci 8f8fe56#2")
  expect(said).toContain("live in /home/x/code/olai/.worktrees/a")
  expect(said).toContain("`lane-a`")
  expect(said).toContain("lanes.olai")
  expect(said).toContain("once per hold")
  expect(said).toContain("Written by olai's odu watcher at 2026-09-02 11:20 UTC, not by a person.")
  expect(said).toContain("Clearing the file on this conversation's wake control stops both.")
})

test("a mirrored claim's sentence names the TARGET's file, not the filter", () => {
  const claim: Claim = {
    value: "m1kb0e11-2c8d",
    node: "lane-a",
    title: "the e2e lane",
    file: "projects/the-thing/Records.olai",
  }
  const said = bodyFor(firstRed(), claim, "2026-09-02T11:20:00.000Z", {
    total: 10,
    settled: 4,
    ok: 8,
    red: 1,
  })
  expect(said).toContain("`lane-a` of projects/the-thing/Records.olai")
  expect(said).not.toContain("lanes.olai")
})

test("a settle with a green verdict comes out green, and names a rerun flake by name", () => {
  const said = bodyFor(settled({}, ["e2e@x86_64-linux"]), CLAIM, "2026-09-02T11:20:00.000Z")
  expect(said.split("\n")[0]).toContain("came out passed on `lane-a` — 4/4 ok.")
  expect(said).toContain("came out passed on `lane-a` — 4/4 ok.")
  expect(said).toContain("`e2e@x86_64-linux` went red earlier in this run and went green on a rerun")
})

test("a settle with a red verdict names each failed recipe WITH its log path", () => {
  const said = bodyFor(settled({
    cells: RED_CELLS.map((cell) => repainted(cell, cell.red || cell.status === "running" ? "failed" : "ok")),
  }), CLAIM, "2026-09-02T11:20:00.000Z")
  expect(said.split("\n")[0]).toContain("came out failed on `lane-a` — 2/4 ok, 2 red.")
  expect(said).toContain("`e2e@x86_64-linux`: failed — log `k:e2e`; odu logs --run m1kb0e11-2c8d e2e@x86_64-linux.")
  expect(said).toContain("`fmt-check@aarch64-darwin`: failed — log `k:fmt`; odu logs --run m1kb0e11-2c8d fmt-check@aarch64-darwin.")
})

test("a run that settled without deciding says `ended` — never `red`, and never `green`", () => {
  const said = bodyFor(settled({ cells: RED_CELLS.filter((cell) => !cell.red) }), CLAIM, "2026-09-02T11:20:00.000Z")
  expect(said.split("\n")[0]).toContain("came out incomplete on `lane-a`")
  expect(said).toContain("came out incomplete")
})

test("first-red's counts re-read the LIVE row where it is still this run's", () => {
  const notice = firstRed()
  const moved = RED_CELLS.map((cell) =>
    cell.id === "fmt-check@aarch64-darwin" ? { ...cell, status: "ok" } : cell
  )
  expect(countsFor([row({ cells: moved })], notice)).toEqual({ total: 4, settled: 4, ok: 3, red: 1 })
})

test("...and uses the notice's own frame where the row is someone else's now", () => {
  const notice = firstRed()
  const next = row({ id: "m1kb0e11-next", seq: 3, cells: [] })
  expect(countsFor([next], notice)).toEqual({ total: 4, settled: 3, ok: 2, red: 1 })
})

test("an unclaimed run rings nothing — silence, and silence means no call at all", () => {
  expect(claimingIn(claimsOf(BOARD, "lanes.olai")).has("never-heard-id")).toBe(false)
})

test("the coalesce key is per kind per run id", () => {
  const red = firstRed()
  expect(coalesceOf(red)).toBe("odu:first-red:m1kb0e11-2c8d")
  expect(coalesceOf(firstRed())).toBe(coalesceOf(red))
  expect(coalesceOf({ ...red, run: row({ id: "other-run1-xxxx", cells: RED_CELLS }) })).toBe(
    "odu:first-red:other-run1-xxxx",
  )
  expect(coalesceOf(settled())).toBe("odu:settled:m1kb0e11-2c8d")
})
