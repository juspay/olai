/** Node-process policy. Machine resources continue to arrive through Env. */
import { Duration, Effect, Schema, SchemaTransformation } from "effect"
import { DEFAULT_IDLE } from "./scoped.ts"

/**
 * WHAT THE SLEEP PASS RUNS ON — the spans, and the two numbers that decide WHEN
 * there is enough to do: for the harness and for an operator, and the last two
 * are a person's.
 *
 * THE DEFAULTS ARE THE DESIGN, and the tables below are where they are written:
 * the spans are ways of making the pass quicker for a test or a slow machine,
 * which is why the words are the plain duration
 * spells a person already writes in `_olai/Settings.olai` (`30s`, `6h`, `2d`)
 * and why an unreadable one WARNS AND FALLS BACK rather than stopping the row:
 * the file adapter decodes each leaf on its own
 * (`@olai/plugin-api`'s `decodePolicy`), so a typo here costs the default and
 * a sentence in the panel and nothing else.
 *
 * `sleep-floor` AND `sleep-latest` ARE NOT SPANS AND ARE NOT ONLY THE HARNESS'S:
 * they are what says how much has to have MOVED before a tidy is worth a turn,
 * because consolidation is a lossy rewrite and one that runs after every edit
 * costs more than it returns (`website/docs/chat.md`). A person who wants their memory
 * tidied sooner lowers the floor or shortens the backstop.
 */
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

/**
 * {@link Config}'s `compact-at` word for "olai says no number": the session
 * opens with nothing about compaction, and only the variables that would
 * override the person's own agent settings are taken from the spawn. THE ONE
 * SPELLING of it — chat's `openingOf` tells it from a number by type.
 */
export const MODEL_LIMIT = "model-limit"

/** Where a chat's agents compact: a number of tokens, or {@link MODEL_LIMIT}. */
export type CompactAt = number | typeof MODEL_LIMIT

/**
 * A `compact-at` size as the tokens it means — `undefined` for a word that is
 * not one. THE ONE PLACE the words become numbers, as {@link spanMillis} is
 * for spans: the schema's check and {@link compactingPolicy} both read it.
 *
 * A WHOLE NUMBER OF THOUSANDS, 100k to 1000k, spelled exactly — no sign, no
 * leading zero, no fraction, no space, a lower-case `k`. The bounds and the
 * spelling are kolu's (`packages/common/src/conductorSchema.ts`,
 * `CONDUCTOR_COMPACTS_AT_MIN`/`MAX`), written again here because that package
 * is not one olai can import: a count small enough to compact every turn is
 * not a setting anybody means.
 */
const compactTokens = (word: string): number | undefined => {
  const match = /^([1-9]\d*)k$/.exec(word)
  const thousands = match === null ? Number.NaN : Number(match[1])
  return thousands >= 100 && thousands <= 1000 ? thousands * 1000 : undefined
}

/** A size a person types, refused unless {@link compactTokens} reads it. */
const compactSize = Schema.String.check(Schema.makeFilter(
  (value: string) => compactTokens(value) !== undefined,
  { expected: "a whole number of thousands from 100k to 1000k" },
))

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
  // THE SAME SHAPE AS `idle-ms`, and for its reason: a number a person types in
  // the vault arrives as text, so the schema takes either spelling and the
  // bounds are the ones the row can actually act on.
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
  // HOW OFTEN A NODE AGENT IS REMINDED OF ITS WRITING RULE, in messages it
  // took — `sleep-floor`'s shape, with zero allowed because zero is the switch:
  // a person who finds the line noisy turns it off here (`./teaching.ts`'s
  // `REMINDER`, `website/docs/chat.md`). DIGITS ONLY on the text arm, because with zero
  // legal a blank property must not read as `Number("")`, which is zero — a
  // reminder switched off by an empty field nobody meant as "off".
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
  // WHETHER OLAI TELLS AN AGENT WHERE TO COMPACT ITS OWN CONVERSATION, and at
  // how many tokens of context. A SWITCH, TWO WORDS AND A TYPED SIZE: `200k`
  // and `model-limit` are kolu's segments, and any other size is a whole
  // number of thousands ({@link compactTokens}). The literal arms are FLAT in
  // the union, not one `Literals` nested in it, so the panel reads the words
  // as the list and the string arm as the typed value beside it.
  //
  // `model-limit`, THE DEFAULT, SENDS NO NUMBER: the person's own agent
  // settings decide, and the host variables that would override them are
  // taken away. OFF SAYS NOTHING AND TAKES NOTHING AWAY — the agent's own
  // settings and the host's variables decide, which is what every chat did
  // before these settings existed. Only an engine that can be told
  // (`@olai/plugin-api`'s `Registering.compacting`) is told; every other one
  // is opened as it always was, whatever these say. The switch's file words
  // (`yes`, `no`) are `@olai/plugin-api/configuration`'s, read where every
  // leaf is read from text (`coerceLeaf`).
  "auto-compact": Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(true)),
    Schema.annotate({
      description:
        "Whether olai acts on compact-at for an agent that can be told where to compact. Off, olai sends nothing and leaves the host's variables alone.",
    }),
  ),
  "compact-at": Schema.Union([Schema.Literal("200k"), Schema.Literal(MODEL_LIMIT), compactSize]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(MODEL_LIMIT)),
    Schema.annotate({
      description:
        "Where a conversation is compacted: model-limit (your own Claude Code settings decide), 200k, or a number of thousands from 100k to 1000k.",
    }),
  ),
})

/** Where a chat's agents compact, off the decoded config: a token count,
 *  {@link MODEL_LIMIT}, or `null` when the switch is off and olai says
 *  nothing. The fallback is the schema's own default, for the reason
 *  {@link sleepingPolicy} gives. */
export const compactingPolicy = (config: typeof Config.Type): CompactAt | null => {
  if (!config["auto-compact"]) return null
  const word = config["compact-at"]
  return word === MODEL_LIMIT ? MODEL_LIMIT : compactTokens(word) ?? MODEL_LIMIT
}

/** The spans as the durations the pass waits, off the decoded config —
 *  the one place the spellings become numbers, so a caller cannot read one of
 *  them in milliseconds and another in words. The fallback is the same default
 *  the schema carries, read off the same table, because a second spelling of it
 *  here would be a number that drifts from the one a person reads. */
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

/**
 * WHAT A PERSON IS TOLD WHEN THEY ASK FOR A PASS WITH THE SWITCH OFF — and the
 *  same sentence the mark's own verb is refused with, because a mark written
 *  while the pass cannot run at all would be a promise the row's label does not
 *  keep.
 *
 * The verb stays on the row and says why rather than disappearing: a person who
 * looked for *Tidy memory* and found nothing would go looking for a bug,
 * and the row that hides itself is the row whose absence has no explanation
 * (`olai-plugin-chat`'s `server.ts` refuses with this).
 */
export const SLEEP_OFF = "sleep is off in this directory's settings"
