import { definePlugin } from "@olai/plugin-api"
import { Effect, Schema } from "effect"

const Config = Schema.Struct({
  tone: Schema.Literals(["blue", "red"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("blue")),
    Schema.annotate({ description: "the colour to greet in" }),
  ),
  size: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(2)),
    Schema.annotate({ description: "how large the greeting is" }),
  ),
})

export default definePlugin({
  name: "greeting",
  needs: [],
  config: Config,
  apply: (config) => Effect.logInfo(`greeting ${config.tone} at ${config.size}`),
})
