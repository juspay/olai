import { type Derived, declarationsOf } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { FleetTerminal, KoluEvent } from "olai-plugin-kolu/appliance/wire"
import { UNOWNED } from "olai-plugin-kolu/appliance/wire"
import { expect, test } from "bun:test"

import {
  bodyFor,
  claimedIn,
  ringingIn,
  claimingIn,
  classify,
  type Conversation,
  makeHeartbeat,
  type Scoped,
  standingIn,
  terminalsIn,
  walkedIn,
  whyOut,
} from "./doorbell.ts"
import { ownKinds, TERMINAL_TYPE } from "./kinds.ts"
import { listed, tracing } from "./trace.ts"

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
  }:"2026-08-31T09:00:00.000Z"${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

const declaring = (key = "terminal"): string =>
  rec(`prop-${key}`, key, { type: TERMINAL_TYPE })

const claimsOf = (files: Record<string, string>, file: string) =>
  claimingNodesOf(files, file).map(({ node: _node, ...claim }) => claim)

const claimingNodesOf = (files: Record<string, string>, file: string) => {
  const at = readingOf(setOf(files)).derived
  return claimedIn(declarationsOf(at, ownKinds), at, file)
}

const row = (
  id: string,
  agentState: string | null,
  label = "",
  repo: string | null = null,
): FleetTerminal => ({
  id,
  pip: {
    variant: "waiting",
    glyph: "claude-code",
    active: false,
    asking: true,
    bytesLive: false,
    hasAgent: agentState !== null,
    sleeping: false,
    alert: false,
    alertLabel: "",
  },
  bucket: "waiting",
  agentState,
  label,
  labelColor: "",
  subline: { text: "", fromAgent: true },
  pr: null,
  recencyAt: null,
  repo,
  themeName: null,
  owner: UNOWNED,
})

const fleetOf = (...rows: ReadonlyArray<FleetTerminal>): ReadonlyMap<string, FleetTerminal> =>
  new Map(rows.map((one) => [one.id, one]))

const fired = (terminal: string, state = "waiting"): KoluEvent => ({
  id: "ev-1",
  kind: "transition",
  at: "2026-08-31T14:32:07.001Z",
  row: {
    terminal,
    state,
    agentState: state === "awaiting" ? "awaiting_user" : "waiting",
    pip: row(terminal, "waiting").pip,
    bucket: "waiting",
    label: "",
    labelColor: "",
    repo: null,
    since: "2026-08-31T14:01:00.000Z",
  },
})

test("a MIRROR resolves to the target that carries the property", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": `{"id":"m","ord":"a0","mirror":"step"}`,
      "work.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", step: "implement", mark: "doing" }])
})

