/**
 * THE `_olai/Kolu.olai` WALK — its semantics, without a revision around it.
 *
 * What is covered is what `./koluConfig.ts` promises:
 *
 *   - an absent file, and a present one shaped every way a vault can shape it;
 *   - the grammar of a duration, and the malformed line saying which;
 *   - the mutes, verbatim, and what the word FIRST pins (one watch, one mutes,
 *     and no precedence that is not spelled).
 *
 * The fixtures are REAL outline records — JSONL, the format's own — parsed by
 * the format package's own testlib (`@olai/format`'s `fixtures.testlib.ts`).
 * A hand-typed record would be a note about the schema rather than the format;
 * a broken reader would be passing anyway.
 */

import { expect, test } from "bun:test"

import { DEFAULT_WATCH } from "@olai/kolu-client"
import { nodesOf, nodesOfFiles } from "@olai/format/testlib"

import { watchConfigIn } from "./koluConfig.ts"

/** One JSONL line's worth of a watch, so the reader's eye is not spent on
 *  escape quotients — the ord is stable per record, since only ONE of these
 *  exists per fixture file today. */
const rec = (title: string, fields: Record<string, string>, id = `${title}-w`): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0
      ? ""
      : `,"custom":${JSON.stringify(fields)}`
  }}`

/** The documents. Each test hands its whole vault as JSONL the parser itself
 *  accepts. */
const setOf = (files: Record<string, string>) => nodesOfFiles(files)

// ── The convention's door ─────────────────────────────────────────────────

test("a set with no `kolu.olai` says the defaults, and has nothing to say", () => {
  const reading = watchConfigIn(
    setOf({
      "_olai/Pins.olai":
        `{"id":"p","ord":"a0","title":"the shelf everyone's reading"}`,
    }),
  )
  expect(reading.config).toEqual(DEFAULT_WATCH)
  expect(reading.malformed).toEqual([])
})

test("an empty set says the defaults", () => {
  expect(watchConfigIn([]).malformed).toEqual([])
})

test("the file is by basename and case-folded, as the other conventions are", () => {
  const reading = watchConfigIn(
    setOf({
      "notes/kolu.olai": rec("watch", { "held-for": "20s" }),
    }),
  )
  expect(reading.config.heldForMs).toBe(20_000)
})

test("the FIRST file capable of deciding decides — shallowest, then lowest path", () => {
  const reading = watchConfigIn(
    setOf({
      "_olai/a/kolu.olai": rec("watch", { "held-for": "9s" }),
      "_olai/kolu.olai": rec("watch", { "held-for": "5s" }),
    }),
  )
  // `_olai/kolu.olai` is the shallower file; the 9s in the nested one is the
  // noise the walk is asked not to listen to.
  expect(reading.config.heldForMs).toBe(5_000)
})

test("the FIRST `watch` node of that file decides — a second is a mistake, not precedence", () => {
  const reading = watchConfigIn(
    setOf({
      "_olai/kolu.olai":
        rec("watch", { "held-for": "17s" }, "w1") + "\n" +
        rec("watch", { "held-for": "3s" }, "w2"),
    }),
  )
  expect(reading.config.heldForMs).toBe(17_000)
})

// ── The grammar ───────────────────────────────────────────────────────────

test("`held-for`, `nag` and `heartbeat` are durations, in the three units", () => {
  const reading = watchConfigIn(
    setOf({
      "_olai/kolu.olai": rec("watch", {
        "held-for": "90s",
        "nag": "15m",
        "heartbeat": "2h",
      }),
    }),
  )
  expect(reading.config).toEqual({
    heldForMs: 90_000,
    nagMs: 900_000,
    heartbeatMs: 7_200_000,
    muted: [],
  })
})

test("one malformed value earns one line — the default stands, and it is SAID", () => {
  const reading = watchConfigIn(
    setOf({
      "_olai/kolu.olai": rec("watch", { "held-for": "a minute or two" }),
    }),
  )
  expect(reading.config.heldForMs).toBe(DEFAULT_WATCH.heldForMs)
  // The other two knobs DEFAULT untroubled — the malformed one is the only
  // one being said about.
  expect(reading.config.nagMs).toBe(DEFAULT_WATCH.nagMs)
  expect(reading.config.heartbeatMs).toBe(DEFAULT_WATCH.heartbeatMs)
  // The sentence the server says — naming the file, the prop and the value,
  // so the owner finds the mistake in three words of reading.
  expect(reading.malformed.length).toBe(1)
  expect(reading.malformed[0]).toContain("_olai/kolu.olai")
  expect(reading.malformed[0]).toContain("held-for")
})

// ── The mutes ─────────────────────────────────────────────────────────────

test("the `mutes` node's children carry the values — verbatim, prefix and id", () => {
  const reading = watchConfigIn(
    nodesOf(
      `{"id":"m","ord":"a0","title":"mutes"}\n` +
        `{"id":"c1","parent":"m","ord":"a0","title":"the side shell nobody watches","custom":{"terminal":"5c5824d5"}}\n` +
        `{"id":"c2","parent":"m","ord":"a1","title":"just a note, never a value"}\n`,
      "_olai/Kolu.olai",
    ),
  )
  expect(reading.config.muted).toEqual(["5c5824d5"])
})

test("children of the mutes node do not trespass on elsewhere", () => {
  const reading = watchConfigIn(
    nodesOf(
      `{"id":"x","ord":"a0","title":"something else","custom":{"terminal":"not-a-child"}}\n` +
        `{"id":"m","ord":"a1","title":"mutes"}\n` +
        `{"id":"c1","parent":"m","ord":"a2","title":"the one flagged","custom":{"terminal":"t1"}}\n`,
      "_olai/Kolu.olai",
    ),
  )
  expect(reading.config.muted).toEqual(["t1"])
})

test("an empty terminal value earns no mute", () => {
  const reading = watchConfigIn(
    nodesOf(
      `{"id":"m","ord":"a0","title":"mutes"}\n` +
        `{"id":"c1","parent":"m","ord":"a0","title":"a placeholder","custom":{"terminal":""}}\n`,
      "_olai/Kolu.olai",
    ),
  )
  expect(reading.config.muted).toEqual([])
})

test("ONE FILE decides the whole: a `watch` here and a `mutes` there do not compose", () => {
  const reading = watchConfigIn(
    setOf({
      "_olai/kolu.olai": rec("watch", { "held-for": "20s" }),
      // The mutes this one holds are the mistake the first file's occupants
      // already answered: the convention judges one file.
      "_olai/torn/kolu.olai":
        `{"id":"m2","ord":"a0","title":"mutes"}\n` +
        `{"id":"c9","parent":"m2","ord":"a1","title":"elsewhere's wilful","custom":{"terminal":"d3adbeef"}}`,
    }),
  )
  expect(reading.config.heldForMs).toBe(20_000)
  expect(reading.config.muted).toEqual([])
})

test("`0s` is a legal `held-for` — the instant report — but never a `nag` or a `heartbeat`", () => {
  const legal = watchConfigIn(
    setOf({ "_olai/kolu.olai": rec("watch", { "held-for": "0s" }) }),
  )
  expect(legal.config.heldForMs).toBe(0)
  expect(legal.malformed).toEqual([])

  const spin = watchConfigIn(
    setOf({
      "_olai/kolu.olai": rec("watch", { nag: "0s", heartbeat: "0s" }),
    }),
  )
  expect(spin.config.nagMs).toBe(DEFAULT_WATCH.nagMs)
  expect(spin.config.heartbeatMs).toBe(DEFAULT_WATCH.heartbeatMs)
  expect(spin.malformed.length).toBe(2)
  expect(spin.malformed[0]).toContain("nag")
  expect(spin.malformed[1]).toContain("heartbeat")
})

test("past the ~24.8-day ceiling is past a timer's grammar", () => {
  const reading = watchConfigIn(
    setOf({
      // 597 hours is past 2_147_483_647 ms; 596 is not, which is exactly the
      // arithmetic the test cares about: the word must be lined and defaulted.
      "_olai/kolu.olai": rec("watch", { heartbeat: "597h" }),
    }),
  )
  expect(reading.config.heartbeatMs).toBe(DEFAULT_WATCH.heartbeatMs)
  expect(reading.malformed.length).toBe(1)
  expect(reading.malformed[0]).toContain("heartbeat")
})

test("`held-for` just inside the ceiling parses and is silent", () => {
  const reading = watchConfigIn(
    setOf({ "_olai/kolu.olai": rec("watch", { "held-for": "596h" }) }),
  )
  expect(reading.config.heldForMs).toBe(596 * 3_600_000)
  expect(reading.malformed).toEqual([])
})
