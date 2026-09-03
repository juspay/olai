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
 *
 * ...AND THE FLOOR UNDER ALL OF IT, last: the heartbeat. Those cases run the
 * real drive loop against a fake core — a scope list a test can move and a
 * `deliver` that HOLDS the thunk the way core holds a body through a running
 * turn — because every claim worth making about a heartbeat is a claim about
 * WHEN it is composed. What they pin is the four the human named: a window
 * with a delivery in it says nothing, an empty one says exactly one thing, the
 * facts are read at the moment the words go in and not when the beat fired,
 * and a scope core does not list is never beaten for at all.
 */

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
/** The claims, WITHOUT the carrying node's id — which is asserted once, on its
 *  own, by the test below that is about the link. Every other case here is
 *  about which terminals a file claims and what they mean, and threading an id
 *  through all of them would bury the claim each one is making. */
const claimsOf = (files: Record<string, string>, file: string) =>
  claimingNodesOf(files, file).map(({ node: _node, ...claim }) => claim)

/** ... and with it, for the one case that is. */
const claimingNodesOf = (files: Record<string, string>, file: string) => {
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

/** A record with a PARENT and its own ord — what the three cases below need
 *  and the plain helpers above deliberately do not carry, because a subtree is
 *  the one thing the walk used not to have. */
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

// ── THE THREE THE HUMAN FOUND ON A LIVE BOARD, 2026-08-31 ──────────────────
// Each was the same defect from a different side: the walk anchored on the row
// in the file rather than on the node that CARRIES the terminal.

test("a step-level claim under a MIRRORED lane rings — the walk goes down, not just across", () => {
  // The reviewer-split shape, and the one that rang for nobody: the board holds
  // a mirror, the lane lives elsewhere, and the terminals are on the lane's
  // STEPS. Following the mirror and reading only what it lands on finds a lane
  // that claims nothing at all.
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
  // The one that was wrong in the direction that matters. The author's own
  // steps are done; somebody else's step is `doing`. Reading the LANE's mark
  // says "a report or a block is owed" to a person who owes nothing — the arm
  // the ruled table sends to the digest, and the arm a wake must never take.
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
    // Its own subtree is finished, so nothing under it is being worked. The
    // lane above is still `doing` because the reviewer is going, and reading
    // THAT is what said a report was owed. A container is judged by its
    // children: open, nobody on it, a digest line.
    { value: "11111111", step: "author", mark: "todo" },
    { value: "22222222", step: "review: grok", mark: "doing" },
  ])
})


test("another terminal's claimed step is never YOUR owing step", () => {
  // The live board, 2026-08-31: the lane is claimed by its AUTHOR, whose own
  // steps are done; the `review: pi` step under it is `doing` and carries the
  // PI REVIEWER'S own terminal. Reading it as the author's owing step said a
  // report was owed by somebody who owed nothing — the reviewer was working.
  const claims = claimsOf({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("lane", "the second doorbell", "doing", { terminal: "aaaaaaaa" }),
      under("impl", "lane", "a0", "implement + open PR", "done"),
      under("rev-pi", "lane", "a1", "review: pi", "doing", { terminal: "bbbbbbbb" }),
    ].join("\n"),
  }, "lanes.olai")
  expect(claims).toEqual([
    // The reviewer's step is its own territory, so nothing is being worked
    // under the author: parked, a digest.
    { value: "aaaaaaaa", step: "the second doorbell", mark: "todo" },
    // ... and the reviewer is on its own step, which is a wake.
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
    // `read the diff` is being worked, but it is the reviewer's work — it
    // cannot be what the author owes a report about.
    { value: "aaaaaaaa", step: "the second doorbell", mark: "todo" },
    { value: "bbbbbbbb", step: "read the diff", mark: "doing" },
  ])
})

