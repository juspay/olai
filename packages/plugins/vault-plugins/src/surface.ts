import { BuiltPlugin } from "@olai/surface"
import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
export const surface = defineSurface({
  procedures: {
    plugins: {
      approve: {
        input: Schema.Struct({
          name: Schema.String,
          version: Schema.String,
          forever: Schema.Boolean,
        }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      trust: {
        input: Schema.Struct({
          name: Schema.String,
          version: Schema.String,
          trusting: Schema.Boolean,
        }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      remove: {
        input: Schema.Struct({ name: Schema.String }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      mint: {
        input: Schema.Struct({
          sentence: Schema.String,
          title: Schema.String,
          engine: Schema.String,
        }),
        output: Schema.Struct({
          name: Schema.String,
        }),
        error: OpFailure,
      },
      ask: {
        input: Schema.Struct({
          name: Schema.String,
          said: Schema.String,
        }),
        output: Schema.Struct({
          sent: Schema.Boolean,
        }),
        error: OpFailure,
      },
      run: {
        input: Schema.Struct({
          name: Schema.String,
        }),
        output: Schema.Struct({
          name: Schema.String,
          version: Schema.String,
          state: Schema.String,
          approved: Schema.Boolean,
          fault: Schema.optionalKey(Schema.String),
          configurationValues: BuiltPlugin.fields.configurationValues,
        }),
        error: OpFailure,
      },
      stop: {
        input: Schema.Struct({ name: Schema.String }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      guide: {
        input: Schema.Struct({}),
        output: Schema.Struct({
          text: Schema.String,
          files: Schema.Struct({ readme: Schema.String, server: Schema.String, browser: Schema.String }),
          folder: Schema.String,
        }),
        error: OpFailure,
      },
      write: {
        input: Schema.Struct({
          name: Schema.String,
          file: Schema.String,
          text: Schema.String,
        }),
        output: Schema.Struct({
          path: Schema.String,
          compiles: Schema.optionalKey(Schema.Boolean),
          why: Schema.optionalKey(Schema.String),
          version: Schema.String,
        }),
        error: OpFailure,
      },
      inspect: {
        input: Schema.Struct({}),
        output: Schema.Struct({
          modules: Schema.Array(Schema.String),
          services: Schema.Array(Schema.Struct({
            key: Schema.String,
            half: Schema.Literals(["server", "browser"]),
            availability: Schema.Literals(["core", "provided", "declared"]),
          })),
          slots: Schema.Array(Schema.Struct({
            name: Schema.String,
            keyedBy: Schema.String,
          })),
          layout: Schema.Struct({
            folder: Schema.String,
            readme: Schema.String,
            server: Schema.String,
            browser: Schema.String,
            settings: Schema.Struct({
              file: Schema.String,
              schema: Schema.String,
              properties: Schema.String,
              reserved: Schema.Array(Schema.String),
            }),
          }),
          taken: Schema.Array(Schema.String),
        }),
        error: OpFailure,
      },
    },
  },
})

export const faces = {
  browser: {
    "plugins.approve": "tool",
    "plugins.trust": "tool",
    "plugins.remove": "tool",
    "plugins.mint": "tool",
    "plugins.ask": "tool",
  },
  agent: {
    "plugins.guide": "tool",
    "plugins.inspect": "tool",
    "plugins.write": "tool",
    "plugins.run": "tool",
    "plugins.stop": "tool",
  },
} as const
