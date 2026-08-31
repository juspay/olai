/**
 * THE DOORBELL'S OWN BENCH — which terminals a scoped file claims, what a
 * fleet event MEANS to a conversation filtered by it, and the sentence it
 * arrives as.
 *
 * Every case is a WHOLE VAULT built out of JSONL the real parser accepts,
 * through the same declaration fold `./server.ts` runs — {@link
 * ./claimants.test.ts}'s harness, verbatim, because the claim under test is
 * the same kind of claim: what a vault SAYS. Nothing here needs a dial, a
 * padi, a socket or a clock; the fleet is a hand-built map of wire rows, and
 * the classification is a pure function of a vault and a roster.
 *
 * WHAT IS PINNED HERE, in order: mirrors resolving to their targets; a
 * `cancelled` step NOT counting as un-done; an unmarked bullet NOT counting
 * as a todo; an ambiguous value claiming nobody; a prefix resolving; `doing`
 * meaning WAKE; anything else un-done meaning digest; and unclaimed meaning
 * SILENCE — spelled `null`, because the dispatch dropped the drift arm and
 * there is nothing else for that case to be.
 */

import { declarationsOf } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { FleetTerminal, KoluEvent } from "@olai/kolu-client/wire"
import { UNOWNED } from "@olai/kolu-client/wire"
import { expect, test } from "bun:test"

import { bodyFor, claimedIn, claimingIn, classify, standingIn } from "./doorbell.ts"
import { ownKinds, TERMINAL_TYPE } from "./kinds.ts"

// ── The vault, as `./claimants.test.ts` builds one ────────────────────────

/** One record, as a file writes it. */
const rec = (
  id: string,
  title: string,
  fields: Record<string, string> = {},
): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

/** The same, wearing a mark — the field a mark is stored in is its own name. */
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

/** The declarations file, saying what a key is. */
const declaring = (key = "terminal"): string =>
  rec(`prop-${key}`, key, { type: TERMINAL_TYPE })

/** The walk, over declarations folded the way `./server.ts` folds them. */
const claimsOf = (files: Record<string, string>, file: string) => {
  const at = readingOf(setOf(files)).derived
  return claimedIn(declarationsOf(at, ownKinds), at, file)
}

// ── The fleet, as the wire carries it ─────────────────────────────────────

/** A FLEET ROW with only the fields this module reads: the agent state it
 *  folds a held bucket out of, and the two words the sentence names it by. */
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

/** The fleet, as `KoluHalf.rows()` hands it over. */
const fleetOf = (...rows: ReadonlyArray<FleetTerminal>): ReadonlyMap<string, FleetTerminal> =>
  new Map(rows.map((one) => [one.id, one]))

/** One `transition` for a terminal, as the watcher stamps it: `row.terminal`
 *  is padi's WHOLE id, which is the half of the join this module must not
 *  compare a vault value against. */
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

// ── What one file claims ──────────────────────────────────────────────────

test("a MIRROR resolves to the target that carries the property", () => {
  // The asymmetry with `claimantsIn`, which skips mirrors on the argument that
  // the target is in the same walk. That walk is the WHOLE vault; this one is
  // ONE file, and a lane mirrored onto the board keeps its record elsewhere —
  // so the placement is followed rather than skipped, and the mark is read off
  // the placement (which already stands for its target's) while the VALUE is
  // read off the record that has one.
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": `{"id":"m","ord":"a0","mirror":"step"}`,
      "work.olai": marked("step", "implement", "doing", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([{ value: "11111111", step: "implement", mark: "doing" }])
})

test("a CANCELLED step is not un-done — `!== \"done\"` would have claimed it", () => {
  // The trap the fourth mark left everywhere: two marks END the wait, and a
  // cancelled step is work nobody owes. A doorbell that rang for one would be
  // waking somebody about a lane they closed.
  expect(
    claimsOf({
      "_olai/Properties.olai": declaring(),
      "lanes.olai": marked("step", "implement", "cancelled", { terminal: "11111111" }),
    }, "lanes.olai"),
  ).toEqual([])
})

test("an ABSENT mark is not a todo — `status` is partial, and a bullet is not work", () => {
  // A node nobody marked is a line somebody wrote, not a task somebody is on.
  // The walk asks `unfinished`, which answers `false` for `undefined`.
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
  // The same ruling `./claimants.ts` keeps: enabling a plugin may add a face,
  // it may not reinterpret somebody's data. With nothing declared, the claim
  // rides the key carrying the kind's own composed word and no other.
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

// ── What the live fleet makes of those values ─────────────────────────────

test("a PREFIX resolves — the board writes eight characters, the fleet holds uuids", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("step", "implement", "doing", { terminal: "54fe62f9" }),
  }, "lanes.olai")
  const claiming = claimingIn(claims, ["54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0"])
  expect([...claiming.keys()]).toEqual(["54fe62f9-aaaa-4bbb-8ccc-ddddddddddd0"])
})

