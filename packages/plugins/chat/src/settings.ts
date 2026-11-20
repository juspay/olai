import { Duration, Effect, Schema, SchemaTransformation } from "effect"
import { DEFAULT_IDLE } from "./scoped.ts"

const SPANS = {
  "sleep-after": {
    default: "6h",
    says: "How long a node agent is left alone before olai tidies its memory for it",
  },
  "sleep-latest": {
    default: "7d",
    says: "How long a moved row may wait untidied before olai tidies anyway, however few have moved",
  },
  "sleep-tick": {
    default: "15m",
    says: "How often olai looks for a node agent whose memory it could tidy",
  },
  "sleep-question": {
    default: "20m",
    says: "How long a tidying turn may sit on a question before olai stops it",
  },
  "sleep-limit": {
    default: "1h",
    says: "How long one tidying turn may run before olai stops it",
  },
} as const

type SpanKey = keyof typeof SPANS

const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/** The ceiling is the Node timer's own: a duration the timer cannot be handed
 *  is not a duration this server can wait. */
export const spanMillis = (value: string): number | undefined => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim())
  const ms = match === null ? Number.NaN : Number(match[1]) * UNITS[match[2]!]!
  return Number.isSafeInteger(ms) && ms > 0 && ms <= 2_147_483_647 ? ms : undefined
}

const span = (key: SpanKey) =>
  Schema.String.check(Schema.makeFilter(
    (value: string) => spanMillis(value) !== undefined,
    { expected: "a positive duration with a unit (500ms, 30s, 2m, 6h, 1d), at most 2147483647ms" },
  )).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(SPANS[key].default)),
    Schema.annotate({ description: SPANS[key].says }),
  )

export const Config = Schema.Struct({
  "idle-ms": Schema.Union([Schema.Int, Schema.NumberFromString.check(Schema.isInt())]).check(Schema.isBetween({ minimum: 1, maximum: 2147483647 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(Duration.toMillis(DEFAULT_IDLE))),
    Schema.annotate({ description: "How long an idle chat keeps its agent running, in milliseconds" }),
  ),
  sleep: Schema.Literals(["on", "off"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("on")),
    Schema.annotate({
      description: "Whether olai may tidy a chat's memory on its own clock at all — each chat still has to ask",
    }),
  ),
  "sleep-after": span("sleep-after"),
  "sleep-latest": span("sleep-latest"),
  "sleep-floor": Schema.Union([
    Schema.Int,
    Schema.NumberFromString.check(Schema.isInt()),
  ]).check(Schema.isBetween({ minimum: 1, maximum: 2147483647 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(5)),
    Schema.annotate({
      description: "How many rows must have moved since the last sleep before olai tidies a chat's memory",
    }),
  ),
  "sleep-tick": span("sleep-tick"),
  "sleep-question": span("sleep-question"),
  "sleep-limit": span("sleep-limit"),
  // DIGITS ONLY on the text arm, because with zero legal a blank property must
  // not read as `Number("")`, which is zero.
  "remind-every": Schema.Union([
    Schema.Int,
    Schema.String.check(Schema.isPattern(/^\d+$/)).pipe(
      Schema.decodeTo(Schema.Int, SchemaTransformation.numberFromString),
    ),
  ]).check(Schema.isBetween({ minimum: 0, maximum: 2147483647 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(20)),
    Schema.annotate({
      description: "Every how many messages a node agent is reminded when to write to its subtree; 0 never reminds",
    }),
  ),
})

export const sleepingPolicy = (config: typeof Config.Type) => {
  const of = (key: SpanKey, raw: string): Duration.Duration =>
    Duration.millis(spanMillis(raw) ?? spanMillis(SPANS[key].default)!)
  return {
    after: of("sleep-after", config["sleep-after"]),
    latest: of("sleep-latest", config["sleep-latest"]),
    floor: config["sleep-floor"],
    tick: of("sleep-tick", config["sleep-tick"]),
    question: of("sleep-question", config["sleep-question"]),
    limit: of("sleep-limit", config["sleep-limit"]),
  }
}

export const SLEEP_OFF = "sleep is off in this directory's settings"