const under = (
  id: string,
  parent: string,
  ord: string,
  title: string,
  mark: string | null,
  fields: Record<string, string> = {},
): string =>
  `{"id":${JSON.stringify(id)},"parent":${JSON.stringify(parent)},"ord":${JSON.stringify(ord)},"title":${
    JSON.stringify(title)
  }${mark === null ? "" : `,${JSON.stringify(mark)}:"2026-08-31T09:00:00.000Z"`}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

test("a step-level claim under a MIRRORED lane rings — the walk goes down, not just across", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": `{"id":"m","ord":"a0","mirror":"lane"}`,
      "work.olai": [
        marked("lane", "the second doorbell", "doing"),
        under("rev-a", "lane", "a0", "review: grok", "doing", { terminal: "11111111" }),
        under("rev-b", "lane", "a1", "review: pi", "todo", { terminal: "22222222" }),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
    { value: "22222222", step: "review: pi", mark: "todo" },
  ])
})

test("a LAWFULLY PARKED author is a digest, whatever the rest of the lane is doing", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        marked("lane", "the second doorbell", "doing"),
        under("author", "lane", "a0", "author", "doing", { terminal: "11111111" }),
        under("impl", "author", "a0", "implement + open PR", "done"),
        under("refactor", "author", "a1", "refactor passes", "done"),
        under("rev", "lane", "a1", "review: grok", "doing", { terminal: "22222222" }),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([
    { value: "11111111", step: "author", mark: "todo" },
    { value: "22222222", step: "review: grok", mark: "doing" },
  ])
})


test("another terminal's claimed step is never YOUR owing step", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane", "the second doorbell", "doing", { terminal: "aaaaaaaa" }),
      under("impl", "lane", "a0", "implement + open PR", "done"),
      under("rev-pi", "lane", "a1", "review: pi", "doing", { terminal: "bbbbbbbb" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([
    { value: "aaaaaaaa", step: "the second doorbell", mark: "todo" },
    { value: "bbbbbbbb", step: "review: pi", mark: "doing" },
  ])
})

test("... and everything UNDER a claimed step goes with it", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane", "the second doorbell", "doing", { terminal: "aaaaaaaa" }),
      under("rev-pi", "lane", "a0", "review: pi", "todo", { terminal: "bbbbbbbb" }),
      under("deep", "rev-pi", "a0", "read the diff", "doing"),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([
    { value: "aaaaaaaa", step: "the second doorbell", mark: "todo" },
    { value: "bbbbbbbb", step: "read the diff", mark: "doing" },
  ])
})

test("a LANE-LEVEL claim names the deepest step somebody is on, not the lane", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        marked("lane", "the second doorbell", "doing", { terminal: "11111111" }),
        under("impl", "lane", "a0", "implement + open PR", "doing"),
        under("inner", "impl", "a0", "write the failing test", "doing"),
        under("later", "lane", "a1", "refactor passes", "todo"),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", step: "write the failing test", mark: "doing" }])
})

test("... and names itself when nothing under it is being worked", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        marked("lane", "the second doorbell", "todo", { terminal: "11111111" }),
        under("impl", "lane", "a0", "implement + open PR", "todo"),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", step: "the second doorbell", mark: "todo" }])
})

test("one record reached twice — a lane and a mirror of it — is claimed once", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        marked("lane", "the second doorbell", "doing", { terminal: "11111111" }),
        `{"id":"m","ord":"a1","mirror":"lane"}`,
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", step: "the second doorbell", mark: "doing" }])
})


test("a claim added between two events is seen by the second — the derivation owns no set", () => {
  const before = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("a", "review: grok", "doing", { terminal: "11111111" }),
  }
  const after = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("a", "review: grok", "doing", { terminal: "11111111" }),
      `{"id":"b","ord":"a1","title":"review: pi","doing":"2026-08-31T09:00:00.000Z","custom":{"terminal":"22222222"}}`,
    ].join("\n"),
  }
  expect(claimsOf(before, "lanes.olai")).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
  ])
  expect(claimsOf(after, "lanes.olai")).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
    { value: "22222222", step: "review: pi", mark: "doing" },
  ])
  expect(claimsOf(before, "lanes.olai")).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
  ])
})



test("a SETTLED step claims nothing, even under a lane that is still open", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        marked("lane", "the second doorbell", "doing"),
        under("folded", "lane", "a0", "review: fr", "done", { terminal: "11111111" }),
        under("live", "lane", "a1", "review: grok", "doing", { terminal: "22222222" }),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([{ value: "22222222", step: "review: grok", mark: "doing" }])
})

test("... and so does a CANCELLED one, and an unmarked bullet somebody wrote", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        marked("lane", "the second doorbell", "doing"),
        under("dropped", "lane", "a0", "review: fr", "cancelled", { terminal: "11111111" }),
        under("note", "lane", "a1", "a note to self", null, { terminal: "22222222" }),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([])
})

test("a lane MINTED AS A BULLET and claimed later rings — an UNMARKED CONTAINER is judged by what is under it", () => {
  const filed = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
    "bugs.olai": rec("tns", "PR: task notifications stop spilling raw"),
  }
  expect(claimsOf(filed, "lanes.olai")).toEqual([])

  const dispatched = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
    "bugs.olai": [
      rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
      under("impl", "tns", "a0", "implement + open PR", "done"),
      under("refactor", "tns", "a1", "refactor passes", "doing"),
    ].join("\n"),
  }
  expect(claimsOf(dispatched, "lanes.olai")).toEqual([
    { value: "11e565c0", step: "refactor passes", mark: "doing" },
  ])
})

test("... and an unmarked container whose work has all SETTLED still claims nothing", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
        under("impl", "tns", "a0", "implement + open PR", "done"),
        under("dropped", "tns", "a1", "refactor passes", "cancelled"),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([])
})

test("THE RESIDUAL: a bullet given ONLY a terminal, before its steps land, is still silent", () => {
  const graftedClaimOnly = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
    "bugs.olai": rec("tns", "PR: task notifications stop spilling raw", {
      terminal: "11e565c0",
    }),
  }
  expect(claimsOf(graftedClaimOnly, "lanes.olai")).toEqual([])

  const at = readingOf(setOf(graftedClaimOnly)).derived
  expect(walkedIn(declarationsOf(at, ownKinds), at, "lanes.olai").excluded).toEqual([
    { value: "11e565c0", node: "tns", why: "unmarked-leaf" },
  ])

  expect(
    claimsOf({
      ...graftedClaimOnly,
      "bugs.olai": [
        rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
        under("impl", "tns", "a0", "implement + open PR", "doing"),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([{ value: "11e565c0", step: "implement + open PR", mark: "doing" }])
})

test("the walk names the OTHER two gates too — settled, and live-but-nobody-under", () => {
  const at = readingOf(setOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("closed", "a lane somebody folded", "done", { terminal: "aaaaaaaa" }),
      rec("spent", "a lane whose steps all settled", { terminal: "bbbbbbbb" }),
      under("gone", "spent", "a0", "implement", "done"),
      rec("jotted", "a bullet with a terminal on it", { terminal: "cccccccc" }),
      marked("live", "a lane somebody is on", "doing", { terminal: "dddddddd" }),
    ].join("\n"),
  })).derived
  const walked = walkedIn(declarationsOf(at, ownKinds), at, "lanes.olai")
  expect(walked.excluded).toEqual([
    { value: "aaaaaaaa", node: "closed", why: "settled" },
    { value: "bbbbbbbb", node: "spent", why: "not-live" },
    { value: "cccccccc", node: "jotted", why: "unmarked-leaf" },
  ])
  expect(walked.claimed.map((claim) => claim.value)).toEqual(["dddddddd"])
})

test("... and an unmarked lane whose only live step is ANOTHER terminal's is a digest, not a disappearance", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": [
        rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
        under("rev", "tns", "a0", "review: claude-opus", "doing", { terminal: "384f5360" }),
      ].join("\n"),
    }, "lanes.olai"),
  ).toEqual([
    { value: "11e565c0", step: "PR: task notifications stop spilling raw", mark: "todo" },
    { value: "384f5360", step: "review: claude-opus", mark: "doing" },
  ])
})

test("the digest line asserts NO mark, because the one it has is a verdict", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": [
      marked("author", "author", "doing", { terminal: "11111111" }),
      under("impl", "author", "a0", "implement + open PR", "done"),
    ].join("\n"),
  }, fleetOf(row("11111111", "waiting", "trivial-pair", "olai")), "digest")
  const body = bodyFor("digest", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).toContain('nothing under "author" is being worked')
  expect(body).not.toContain("`todo`")
})

test("a CANCELLED step is not un-done — `!== \"done\"` would have claimed it", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": marked("step", "implement", "cancelled", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([])
})