test("an AMBIGUOUS value claims nothing at all", () => {
  // Two live terminals under one prefix: picking whichever sorted first would
  // put a lane's name on a terminal it never named, so the value owns neither.
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("step", "implement", "doing", { terminal: "54fe" }),
  }, "lanes.olai")
  expect([...claimingIn(claims, ["54fe0001", "54fe0002"]).keys()]).toEqual([])
})

test("a value naming nobody live claims nothing, and says nothing about it", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("step", "implement", "doing", { terminal: "99999999" }),
  }, "lanes.olai")
  expect([...claimingIn(claims, ["11111111"]).keys()]).toEqual([])
})

test("two records claiming one terminal — the file's first line wins", () => {
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("a", "the lane", "doing", { terminal: "11111111" }),
      marked("b", "a copy of the lane", "todo", { terminal: "11111111" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claimingIn(claims, ["11111111"]).get("11111111")?.step).toBe("the lane")
})

// ── What an event MEANS ───────────────────────────────────────────────────

/** One vault, one fleet, one event — the whole join, as `./server.ts` runs it. */
const meaningOf = (files: Record<string, string>, file: string, event: KoluEvent) => {
  const claims = claimsOf(files, file)
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
  // The lane is open and nobody is on it: the terminal is lawfully parked, and
  // waking a person for it would be the flood the whole feature replaces.
  expect(
    meaningOf({
      ...DECLARED,
      "lanes.olai": marked("step", "implement", "todo", { terminal: "11111111" }),
    }, "lanes.olai", fired("11111111")),
  ).toBe("digest")
})

test("UNCLAIMED is silence, spelled `null` — there is no drift arm to take", () => {
  // The human's own terminals are the honest majority, and a doorbell that
  // also reported what it decided not to ring about is one nobody leaves on.
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

// ── The standing set, and the words ───────────────────────────────────────

/** The whole pipeline for one meaning, so the body cases read as the server's
 *  own sequence rather than as a hand-built list. */
const standingFor = (
  files: Record<string, string>,
  fleet: ReadonlyMap<string, FleetTerminal>,
  meaning: "wake" | "digest",
) => standingIn(claimingIn(claimsOf(files, "lanes.olai"), fleet.keys()), fleet, meaning)

test("the standing set is EVERY claimed terminal held now, not the one that moved", () => {
  // This is what makes core's replace-in-place lossless: the second body names
  // both terminals, so replacing the first one's slot loses nothing.
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
  // The sentence describes now. A terminal the agent picked back up is not
  // waiting on anybody, and naming it would be reporting a moment that passed.
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

test("the ATTRIBUTION and the time open the body — the row's mark does not survive a replay", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce + fix + open PR", "doing", {
      terminal: "54fe62f9",
    }),
  }, fleetOf(row("54fe62f9", "waiting", "done-flip-flake", "olai")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  const [first, second] = body.split("\n")
  expect(first).toBe("olai · kolu · wake on terminal activity · 2026-08-31 14:32 UTC")
  expect(second).toBe("Written by olai's kolu watcher, not by a person.")
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
    "— `54fe62f9` (olai·done-flip-flake) is held at `waiting`; its step \"reproduce + fix + open PR\" is `doing`.",
  )
  expect(body).toContain("One terminal claimed by lanes.olai is waiting on a person")
  expect(body).toContain("a report or a block is owed")
  // The exit, in the body's own words: a machine message that cannot be
  // switched off from inside its own text is one a person resents.
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
    "olai · kolu · terminal activity, for the record · 2026-08-31 14:32 UTC",
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

test("a row with a repo and NO label is named by the repo alone — no dangling joiner", () => {
  // The one case the browser's own fold (`@olai/kolu-ui`'s `repoPrefix`) and
  // this one used to answer differently: `olai·`, a name ending in a joiner
  // with nothing joined to it. Both drop it now — see `whoOf`.
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting", "  ", "olai")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).toContain("— `11111111` (olai) is held at `waiting`;")
  expect(body).not.toContain("olai·")
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
    "· half past four",
  )
})
