/** Node-process policy. Machine resources continue to arrive through Env. */
import { Duration, Effect, Schema } from "effect"
import { DEFAULT_IDLE } from "./scoped.ts"

/**
 * WHAT THE SLEEP PASS RUNS ON — three spans, for the harness and for an
 * operator, and never something a person has to touch.
 *
 * THE DEFAULTS ARE THE DESIGN: a node agent is left alone for six hours, olai
 * looks every fifteen minutes, and a tidying turn that sits on a question for
 * twenty minutes is stopped. Everything here is a way of making those shorter
 * for a test or a slow machine, which is why the words are the plain duration
 * spells a person already writes in `_olai/Settings.olai` (`30s`, `6h`, `2d`)
 * and why an unreadable one WARNS AND FALLS BACK rather than stopping the row:
 * the file adapter decodes each leaf on its own
 * (`@olai/plugin-api`'s `decodePolicy`), so a typo here costs the default and
 * a sentence in the panel and nothing else.
 */
const SPANS = {
  "sleep-after": {
    default: "6h",
    says: "How long a node agent is left alone before olai tidies its memory for it",
  },
  "sleep-tick": {
    default: "15m",
    says: "How often olai looks for a node agent whose memory it could tidy",
  },
  "sleep-question": {
    default: "20m",
    says: "How long a tidying turn may sit on a question before olai stops it",
  },
} as const

type SpanKey = keyof typeof SPANS

const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/**
 * A span as the milliseconds it means — `undefined` for a value that is not
 * one.
 *
 * WHOLE NUMBERS, ONE UNIT, AND THE NODE TIMER'S OWN CEILING, which is mail's
 * poll rule word for word (`olai-plugin-mail`'s `pollMillis`): a duration the
 * timer cannot be handed is not a duration this server can wait, and a second
 * spelling of the grammar here would be a second thing to keep in step with
 * what a person reads in the panel.
 */
export const spanMillis = (value: string): number | undefined => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim())
  const ms = match === null ? Number.NaN : Number(match[1]) * UNITS[match[2]!]!
  return Number.isSafeInteger(ms) && ms > 0 && ms <= 2_147_483_647 ? ms : undefined
}

/** One span, as the field a person writes it in — the schema is the validity
 *  check and the default is what a bad value falls back to. */
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
      description: "Whether olai tidies a node agent's memory for it once it has been left alone",
    }),
  ),
  "sleep-after": span("sleep-after"),
  "sleep-tick": span("sleep-tick"),
  "sleep-question": span("sleep-question"),
})

/** The three spans as the durations the pass waits, off the decoded config —
 *  the one place the spellings become numbers, so a caller cannot read one of
 *  them in milliseconds and another in words. The fallback is the same default
 *  the schema carries, read off the same table, because a second spelling of it
 *  here would be a number that drifts from the one a person reads. */
export const sleepingPolicy = (config: typeof Config.Type) => {
  const of = (key: SpanKey, raw: string): Duration.Duration =>
    Duration.millis(spanMillis(raw) ?? spanMillis(SPANS[key].default)!)
  return {
    after: of("sleep-after", config["sleep-after"]),
    tick: of("sleep-tick", config["sleep-tick"]),
    question: of("sleep-question", config["sleep-question"]),
  }
}

/**
 * WHAT A PERSON IS TOLD WHEN THEY ASK FOR A PASS WITH THE SWITCH OFF.
 *
 * The verb stays on the row and says why rather than disappearing: a person who
 * looked for *Sleep now* and found nothing would go looking for a bug,
 * and the row that hides itself is the row whose absence has no explanation
 * (`olai-plugin-chat`'s `server.ts` refuses with this).
 */
export const SLEEP_OFF = "sleep is off in this directory's settings"
