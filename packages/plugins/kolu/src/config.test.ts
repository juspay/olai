/**
 * The watch's VAULT HALF, at its own bench: every case below is the
 * `watchConfigIn` walk or the `koluFileIn` finder, and the fixtures are
 * the read half's own JSONL so each record is checked by the parser the
 * product itself reads.
 *
 * IT HAD A MUTES HALF TOO — nine cases over a `mutes` node's children, the
 * values the timers gated on and the titles the drawer's foot read. They
 * went with the second doorbell (2026-08-31), which took the mute list out
 * of `_olai/Kolu.olai` altogether: a conversation's wake FILTER FILE is the
 * silence control now. What is left is the knobs and the convention, and
 * both are pinned whole.
 */

import { DEFAULT_WATCH } from "olai-plugin-kolu/appliance"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { koluFileIn, watchConfigIn } from "./config.ts"

/**
 * The configurations. One node per record, properties under `custom`
 * (the outline codec maps `-- foo: bar` to that).
 */
const rec = (
  title: string,
  fields: Record<string, string>,
  id = `${title}-w`,
  ord = "a0",
): string =>
  `{"id":${JSON.stringify(id)},"ord":${JSON.stringify(ord)},"title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0
      ? ""
      : `,"custom":${JSON.stringify(fields)}`
  }}`

/** The documents. Each test hands its whole vault as JSONL the parser itself
 *  accepts, and the walk the file the convention named — the finder's
 *  answer over the SAME keys, which is what the runtime hands it off
 *  the served outlines. */
const setOf = (files: Record<string, string>, file?: string) =>
  watchConfigIn(
    nodesOfFiles(files),
    file === undefined ? (koluFileIn(Object.keys(files)) ?? null) : file,
  )

// ── The convention's door ─────────────────────────────────────────────────

test("the finder names the file by basename and case-folded, shallowest first", () => {
  expect(
    koluFileIn([
      "pieces/week-34/kolu.olai",
      "_olai/Kolu.olai",
      "mocca.olai",
    ]),
  ).toBe("_olai/Kolu.olai")
})

test("the finder names nothing a korrekt file does not answer to", () => {
  expect(koluFileIn(["mocca.olai", "_olai/Pins.olai"])).toBeUndefined()
})

test("a set with no `kolu.olai` says the defaults", () => {
  const reading = setOf({
    "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"the shelf everyone's reading"}`,
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
  expect(reading.malformed).toEqual([])
})

// ── The wrench's door stays when the inside is torn ─────────────────────

test("a config that parses to nothing reads the defaults — the wrench is the caller's", () => {
  // An unparsed `_olai/Kolu.olai` contributes no records: this is the
  // walk's empty-inside answer. WHICH file it was is deliberately not this
  // walk's to answer — the caller found it off the served PATHS and keeps
  // its own answer, which is what lets the drawer's wrench draw over a file
  // whose nodes the codec withheld.
  const reading = setOf({ "_olai/Kolu.olai": "" })
  expect(reading.config).toEqual(DEFAULT_WATCH)
  expect(reading.malformed).toEqual([])
})

test("the knobs' defaults stand where the file says nothing", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [rec("watch", {})].join("\n"),
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})

// ── Durations ────────────────────────────────────────────────────────────

test("the three durations parse the vault's grammar", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { "held-for": "30s", nag: "10m", heartbeat: "30m" }),
    ].join("\n"),
  })
  expect(reading.config).toEqual({
    heldForMs: 30_000,
    nagMs: { ms: 600_000 },
    heartbeatMs: 1_800_000,
  })
  expect(reading.malformed).toEqual([])
})

test("the nag's CAP is spelled inside its interval, and the two cross as one", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { nag: "30m/3" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual({ ms: 1_800_000, count: 3 })
  expect(reading.malformed).toEqual([])
})

test("a malformed duration keeps the default and earns KOLU'S OWN sentence", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { "held-for": "soon" }),
    ].join("\n"),
  })
  expect(reading.config.heldForMs).toEqual(DEFAULT_WATCH.heldForMs)
  // NOT the vault half's own composing: the parsers the `kolu watch` face
  // reads compose the sentence, and this is the wrap that names WHERE.
  expect(reading.malformed.length).toBe(1)
  expect(reading.malformed[0]).toContain("kolu: `held-for: soon` in _olai/Kolu.olai:")
  expect(reading.malformed[0]).toContain("held-for \"soon\" is not a duration")
})

