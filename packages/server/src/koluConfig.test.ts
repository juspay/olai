/**
 * The watch's VAULT HALF, at its own bench: every case below is the
 * `watchConfigIn` walk or the `koluFileIn` finder, and the fixtures are
 * the read half's own JSONL so each record is checked by the parser the
 * product itself reads. Which ids a mute actually silences is the
 * watcher's (`watch.test.ts`) — these ask WHICH the vault claims, and
 * what the vault itself names the file.
 */

import { DEFAULT_WATCH } from "@olai/kolu-client"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { koluFileIn, watchConfigIn } from "./koluConfig"

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

test("a set with no `kolu.olai` says the defaults, and names no file", () => {
  const reading = setOf({
    "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"the shelf everyone's reading"}`,
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
  expect(reading.malformed).toEqual([])
  expect(reading.mutes).toEqual({ file: null, entries: [] })
})

// ── The wrenches' door stays when the inside is torn ─────────────────────

test("a config that parses to nothing still names its file — the wrench stays", () => {
  // An unparsed `_olai/Kolu.olai` contributes no records: this is the
  // walk's empty-inside answer (the codec's broken half answers above,
  // and each is whole without the other — the connector hands the two
  // pieces and the file in separately).
  const reading = setOf({ "_olai/Kolu.olai": "" })
  expect(reading.config).toEqual(DEFAULT_WATCH)
  expect(reading.mutes).toEqual({ file: "_olai/Kolu.olai", entries: [] })
})

test("a `watch`-only config names its file with no mutes", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [rec("watch", { nag: "10m" })].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(10 * 60_000)
  expect(reading.mutes).toEqual({ file: "_olai/Kolu.olai", entries: [] })
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
    muted: [],
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

// ── Mutes ────────────────────────────────────────────────────────────────

test("`mutes`' children answer value AND title, in the outline's order", () => {
  const reading = setOf({
    "_olai/Kolu.olai":
      `{"id":"m","ord":"a0","title":"mutes"}\n` +
      `{"id":"c1","parent":"m","ord":"a1","title":"the grok terminal","custom":{"terminal":"22222222"}}\n` +
      `{"id":"c2","parent":"m","ord":"a0","title":"the pi terminal","custom":{"terminal":"5c5824d5"}}\n`,
  })
  // The VALUES too follow the outline's order — byOrd, the derivation's
  // own sibling order — so the gate and the line are the same list.
  expect(reading.config.muted).toEqual(["5c5824d5", "22222222"])
  expect(reading.mutes).toEqual({
    file: "_olai/Kolu.olai",
    entries: [
      { value: "5c5824d5", title: "the pi terminal" },
      { value: "22222222", title: "the grok terminal" },
    ],
  })
})

test("an untitled mute is named by the value it mutes", () => {
  const reading = setOf({
    "_olai/Kolu.olai":
      `{"id":"m","ord":"a0","title":"mutes"}\n` +
      `{"id":"c1","parent":"m","ord":"a0","title":" ","custom":{"terminal":"5c5824d5"}}\n`,
  })
  expect(reading.mutes.entries).toEqual([
    { value: "5c5824d5", title: "5c5824d5" },
  ])
})

test("no `mutes` node mutes nobody", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [rec("watch", { nag: "10m" })].join("\n"),
  })
  expect(reading.config.muted).toEqual([])
  expect(reading.mutes).toEqual({ file: "_olai/Kolu.olai", entries: [] })
})

test("a mute child without `terminal` is no mute", () => {
  const reading = setOf({
    "_olai/Kolu.olai":
      `{"id":"m","ord":"a0","title":"mutes"}\n` +
      `{"id":"c1","parent":"m","ord":"a0","title":"some note"}\n`,
  })
  expect(reading.config.muted).toEqual([])
  expect(reading.mutes.entries).toEqual([])
})

// ── ONE file decides — including a silent one ─────────────────────────────

test("nodes hanging in another file answer on their own, as not the file's", () => {
  // `mocca.olai`'s `watch` is not the convention file's.
  const reading = setOf({
    "mocca.olai": [rec("watch", { nag: "10m" })].join("\n"),
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
  expect(reading.mutes).toEqual({ file: null, entries: [] })
})

test("the deepest duplicate loses by convention while sharing the name", () => {
  const reading = setOf({
    "_olai/Kolu.olai": [rec("watch", { nag: "10m" })].join("\n"),
    "pieces/kolu.olai": [rec("watch", { nag: "1m" })].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(10 * 60_000)
})
