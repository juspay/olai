/**
 * THE DOORBELL'S OWN BENCH — which runs a scoped file claims, the joining
 * rules, and the sentence each kind arrives as.
 *
 * `olai-plugin-kolu`'s `./doorbell.test.ts` is the pattern, verbatim: every
 * case is a WHOLE VAULT built out of JSONL the real parser accepts, folded
 * through the same declaration fold `./server.ts` runs. Nothing here needs a
 * dial or a clock: notices are hand-built rows, and the classification is a
 * pure function of a vault and a value.
 *
 * WHAT IS PINNED: a lane the file carries claims its run's notices; a
 * mirrored lane claims through the target; a DONE lane claims nothing; an
 * undeclared column claims nothing; an unclaimed run rings NOTHING at all
 * (spelled as what it is: the absence of a call); first-red's counts are the
 * FRESH reading where the row is still this run's; and a red settle carries
 * every failed recipe with its log path, while a flaked-then-green node is
 * named as what it was.
 */

import { declarationsOf, type Derived } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { RunNotice } from "@olai/odu-client"
import type { CiRun } from "@olai/odu-client/wire"
import { expect, test } from "bun:test"

import { bodyFor, claimedIn, claimingIn, coalesceOf, countsFor, type Claim } from "./doorbell.ts"
import { ownKinds, WORKTREE_TYPE } from "./kinds.ts"

// ── The vault, as the neighbouring suites build one ──────────────────────

/** One record, as a file writes it. */
const rec = (
  id: string,
  title: string,
  fields: Record<string, string> = {},
): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

/** The same, wearing a mark. */
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

/** A record with a PARENT and its own ord — for the one case about a settled
 *  node UNDER a live lane, the shape the coalescing bug was found in: a
 *  subtree. */
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

/** The declarations file, saying what a key is. A declaration is read from
 *  `_olai/Properties.olai` and from nowhere else — a `prop-*` row parked in
 *  the board file itself is prose, which is the mistake this helper exists
 *  once against. */
const declaring = (key = "worktree"): string =>
  rec(`prop-${key}`, key, { type: WORKTREE_TYPE })

/** The declaration fold `./server.ts` runs, over the whole vault. */
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
    marked("lane-a", "the e2e lane", "doing", { worktree: ".worktrees/a" }),
    marked("lane-b", "the docs lane", "doing", { worktree: ".worktrees/b" }),
  ].join("\n"),
}

// ── The notices, as `@olai/odu-client` hands them over ───────────────────

/** A RUN ROW with only the fields this module reads, honestly. */
const row = (over: Partial<CiRun> = {}): CiRun => ({
  id: ".worktrees/a",
  at: "/home/x/code/odu/.worktrees/a",
  live: true,
  name: "ci",
  sha7: "8f8fe56",
  dirty: false,
  seq: 2,
  phase: "lanes",
  lanes: ["x86_64-linux=kolu-ci-9"],
  cells: [],
  ...over,
})

const RED_CELLS: CiRun["cells"] = [
  { id: "typecheck@x86_64-linux", name: "typecheck", platform: "x86_64-linux", status: "ok", hue: "green", glyph: "✔", red: false, startedAt: 100, ms: 12_000 },
  { id: "test@x86_64-linux", name: "test", platform: "x86_64-linux", status: "ok", hue: "green", glyph: "✔", red: false, startedAt: 100, ms: 60_000 },
  { id: "e2e@x86_64-linux", name: "e2e", platform: "x86_64-linux", status: "failed", hue: "red", glyph: "✘", red: true, startedAt: 100, ms: 130_000 },
  { id: "fmt-check@aarch64-darwin", name: "fmt-check", platform: "aarch64-darwin", status: "running", hue: "amber", glyph: "▶", red: false, startedAt: 100, ms: null },
]

const firstRed = (cells: CiRun["cells"] = RED_CELLS): Extract<RunNotice, { kind: "first-red" }> => ({
  kind: "first-red",
  run: row({ cells }),
  cell: cells.find((cell) => cell.red) ?? (() => {
    throw new Error("a first-red bench without a red cell is not a bench")
  })(),
})

/** The same cell wearing another status — the fold a real coordinator's own
 *  status table would have run: the word, the ink, and the RED FLAG move
 *  together, because the wire carries them as one reading and never three.
 *  A bench that flips the word and leaves the flag over is a bench whose
 *  verdict fold answers a question nobody asked it. */
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
  run: row({ live: false, cells: RED_CELLS.map((cell) => repainted(cell, "ok")), ...over }),
  reddened,
})