test("an ABSENT mark on a LEAF is not a todo — a bullet with nothing under it is not work", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": rec("step", "implement", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([])
})

test("a DONE step is not un-done either, and both surviving marks are", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("a", "shipped", "done", { terminal: "11111111" }),
      marked("b", "in hand", "doing", { terminal: "22222222" }),
      marked("c", "queued", "todo", { terminal: "33333333" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([
    { value: "22222222", step: "in hand", mark: "doing" },
    { value: "33333333", step: "queued", mark: "todo" },
  ])
})

test("the value is read by LICENCE, so a person's own `terminal` column is not one", () => {
  expect(
    claimsOf({
      "lanes.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([])
  expect(
    claimsOf({
      "lanes.olai": marked("step", "implement", "doing", { [TERMINAL_TYPE]: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", step: "implement", mark: "doing" }])
})

test("a node in ANOTHER file is not in this file's scope", () => {
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "board.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([])
})


test("the claiming node's id rides the account, so the panel can press through to it", () => {
  expect(
    claimingNodesOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": marked("lane-sd", "review: grok", "doing", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", node: "lane-sd", step: "review: grok", mark: "doing" }])
})

test("... and the account names it, in backticks, beside the terminal it is about", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("lane-sd", "review: grok", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting", "trivial-pair", "olai")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).toContain("on `lane-sd`.")
  expect(body.split("\n")[0]).toContain("on `lane-sd`")
})

test("... and the head links NOTHING where it names a count, because it would be picking for the reader", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": [
      marked("lane-a", "review: grok", "doing", { terminal: "11111111" }),
      marked("lane-b", "review: pi", "doing", { terminal: "22222222" }),
    ].join("\n"),
  }, fleetOf(
    row("11111111", "waiting", "one", "olai"),
    row("22222222", "waiting", "two", "olai"),
  ), "wake")
  const head = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z").split("\n")[0]
  expect(head).toBe("2 terminals are idle: they have finished, or they need you.")
  expect(head).not.toContain("`")
})

test("a PREFIX resolves — the board writes eight characters, the fleet holds uuids", () => {
  const claims = claimingNodesOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("step", "implement", "doing", { terminal: "54fe62f9" }),
  }, "lanes.olai")
  const claiming = claimingIn(claims, ["54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0"])
  expect([...claiming.keys()]).toEqual(["54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0"])
})

test("an AMBIGUOUS value claims nothing at all", () => {
  const claims = claimingNodesOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("step", "implement", "doing", { terminal: "54fe" }),
  }, "lanes.olai")
  expect([...claimingIn(claims, ["54fe0001", "54fe0002"]).keys()]).toEqual([])
})