test("a LANE-LEVEL claim names the deepest step somebody is on, not the lane", () => {
  // What a person reading the lane already knows is the lane. What they want is
  // the step the agent is actually at — and DEEPEST, because a step with
  // sub-steps is a step whose real work is below it.
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
  // THE RULING THIS PINS (the human, 2026-08-31): the doorbell keeps NO
  // standing set of its own — no cache of claimed ids, no change-watching. It
  // derives per event against the store's current revision, and the store's
  // parsed vault IS the maintained copy. A doorbell-private set would be the
  // Monitor's frozen `--ignore` list reborn one floor down: a second copy of
  // the truth, plus the duty to catch every source that changes it, which is
  // the disease this whole PR exists to kill.
  //
  // The property lives HERE because {@link claimedIn} takes the revision as an
  // argument and returns a fresh answer — `server.ts`'s `ring` reads the
  // latest one per event and its per-file memo is minted per event and dropped
  // with it, so there is nowhere for an answer to survive a tick.
  const before = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("a", "review: grok", "doing", { terminal: "11111111" }),
  }
  const after = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": [
      marked("a", "review: grok", "doing", { terminal: "11111111" }),
      // The dispatch a person just wrote, mid-flight.
      `{"id":"b","ord":"a1","title":"review: pi","doing":"2026-08-31T09:00:00.000Z","custom":{"terminal":"22222222"}}`,
    ].join("\n"),
  }
  expect(claimsOf(before, "lanes.olai")).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
  ])
  // The SECOND event, against the revision the store now holds: the new claim
  // rings, with no restart and nothing subscribed to.
  expect(claimsOf(after, "lanes.olai")).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
    { value: "22222222", step: "review: pi", mark: "doing" },
  ])
  // ... and nothing accumulated on the way: handed the older revision again it
  // answers what that revision says, which a cache could not do.
  expect(claimsOf(before, "lanes.olai")).toEqual([
    { value: "11111111", step: "review: grok", mark: "doing" },
  ])
})



test("a SETTLED step claims nothing, even under a lane that is still open", () => {
  // The live board, 2026-08-31: a review step folded half an hour earlier went
  // on ringing, because the lane above it was open and nothing re-asked the
  // step. The un-done filter is asked of the CLAIMING NODE and not only of the
  // row the file lists — a settled node's claim is as silent as a settled lane's.
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

// ── THE ONE THE HUMAN FOUND ON A LIVE BOARD, 2026-09-01 ────────────────────

test("a lane MINTED AS A BULLET and claimed later rings — an UNMARKED CONTAINER is judged by what is under it", () => {
  // THE P1 (`doorbell-missing-claim`, whose RCA is on the board): one lane on a
  // busy day board drew no wake and no nag for 26 minutes while its agent sat
  // `waiting` and the nag knob was on. Four other lanes on the SAME board, in
  // the SAME conversation, rang 5 and 7 times through that window — so it was
  // never the queue, the scope or the knobs. It was the SET: the terminal was
  // not in it.
  //
  // WHAT MADE IT DIFFERENT, and it is one field. Every other row of that board
  // carried a mark. This lane's node had been FILED FIRST — a bug somebody
  // wrote down — and the dispatch grafted the `terminal` and the eleven steps
  // onto the node that was already there without ever marking the node itself.
  // A lane minted whole by its own dispatch arrives WITH a mark; a lane grown
  // onto a bullet does not, and nobody notices, because the board draws it from
  // its children either way.
  //
  // The walk then asked the CARRYING NODE for an unfinished mark of its own,
  // found none, and dropped the lane and its whole subtree before descending —
  // the same mistake this module's header already names three times over ("the
  // meaning read the wrong node's mark"), left standing on the un-done gate. A
  // container is judged by its children and never by itself: that is the ruled
  // sentence, and this is the gate that did not obey it.
  const filed = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
    "bugs.olai": rec("tns", "PR: task notifications stop spilling raw"),
  }
  // A bullet somebody filed, claiming nothing — and nothing should ring for it.
  // That is the leaf case one test up, and it does not move.
  expect(claimsOf(filed, "lanes.olai")).toEqual([])

  // THE DISPATCH, as a LATER write onto the node already on the board: the
  // claim and the steps arrive, and the node's own row is never marked.
  const dispatched = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
    "bugs.olai": [
      rec("tns", "PR: task notifications stop spilling raw", { terminal: "11e565c0" }),
      under("impl", "tns", "a0", "implement + open PR", "done"),
      under("refactor", "tns", "a1", "refactor passes", "doing"),
    ].join("\n"),
  }
  // Somebody is on `refactor passes` right now and the terminal the node above
  // it claims is held. That is a WAKE, and the set has to carry it.
  expect(claimsOf(dispatched, "lanes.olai")).toEqual([
    { value: "11e565c0", step: "refactor passes", mark: "doing" },
  ])
})