const CLAIM: Claim = { value: ".worktrees/a", node: "lane-a", title: "the e2e lane", file: "lanes.olai" }

// ── The claimed set ──────────────────────────────────────────────────────

test("a file's un-done nodes claiming a worktree are the claimed set", () => {
  const claims = claimsOf(BOARD, "lanes.olai")
  expect(claims.map(({ value, node }) => ({ value, node }))).toEqual([
    { value: ".worktrees/a", node: "lane-a" },
    { value: ".worktrees/b", node: "lane-b" },
  ])
})

test("a mirrored lane claims through its TARGET", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a1","mirror":"lane-a"}`,
    "projects/the-thing/Records.olai": [
      marked("lane-a", "the e2e lane", "doing", { worktree: ".worktrees/a" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([{
    value: ".worktrees/a",
    node: "lane-a",
    title: "the e2e lane",
    file: "projects/the-thing/Records.olai",
  }])
})

test("a DONE lane claims nothing — finishing the lane turns the doorbell off", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("lane-a", "the e2e lane", "done", { worktree: ".worktrees/a" }),
  }, "lanes.olai")).toEqual([])
})

test("...and a CANCELLED lane claims nothing either — both marks end the wait", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("lane-a", "the e2e lane", "cancelled", { worktree: ".worktrees/a" }),
  }, "lanes.olai")).toEqual([])
})

test("...and a BULLET nobody marked is not a task", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": rec("lane-a", "the e2e lane", { worktree: ".worktrees/a" }),
  }, "lanes.olai")).toEqual([])
})

test("nothing declared ANYWHERE: the plugin's OWN key carries the claim", () => {
  // The other layer of the same license, and the one an out-of-the-box board
  // exercises: an enabled odu claims the key `odu-worktree` by convention,
  // so a vault that has said nothing at all is heard on it.
  expect(claimsOf({
    "lanes.olai": marked("lane-a", "the e2e lane", "doing", { "odu-worktree": ".worktrees/a" }),
  }, "lanes.olai")).toEqual([{ value: ".worktrees/a", node: "lane-a", title: "the e2e lane", file: "lanes.olai" }])
})

test("an UNDECLARED column claims nothing — the licence is the declaration", () => {
  // The key's own spelling is `worktree`, and that is never read: no row
  // asked for a face, so the probe and the doorbell both let it sleep.
  expect(claimsOf({
    "lanes.olai": marked("lane-a", "the e2e lane", "doing", { worktree: ".worktrees/a" }),
  }, "lanes.olai")).toEqual([])
})

test("a settled CARRYING node under a live lane claims nothing", () => {
  expect(claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane-a", "the e2e lane", "doing"),
      under("step-1", "lane-a", "a0", "fold the review", "done", { worktree: ".worktrees/a" }),
    ].join("\n"),
  }, "lanes.olai")).toEqual([])
})

// ── The join ─────────────────────────────────────────────────────────────