test("a value naming nobody live claims nothing, and says nothing about it", () => {
  const claims = claimingNodesOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("step", "implement", "doing", { terminal: "99999999" }),
  }, "lanes.olai")
  expect([...claimingIn(claims, ["11111111"]).keys()]).toEqual([])
})

test("two records claiming one terminal — the file's first line wins", () => {
  const claims = claimingNodesOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("a", "the lane", "doing", { terminal: "11111111" }),
      marked("b", "a copy of the lane", "todo", { terminal: "11111111" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claimingIn(claims, ["11111111"]).get("11111111")?.step).toBe("the lane")
})

const meaningOf = (files: Record<string, string>, file: string, event: KoluEvent) => {
  const claims = claimingNodesOf(files, file)
  return classify(event, claimingIn(claims, ["11111111", "22222222"]))
}

const DECLARED = { "_olai/Properties.olai": declaring() }

test("claimed, and the claiming step is DOING — that is a wake", () => {
  expect(
    meaningOf({
      ...DECLARED,
      "lanes.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai", fired("11111111")),
  ).toBe("wake")
})

test("claimed, and the claiming step is TODO — that is a digest line", () => {
  expect(
    meaningOf({
      ...DECLARED,
      "lanes.olai": marked("step", "implement", "todo", { terminal: "11111111" }),
    }, "lanes.olai", fired("11111111")),
  ).toBe("digest")
})

test("UNCLAIMED is silence, spelled `null` — there is no drift arm to take", () => {
  expect(
    meaningOf({
      ...DECLARED,
      "lanes.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai", fired("22222222")),
  ).toBeNull()
})

test("a HEARTBEAT names no terminal, so it means nothing to a conversation", () => {
  const beat: KoluEvent = {
    id: "ev-9",
    kind: "heartbeat",
    at: "2026-08-31T14:32:07.001Z",
    row: null,
  }
  expect(
    meaningOf({
      ...DECLARED,
      "lanes.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai", beat),
  ).toBeNull()
})

test("a NAG means what its transition meant — the derivation is idempotent", () => {
  const nag: KoluEvent = { ...fired("11111111"), id: "ev-2", kind: "nag" }
  expect(
    meaningOf({
      ...DECLARED,
      "lanes.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai", nag),
  ).toBe("wake")
})

const standingFor = (
  files: Record<string, string>,
  fleet: ReadonlyMap<string, FleetTerminal>,
  meaning: "wake" | "digest",
) => standingIn(claimingIn(claimingNodesOf(files, "lanes.olai"), fleet.keys()), fleet, meaning)

test("the standing set is EVERY claimed terminal held now, not the one that moved", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": [
      marked("a", "reproduce + fix", "doing", { terminal: "11111111" }),
      marked("b", "post the verdict", "doing", { terminal: "22222222" }),
    ].join("\n"),
  }, fleetOf(row("11111111", "waiting"), row("22222222", "awaiting_user")), "wake")
  expect(standing.map((one) => one.terminal)).toEqual(["11111111", "22222222"])
  expect(standing.map((one) => one.state)).toEqual(["waiting", "awaiting"])
})

test("a claimed terminal that went back to WORK is not standing", () => {
  expect(
    standingFor({
      ...DECLARED,
      "lanes.olai": [
        marked("a", "reproduce + fix", "doing", { terminal: "11111111" }),
        marked("b", "post the verdict", "doing", { terminal: "22222222" }),
      ].join("\n"),
    }, fleetOf(row("11111111", "waiting"), row("22222222", "thinking")), "wake")
      .map((one) => one.terminal),
  ).toEqual(["11111111"])
})

test("the two meanings PARTITION the standing set — neither body names the other's", () => {
  const files = {
    ...DECLARED,
    "lanes.olai": [
      marked("a", "reproduce + fix", "doing", { terminal: "11111111" }),
      marked("b", "chase the flake", "todo", { terminal: "22222222" }),
    ].join("\n"),
  }
  const fleet = fleetOf(row("11111111", "waiting"), row("22222222", "waiting"))
  expect(standingFor(files, fleet, "wake").map((one) => one.terminal)).toEqual(["11111111"])
  expect(standingFor(files, fleet, "digest").map((one) => one.terminal)).toEqual(["22222222"])
})

test("the FIRST LINE is the essence — the plain sentence the panel folds to", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce + fix + open PR", "doing", {
      terminal: "54fe62f9",
    }),
  }, fleetOf(row("54fe62f9", "waiting", "done-flip-flake", "olai")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  const [first, blank, third] = body.split("\n")
  expect(first).toBe(
    "The done-flip-flake terminal is idle on `step`: it has finished, or it needs you.",
  )
  expect(first).not.toContain("kolu")
  expect(blank).toBe("")
  expect(third).toBe("Written by olai's kolu watcher at 2026-08-31 14:32 UTC, not by a person.")
})

