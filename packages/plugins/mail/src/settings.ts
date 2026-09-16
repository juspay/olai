import { Effect, Schema } from "effect"
const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
/** Same whole-number, unit and timer bounds as kolu's poll settings. */
export const pollMillis = (value: string): number | undefined => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim())
  const ms = match ? Number(match[1]) * units[match[2]!]! : NaN
  return Number.isSafeInteger(ms) && ms > 0 && ms <= 2_147_483_647 ? ms : undefined
}
export const Config = Schema.Struct({
  poll: Schema.String.check(Schema.makeFilter(value => pollMillis(value) !== undefined, { expected: "a positive duration with a unit (500ms, 30s, 2m, 1h, 1d), at most 2147483647ms" })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("2m")), Schema.annotate({ description: "how often opted-in agents check for inbox arrivals" }),
  ),
})