test("... and an unmarked container whose work has all SETTLED still claims nothing", () => {
  // The fence on the case above, and the reason the gate is LIVE rather than
  // not-settled: a bullet is judged by its children, so a bullet whose children
  // have all finished is as silent as the leaf bullet is. A gate spelled
  // "anything that is not `done`" would ring every closed lane on a board
  // somebody kept — which is `unfinished`'s own documented trap, one level up.
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
  // THE NEXT HOLE OF THE SAME SHAPE, pinned HERE so that widening it later
  // cannot mistake itself for a regression of the P1 two tests up.
  //
  // The P1 was an unmarked CONTAINER judged by its own mark instead of by its
  // children. This is the same vault one step earlier: the dispatch has written
  // the `kolu-terminal` onto the bullet and the eleven steps have not landed
  // yet — so the carrier is an unmarked LEAF, `live` is false, and the terminal
  // is not in the ringing set. A one-node lane is the same shape permanently.
  //
  // IT IS NOT A BUG THIS TEST IS ASKING SOMEBODY TO FIX. The leaf rule is a
  // real sentence — a bullet with nothing under it is a line somebody wrote,
  // not work somebody owes — and ringing every unmarked claimed leaf would
  // wake people about rows they jotted. What this pins is that the silence is
  // DECIDED rather than inherited: the residual is named, the walk says
  // `unmarked-leaf` about it out loud (below), and a future widening is a
  // deliberate change to this expectation and not a bug fix that happens to
  // pass because nothing was watching.
  const graftedClaimOnly = {
    "_olai/Properties.olai": declaring(),
    "lanes.olai": `{"id":"m","ord":"a0","mirror":"tns"}`,
    "bugs.olai": rec("tns", "PR: task notifications stop spilling raw", {
      terminal: "11e565c0",
    }),
  }
  expect(claimsOf(graftedClaimOnly, "lanes.olai")).toEqual([])

  // ...AND THE WALK SAYS WHICH GATE, by its own word for this one. That is what
  // keeps it a decision: an operator who wonders why a lane went quiet reads
  // `unmarked-leaf` rather than an absence they have to reconstruct.
  const at = readingOf(setOf(graftedClaimOnly)).derived
  expect(walkedIn(declarationsOf(at, ownKinds), at, "lanes.olai").excluded).toEqual([
    { value: "11e565c0", node: "tns", why: "unmarked-leaf" },
  ])

  // The moment one step lands and is being worked, it rings — which is the P1
  // test, and the line between the two is exactly one child.
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
  // The three `Why` words, over one vault, so the vocabulary is pinned where it
  // is decided rather than only where it is printed.
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
  // ...and the one that is none of the three is the one that rings.
  expect(walked.claimed.map((claim) => claim.value)).toEqual(["dddddddd"])
})

