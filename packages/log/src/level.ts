/** A serve owns this filter. Existing fibers and callback emitters consult the
 * same value when they log, so a revision changes the level without restarting
 * their resources. The enclosing scope still owns all of those fibers. */
import { Effect, Layer, Logger, LogLevel, References } from "effect"

import { LogPresentation, type Presentation } from "./sinks.ts"

export const liveLevel = Effect.gen(function*() {
  const sinks = yield* Logger.CurrentLoggers
  let presentation: Presentation = "auto"
  let minimum: LogLevel.LogLevel = "Info"
  const logger = Logger.make((event) => {
    if (LogLevel.getOrdinal(event.logLevel) < LogLevel.getOrdinal(minimum)) return
    for (const sink of sinks) sink.log(event)
  })
  return {
    setFormat: (value: Presentation) => { presentation = value },
    set: (value: "debug" | "info" | "warn" | "error") => { minimum = ({ debug: "Debug", info: "Info", warn: "Warn", error: "Error" } as const)[value] },
    layer: Layer.mergeAll(Logger.layer([logger]), Layer.succeed(References.MinimumLogLevel, "All"), Layer.succeed(LogPresentation, () => presentation)),
  }
})
