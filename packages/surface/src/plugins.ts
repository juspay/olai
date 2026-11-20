import { type Claims, fileKind } from "@olai/format"
import { Schema } from "effect"

export const EnvironmentReading = Schema.Union([
  Schema.Struct({ key: Schema.String, kind: Schema.Literal("secret"), set: Schema.Boolean, says: Schema.String }),
  Schema.Struct({ key: Schema.String, kind: Schema.Literal("resource"), set: Schema.Boolean, says: Schema.String, value: Schema.optionalKey(Schema.String), source: Schema.optionalKey(Schema.Literal("wrapper")) }),
])

const PolicyControl = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("choice"), options: Schema.Array(Schema.String) }),
  Schema.Struct({ kind: Schema.Literal("switch") }),
  Schema.Struct({ kind: Schema.Literal("number"), integer: Schema.Boolean, min: Schema.optionalKey(Schema.Number), max: Schema.optionalKey(Schema.Number) }),
  Schema.Struct({ kind: Schema.Literal("text"), expected: Schema.optionalKey(Schema.String) }),
])
const PolicyValue = Schema.Struct({
  key: Schema.String, value: Schema.Unknown, setBy: Schema.Literals(["vault", "default"]), says: Schema.String,
  control: Schema.optionalKey(PolicyControl),
  preference: Schema.optionalKey(Schema.Boolean),
  problem: Schema.optionalKey(Schema.Struct({ raw: Schema.String, why: Schema.String })),
})

export const BuiltPlugin = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  generation: Schema.optionalKey(Schema.Number),
  browserOnly: Schema.optional(Schema.Boolean),
  state: Schema.optionalKey(Schema.String),
  fault: Schema.optionalKey(Schema.String),
  missing: Schema.optionalKey(Schema.Array(Schema.String)),
  carrying: Schema.optionalKey(Schema.Array(Schema.String)),
  /** OPTIONAL, and that is load-bearing rather than tidy. A required field here
   *  fails DECODE for a new tab talking to an older server, and the roster's
   *  failed arm is what the browser's subscribe licence is read out of — so one
   *  missing key would take every plugin's mount down. */
  wake: Schema.optionalKey(Schema.Struct({
    subject: Schema.String,
    waiting: Schema.Struct({ one: Schema.String, many: Schema.String }),
  })),
  config: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  configurationValues: Schema.optionalKey(Schema.Array(PolicyValue)),
  configurationNode: Schema.optionalKey(Schema.Struct({ file: Schema.String, id: Schema.String })),
  desiredOn: Schema.optionalKey(Schema.Boolean),
  environment: Schema.optionalKey(Schema.Array(EnvironmentReading)),
  switchPersistence: Schema.optionalKey(Schema.Literals(["file", "session"])),
  source: Schema.optionalKey(Schema.Struct({
    folder: Schema.String,
    title: Schema.String,
    description: Schema.String,
    readme: Schema.optionalKey(Schema.String),
    version: Schema.String,
    approved: Schema.Boolean,
    decided: Schema.optionalKey(Schema.Boolean),
    trusting: Schema.optionalKey(Schema.Boolean),
    building: Schema.optionalKey(Schema.Boolean),
    on: Schema.Boolean,
    server: Schema.String,
    browser: Schema.optionalKey(Schema.String),
    approvedServer: Schema.optionalKey(Schema.String),
    approvedBrowser: Schema.optionalKey(Schema.String),
    uses: Schema.optionalKey(Schema.Array(Schema.Struct({
      said: Schema.String,
      named: Schema.String,
    }))),
    chat: Schema.optionalKey(Schema.Boolean),
    asking: Schema.optionalKey(Schema.Boolean),
    chunk: Schema.optionalKey(Schema.String),
  })),
})
export type BuiltPlugin = typeof BuiltPlugin.Type

export const PLUGIN_CHUNK_PREFIX = "/_olai/plugins/"

export const PLUGIN_FOLDER = "plugins/"
export const PLUGIN_README_FILE = "README.md"
export const PLUGIN_SERVER_FILE = "server.ts"
export const PLUGIN_BROWSER_FILE = "browser.tsx"

export const PLUGIN_FILES = [PLUGIN_README_FILE, PLUGIN_SERVER_FILE, PLUGIN_BROWSER_FILE] as const

export const WORD = /^[a-z][a-z0-9-]*$/

const STATES = ["running", "off", "optIn", "failed", "waiting", "switched", "pending"] as const

export type PluginState = (typeof STATES)[number]

const KNOWN: ReadonlySet<string> = new Set<string>(STATES)

export const pluginState = (plugin: BuiltPlugin): PluginState => {
  const word = plugin.state
  if (word !== undefined && KNOWN.has(word)) {
    const claimed = word as PluginState
    if ((claimed === "running") === plugin.running) return claimed
  }
  return plugin.running ? "running" : "off"
}

export const PluginRoster = Schema.Struct({
  configurationFile: Schema.optionalKey(Schema.String),
  configurationError: Schema.optionalKey(Schema.String),
  configurationAvailable: Schema.optionalKey(Schema.Boolean),

  instance: Schema.optionalKey(Schema.Struct({
    hostname: Schema.String,
    hostnameAuthor: Schema.optionalKey(Schema.Literals(["env", "process"])),
    host: Schema.String, port: Schema.Number,
    hostAuthor: Schema.Literals(["flag", "default", "process"]), portAuthor: Schema.Literals(["flag", "default", "process"]),
    policy: Schema.Array(PolicyValue),
    configurationNode: Schema.optionalKey(Schema.Struct({ file: Schema.String, id: Schema.String })),
    origins: Schema.Array(Schema.String),
    bearer: Schema.Struct({ set: Schema.Boolean }),
  })),
  built: Schema.Array(BuiltPlugin),

})
export type PluginRoster = typeof PluginRoster.Type

export const watchable = (
  claims: Claims,
  wake: { readonly walks?: string | undefined },
  file: string,
): boolean => {
  const kind = fileKind(claims, file)
  return kind !== null && claims.byKind.get(kind)?.holds === wake.walks
}

export const NO_ROSTER: PluginRoster = { built: [] }

export const sameRoster: (a: PluginRoster, b: PluginRoster) => boolean = Schema
  .toEquivalence(PluginRoster)