test("... and an unmarked lane whose only live step is ANOTHER terminal's is a digest, not a disappearance", () => {
  // The two rules meeting. `live` says the lane still holds work; the
  // claimed-subtree fence says that work is the REVIEWER'S and can never be the
  // lane's owing step. So the lane is present and parked — which is exactly
  // what a lane marked `doing` in this shape already answers, and the point is
  // that it does not depend on whether anybody remembered to mark it.
  //
  // A fence that swallowed `live` as well as `deepest` would delete the lane
  // from the set instead, which is this file's own P1 again one rule down.
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
  // `Standing.mark` is derived — a container with nothing being worked under it
  // reads `todo` however the board marked the container itself. Printing that
  // as the step's mark told a person the board said `todo` about a node the
  // board says is `doing`, which is a false claim about their own file.
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

test("an ABSENT mark on a LEAF is not a todo — a bullet with nothing under it is not work", () => {
  // A node nobody marked is a line somebody wrote, not a task somebody is on.
  //
  // THE PREDICATE IS NOT `unfinished` ANY MORE, and this comment used to say it
  // was. The walk asks `settled` — which an unmarked node is not — and then
  // whether anything at or under the node is LIVE. For a leaf that is its own
  // mark and nothing else, so the answer here is unchanged; but a reader who
  // believed the old sentence would think the P1's dropped predicate was still
  // in force, and go looking for it.
  //
  // WHAT THIS PINS IS THE LEAF RULE, not the mark rule: the same bullet with a
  // `doing` step under it DOES claim, which is the case two tests up.
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


test("the claiming node's id rides the account, so the panel can press through to it", () => {
  // NO NEW MECHANISM: the set declares this id, and the transcript's ordinary
  // id-lookup makes a backticked declared id pressable. So the link is a fact
  // about the WORDS the plugin wrote, and core adds nothing to carry it.
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
  // ... AND IN THE HEAD, which is the line the fold shows: pressing through to
  // the board was the thing a person wanted to do from the collapsed row, and a
  // link that only appeared once the fold was open sat behind the very fold it
  // was the reason to open.
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
  // Which of the two a single link went to would move with the board. The
  // account names both, each with its own reference — that is what the fold is
  // for, and it is one press away.
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
  // Two live terminals under one prefix: picking whichever sorted first would
  // put a lane's name on a terminal it never named, so the value owns neither.
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

// ── What an event MEANS ───────────────────────────────────────────────────

/** One vault, one fleet, one event — the whole join, as `./server.ts` runs it. */
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
) => standingIn(claimingIn(claimingNodesOf(files, "lanes.olai"), fleet.keys()), fleet, meaning)

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

test("the FIRST LINE is the essence — the plain sentence the panel folds to", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce + fix + open PR", "doing", {
      terminal: "54fe62f9",
    }),
  }, fleetOf(row("54fe62f9", "waiting", "done-flip-flake", "olai")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  const [first, blank, third] = body.split("\n")
  // WHAT HAPPENED, in words a reader who was not there understands — this is the
  // only line the transcript draws until somebody expands it. The step here is
  // long enough to be a sentence of its own, so the name falls back to the label
  // and the step waits in the account.
  expect(first).toBe(
    "The done-flip-flake terminal is idle on `step`: it has finished, or it needs you.",
  )
  // ... AND IT DOES NOT NAME ITS AUTHOR, which is the correction. The panel
  // draws a mark and a byline above the row, so a head that said `kolu` spent
  // the one line a glance gets on a question already answered twice above it.
  expect(first).not.toContain("kolu")
  // The fold is at the blank line, so everything below is detail.
  expect(blank).toBe("")
  // ... and the REPLAY rule is kept one line down rather than dropped: a resumed
  // conversation is rebuilt out of message chunks carrying text and no keys, so
  // the body has to say who wrote it SOMEWHERE — and anywhere in the body
  // satisfies that, because a replay rebuilds the whole of it.
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

// ── THE REMINDER'S OWN LINES ─────────────────────────────────────────────

test("a first report carries NO count — the cap the count counts against is padi's restatement of it, and a count absent from the event is absent from the body", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z")
  expect(body).not.toContain("reminder")
})

test("a capped nag spells the count, spell for spell the last one", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const second = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z", { index: 2, left: 1 })
  expect(second).toContain("This is reminder 2 of 3.")
  // THE LAST ONE says so in words — the difference between a cap spent well
  // and a watcher gone quiet is exactly where this sentence is true.
  const last = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z", { index: 3, left: 0 })
  expect(last).toContain("This is reminder 3 of 3, the last — this doorbell goes quiet about this terminal until its state changes.")
  // ...AND NOTHING OF IT IS MARKDOWN: the cap's own clause rides a body
  // that is a message, not a render.
  expect(last).not.toContain("**")
})

test("an UNCAPPED nag has no end to name — the count alone, in padi's own clause", () => {
  const standing = standingFor({
    ...DECLARED,
    "lanes.olai": marked("step", "reproduce", "doing", { terminal: "11111111" }),
  }, fleetOf(row("11111111", "waiting")), "wake")
  const body = bodyFor("wake", standing, "lanes.olai", "2026-08-31T14:32:07.001Z", { index: 4 })
  expect(body).toContain("This is reminder 4 of an uncapped nag")
})

// ── THE LOGGING HALF'S OWN REPRODUCE-RED-FIRST ────────────────────────────
//
// `ringingIn` is the seam that emits the `derived` line this PR exists to add,
// and it sat inside `serve`'s closure where no test could reach it without a
// `koluHalf`, a surface and a ctx. Nothing pinned that the line NAMES the set
// rather than counting it — and an edit that logged `ringing: claiming.size`
// would have shipped green and left the next P1 of this shape exactly as
// undiagnosable as this one was. It needs none of that scaffolding: a
// `Derived`, a file, the fleet's ids and a channel are all values.

/** The tracer over a collector, and the walk driven the way `ring` drives it. */
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

/** The P1's own vault, before and after the dispatch grafted onto the bullet. */
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
  // THE LOAD-BEARING FIELD. `ringing` carries the fleet id AND the board row
  // that claims it, so a reader goes to the row rather than to a uuid — and,
  // far more importantly, an ABSENCE is legible, because it is legible only
  // against the set it is absent from.
  expect(it.lines[0]).toBe(
    "kolu doorbell derived file=lanes.olai claims=1 ringing=11e565c0aaaa@tns"
      + " unmatched=none excluded=none fleet=2",
  )
  expect([...it.ringing.claiming.keys()]).toEqual(["11e565c0aaaa"])
})

