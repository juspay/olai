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
    nagMs: 600_000,
    heartbeatMs: 1_800_000,
  })
  expect(reading.malformed).toEqual([])
})

test("a malformed duration keeps the default and earns its sentence", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { "held-for": "soon" }),
    ].join("\n"),
  })
  expect(reading.config.heldForMs).toEqual(DEFAULT_WATCH.heldForMs)
  expect(reading.malformed).toEqual([
    "kolu: `held-for: soon` in _olai/Kolu.olai is not a duration — write <n>s, <n>m or <n>h.",
  ])
})

test("`0s` is held-for's own spell, and not the intervals'", () => {
  const zeros = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { "held-for": "0s", nag: "0s", heartbeat: "0s" }),
    ].join("\n"),
  })
  expect(zeros.config.heldForMs).toEqual(0)
  expect(zeros.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(zeros.config.heartbeatMs).toEqual(DEFAULT_WATCH.heartbeatMs)
  expect(zeros.malformed).toEqual([
    "kolu: `nag: 0s` in _olai/Kolu.olai is not an interval its timer allows — padi refuses a nag of 0 as the spin it is.",
    "kolu: `heartbeat: 0s` in _olai/Kolu.olai is not an interval its timer allows — padi refuses a heartbeat of 0 as the spin it is.",
  ])
})

test("a duration past the timer ceiling is the malformed half rather than a knob", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [
      rec("watch", { nag: `${2_147_483_648}ms` }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(reading.malformed[0]).toMatch(/is not a duration/)
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
  expect(reading.config.nagMs).toEqual(10 * 60_000)
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