test("two rows naming ONE checkout coalesce into one claim, first writer wins", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane-a", "the e2e lane", "doing", { worktree: ".worktrees/a" }),
      marked("lane-b", "a copied row", "doing", { worktree: ".worktrees/a" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([{ value: ".worktrees/a", node: "lane-a", title: "the e2e lane", file: "lanes.olai" }])
  expect(claimingIn(claims).get(".worktrees/a")?.node).toBe("lane-a")
})

// ── The sentences ────────────────────────────────────────────────────────

test("first-red names the lane, the node, and the counts so far", () => {
  const said = bodyFor(firstRed(), CLAIM, "2026-09-02T11:20:00.000Z", {
    total: 10,
    settled: 4,
    ok: 8,
    red: 1,
  })
  expect(said.split("\n")[0]).toContain("The e2e lane's CI went red on `lane-a`")
  expect(said).toContain("The e2e lane's CI went red")
  // The lane's own title VERBATIM, once — the wrap that would spell
  // "the the e2e lane lane" is the regression this pin keeps out.
  expect(said).not.toContain("the the")
  expect(said).toContain("`e2e@x86_64-linux` is the first red node of this run — 8/10 ok so far, 1 red.")
  expect(said).toContain("ci 8f8fe56#2")
  expect(said).toContain("live in /home/x/code/odu/.worktrees/a")
  expect(said).toContain("`lane-a`")
  expect(said).toContain("lanes.olai")
  expect(said).toContain("once per hold")
  expect(said).toContain("Written by olai's odu watcher at 2026-09-02 11:20 UTC, not by a person.")
  expect(said).toContain("Clearing the file on this conversation's wake control stops both.")
})

test("a mirrored claim's sentence names the TARGET's file, not the filter", () => {
  const claim: Claim = {
    value: ".worktrees/a",
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
  expect(said.split("\n")[0]).toContain("came out green on `lane-a` — 4/4 ok.")
  expect(said).toContain("came out green on `lane-a` — 4/4 ok.")
  // The flake is named as WHAT the hold observed, not why.
  expect(said).toContain("`e2e@x86_64-linux` went red earlier in this run and went green on a rerun")
})

test("a settle with a red verdict names each failed recipe WITH its log path", () => {
  const said = bodyFor(settled({
    // The two still going when the first red landed both failed in the end;
    // the paint moves WITH the word, the way a real frame's fold would have it.
    cells: RED_CELLS.map((cell) => repainted(cell, cell.red || cell.status === "running" ? "failed" : "ok")),
  }), CLAIM, "2026-09-02T11:20:00.000Z")
  expect(said.split("\n")[0]).toContain("came out red on `lane-a` — 2/4 ok, 2 red.")
  expect(said).toContain("`e2e@x86_64-linux`: failed — the log is at /home/x/code/odu/.worktrees/a/.ci/8f8fe56/x86_64-linux/e2e.log.")
  expect(said).toContain("`fmt-check@aarch64-darwin`: failed — the log is at /home/x/code/odu/.worktrees/a/.ci/8f8fe56/aarch64-darwin/fmt-check.log.")
})

test("a run that settled without deciding says `ended` — never `red`, and never `green`", () => {
  // The one status in this suite with a person behind it: an odu that died
  // mid-run did not decide anything, and the wake says so in the vocabulary
  // the chip's own bench assures (odu's `errored` is for INFRASTRUCTURE,
  // and conflating the two is the one mis-report this doorbell exists not
  // to make).
  const said = bodyFor(settled({ cells: RED_CELLS.filter((cell) => !cell.red) }), CLAIM, "2026-09-02T11:20:00.000Z")
  expect(said.split("\n")[0]).toContain("ended without deciding on `lane-a`")
  expect(said).toContain("ended without deciding")
})

test("first-red's counts re-read the LIVE row where it is still this run's", () => {
  // `countsFor` IS the tally: asking it of a row whose cells moved further
  // than the firing frame's says "so far" of the wake's delivery moment.
  const notice = firstRed()
  const moved = RED_CELLS.map((cell) =>
    cell.id === "fmt-check@aarch64-darwin" ? { ...cell, status: "ok" } : cell
  )
  expect(countsFor([row({ cells: moved })], notice)).toEqual({ total: 4, settled: 4, ok: 3, red: 1 })
})

test("...and uses the notice's own frame where the row is someone else's now", () => {
  // A run to the same worktree settled before this body entered the
  // conversation, and the row was re-opened by a NEW run — quiet arithmetic
  // would otherwise add the fresh run's counts to an older wake.
  const notice = firstRed()
  const next = row({ seq: 3, cells: [] })
  expect(countsFor([next], notice)).toEqual({ total: 4, settled: 3, ok: 2, red: 1 })
})

test("an unclaimed run rings nothing — silence, and silence means no call at all", () => {
  // The dispatch dropped the drift arm on purpose: the test is not the
  // absence of a delivery here (that is `server.ts`'s loop's word), it is
  // that there is no fourth arm in this module at all.
  expect(claimingIn(claimsOf(BOARD, "lanes.olai")).has(".worktrees/never-heard")).toBe(false)
})

test("the coalesce key is per kind per run, not per worktree", () => {
  // CiRun.id is the worktree value. Keying on it would collapse two sequential
  // settles of one lane into one account. identityOf is the fold; it
  // degenerates to the bare name only for a run odu never stamped.
  const red = firstRed()
  expect(coalesceOf(red)).toBe("odu:first-red:ci 8f8fe56#2")
  expect(coalesceOf(firstRed())).toBe(coalesceOf(red))
  const later = firstRed()
  expect(coalesceOf({ ...later, run: row({ seq: 3, cells: RED_CELLS }) })).toBe(
    "odu:first-red:ci 8f8fe56#3",
  )
  expect(coalesceOf(settled())).toBe("odu:settled:ci 8f8fe56#2")
  expect(coalesceOf(settled({ sha7: "" }))).toBe("odu:settled:ci")
})