test("... and the SAME vault before the graft names the gate instead", () => {
  // The bullet has its terminal and no steps: nothing rings, and the line says
  // which gate rather than leaving a reader to reconstruct an absence.
  const it = rangOver(P1_FILED, "lanes.olai", ["11e565c0aaaa", "4b5a3fb6bbbb"])
  expect(it.lines[0]).toBe(
    "kolu doorbell derived file=lanes.olai claims=0 ringing=none"
      + " unmatched=none excluded=11e565c0@tns:unmarked-leaf fleet=2",
  )
})

test("the silence says WHICH gate — every `Why`, plus unmatched and unclaimed", () => {
  // What `classified why=` prints, asked of the function that decides it. The
  // RCA was "absent from the set"; the next one of this shape should be a grep.
  const grafted = rangOver(P1_GRAFTED, "lanes.olai", ["11e565c0aaaa"]).ringing
  // In the set: the caller does not ask, because there is no silence to explain.
  expect(grafted.claiming.has("11e565c0aaaa")).toBe(true)

  const filed = rangOver(P1_FILED, "lanes.olai", ["11e565c0aaaa"]).ringing
  expect(whyOut("11e565c0aaaa", filed)).toBe("unmarked-leaf")

  // A lane somebody folded, and a lane whose steps all settled.
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

  // A prefix that opens two live terminals claims neither — the claim is live
  // and it is the JOIN that refused, which is a different answer entirely.
  const ambiguous = rangOver({
    "_olai/Properties.olai": declaring(),
    "lanes.olai": marked("lane", "review: grok", "doing", { terminal: "11" }),
  }, "lanes.olai", ["1111aaaa", "1122bbbb"]).ringing
  expect(whyOut("1111aaaa", ambiguous)).toBe("unmatched")

  // ...and a terminal nobody in this file ever named, which is the ordinary
  // case and the doorbell working.
  expect(whyOut("99999999", grafted)).toBe("unclaimed")
})

// ── THE FLOOR UNDER SILENCE ───────────────────────────────────────────────

/** THE WATCH WINDOW, as the vault's own default spells it: half an hour. It
 *  arrives at the loop on the beat that fires under it — there is no second
 *  knob, so a test that invented one would be testing a mechanism that does
 *  not exist. */
const WINDOW = 1_800_000

/** ONE SCOPED SEAT — a conversation, and the file somebody pointed it at. */
const SEAT: Scoped = { agent: "olai", session: "s-1", file: "lanes.olai" }

/** A board with one un-done claim on it, and the same board grown a second. */
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

/**
 * THE HEARTBEAT'S BENCH — the real drive loop, against a core that HOLDS.
 *
 * `deliver` does not ask for the words: it keeps the thunk, exactly as core
 * keeps a body through a running turn or until somebody opens the
 * conversation, and the test asks for them at the moment it wants to know what
 * they would have said. That is the only way a claim about SEND TIME can be
 * tested at all — a fake that composed on the spot would agree with every
 * implementation, including the one that reads its facts when the beat fires.
 *
 * The vault and the scope list are both movable for the same reason: what this
 * loop promises is that it re-reads them, so a bench that could not move them
 * underneath it would prove nothing.
 */
