import { DEFAULT_WATCH } from "olai-plugin-kolu/appliance"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { configurationFileIn } from "@olai/plugin-api/configuration"
import { watchConfigIn } from "./config.ts"

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
  `{"id":"kolu","ord":"a0","title":"kolu"}\n{"parent":"kolu","id":${JSON.stringify(id)},"ord":${JSON.stringify(ord)},"title":${JSON.stringify(title)}${
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
    file === undefined ? (configurationFileIn(Object.keys(files)) ?? null) : file,
  )

// ── The convention's door ─────────────────────────────────────────────────

test("the finder names the file by basename and case-folded, shallowest first", () => {
  expect(
    configurationFileIn([
      "pieces/week-34/settings.olai",
      "_olai/Settings.olai",
      "mocca.olai",
    ]),
  ).toBe("_olai/Settings.olai")
})

test("the finder names nothing a korrekt file does not answer to", () => {
  expect(configurationFileIn(["mocca.olai", "_olai/Pins.olai"])).toBeUndefined()
})

test("a set with no `settings.olai` says the defaults", () => {
  const reading = setOf({
    "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"the shelf everyone's reading"}`,
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})

// ── The wrench's door stays when the inside is torn ─────────────────────

test("a config that parses to nothing reads the defaults — the wrench is the caller's", () => {
  // An unparsed `_olai/Settings.olai` contributes no records: this is the
  // walk's empty-inside answer. WHICH file it was is deliberately not this
  // walk's to answer — the caller found it off the served PATHS and keeps
  // its own answer, which is what lets the drawer's wrench draw over a file
  // whose nodes the codec withheld.
  const reading = setOf({ "_olai/Settings.olai": "" })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})

test("the knobs' defaults stand where the file says nothing", () => {
  const reading = setOf({
    "_olai/Settings.olai": [rec("watch", {})].join("\n"),
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})

// ── Durations ────────────────────────────────────────────────────────────

test("the three durations parse the vault's grammar", () => {
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { "held-for": "30s", nag: "10m", heartbeat: "30m" }),
    ].join("\n"),
  })
  expect(reading.config).toEqual({
    heldForMs: 30_000,
    nagMs: { ms: 600_000 },
    heartbeatMs: 1_800_000,
  })
})

test("the nag's CAP is spelled inside its interval, and the two cross as one", () => {
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { nag: "30m/3" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual({ ms: 1_800_000, count: 3 })
})

test("a malformed duration keeps the default", () => {
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { "held-for": "soon" }),
    ].join("\n"),
  })
  expect(reading.config.heldForMs).toEqual(DEFAULT_WATCH.heldForMs)
})

test("`0s` is held-for's own spell, and not the intervals'", () => {
  const zeros = setOf({
    "_olai/Settings.olai": [
      rec("watch", { "held-for": "0s", nag: "0s", heartbeat: "0s" }),
    ].join("\n"),
  })
  expect(zeros.config.heldForMs).toBe(0)
  expect(zeros.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(zeros.config.heartbeatMs).toEqual(DEFAULT_WATCH.heartbeatMs)
})

test("a duration past the timer ceiling is the malformed half rather than a knob", () => {
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { nag: `${2_147_483_648}ms` }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
})

test("an orphaned or off-grammar cap is the malformed nag, not a negotiated half", () => {
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { nag: "/3" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
})

test("a BARE number is refused: the CLI's default-to-ms is for flags, and a file is not a flag", () => {
  // `nag: 10` as milliseconds is a 10ms re-fire spin — the argv-consistency
  // leniency kolu's parser carries reads the other way in a property file:
  // the vault says rather than doing.
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { nag: "10", heartbeat: "30" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(reading.config.heartbeatMs).toEqual(DEFAULT_WATCH.heartbeatMs)
})

test("a bare number trailing WHITESPACE is still the bare number: the gate looks at what the parser would", () => {
  // Kolu's parsers trim before judging, so `10 ` without a gate that trims
  // too parses to 10ms — the spin the refusal exists to stop, dressed as
  // a typo. The sentence quotes the file's own spelling, paper included.
  const reading = setOf({
    "_olai/Settings.olai": [
      rec("watch", { nag: "10 ", "held-for": " 5" }),
    ].join("\n"),
  })
  expect(reading.config.nagMs).toEqual(DEFAULT_WATCH.nagMs)
  expect(reading.config.heldForMs).toEqual(DEFAULT_WATCH.heldForMs)
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
    "_olai/Settings.olai": [rec("watch", { nag: "10m" })].join("\n"),
    "pieces/settings.olai": [rec("watch", { nag: "1m" })].join("\n"),
  })
  expect(reading.config.nagMs).toEqual({ ms: 10 * 60_000 })
})

test("the convention is by NAME, the way the shelf's is: a silent front-runner decides, and deeper said ones do not", () => {
  // The one behaviour this PR changed on purpose and the rule every
  // convention file already keeps (`inboxIn`, `pinsIn`): a root
  // `Settings.olai` of notes DECIDES — it is the shallowest file holding the
  // name — so the knobs say defaults, and the wrench lands on the ROOT
  // file. The reader's note file is not vetoed by a correctly-shaped
  // config sitting deeper: the answer is the name, and a reader keeping
  // one there finds it, not a layout the code knew to skip. Before
  // `configurationFileIn` the walk dodged the silent one, silently.
  expect(
    configurationFileIn(["Settings.olai", "_olai/Settings.olai"]),
  ).toBe("Settings.olai")
  const reading = setOf({
    "Settings.olai": `{"id":"k","ord":"a0","title":"kolu notes"}`,
    "_olai/Settings.olai": [rec("watch", { nag: "1m" })].join("\n"),
  })
  expect(reading.config).toEqual(DEFAULT_WATCH)
})

test("the retired file and a watch node outside the namespace are inert", () => {
  expect(setOf({ "_olai/Kolu.olai": rec("watch", { nag: "1m" }) }).config).toEqual(DEFAULT_WATCH)
  expect(setOf({ "_olai/Settings.olai": '{"id":"watch","ord":"a0","title":"watch","custom":{"nag":"1m"}}' }).config).toEqual(DEFAULT_WATCH)
})
