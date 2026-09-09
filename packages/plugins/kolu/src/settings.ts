/** The watcher policy declaration; the appliance still receives milliseconds. */
import { Effect, Schema } from "effect"
import { DEFAULT_WATCH, parseDuration, parseNag, type WatchConfig } from "./client/index.ts"

const duration = (key: "held-for" | "heartbeat", value: string) => parseDuration(
  key, value.trim(),
  key === "held-for"
    ? { ms: 0, why: "a hold of zero is a legal instant report" }
    : { ms: 1, why: "a heartbeat of zero paces nothing" },
  key === "held-for" ? "its debounce fires" : "the stamp ages out",
)
export type WatchKey = "held-for" | "nag" | "heartbeat"

/** Shared by schema validation and the file adapter's warning sentence. */
export const watchProblem = (key: WatchKey, value: string): string | undefined => {
  const raw = value.trim()
  if (/^\d+$/.test(raw)) return "spell a number and a unit (500ms, 30s, 10m, 2h, 1d)"
  const read = key === "nag" ? parseNag(key, raw) : duration(key, raw)
  return read.kind === "error" ? read.message : undefined
}
const millis = (ms: number): string => ms % 60000 === 0 ? `${ms / 60000}m` : ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`

export const Watch = Schema.Struct({
  "held-for": Schema.String.check(Schema.makeFilter(
    (value) => watchProblem("held-for", value),
    { expected: "a non-negative duration with a unit" },
  )).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(millis(DEFAULT_WATCH.heldForMs))),
    Schema.annotate({ description: "how long a terminal holds attention before a report" }),
  ),
  nag: Schema.String.check(Schema.makeFilter(
    (value) => watchProblem("nag", value),
    { expected: "a positive duration with a unit and an optional /count" },
  )).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(millis(DEFAULT_WATCH.nagMs.ms)
      + (DEFAULT_WATCH.nagMs.count === undefined ? "" : `/${DEFAULT_WATCH.nagMs.count}`))),
    Schema.annotate({ description: "the reminder interval, optionally capped with /count" }),
  ),
  heartbeat: Schema.String.check(Schema.makeFilter(
    (value) => watchProblem("heartbeat", value),
    { expected: "a positive duration with a unit" },
  )).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(millis(DEFAULT_WATCH.heartbeatMs))),
    Schema.annotate({ description: "how long a silent watch remains healthy" }),
  ),
})

export const Config = Schema.Struct({
  watch: Watch.pipe(
    Schema.withDecodingDefaultKey(Effect.sync(() => Schema.decodeUnknownSync(Watch)({}))),
    Schema.annotate({ description: "terminal attention and watch pacing" }),
  ),
})

export const configuredWatch = (config: typeof Config.Type): WatchConfig => {
  const held = duration("held-for", config.watch["held-for"])
  const nag = parseNag("nag", config.watch.nag.trim())
  const heartbeat = duration("heartbeat", config.watch.heartbeat)
  if (held.kind === "error" || nag.kind === "error" || heartbeat.kind === "error") {
    throw new Error("invalid decoded watch policy")
  }
  return { heldForMs: held.value, nagMs: nag.value, heartbeatMs: heartbeat.value }
}