const bench = (files: Record<string, string>) => {
  let clock = Date.parse("2026-08-31T09:00:00.000Z")
  let vault: Derived | null = readingOf(setOf(files)).derived
  let scoped: ReadonlyArray<Scoped> = []
  const held: Array<
    { to: Conversation; say: () => string | null; coalesce: string | undefined }
  > = []
  /** EVERY LINE THE BEAT WROTE, in order — the real tracer over a collector,
   *  because what a `Trace` is for is being read, and a test that handed it a
   *  no-op would pin the calls and not the words. */
  const lines: Array<string> = []
  const heart = makeHeartbeat({
    trace: tracing((line) => {
      lines.push(line)
    }),
    scopes: () => scoped,
    deliver: (to, say, options) => {
      held.push({ to, say, coalesce: options?.coalesce })
    },
    // The REAL derivation, over whatever vault the test last set — the
    // server's own closure, which is one `undefined` check and this call.
    terminals: (file) =>
      vault === null ? null : terminalsIn(declarationsOf(vault, ownKinds), vault, file),
    now: () => new Date(clock).toISOString(),
    coalesce: "kolu:heartbeat",
  })
  return {
    heart,
    held,
    scope: (...next: ReadonlyArray<Scoped>) => {
      scoped = next
    },
    board: (next: Record<string, string>) => {
      vault = readingOf(setOf(next)).derived
    },
    /** The store stopped publishing — `server.ts`'s `unloaded`. */
    unload: () => {
      vault = null
    },
    after: (ms: number) => {
      clock += ms
    },
    /** WHAT ACTUALLY ENTERED THE CONVERSATIONS: core drops a `null` body
     *  rather than shortening it, so a held delivery that derives to nothing
     *  is not a message and does not count as one here either. */
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
  expect(it.held[0]?.to).toEqual({ agent: "olai", session: "s-1" })
  // Held under one key per conversation, so two beats through one busy turn
  // arrive as one message — lossless, because the body is a fresh derivation.
  expect(it.held[0]?.coalesce).toBe("kolu:heartbeat")
  const body = it.words()[0] ?? ""
  // THE FOUR FACTS, and they are the point: "still here" would be true of a
  // wedged watcher too, so what it says is what a reader can disagree with.
  expect(body).toContain("— the filter file: lanes.olai.")
  expect(body).toContain("— terminals it claims right now: 1.")
  expect(body).toContain("— last watcher event: none at all since it started watching.")
  expect(body).toContain("— watching since 2026-08-31 09:00 UTC, 30 minutes so far.")
  // The head is the one line the fold shows, and it says the window and the
  // subject rather than "still here".
  expect(body.split("\n")[0]).toBe(
    "The kolu watcher is alive: 30 minutes with nothing to say about the one terminal lanes.olai claims.",
  )
  // The attribution rule the wake bodies keep, for its reason: a replayed
  // conversation rebuilds the text and nothing else.
  expect(body).toContain("Written by olai's kolu watcher at 2026-08-31 09:30 UTC, not by a person.")
  // ...and it says what it is NOT, because a quiet heartbeat read as an
  // all-clear about a broken scope is the one way this feature could hurt.
  expect(body).toContain("This is never a fault report")
})

test("a WINDOW WITH A DELIVERY IN IT produces no heartbeat at all", () => {
  // THE FLOOR, NOT THE METRONOME: a wake or a digest that reached this
  // conversation already proved everything a heartbeat would have.
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.heart.delivered(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.length).toBe(0)
  // ...and the window closed with the beat: the NEXT one heard nothing, so it
  // beats. The ledger is per beat, not per hour — nothing here compares two
  // stamps, so nothing here can drift against the interval it is measuring.
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
  const other: Scoped = { agent: "olai", session: "s-2", file: "lanes.olai" }
  const it = bench(ONE_CLAIM)
  it.scope(SEAT, other)
  it.heart.delivered(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.held.map((one) => one.to.session)).toEqual(["s-2"])
})

test("the facts are derived at SEND TIME, not when the beat fired", () => {
  // The rule `said` keeps for a wake body, spent on the one number a heartbeat
  // carries: core holds a delivery through a running turn, and a count read
  // when the beat fired is the one fact in the message that would be stale by
  // the time anybody read it.
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  // The board moves while the message waits — a dispatch somebody wrote
  // mid-turn — and so does the clock, and so does the last event.
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
  // A lane folded while the message waited: the sentence describes now.
  it.board(ONE_CLAIM)
  expect(it.words()[0] ?? "").toContain("— terminals it claims right now: 1.")
})