test("`0s` is held-for's own spell, and not the intervals'", () => {
  const zeros = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { "held-for": "0s", nag: "0s", heartbeat: "0s" }),
    ].join("\n"),
  })
  expect(zeros.config.heldForMs).toBe(0)
  expect(zeros.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(zeros.config.heartbeatMs).toEqual(DEFAULT_WATCH.heartbeatMs)
  expect(zeros.malformed.length).toBe(2)
  // BOTH refusals are kolu's own spin sentences — a nag of zero loops and a
  // heartbeat of zero paces nothing; the vault is told in the face's words.
  expect(zeros.malformed[0]).toContain("kolu: `nag: 0s` in _olai/Kolu.olai:")
  expect(zeros.malformed[0]).toContain("spin")
  expect(zeros.malformed[1]).toContain("kolu: `heartbeat: 0s` in _olai/Kolu.olai:")
  expect(zeros.malformed[1]).toContain("paces nothing")
})

test("a duration past the timer ceiling is the malformed half rather than a knob", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { nag: `${2_147_483_648}ms` }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(reading.malformed[0]).toContain("overflows the timer")
})

test("an orphaned or off-grammar cap is the malformed nag, not a negotiated half", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { nag: "/3" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(reading.malformed.length).toBe(1)
  expect(reading.malformed[0]).toContain("kolu: `nag: /3` in _olai/Kolu.olai:")
  expect(reading.malformed[0]).toContain("the count after the slash caps")
})

test("a BARE number is refused: the CLI's default-to-ms is for flags, and a file is not a flag", () => {
  // `nag: 10` as milliseconds is a 10ms re-fire spin — the argv-consistency
  // leniency kolu's parser carries reads the other way in a property file:
  // the vault says rather than doing.
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { nag: "10", heartbeat: "30" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(reading.config.heartbeatMs).toEqual(DEFAULT_WATCH.heartbeatMs)
  expect(reading.malformed.length).toBe(2)
  expect(reading.malformed[0]).toContain("kolu: `nag: 10` in _olai/Kolu.olai: spell a number and a unit")
  expect(reading.malformed[1]).toContain("kolu: `heartbeat: 30` in _olai/Kolu.olai: spell a number and a unit")
})

// ── ONE file decides — including a silent one ─────────────────────────────

test("nodes hanging in another file answer on their own, as not the file's", () => {
  // `mocca.olai`'s `watch` is not the convention file's.
  const reading = setOf({
    "mocca.olai": [rec("watch", { nag: "10m" })].join("\n"),
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})

test("the deepest duplicate loses by convention while sharing the name", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [rec("watch", { nag: "10m" })].join("\n"),
    "pieces/kolu.olai": [rec("watch", { nag: "1m" })].join("\n"),
  })
  expect(reading.config.nagMs).toEqual({ ms: 10 * 60_000 })
})

test("the convention is by NAME, the way the shelf's is: a silent front-runner decides, and deeper said ones do not", () => {
  // The one behaviour this PR changed on purpose and the rule every
  // convention file already keeps (`inboxIn`, `pinsIn`): a root
  // `Kolu.olai` of notes DECIDES — it is the shallowest file holding the
  // name — so the knobs say defaults, and the wrench lands on the ROOT
  // file. The reader's note file is not vetoed by a correctly-shaped
  // config sitting deeper: the answer is the name, and a reader keeping
  // one there finds it, not a layout the code knew to skip. Before
  // `koluFileIn` the walk dodged the silent one, silently.
  expect(
    koluFileIn(["Kolu.olai", "_olai/Kolu.olai"]),
  ).toBe("Kolu.olai")
  const reading = setOf({
    "Kolu.olai": `{"id":"k","ord":"a0","title":"kolu notes"}`,
    "_olai/Kolu.olai": [rec("watch", { nag: "1m" })].join("\n"),
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})
