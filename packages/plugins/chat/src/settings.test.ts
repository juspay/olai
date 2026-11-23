import { expect, test } from "bun:test"
import { coerceLeaf, policyControl } from "@olai/plugin-api/configuration"
import { Duration, Schema } from "effect"
import { compactingPolicy, Config, sleepingPolicy, spanMillis } from "./settings.ts"

test("idle-ms decodes property strings within the Node timer range", () => {
  const decode = Schema.decodeUnknownSync(Config)
  expect(decode({})["idle-ms"]).toBe(172800000)
  for (const value of ["1", "1200", "2147483647"]) expect(decode({ "idle-ms": value })["idle-ms"]).toBe(Number(value))
  for (const value of ["0", "-1", "2147483648", "1.5", "NaN", "forever", ""]) expect(() => decode({ "idle-ms": value })).toThrow()
})

test("the pass is on, left alone for six hours, and needs five moved rows", () => {
  const decode = Schema.decodeUnknownSync(Config)
  const config = decode({})
  expect(config.sleep).toBe("on")
  expect(config["sleep-after"]).toBe("6h")
  expect(config["sleep-floor"]).toBe(5)
  expect(config["sleep-latest"]).toBe("7d")
  expect(config["sleep-tick"]).toBe("15m")
  expect(config["sleep-question"]).toBe("20m")
  expect(config["sleep-limit"]).toBe("1h")
  // ... and they become the numbers the pass reads, from ONE reading: the decoded
  // config, so nothing downstream has to know which spelling a person wrote.
  expect(sleepingPolicy(config)).toEqual({
    after: Duration.hours(6),
    latest: Duration.days(7),
    floor: 5,
    tick: Duration.minutes(15),
    question: Duration.minutes(20),
    limit: Duration.hours(1),
  })
})

test("the floor is a whole number of rows, and zero or a fraction is refused", () => {
  const decode = Schema.decodeUnknownSync(Config)
  // A NUMBER A PERSON TYPED ARRIVES AS TEXT, like `idle-ms`, and a floor of one
  // is the lowest setting that still means "a row has moved".
  expect(decode({ "sleep-floor": "2" })["sleep-floor"]).toBe(2)
  expect(decode({ "sleep-floor": 1 })["sleep-floor"]).toBe(1)
  for (const value of ["0", "-1", "1.5", "many", ""]) {
    expect(() => decode({ "sleep-floor": value })).toThrow()
  }
  // ...AND THE BACKSTOP IS A SPAN, refused and spelled like the others.
  expect(decode({ "sleep-latest": "12h" })["sleep-latest"]).toBe("12h")
  for (const value of ["0", "7", "a week", ""]) {
    expect(() => decode({ "sleep-latest": value })).toThrow()
  }
})

test("`off` is a word, and a span is a duration or it is refused", () => {
  const decode = Schema.decodeUnknownSync(Config)
  expect(decode({ sleep: "off" }).sleep).toBe("off")
  for (const value of ["0", "-1", "6", "6 hours", "6h30m", "", "forever"]) {
    expect(() => decode({ "sleep-after": value })).toThrow()
  }
  // THE VALUE THE FILE ADAPTER FALLS BACK TO is the schema's own default, so a
  // typo costs the default and a sentence in the panel (`decodePolicy`) rather
  // than the whole row.
  expect(spanMillis("6h")).toBe(21_600_000)
  expect(spanMillis("30s")).toBe(30_000)
  expect(spanMillis("2d")).toBe(172_800_000)
  expect(spanMillis("1d1h")).toBeUndefined()
  expect(spanMillis("2147483648ms")).toBeUndefined()
})

test("a node agent is reminded every twenty messages, and zero is the switch that turns it off", () => {
  const decode = Schema.decodeUnknownSync(Config)
  expect(decode({})["remind-every"]).toBe(20)
  expect(decode({ "remind-every": "3" })["remind-every"]).toBe(3)
  expect(decode({ "remind-every": "0" })["remind-every"]).toBe(0)
  for (const value of ["-1", "1.5", "often", ""]) {
    expect(() => decode({ "remind-every": value })).toThrow()
  }
})

test("olai names no size unless a person chooses one, and off says nothing", () => {
  const decode = Schema.decodeUnknownSync(Config)
  const config = decode({})
  expect(config["auto-compact"]).toBe(true)
  expect(config["compact-at"]).toBe("model-limit")
  expect(compactingPolicy(config)).toBe("model-limit")
  expect(compactingPolicy(decode({ "compact-at": "200k" }))).toBe(200_000)
  // EVERY SIZE IS THE NUMBER IT SAYS — the bounds included, and the three
  // sizes PR 733 listed beside 200k mean what they meant there, so a file that
  // says one carries on unchanged.
  for (const [word, tokens] of [
    ["100k", 100_000],
    ["250k", 250_000],
    ["300k", 300_000],
    ["500k", 500_000],
    ["1000k", 1_000_000],
  ] as const) {
    expect(compactingPolicy(decode({ "compact-at": word }))).toBe(tokens)
  }
  // OFF IS `null`, whatever `compact-at` says: the agent is told nothing,
  // rather than told never to compact — and `model-limit` is not off.
  for (const word of ["500k", "200k", "model-limit"]) {
    expect(compactingPolicy(decode({ "auto-compact": false, "compact-at": word }))).toBeNull()
  }
})

test("a size is a whole number of thousands from 100k to 1000k, spelled exactly, and the switch is written yes or no", () => {
  const decode = Schema.decodeUnknownSync(Config)
  for (const value of ["99k", "1001k", "250", "250K", "250.5k", "0250k", "-200k", " 250k", "abc", "", 200_000]) {
    expect(() => decode({ "compact-at": value })).toThrow()
  }
  // DRAWN AS TWO WORDS AND A TYPED SIZE, read from the file the way the panel
  // writes it, and a refusal names what a size must be, so the person reading
  // it under the knob knows what to type.
  const size = Config.fields["compact-at"]
  expect(policyControl(size.ast)).toEqual({
    kind: "choice",
    options: ["200k", "model-limit"],
    other: { expected: "a whole number of thousands from 100k to 1000k" },
  })
  expect(coerceLeaf(size, "250k")).toBe("250k")
  expect(() => coerceLeaf(size, "250")).toThrow("a whole number of thousands from 100k to 1000k")
  // The switch's words are `yes` and `no`, and nothing else is.
  const toggle = Config.fields["auto-compact"]
  expect(policyControl(toggle.ast)).toEqual({ kind: "switch" })
  expect(coerceLeaf(toggle, "no")).toBe(false)
  expect(coerceLeaf(toggle, "yes")).toBe(true)
  for (const value of ["on", "true", "1", ""]) {
    expect(() => coerceLeaf(toggle, value)).toThrow()
  }
})