test("a scope core does not list is never beaten for — the fault's boundary, kept by construction", () => {
  // THE ONE THING A HEARTBEAT MUST NEVER BE is the message that tells somebody
  // their scope is broken. A scope whose file has gone is not in `scopes()` at
  // all, so this loop cannot beat for it and has no gone-detection of its own
  // to grow one. Quiet-and-fine and quiet-because-broken are two messages, and
  // this is only ever the first.
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
  // Somebody cleared the control — or the file went — during the turn the
  // message was waiting on. `scopes()` is asked again inside the thunk, so the
  // words are never composed.
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
  // Not a slot in core and not a row: four facts with a hole where the derived
  // one goes is not a heartbeat.
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
  // A scope pointed at the wrong file, or a board somebody emptied. This
  // message is the only place either of those would ever be said out loud, so
  // a count of zero is a reason to send rather than a reason to skip.
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


// ── WHAT THE BEAT SAID IT DID ──────────────────────────────────────────────

test("a beat says what it did — the head, then one line per conversation it decided about", () => {
  // THE EVIDENCE HALF of `doorbell-missing-claim`. A conversation hearing
  // nothing is the ordinary case, so "quiet" is never evidence on its own: a
  // beat that passed everybody over and a beat that never fired are the same
  // nothing from outside, and one of them is a wedged watcher. These lines are
  // the only place that difference is written down.
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.after(WINDOW)
  it.heart.beat(WINDOW)
  expect(it.lines[0]).toBe(
    "kolu doorbell beat every=1800000 scopes=1 spoken=0 lastEvent=none",
  )
  expect(it.lines[1]).toBe("kolu doorbell beating file=lanes.olai agent=olai session=s-1")
  // ...and the count is said at SEND time, not at beat time, which is where the
  // body reads it — so the line and the sentence can never disagree.
  expect(it.lines).not.toContain("kolu doorbell beat-said file=lanes.olai agent=olai terminals=1")
  it.words()
  expect(it.lines.at(-1)).toBe("kolu doorbell beat-said file=lanes.olai agent=olai terminals=1")
})

test("... and a conversation passed over says WHICH of the two reasons it was", () => {
  // The two are not the same fault and must never read alike: one is a busy
  // window doing exactly what the floor is for, the other is a store that has
  // stopped publishing and a doorbell that can derive nothing at all.
  const it = bench(ONE_CLAIM)
  it.scope(SEAT)
  it.heart.delivered({ agent: "olai", session: "s-1" })
  it.heart.beat(WINDOW)
  expect(it.lines).toContain(
    "kolu doorbell beat-passed file=lanes.olai agent=olai why=spoke-this-window",
  )
  expect(it.held.length).toBe(0)

  const starved = bench(ONE_CLAIM)
  starved.scope(SEAT)
  starved.unload()
  starved.heart.beat(WINDOW)
  expect(starved.lines).toContain(
    "kolu doorbell beat-passed file=lanes.olai agent=olai why=no-revision",
  )
  expect(starved.held.length).toBe(0)
})
test("the BEAT is not an event — a heartbeat never dates itself as one", () => {
  // The beat and this loop come off one timer, so a beat stamped as an event
  // would make "last watcher event" say "just now" forever: the one fact in
  // the message that could never fail, and therefore the one worth nothing.
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
  // The count is over the distinct VALUES the file wrote. Joining it to the
  // live roster would make a heartbeat a statement about the padi link — the
  // count would collapse to zero the moment a socket dropped, and the message
  // a person reads as "quiet and fine" would become the one that tells them
  // their fleet is gone. That is the fault's sentence, never this one's.
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
  // The stamp passes through verbatim and nothing is subtracted from it — the
  // bargain `stampOf` already keeps, one clause along.
  expect(body).toContain("— last watcher event: half past four.")
})

test("a prefix and the id it names count as ONE terminal, not two", () => {
  // The board writes eight characters far more often than a whole uuid, and one
  // file may carry both spellings — a lane row abbreviating what a step row
  // wrote out. Counting the strings would tell a person two terminals where
  // they can see one, and the count is the one number in a heartbeat somebody
  // might act on.
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
  // Right twice over: it IS two terminals, and the derivation already refuses
  // an ambiguous value ownership of either.
  expect(terminalsIn(declarationsOf(vault, ownKinds), vault, "lanes.olai")).toBe(2)
})