test("... and the essence COUNTS rather than lists, so one line stays one line", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": [
      marked("a", "review: grok", "doing", { terminal: "11111111" }),
      marked("b", "review: pi", "doing", { terminal: "22222222" }),
    ].join("\n"),
  }, fleetOf(
    row("11111111", "waiting", "one", "olai"),
    row("22222222", "waiting", "two", "olai"),
  ), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body.split("\n")[0]).toBe(
    "2 terminals are idle: they have finished, or they need you.",
  )
})

test("the wake body names the terminal, who it is, its state and the doing step", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce + fix + open PR", "doing", {
      terminal: "54fe62f9",
    }),
  }, fleetOf(row("54fe62f9", "waiting", "done-flip-flake", "olai")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).toContain(
    "— `54fe62f9` (olai·done-flip-flake) is held at `waiting`; its step \"reproduce + fix + open PR\" is `doing`, on `step`.",
  )
  expect(body).toContain("One terminal claimed by lanes.olai is waiting on a person")
  expect(body).toContain("a report or a block is owed")
  expect(body).toContain("clearing the file on this conversation's wake control stops it")
})

test("the digest body says PARKED rather than owed, and counts what it names", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": [
      marked("a", "chase the flake", "todo", { terminal: "11111111" }),
      marked("b", "read the log", "todo", { terminal: "22222222" }),
    ].join("\n"),
  }, fleetOf(row("11111111", "waiting"), row("22222222", "waiting")), "digest")
  const body = bodyFor("digest", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body.split("\n")[0]).toBe(
    "2 terminals went quiet, and nothing under them is being worked. A note, not a call.",
  )
  expect(body).toContain("2 terminals claimed by lanes.olai are waiting on a person")
  expect(body).toContain("they are lawfully parked, so this is a note and not a call")
  expect(body).toContain("`11111111`")
  expect(body).toContain("`22222222`")
})

test("NOTHING IN A BODY IS MARKDOWN — it is delivered as a message, not rendered", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).not.toContain("**")
  expect(body).not.toContain("- `")
  expect(body.split("\n").some((line) => line.startsWith("#"))).toBe(false)
})

test("a row with no repo and no label is named by its id alone", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  expect(bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")).toContain(
    "— `11111111` is held at `waiting`;",
  )
})

test("an untitled claiming node is drawn around rather than filled in", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "  ", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  expect(bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")).toContain(
    "the node that claims it is `doing`",
  )
})

test("a clock this runtime cannot read passes through VERBATIM", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  expect(bodyFor("wake", standing, "lanes.olai", "half past four")).toContain(
    "at half past four,",
  )
})

test("a first report carries NO count — the cap the count counts against is padi's restatement of it, and a count absent from the event is absent from the body", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).not.toContain("reminder")
})

test("a count on a kind that is not a nag does not become a reminder in the body", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const body = bodyFor(
    "wake",
    standing,
    "lanes.olai",
    "2026-08-31T14:32:07.001Z",
    { ...fired("11111111"), nag: { index: 2, left: 1 } },
  )
  expect(body).not.toContain("This is reminder")
})

test("a capped nag spells the count, spell for spell the last one — and names the terminal it is about", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const second = bodyFor(
    "wake",
    standing,
    "lanes.olai",
    "2026-08-31T14:32:07.001Z",
    { ...fired("11111111"), kind: "nag", nag: { index: 2, left: 1 } },
  )
  expect(second).toContain("This is reminder 2 of 3 for `11111111`.")
  const last = bodyFor(
    "wake",
    standing,
    "lanes.olai",
    "2026-08-31T14:32:07.001Z",
    { ...fired("11111111"), kind: "nag", nag: { index: 3, left: 0 } },
  )
  expect(last).toContain("This is reminder 3 of 3 for `11111111`, the last — this doorbell goes quiet about that terminal until its state changes.")
  expect(last).not.toContain("**")
})

test("an UNCAPPED nag has no end to name — the count alone, in padi's own clause", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const body = bodyFor(
    "wake",
    standing,
    "lanes.olai",
    "2026-08-31T14:32:07.001Z",
    { ...fired("11111111"), kind: "nag", nag: { index: 4 } },
  )
  expect(body).toContain("This is reminder 4 of an uncapped nag for `11111111`")
})

