/** Node-process policy. Machine resources continue to arrive through Env. */
import { Duration, Effect, Schema } from "effect"
import { DEFAULT_IDLE } from "./scoped.ts"

export const Config = Schema.Struct({
  "idle-ms": Schema.Union([Schema.Int, Schema.NumberFromString.check(Schema.isInt())]).check(Schema.isBetween({ minimum: 1, maximum: 2147483647 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(Duration.toMillis(DEFAULT_IDLE))),
    Schema.annotate({ description: "milliseconds an idle node conversation keeps its process" }),
  ),
})
