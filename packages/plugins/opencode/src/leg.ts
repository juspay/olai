import { allowFlavoured, type Leg, namedExactly } from "@kolu/acp/engine"

import { CHILD_SESSIONS } from "./activity.ts"
import { type Called, toolsCalledIn } from "./script.ts"

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined

/**
 * opencode 2 carries a tool's programmatic name in `name`, beside `title`, on
 * `tool_call`, `tool_call_update` and a `session/request_permission`'s
 * `toolCall` alike. The title is not it: opencode rewrites a call's title
 * over its life (`shell` while it starts, `sleep 20` once the command is
 * known, a child's prefixed with the child's own).
 */
export const toolNameIn = (_meta: unknown, frame?: unknown): string | null => {
  const named = record(frame)?.["name"]
  return typeof named === "string" && named !== "" ? named : null
}

/** The builtin every MCP tool arrives inside. opencode 2's Code Mode: the
 *  model writes JavaScript, the script calls the tools, and one call id
 *  covers however many of them it ran. */
const EXECUTE = "execute"

/** ... and the builtin a spawn arrives as: `name: "subagent"`, kind `think`. */
const SUBAGENT = "subagent"

/** ... and every one the completion reported, which is the agent's own
 *  account of what the script ran (`rawOutput.metadata.toolCalls`, entries
 *  `{ tool: "<server>.<tool>", status, input? }`). `null` for a frame
 *  carrying no such list. */
export const toolsRanIn = (rawOutput: unknown): ReadonlyArray<Called> | null => {
  const ran = record(record(rawOutput)?.["metadata"])?.["toolCalls"]
  if (!Array.isArray(ran)) return null
  const called: Called[] = []
  for (const entry of ran) {
    const name = record(entry)?.["tool"]
    if (typeof name !== "string") return null
    const dot = name.indexOf(".")
    if (dot <= 0 || dot === name.length - 1) return null
    called.push({ server: name.slice(0, dot), tool: name.slice(dot + 1) })
  }
  return called
}

export const mcpCall: Leg["mcpCall"] = (frame, servers) => {
  if (frame.name !== EXECUTE) return []
  const code = record(frame.rawInput)?.["code"]
  const called = toolsRanIn(frame.rawOutput)
    ?? (typeof code === "string" ? toolsCalledIn(code) : null)
  if (called === null || called.length === 0) return []
  return called.every((one) => servers.includes(one.server)) ? called : []
}

export function replyIn(_rawOutput: unknown, content?: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(content)) return undefined
  for (const block of content) {
    const outer = record(block)
    if (outer?.["type"] !== "content") continue
    const inner = record(outer["content"])
    if (inner?.["type"] !== "text" || typeof inner["text"] !== "string") continue
    try {
      return record(JSON.parse(inner["text"]))
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * opencode asks permission once per inner call of a Code Mode script and
 * sends the same frame each time — three requests from a three-call script
 * were byte-identical but for the JSON-RPC id (2.2.7, 2026-11-11) — and the
 * request never says which tool it is about, since olai's tools, a foreign
 * server's and opencode's own builtins all arrive as one `execute`. So one
 * approval covers the whole script, and only a script `./script.ts` read in
 * full may be answered without a person.
 */
export const approvedOnlyIfScriptFullyParsed: Leg["allowedWithoutAsking"] = (tool, given, options, asked) => {
  if (tool !== EXECUTE || asked === undefined) return null
  const code = record(asked.rawInput)?.["code"]
  if (typeof code !== "string") return null
  const called = toolsCalledIn(code)
  if (called === null || called.length === 0) return null
  if (!called.every((one) => given.includes(one.server))) return null
  return allowFlavoured(options)
}

/**
 * opencode's spawn is a `subagent` call of kind `think` whose `rawInput` is
 * `{ agent, description, prompt }`: `agent` names one of opencode's own
 * agents and `description` is the line it was sent to do, which is also the
 * title the child session arrives under.
 */
export const spawned: Leg["spawned"] = (_meta, input, named) => {
  if (named !== SUBAGENT) return null
  const args = record(input)
  if (args === undefined) return null
  const kind = args["agent"], said = args["description"]
  if (typeof kind !== "string" && typeof said !== "string") return null
  return {
    ...(typeof kind === "string" ? { kind } : {}),
    ...(typeof said === "string" ? { said } : {}),
  }
}

export const OPENCODE: Leg = {
  spelling: null,
  mcpCall,
  replyIn,
  nativeActivity: CHILD_SESSIONS,
  // opencode's sign-in is an interactive wizard: `acp --login` and `auth
  // login` both answer `Pass an integration ID or name when running without
  // an interactive terminal` and exit 1 with no TTY, and `auth login <target>
  // --method key` answers `API key input requires an interactive terminal`
  // (2.2.7). `--standalone` reaches the store an `opencode acp` reads
  // (`$XDG_DATA_HOME/opencode/opencode.db`); the default goes through
  // opencode's per-machine background service.
  terminalAuth: { byHand: ["auth", "login", "--standalone"] },
  toolNameIn,
  toolNameOf: () => null,
  allowedWithoutAsking: approvedOnlyIfScriptFullyParsed,
  parentToolUse: () => null,
  spawned,
  backgroundTask: () => null,
  taskNotification: () => null,
  listedIn: () => null,
  prologueIn: () => null,
  // Refused (`-32602 mode not found`): the modes are `build` and `plan`.
  bypassMode: null,
  steering: {
    method: "_session/steering",
    meta: { steering: { idleBehavior: "promptRequired" } },
    timeout: "30 seconds",
    // opencode answers `{outcome:"injected"}` when the words went into the
    // running turn and `{outcome:"promptRequired",reason:"noRunningTurn"}` when
    // there was no turn to put them in.
    taken: (answered) => record(answered)?.["outcome"] === "injected",
    advertised: (initialized) =>
      record(record(record(initialized)?.["_meta"])?.["steering"])?.["supported"] === true,
  },
  // 2.2.7 refuses a second `session/prompt` during a turn: `-32603 "Session
  // already has an active ACP prompt: <sessionId>"`.
  queues: () => false,
  // opencode forwards no CLI messages: the model is in `configOptions` and a
  // change comes back in the method response rather than as a pushed update.
  rawMessages: null,
  models: { config: "model", nameIn: namedExactly },
}