const rangOver = (files: Record<string, string>, file: string, fleet: ReadonlyArray<string>) => {
  const lines: Array<string> = []
  const at = readingOf(setOf(files)).derived
  const ringing = ringingIn(
    declarationsOf(at, ownKinds),
    at,
    file,
    fleet,
    tracing((line) => {
      lines.push(line)
    }),
  )
  return { ringing, lines }
}

const P1_FILED = {
  "_olai/Properties.olai": declaring(),
  "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
  "bugs.olai": rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
}
const P1_GRAFTED = {
  ...P1_FILED,
  "bugs.olai": [
    rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
    under("impl", "tns", "a0", "implement + open PR", "done"),
    under("refactor", "tns", "a1", "refactor passes", "doing"),
  ].join("\n"),
}

test("the `derived` line NAMES the ringing set — a count would not have found this bug", () => {
  const it = rangOver(P1_GRAFTED, "lanes.olai", ["11e565c0aaaa", "4b5a3fb6bbbb"])
  expect(it.lines[0]).toBe(
    "kolu doorbell derived file=lanes.olai claims=1 ringing=11e565c0aaaa@tns"
      + " unmatched=none excluded=none fleet=2",
  )
  expect([...it.ringing.claiming.keys()]).toEqual(["11e565c0aaaa"])
})

test("... and the SAME vault before the graft names the gate instead", () => {
  const it = rangOver(P1_FILED, "lanes.olai", ["11e565c0aaaa", "4b5a3fb6bbbb"])
  expect(it.lines[0]).toBe(
    "kolu doorbell derived file=lanes.olai claims=0 ringing=none"
      + " unmatched=none excluded=11e565c0@tns:unmarked-leaf fleet=2",
  )
})

test("the silence says WHICH gate — every `Why`, plus unmatched and unclaimed", () => {
  const grafted = rangOver(P1_GRAFTED, "lanes.olai", ["11e565c0aaaa"]).ringing
  expect(grafted.claiming.has("11e565c0aaaa")).toBe(true)

  const filed = rangOver(P1_FILED, "lanes.olai", ["11e565c0aaaa"]).ringing
  expect(whyOut("11e565c0aaaa", filed)).toBe("unmarked-leaf")

  const settled = rangOver({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("closed", "folded", "done", { terminal: "aaaaaaaa" }),
      rec("spent", "spent", { terminal: "bbbbbbbb" }),
      under("gone", "spent", "a0", "implement", "done"),
    ].join("\n"),
  }, "lanes.olai", ["aaaaaaaaffff", "bbbbbbbbffff"]).ringing
  expect(whyOut("aaaaaaaaffff", settled)).toBe("settled")
  expect(whyOut("bbbbbbbbffff", settled)).toBe("not-live")

  const ambiguous = rangOver({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("lane", "review: grok", "doing", { terminal: "11" }),
  }, "lanes.olai", ["1111aaaa", "1122bbbb"]).ringing
  expect(whyOut("1111aaaa", ambiguous)).toBe("unmatched")

  expect(whyOut("99999999", grafted)).toBe("unclaimed")
})

const WINDOW = 1_800_000

const SEAT: Scoped = { current: () => true, agent: "olai", session: "s-1", file: "lanes.olai" }

const ONE_CLAIM = {
  ...DECLARED,
  "lanes.olai": marked("lane", "review: grok", "doing", { terminal: "11111111" }),
}
const TWO_CLAIMS = {
  ...DECLARED,
  "lanes.olai": [
    marked("lane", "review: grok", "doing", { terminal: "11111111" }),
    marked("lane-b", "review: pi", "todo", { terminal: "22222222" }),
  ].join("\n"),
}

const bench = (files: Record<string, string>, opts?: { readonly armless?: boolean }) => {
  let clock = Date.parse("2026-08-31T09:00:00.000Z")
  let vault: Derived | null = readingOf(setOf(files)).derived
  let scoped: ReadonlyArray<Scoped> = []
  const held: Array<
    { to: Conversation; say: () => string | null; coalesce: string | undefined }
  > = []
  const lines: Array<string> = []
  const heart = makeHeartbeat({
    trace: tracing((line) => {
      lines.push(line)
    }),
    scopes: () => scoped,
    deliver: (to, say, options) => {
      held.push({ to, say, coalesce: options?.coalesce })
    },
    terminals: (scope) =>
      vault === null
        ? null
        : terminalsIn(declarationsOf(vault, ownKinds), vault, scope.file, scope.under),
    now: () => new Date(clock).toISOString(),
    coalesce: "kolu:heartbeat",
  })
  if (opts?.armless !== true) heart.beat(WINDOW)
  return {
    heart,
    held,
    scope: (...next: ReadonlyArray<Scoped>) => {
      scoped = next
    },
    board: (next: Record<string, string>) => {
      vault = readingOf(setOf(next)).derived
    },
    unload: () => {
      vault = null
    },
    after: (ms: number) => {
      clock += ms
    },
    lines,
    words: () =>
      held.map((one) => one.say()).filter((body): body is string => body !== null),
  }
}

