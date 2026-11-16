import { definePlugin } from "@olai/plugin-api"
import { Effect, Schema } from "effect"

// FOUR KNOBS, ONE OF EACH CONTROL the settings reader can draw: a short choice
// (buttons), a switch, a bounded integer (a number box that refuses what is
// outside it), and a long choice (a select). A plugin a vault defines reaches
// the same reader every built row's settings do, so one fixture covers the
// whole vocabulary.
const Config = Schema.Struct({
  tone: Schema.Literals(["blue", "red"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("blue")),
    Schema.annotate({ description: "the colour to greet in" }),
  ),
  bright: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
    Schema.annotate({ description: "whether to say it brightly" }),
  ),
  size: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(2)),
    Schema.annotate({ description: "how large the greeting is" }),
  ),
  shape: Schema.Literals(["circle", "square", "star", "oval", "line"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("circle")),
    Schema.annotate({ description: "the shape to greet with" }),
  ),
})

export default definePlugin({
  name: "greeting",
  needs: [],
  config: Config,
  apply: (config) => Effect.logInfo(`greeting ${config.tone} at ${config.size}`),
})
