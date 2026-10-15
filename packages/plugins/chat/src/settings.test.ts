import { expect, test } from "bun:test"
import { Duration, Schema } from "effect"
import { Config, sleepingPolicy, spanMillis } from "./settings.ts"

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