test("an EMPTY WINDOW produces exactly one heartbeat, and it carries the four facts", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(1)
  expect(it.held[0]?.to).toBe(SEAT)
  expect(it.held[0]?.coalesce).toBe("kolu:heartbeat")
  const body = it.words()[0] ?? ""
  expect(body).toContain("— the filter file: lanes.olai.")
  expect(body).toContain("— terminals it claims right now: 1.")
  expect(body).toContain("— last watcher event: none at all since it started watching.")
  expect(body).toContain("— watching since 2026-08-31 09:00 UTC, 30 minutes so far.")
  expect(body.split("\n")[0]).toBe(
    "The kolu watcher is alive: 30 minutes with nothing to say about the one terminal lanes.olai claims.",
  )
  expect(body).toContain("Written by olai's kolu watcher at 2026-08-31 09:30 UTC, not by a person.")
  expect(body).toContain("This is never a fault report")
})

test("a WINDOW WITH A DELIVERY IN IT produces no heartbeat at all", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.heart.delivered(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(0)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(1)
})

test("a busy day never sees a heartbeat at all", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  for (let window = 0; window < 6; window += 1) {
    it.heart.delivered(SEAT)
    it.after(WINDOW)
    it.heart.beat(WINDOW)
  }
  expect(it.held.length).toBe(0)
})

test("...and one seat's traffic does not silence another seat's floor", () => {
  const other: Scoped = { current: () => true, agent: "olai", session: "s-2", file: "lanes.olai" }
  const it = bench(ONE_CLAIM)
  it.scope(SEAT, other)
  it.heart.delivered(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.map((one) => one.to.session)).toEqual(["s-2"])
})

test("the facts are derived at SEND TIME, not when the beat fired", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  it.board(TWO_CLAIMS)
  it.after(600_000)
  it.heart.saw("2026-08-31T09:35:00.000Z")
  const body = it.words()[0] ?? ""
  expect(body).toContain("— terminals it claims right now: 2.")
  expect(body).toContain("— last watcher event: 2026-08-31 09:35 UTC, 5 minutes ago.")
  expect(body).toContain("— watching since 2026-08-31 09:00 UTC, 40 minutes so far.")
  expect(body.split("\n")[0]).toContain("the 2 terminals lanes.olai claims")
})

test("...and the count follows the board back down, because nothing is remembered", () => {
  const it = bench(TWO_CLAIMS)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  it.board(ONE_CLAIM)
  expect(it.words()[0] ?? "").toContain("— terminals it claims right now: 1.")
})

test("a scope core does not list is never beaten for — the fault's boundary, kept by construction", () => {
  const it = bench(ONE_CLAIM)
  it.scope()
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(0)
})

test("...and a scope that goes while the heartbeat waits is dropped rather than delivered", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(1)
  it.scope()
  expect(it.held[0]?.say()).toBeNull()
  expect(it.words()).toEqual([])
})

test("...and a re-scoped seat is beaten about the file it is on NOW", () => {
  const it = bench({
    ...DECLARED,
    "lanes.olai": marked("lane", "review: grok", "doing", { terminal: "11111111" }),
    "board.olai": [
      marked("a", "one", "doing", { terminal: "22222222" }),
      marked("b", "two", "todo", { terminal: "33333333" }),
    ].join("\n"),
  })
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  it.scope({ ...SEAT, file: "board.olai" })
  const body = it.words()[0] ?? ""
  expect(body).toContain("— the filter file: board.olai.")
  expect(body).toContain("— terminals it claims right now: 2.")
})

test("a vault nobody has published is not beaten for, and neither is a disowned one", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.unload()
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(0)
})

test("...and a store that stops publishing while the heartbeat waits drops it too", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  it.unload()
  expect(it.held[0]?.say()).toBeNull()
})

test("a file that claims NOTHING is still beaten for — the zero is the evidence", () => {
  const it = bench({ ...DECLARED, "lanes.olai": marked("lane", "shipped", "done") })
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  const body = it.words()[0] ?? ""
  expect(body.split("\n")[0]).toBe(
    "The kolu watcher is alive: 30 minutes with nothing to say, and lanes.olai claims no terminals at all right now.",
  )
  expect(body).toContain("— terminals it claims right now: 0.")
})


