import { expect, test } from "bun:test"
import { Duration, Schema } from "effect"
import { Config, sleepingPolicy, spanMillis } from "./settings.ts"

test("idle-ms decodes property strings within the Node timer range", () => {
  const decode = Schema.decodeUnknownSync(Config)
  expect(decode({})["idle-ms"]).toBe(172800000)
  for (const value of ["1", "1200", "2147483647"]) expect(decode({ "idle-ms": value })["idle-ms"]).toBe(Number(value))
  for (const value of ["0", "-1", "2147483648", "1.5", "NaN", "forever", ""]) expect(() => decode({ "idle-ms": value })).toThrow()
})

test("the pass is on, and left alone for six hours, by default", () => {
  const decode = Schema.decodeUnknownSync(Config)
  const config = decode({})
  expect(config.sleep).toBe("on")
  expect(config["sleep-after"]).toBe("6h")
  expect(config["sleep-tick"]).toBe("15m")
  expect(config["sleep-question"]).toBe("20m")
  // ... and the three become the durations the pass waits, from ONE reading:
  // the decoded config, so nothing downstream has to know which spelling a
  // person wrote.
  expect(sleepingPolicy(config)).toEqual({
    after: Duration.hours(6),
    tick: Duration.minutes(15),
    question: Duration.minutes(20),
  })
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