test("the FIRST beat only arms the window — the timered watcher's `begun` swallow, moved down here with the pulse it swallowed", () => {
  const it = bench(ONE_CLAIM, { armless: true })
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(0)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(1)
})

test("the cadence is the KNOB's, not the subscription's speech rate: a beat inside the window is collapsed", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(1_000)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(0)
  expect(it.lines.at(-1)).toBe("kolu doorbell beat-collapsed every=1800000")
  it.after(WINDOW - 1_000)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(1)
})

test("a beat says what it did — the head, then one line per conversation it decided about", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.lines[0]).toBe("kolu doorbell beat-armed every=1800000")
  expect(it.lines[1]).toBe(
    "kolu doorbell beat every=1800000 scopes=1 spoken=0 lastEvent=none",
  )
  expect(it.lines[2]).toBe("kolu doorbell beating file=lanes.olai agent=olai session=s-1")
  expect(it.lines).not.toContain("kolu doorbell beat-said file=lanes.olai agent=olai terminals=1")
  it.words()
  expect(it.lines.at(-1)).toBe("kolu doorbell beat-said file=lanes.olai agent=olai terminals=1")
})

test("... and a conversation passed over says WHICH of the two reasons it was", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.heart.delivered({ agent: "olai", session: "s-1" })
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.lines).toContain(
    "kolu doorbell beat-passed file=lanes.olai agent=olai why=spoke-this-window",
  )
  expect(it.held.length).toBe(0)

  const starved = bench(ONE_CLAIM)
  starved.scope(SEAT)
  starved.unload()
  starved.after(WINDOW)
  starved.heart.beat(WINDOW)
  expect(starved.lines).toContain(
    "kolu doorbell beat-passed file=lanes.olai agent=olai why=no-revision",
  )
  expect(starved.held.length).toBe(0)
})
test("the BEAT is not an event — a heartbeat never dates itself as one", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.words()[0] ?? "").toContain(
    "— last watcher event: none at all since it started watching.",
  )
})

test("two records copying one value are ONE terminal, and the fleet is not asked", () => {
  const it = bench({
    ...DECLARED,
    "lanes.olai": [
      marked("a", "the lane", "doing", { terminal: "11111111" }),
      marked("b", "a copy of the lane", "todo", { terminal: "11111111" }),
    ].join("\n"),
  })
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.words()[0] ?? "").toContain("— terminals it claims right now: 1.")
})

test("NOTHING IN A HEARTBEAT IS MARKDOWN either, and it says how to stop it", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  const body = it.words()[0] ?? ""
  expect(body).not.toContain("**")
  expect(body).not.toContain("- ")
  expect(body.split("\n").some((line) => line.startsWith("#"))).toBe(false)
  expect(body).toContain("clearing the file on this conversation's wake control stops it")
})

test("a long watch is said in two units, and a clock nobody can read is not subtracted", () => {
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(5 * 3_600_000 + 20 * 60_000)
  it.heart.saw("half past four")
  it.heart.beat(WINDOW)
  const body = it.words()[0] ?? ""
  expect(body).toContain("— watching since 2026-08-31 09:00 UTC, 5 hours 20 minutes so far.")
  expect(body).toContain("— last watcher event: half past four.")
})

test("a prefix and the id it names count as ONE terminal, not two", () => {
  const vault = readingOf(setOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane", "the second doorbell", "doing", { terminal: "54fe62f9" }),
      under("step", "lane", "a0", "reproduce", "doing", {
        terminal: "54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0",
      }),
    ].join("\n"),
  })).derived
  expect(terminalsIn(declarationsOf(vault, ownKinds), vault, "lanes.olai")).toBe(1)
})

test("... and two whole ids sharing a prefix are still two", () => {
  const vault = readingOf(setOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("a", "review: grok", "doing", { terminal: "54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0" }),
      marked("b", "review: pi", "doing", { terminal: "54fe62f9-bbbb-4bbb-8ccc-ddddddddddd1" }),
    ].join("\n"),
  })).derived
  expect(terminalsIn(declarationsOf(vault, ownKinds), vault, "lanes.olai")).toBe(2)
})

test("... and an AMBIGUOUS prefix folds away, leaving the two it could not choose between", () => {
  const vault = readingOf(setOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane", "the second doorbell", "doing", { terminal: "54fe" }),
      marked("a", "review: grok", "doing", { terminal: "54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0" }),
      marked("b", "review: pi", "doing", { terminal: "54fe62f9-bbbb-4bbb-8ccc-ddddddddddd1" }),
    ].join("\n"),
  })).derived
  expect(terminalsIn(declarationsOf(vault, ownKinds), vault, "lanes.olai")).toBe(2)
})
