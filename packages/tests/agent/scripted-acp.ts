import { nativeActivity } from "./native-activity.ts"

import { spawn } from "node:child_process"
import { appendFileSync, writeFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import { basename, join } from "node:path"

import { readMessages } from "../support/ndjson.ts"
import { emitter, MARKER_FILE, MARKER_FILE_FOR, RELEASE, released as releasedIn, SLEEP_STAMP, speaking } from "../support/scripted.ts"
import { sessionStore } from "./session-store.ts"
import { commandLine, commandWords } from "./command.ts"

const OUT = process.stdout

export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}
export interface ScriptedTool {
  readonly announced: (
    server: string,
    tool: string,
    args: unknown,
  ) => Readonly<Record<string, unknown>>
  readonly wrapped: (
    result: CallToolResult,
  ) => { readonly rawOutput: unknown; readonly content?: ReadonlyArray<Record<string, unknown>> }
}

let toolWire: ScriptedTool = { announced: () => ({}), wrapped: () => ({ rawOutput: undefined }) }

const memoryReport = (): string => {
  const made = (value: string): string => `harness memory: off (${value})`
  if (process.env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"] === "1") return made("auto memory disabled")
  try {
    const config: unknown = JSON.parse(process.env["CODEX_CONFIG"] ?? "")
    if (typeof config === "object" && config !== null && !Array.isArray(config)) {
      const record = config as Record<string, unknown>
      const features = record["features"]
      if (typeof features === "object" && features !== null && !Array.isArray(features)) {
        const settings = features as Record<string, unknown>
        if (settings["memories"] === false) {
          const kept = Object.keys(record).filter((key) => key !== "features").map((key) => `${key}=${String(record[key])}`)
          return made(`features.memories=false` + (kept.length === 0 ? "" : `, kept ${kept.join(" ")}`))
        }
      }
    }
  } catch {
  }
  return "harness memory: on"
}
let isCodex = false

const emit = emitter(OUT)
const { notify: sendNotification, refuse, request, respond, take, withdraw } = speaking(emit, "agent")
const notify = (method: string, params: unknown): void => {
  if (method === "session/update" && typeof params === "object" && params !== null
    && "sessionId" in params && typeof params.sessionId === "string"
    && "update" in params && typeof params.update === "object" && params.update !== null) {
    sessionStore(cwd).update(params.sessionId, params.update as Record<string, unknown>)
  }
  sendNotification(method, params)
}

const SPAWN_TITLE = "Task"

const waiting = new Set<unknown>()

const settledEarly = new Set<unknown>()

const reply = (id: unknown, result: unknown): void => {
  if (settledEarly.delete(id)) return
  respond(id, result)
}

const withdrawRequests = (): void => {
  for (const id of withdraw()) {
    notify("$/cancel_request", { requestId: id })
  }
}

const noise = (line: string): void => {
  process.stderr.write(`${line}\n`)
}

let cwd = process.cwd()
let sessionId = "fake-session-1"
let mcp: { url: string; headers: Record<string, string> } | null = null
let servers: ReadonlyArray<string> = []
const attachment = new Map<string, string>()
let cancelled = false
let deaf = false
let running = false
const steered: Array<string> = []
let steerRefused = false
let busyRefused = false
let steerSwallowed = false
let steerDelayMs = 0
const SLOW_STEER_MS = 2_000
let listRefused = false
let capabilities: Record<string, unknown> = {}



const STORED = process.env["OLAI_FAKE_ACP_STORED"] ?? ""
const stored = () => STORED !== ""

const STORED_TITLES: Record<string, string> = {
  "fake-stored-old": "an older conversation",
  "fake-stored-new": "the last conversation",
}

interface Minted {
  readonly title: string | null
  readonly updatedAt: string
  readonly messageCount: number
}
const minted = new Map<string, Minted>()

const listedSessions = () => {
  if (sessionStore(cwd).enabled) return sessionStore(cwd).list()
  const staticRows = stored() ? storedSessions() : []
  const staticIds = new Set(staticRows.map((row) => row.sessionId))
  return [
    ...staticRows,
    ...[...minted]
      .filter(([id]) => !staticIds.has(id) && !forgotten(id))
      .map(([sessionId, row]) => ({
        sessionId,
        cwd,
        title: row.title,
        updatedAt: row.updatedAt,
        _meta: { claudeCode: { messageCount: row.messageCount } },
      })),
  ]
}

const forgotten = (sessionId: string): boolean =>
  existsSync(`${cwd}/${MARKER_FILE_FOR.forgottenSession(sessionId)}`)

const missingHere = (sessionId: string): boolean =>
  existsSync(`${cwd}/${MARKER_FILE_FOR.sessionMissingHere(sessionId)}`)

const refusesToOpen = (verb: "new" | "load"): boolean =>
  existsSync(`${cwd}/${MARKER_FILE_FOR.refusalToOpen(verb)}`)

const holdsLoad = (): boolean => existsSync(`${cwd}/${MARKER_FILE.holdLoad}`)

const holdingOpen = (): boolean => {
  const marker = `${cwd}/${MARKER_FILE.holdOpen}`
  if (!existsSync(marker)) return false
  rmSync(marker, { force: true })
  return true
}

const silent = (): boolean => existsSync(`${cwd}/${MARKER_FILE.saysNothing}`)

const identityOnly = (): boolean => existsSync(`${cwd}/${MARKER_FILE.identityOnly}`)

const needsSignature = (): boolean =>
  existsSync(`${cwd}/${MARKER_FILE.needsAuth}`) && !existsSync(`${cwd}/${MARKER_FILE.signedIn}`)

const waitAtThePage = async (still: () => boolean = () => true): Promise<boolean> => {
  const marker = `${cwd}/${MARKER_FILE.atThePage}`
  for (let waited = 0; waited < LOGIN_LIMIT_MS; waited += 100) {
    if (!still()) return false
    if (existsSync(marker)) {
      rmSync(marker, { force: true })
      return true
    }
    await new Promise((done) => setTimeout(done, 100))
  }
  return false
}

const LOGIN_LIMIT_MS = 20_000

const REMOTE_SIGNALS = ["NO_BROWSER", "SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY", "CLAUDE_CODE_REMOTE"]

const feelsRemote = (): boolean =>
  REMOTE_SIGNALS.some((name) => (process.env[name] ?? "") !== "")

const terminalAuth = (mode: string, label: string) => ({
  command: process.execPath,
  args: [join(import.meta.dirname, "fake-login.ts"), mode],
  label,
})

const AUTH_STATUS_METHOD = "_auth/status_update"

const defaultIdentity = (): Record<string, unknown> => isCodex
  ? {
    kind: "account",
    label: "ChatGPT Plus",
    account: { email: "you@example.com", plan: "plus" },
  }
  : {
    kind: "account",
    label: "Claude Max",
    account: { email: "you@example.com", organization: "Olai", plan: "max" },
  }

const identityNow = (): Record<string, unknown> => {
  const path = `${cwd}/${MARKER_FILE.identity}`
  if (existsSync(path)) {
    try {
      const read: unknown = JSON.parse(readFileSync(path, "utf8"))
      if (typeof read === "object" && read !== null && !Array.isArray(read)) {
        return read as Record<string, unknown>
      }
    } catch {
    }
  }
  if (needsSignature()) return { kind: "none", label: "Not logged in" }
  return defaultIdentity()
}

let publishedIdentity: string | null = null

const publishIdentity = (): void => {
  if (silent()) return
  const status = identityNow()
  const said = JSON.stringify(status)
  if (said === publishedIdentity) return
  publishedIdentity = said
  notify(AUTH_STATUS_METHOD, { authStatus: status })
}

const authMethodsOffered = (): ReadonlyArray<Record<string, unknown>> => {
  if (silent() || identityOnly()) return []
  if (isCodex) {
    return [
      { id: "api-key", name: "API Key", description: "Use an API key to authenticate", type: "env_var" },
      {
        id: "chat-gpt-device-code",
        name: "ChatGPT (device code)",
        description: "Sign in to ChatGPT by opening a verification page and entering a one-time code",
      },
    ]
  }
  if (feelsRemote()) {
    return [{
      id: "claude-login",
      name: "Log in with Claude",
      description: "Run `claude /login` in the terminal",
      type: "terminal",
      args: ["--cli"],
      _meta: { "terminal-auth": terminalAuth("tui", "Claude Login") },
    }]
  }
  return [
    {
      id: "claude-ai-login",
      name: "Claude Subscription",
      description: "Use Claude subscription ",
      type: "terminal",
      args: ["--cli", "auth", "login", "--claudeai"],
      _meta: { "terminal-auth": terminalAuth("login", "Claude Login") },
    },
    {
      id: "console-login",
      name: "Anthropic Console",
      description: "Use Anthropic Console (API usage billing)",
      type: "terminal",
      args: ["--cli", "auth", "login", "--console"],
      _meta: { "terminal-auth": terminalAuth("login", "Anthropic Console Login") },
    },
  ]
}

const storedSessions = () =>
  [
    {
      sessionId: "fake-stored-old",
      cwd,
      title: STORED_TITLES["fake-stored-old"],
      updatedAt: "2026-07-01T09:00:00.000Z",
      _meta: { claudeCode: { messageCount: 47, supersededBy: "fake-stored-new" } },
    },
    {
      sessionId: "fake-stored-new",
      cwd: `${cwd}/`,
      title: STORED_TITLES["fake-stored-new"],
      updatedAt: "2026-08-01T17:30:00.000Z",
      _meta: { claudeCode: { messageCount: 1 } },
    },
  ].filter((session) => !forgotten(session.sessionId))

const MODEL_ROWS = [
  { value: "fake-model-1", name: "Fake One" },
  { value: "fake-model-2", name: "Fake Two" },
  { value: "sonnet", name: "Fake Sonnet" },
  { value: "haiku", name: "Fake Haiku" },
  { value: "opus[1m]", name: "Fake Opus (1M context)" },
  { value: "fable", name: "Fake Fable" },
]

const refusedForAccount = (): string | null => {
  try {
    return readFileSync(`${cwd}/${MARKER_FILE.refuseModelByAccount}`, "utf8").trim() || null
  } catch {
    return null
  }
}

const pinnedModel = (): string => {
  try {
    return readFileSync(`${cwd}/${MARKER_FILE.pinnedModel}`, "utf8").trim() || "fake-model-1"
  } catch {
    return "fake-model-1"
  }
}

let currentModel = "fake-model-1"
let reasoning = "medium"
let mode = "code"
let fast = false

const configOptions = () => [
  { id: "model", name: "Model", type: "select", currentValue: currentModel, options: MODEL_ROWS },
  { id: "reasoning", name: "Reasoning", description: "How deeply the agent thinks", type: "select", currentValue: reasoning, options: (currentModel === "fake-model-2" ? ["medium", "high", "xhigh"] : ["medium", "high"]).map(value => ({ value, name: value })) },
  { id: "mode", name: "Mode", type: "select", currentValue: mode, options: ["code", "plan"].map(value => ({ value, name: value })) },
  { id: "fast", name: "Fast mode", type: "boolean", currentValue: fast },
]

const OFFERED = new Set(MODEL_ROWS.map((row) => row.value))

const EDITED = {
  before: [
    "# Kitchen notes",
    "",
    "The remodel is in three parts, and two of them are waiting on the third.",
    "",
    "- oak doors, twelve of them, ordered on the second",
    "- a worktop nobody has chosen yet",
    "- the sink stays exactly where it is",
    "- the tiles are somebody else's problem",
    "",
    "Nothing here is decided until the worktop is.",
    "",
  ].join("\n"),
  after: [
    "# Kitchen notes",
    "",
    "The remodel is in three parts, and two of them are waiting on the third.",
    "",
    "- oak doors, twelve of them, delivered on the ninth",
    "- a walnut worktop, ordered on the tenth",
    "- the sink stays exactly where it is",
    "- the tiles are somebody else's problem",
    "- the lights arrive with the worktop",
    "",
    "The worktop settles it: everything else can be booked in now.",
    "",
    "_Rewritten while you watched._",
    "",
  ].join("\n"),
}

const EDITED_HUNKS = [
  {
    before: [
      "- oak doors, twelve of them, ordered on the second",
      "- a worktop nobody has chosen yet",
    ].join("\n"),
    after: [
      "- oak doors, twelve of them, delivered on the ninth",
      "- a walnut worktop, ordered on the tenth",
    ].join("\n"),
  },
  {
    before: "- the tiles are somebody else's problem",
    after: [
      "- the tiles are somebody else's problem",
      "- the lights arrive with the worktop",
    ].join("\n"),
  },
  {
    before: "Nothing here is decided until the worktop is.",
    after: [
      "The worktop settles it: everything else can be booked in now.",
      "",
      "_Rewritten while you watched._",
    ].join("\n"),
  },
]

const EDITED_OUTLINE = {
  before: [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets"}`,
    "",
  ].join("\n"),
  after: [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","desc":"oak, twelve of them"}`,
    "",
  ].join("\n"),
}

const unbroken = (seed: string): string => {
  const unit = `${seed}X`
  return unit.repeat(Math.ceil(700 / unit.length)).slice(0, 700)
}

const LONG_ADDED = unbroken("added")
const LONG_REMOVED = unbroken("removed")
const LONG_CONTEXT = unbroken("context")

const LONG_EDITED = {
  before: [
    "# Kitchen notes",
    "",
    LONG_CONTEXT,
    LONG_REMOVED,
    "the sink stays exactly where it is",
    "the tiles are somebody else's problem",
    "the lights arrive with the worktop",
    "Nothing here is decided until the worktop is.",
    "book the electrician",
    "book the tiler",
    "",
  ].join("\n"),
  after: [
    "# Kitchen notes",
    "",
    LONG_CONTEXT,
    LONG_ADDED,
    "the sink stays exactly where it is",
    "the tiles are somebody else's problem",
    "the lights arrive with the worktop",
    "Nothing here is decided until the worktop is.",
    "book the electrician",
    "book the tiler",
    "",
  ].join("\n"),
}

const REWRITTEN = {
  before: `${Array.from({ length: 600 }, (_, at) => `was ${at}`).join("\n")}\n`,
  after: `${Array.from({ length: 600 }, (_, at) => `now ${at}`).join("\n")}\n`,
}

const COMMANDS = [
  { name: "review", description: "review the outline" },
  { name: "plan", description: "plan the next step" },
  { name: "compact", description: "compact the conversation" },
]

let nextMcpId = 0
let lastSpawn: string | null = null

const callMcp = async (
  method: string,
  params: unknown,
): Promise<Record<string, unknown>> => {
  if (mcp === null) throw new Error("no MCP server was configured")
  const response = await fetch(mcp.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...mcp.headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextMcpId, method, params }),
  })
  if (response.status === 202) return {}
  const body = (await response.json()) as { result?: Record<string, unknown> }
  return body.result ?? {}
}

let externals = new Map<string, {
  type?: string
  name?: string
  command?: string
  args?: ReadonlyArray<string>
  env?: ReadonlyArray<{ name: string; value: string }>
}>()

interface External {
  readonly ask: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
  readonly drop: () => void
}

const attached2 = new Map<string, External | null>()

const dropAttached = (): void => {
  for (const held of attached2.values()) held?.drop()
  attached2.clear()
}

const externalOf = async (name: string): Promise<External | null> => {
  const held = attached2.get(name)
  if (held !== undefined) return held
  const entry = externals.get(name)
  if (entry === undefined || entry.command === undefined) {
    attached2.set(name, null)
    return null
  }
  let drop: (() => void) | undefined
  try {
    const child = spawn(
      entry.command,
      [...(entry.args ?? [])],
      {
        stdio: ["pipe", "pipe", "inherit"],
        env: {
          ...process.env,
          ...Object.fromEntries((entry.env ?? []).map((pair) => [pair.name, pair.value])),
        } as Record<string, string>,
      },
    )
    const reap = (): void => { child.kill() }
    drop = reap
    if (child.stdin === null || child.stdout === null) throw new Error("no pipes")
    let next = 0
    const pending = new Map<number, (message: Record<string, unknown>) => void>()
    let queue = ""
    child.stdout.on("data", (chunk: Buffer) => {
      queue += chunk.toString("utf8")
      for (;;) {
        const at = queue.indexOf("\n")
        if (at === -1) return
        const line = queue.slice(0, at).trim()
        queue = queue.slice(at + 1)
        if (line === "") continue
        let message: Record<string, unknown>
        try {
          message = JSON.parse(line) as Record<string, unknown>
        } catch {
          continue
        }
        const mid = message["id"]
        if (typeof mid !== "number") continue
        pending.get(mid)?.(message)
      }
    })
    const ask = (method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> =>
      new Promise((resolve, reject) => {
        const mid = ++next
        const timer = setTimeout(() => {
          pending.delete(mid)
          reject(new Error(`${method} unanswered after 300s`))
        }, 300_000)
        pending.set(mid, (message) => {
          clearTimeout(timer)
          pending.delete(mid)
          if (message["error"] !== undefined) reject(new Error(JSON.stringify(message["error"])))
          else resolve((message["result"] as Record<string, unknown>) ?? {})
        })
        child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, ...(params === undefined ? {} : { params }) }) + "\n")
      })
    await ask("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "fake-acp-agent", version: "0.0.0" },
    })
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
    const external: External = { ask, drop: reap }
    attached2.set(name, external)
    return external
  } catch (thrown) {
    drop?.()
    attached2.set(name, null)
    attachment.set(name, "failed")
    noise(`external ${name}: attach failed — ${String(thrown)}`)
    return null
  }
}

const useExternal = async (
  server: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> => {
  const toolCallId = `call-${++nextMcpId}`
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      ...toolWire.announced(server, name, args),
      status: "in_progress",
      rawInput: args,
    },
  })
  const sayOutcome = (status: "completed" | "failed", output: unknown): void =>
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status, rawOutput: output },
    })
  const server_ = await externalOf(server)
  if (server_ === null) {
    sayOutcome("failed", { error: `no attached MCP server named \`${server}\`` })
    return `no attached MCP server named \`${server}\``
  }
  try {
    const result = await server_.ask("tools/call", { name, arguments: args })
    const blocks = result["content"] as ReadonlyArray<{ type?: string; text?: string }> | undefined
    const said = blocks?.find((block) => block?.type === "text")?.text
      ?? JSON.stringify(result["structuredContent"] ?? result)
    sayOutcome(result["isError"] === true ? "failed" : "completed", toolWire.wrapped(result as unknown as CallToolResult).rawOutput)
    return said
  } catch (thrown) {
    attachment.set(server, "failed")
    sayOutcome("failed", { error: String(thrown) })
    return `the call failed: ${String(thrown)}`
  }
}

const completed = (toolCallId: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
  })
}

const useTool = async (
  name: string,
  args: Record<string, unknown>,
  late = false,
): Promise<Record<string, unknown>> => {
  const toolCallId = `call-${++nextMcpId}`
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      ...(late ? { title: "pending MCP call", rawInput: args } : toolWire.announced("olai", name, args)),
      locations: [{ path: `${cwd}/house.olai`, line: 12 }],
      status: "in_progress",
    },
  })

  const result = await callMcp("tools/call", { name, arguments: args })
  const failed = result["isError"] === true
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      ...(late ? toolWire.announced("olai", name, args) : {}),
      status: failed ? "failed" : "completed",
      ...toolWire.wrapped(result as unknown as CallToolResult),
    },
  })
  return result
}

const CHUNK = 5

const PACE = 15

const ANSWER = [
  "The cabinets are the part of this that has to be decided first, " +
  "because everything else in the room is measured off them. A run along " +
  "the north wall gives you the longest uninterrupted counter, and the " +
  "window stays where it is. Anything else you do to the room has to be " +
  "drawn after that line is fixed, which is the whole reason it is fixed " +
  "first and not last. The depth is the only number worth arguing about, " +
  "and the answer is the standard one, because every appliance in the " +
  "catalogue is built to it. Going deeper buys you a shelf you cannot " +
  "reach across and a counter you cannot wipe without leaning.",
  "The alternative is an island, which reads better in a drawing than it " +
  "does in a kitchen this size: two people cannot pass behind a chair, " +
  "and the chairs are the whole point of an island. So the island is out, " +
  "and what it was for — somewhere to sit that is not the table — moves " +
  "to the end of the run, where a shallow overhang and two stools do the " +
  "same job and cost a tenth as much. It also leaves the floor clear, " +
  "which is the thing you notice every day and the thing no drawing ever " +
  "shows. A kitchen you can walk through is worth more than a kitchen you " +
  "can photograph.",
  "That leaves the appliances. The oven wants to be near the sink and not " +
  "near the door; the fridge wants to be near the door and not near the " +
  "oven. Those two wants are the same wall, so one of them loses, and it " +
  "should be the fridge: a fridge is opened for ten seconds and an oven " +
  "is worked at for an hour, and the hour is the one worth arranging the " +
  "room around. The dishwasher is not a choice at all — it goes beside " +
  "the sink, on the side your good hand is on, and there is no second " +
  "opinion about it. The bin goes under the sink, for the same reason and " +
  "with the same lack of argument. Everything else — the kettle, the " +
  "toaster, the thing that makes the bread — lives on the counter and can " +
  "be moved by hand, so none of it is a decision anybody has to make " +
  "today.",
  "The lighting follows the counter rather than the ceiling. One line of " +
  "it under the upper cabinets, one over the sink, and nothing in the " +
  "middle of the room at all — a room lit from its edges reads as bigger " +
  "than the same room lit from its centre, and this room needs all the " +
  "help it can get. The switch for the under-cabinet run goes by the " +
  "door, not by the counter, because the person who wants it on is the " +
  "person walking in, and they are carrying something in both hands. Put " +
  "it at the height everything else in the house is at, and nobody will " +
  "ever have to look for it.",
  "None of this is expensive except the cabinets, which is the usual " +
  "shape of a kitchen: the joinery is the project and everything else is " +
  "shopping. If the budget has to give somewhere, it gives on the " +
  "appliances, which can be replaced one at a time later on, and never on " +
  "the run along the north wall. That run is the room, and everything the " +
  "room is asked to do for the next twenty years is asked of it. Buy the " +
  "doors you want the first time; the handles can wait, and so can the " +
  "tiles. What you cannot do later is move the wall the run is on, or the " +
  "window that decides where the light falls on it, and those two are the " +
  "whole of what a kitchen is.",
].join("\n\n")

const say = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  })
}

const showPicture = (): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      content: {
        type: "image",
        mimeType: "image/png",
        data:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    },
  })
}

const sleep = (millis: number) => new Promise<void>((done) => setTimeout(done, millis))

const released = async (onTick?: () => void, stopped?: () => boolean): Promise<void> => {
  const let_go = await releasedIn(cwd, async () => {
    await takeSteering()
    onTick?.()
  }, stopped)
  if (!let_go) noise("fake agent: nothing released the held turn; going on anyway")
}

const takeSteering = async (): Promise<void> => {
  for (const text of steered.splice(0)) {
    const [verb, ...rest] = commandWords(text)
    const argument = rest.join(" ")
    if (verb === "done") {
      await useTool("outlines_done", { id: argument })
      say(` — steered mid-turn: marked \`${argument}\` done.`)
      continue
    }
    say(` — steered mid-turn: ${text}`)
  }
}

let forwardsInit = false

const sdkInit = (model: string): void => {
  if (!forwardsInit) return
  notify("_claude/sdkMessage", {
    sessionId,
    message: {
      type: "system",
      subtype: "init",
      model,
      mcp_servers: servers.map((name) => ({
        name,
        status: attachment.get(name) ?? "connected",
      })),
    },
  })
}

let liveModel = "fake-model-1"

let used = 0
let size = 200_000

const usageUpdate = (final: boolean): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "usage_update",
      used,
      size,
      ...(final ? { cost: { amount: 0.1234, currency: "USD" } } : {}),
    },
  })
}

const endedCancelled = (id: unknown): boolean => {
  if (!cancelled) return false
  reply(id, { stopReason: "cancelled" })
  return true
}

const canElicit = (): boolean => {
  const elicitation = capabilities["elicitation"] as
    | { form?: unknown }
    | null
    | undefined
  return elicitation?.form != null
}

const clientCanElicitUrl = (): boolean => {
  const elicitation = capabilities["elicitation"] as
    | { url?: unknown }
    | null
    | undefined
  return elicitation?.url != null
}

const terminalsAdvertised = (): boolean =>
  (capabilities["_meta"] as { terminal_output?: unknown } | null | undefined)
    ?.terminal_output === true

const shellTerminal = (call: string) => ({
  block: { type: "terminal", terminalId: call },
  info: { terminal_info: { terminal_id: call } },
  output: (data: string) => ({ terminal_output: { terminal_id: call, data } }),
  exit: (code: number) => ({ terminal_exit: { terminal_id: call, exit_code: code, signal: null } }),
  fenced: (data: string) => ({
    type: "content",
    content: { type: "text", text: "```console\n" + data.trimEnd() + "\n```" },
  }),
})

const attaching = (named: string | undefined): { attachments?: Array<{ path: string }> } => {
  if (named === undefined) return {}
  const paths = named.split(",").map((one) => one.trim()).filter(Boolean)
  return { attachments: paths.map((path) => ({ path: path.startsWith("/") ? path : `${cwd}/${path}` })) }
}

const runTurn = async (id: unknown, text: string): Promise<void> => {
  cancelled = false
  noise(`fake agent: ${text}`)

  sdkInit(liveModel)

  const [verb, ...rest] = commandWords(text)
  const argument = rest.join(" ")

  const mailWords = [verb, ...rest].join(" ")
  const property = /^set property (\S+) (\S+) (\S+)$/.exec(mailWords)
  if (property) {
    const answer = await useTool("outlines_prop", { id: property[1], key: property[2], value: property[3] })
    say(JSON.stringify(answer))
    reply(id, { stopReason: "end_turn" })
    return
  }
  const mailCall = (() => {
    const draft = /^draft mail to (.+?) subject (.+?) saying ([\s\S]+?)(?: attaching ([^\n]+))?$/.exec(mailWords)
    if (draft) return { name: "draft", args: { to: [draft[1]!], subject: draft[2]!.replace(/\\n/g, "\n"), body: draft[3], ...attaching(draft[4]) } }
    const draftReply = /^draft reply to mail thread (\S+)(?: cc (.+?))? saying (.+)$/.exec(mailWords)
    if (draftReply) return { name: "draft", args: { thread: draftReply[1], ...(draftReply[2] ? { cc: draftReply[2].split(",").map(value => value.trim()) } : {}), body: draftReply[3] } }
    const draftUpdate = /^update mail draft (\S+)(?: on thread (\S+))? saying (.+?)(?: attaching ([^\n]+))?$/.exec(mailWords)
    if (draftUpdate) return { name: "draft_update", args: { draft: draftUpdate[1], ...(draftUpdate[2] ? { thread: draftUpdate[2] } : { to: ["ravi@example.com"], subject: "Revised" }), body: draftUpdate[3], ...attaching(draftUpdate[4]) } }
    if (mailWords === "list my inbox") return { name: "inbox", args: {} }
    if (mailWords.startsWith("search mail for ")) return { name: "search", args: { query: mailWords.slice(16) } }
    const thread = /^(read|archive|trash|untrash) mail thread (\S+)$/.exec(mailWords)
    if (thread) return { name: thread[1] === "read" ? "thread" : thread[1]!, args: { thread: thread[2] } }
    const attachment = /^save mail attachment (\S+) (\S+)$/.exec(mailWords)
    if (attachment) return { name: "attachment", args: { message: attachment[1], attachment: attachment[2] } }
    const label = /^label mail thread (\S+) with (.+)$/.exec(mailWords)
    if (label) return { name: "label", args: { thread: label[1], add: [label[2]] } }
    const read = /^mark mail thread (\S+) (read|unread)$/.exec(mailWords)
    if (read) return { name: "read", args: { thread: read[1], read: read[2] === "read" } }
    return null
  })()
  if (mailCall) {
    const answer = await useTool(`mail_${mailCall.name}`, mailCall.args)
    say("```json\n" + JSON.stringify(answer) + "\n```")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (commandLine(text).startsWith("[olai] Sleep.")) {
    const named = /the node `([^`]+)` in `([^`]+)`/.exec(text)
    const node = named?.[1]
    if (node === undefined) {
      say("that row names no node agent.")
      reply(id, { stopReason: "end_turn" })
      return
    }
    if (existsSync(`${cwd}/${MARKER_FILE.sleepAsk}`)) {
      rmSync(`${cwd}/${MARKER_FILE.sleepAsk}`, { force: true })
      if (!canElicit()) {
        say("the client cannot draw a form, so there is nothing to ask")
        reply(id, { stopReason: "end_turn" })
        return
      }
      appendFileSync(`${cwd}/${MARKER_FILE.sleepAsked}`, "")
      await request("elicitation/create", {
        mode: "form",
        sessionId,
        toolCallId: `call-${++nextMcpId}`,
        message: "Which rows should I archive?",
        requestedSchema: {
          type: "object",
          properties: {
            question_0: {
              type: "string",
              title: "Archive",
              oneOf: [{ const: "all", title: "all" }, { const: "none", title: "none" }],
            },
          },
        },
      })
      if (endedCancelled(id)) return
      say("you answered.")
      reply(id, { stopReason: "end_turn" })
      return
    }
    if (existsSync(`${cwd}/${MARKER_FILE.sleepOutside}`) || existsSync(`${cwd}/${MARKER_FILE.sleepTrash}`)) {
      const said: Array<string> = []
      const outside = `${cwd}/${MARKER_FILE.sleepOutside}`
      if (existsSync(outside)) {
        const target = readFileSync(outside, "utf8").trim()
        rmSync(outside, { force: true })
        said.push(JSON.stringify(await useTool("outlines_prop", { id: target, key: "tidy-probe", value: "1" })))
      }
      const trash = `${cwd}/${MARKER_FILE.sleepTrash}`
      if (existsSync(trash)) {
        const target = readFileSync(trash, "utf8").trim()
        rmSync(trash, { force: true })
        said.push(JSON.stringify(await useTool("outlines_trash", { id: target })))
      }
      say(said.join("\n"))
      reply(id, { stopReason: "end_turn" })
      return
    }
    if (existsSync(`${cwd}/${MARKER_FILE.sleepStamp}`)) {
      rmSync(`${cwd}/${MARKER_FILE.sleepStamp}`, { force: true })
      const refused = await useTool("outlines_prop", {
        id: node,
        key: "chat-agent-slept",
        value: SLEEP_STAMP,
      })
      const opted = await useTool("outlines_prop", {
        id: node,
        key: "chat-agent-sleep",
        value: "",
      })
      say(JSON.stringify(refused))
      say(JSON.stringify(opted))
      reply(id, { stopReason: "end_turn" })
      return
    }
    const read = await useTool("outlines_subtree", { id: node, depth: 1, withDesc: false })
    const answer = read["structuredContent"] as
      | { readonly children?: ReadonlyArray<{ readonly id?: string; readonly title?: string }> }
      | undefined
    const child = answer?.children?.[0]
    if (child?.id === undefined) {
      say("that node has no children to tidy.")
      reply(id, { stopReason: "end_turn" })
      return
    }
    await useTool("outlines_title", { id: child.id, title: "tidied" })
    if (existsSync(`${cwd}/${MARKER_FILE.sleepHold}`)) {
      rmSync(`${cwd}/${MARKER_FILE.sleepHold}`, { force: true })
      await released(() => void 0, () => cancelled)
      if (endedCancelled(id)) return
    }
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "memory") {
    say(memoryReport())
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "native") {
    const air = (capabilities._meta as { jetbrains?: { air?: { version?: number; capabilities?: string[] } } } | undefined)?.jetbrains?.air
    if (air?.version !== 1 || !air.capabilities?.includes("nativeSubagentSessions") || !air.capabilities.includes("asyncTasks")) {
      refuse(id, -32603, "native activity capabilities were not negotiated"); return
    }
    await nativeActivity(argument, sessionId, notify, request, async () => {
      if (argument !== "slow") return released()
      while (!cancelled && !existsSync(`${cwd}/${MARKER_FILE.release}`)) { await takeSteering(); await sleep(20) }
      if (!cancelled) rmSync(`${cwd}/${MARKER_FILE.release}`, { force: true })
    }, () => cancelled)
    if (endedCancelled(id)) return
    say("Native work handled")
    reply(id, { stopReason: "end_turn" }); return
  }
  if (verb === "settings") {
    if (argument === "update") {
      reasoning = "high"; mode = "plan"; fast = true
      notify("session/update", { sessionId, update: { sessionUpdate: "config_option_update", configOptions: configOptions() } })
    }
    say(`Settings: reasoning=${reasoning}, mode=${mode}, fast=${fast}`)
    reply(id, { stopReason: "end_turn" }); return
  }
  if (verb === "execution-plan") {
    const plan = (entries: unknown[]) => notify("session/update", { sessionId, update: { sessionUpdate: "plan", entries } })
    if (argument === "clear") plan([])
    else {
      plan([{ content: "Inspect the outline", priority: "high", status: "in_progress" },
        { content: "Old next step", priority: "low", status: "pending" }])
      await released()
      plan([{ content: "Inspect the outline", priority: "high", status: "completed" },
        { content: "Verify the changes", priority: "medium", status: "completed" }])
    }
    say("Plan updated"); reply(id, { stopReason: "end_turn" }); return
  }
  if (verb === "terminal") {
    if (capabilities["terminal"] !== true) { refuse(id, -32603, "client did not advertise terminals"); return }
    const variant = rest[0]
    const limit = variant === "truncate" ? 7 : variant === "zero" ? 0 : 65536
    const script = variant === "truncate" || variant === "zero"
      ? 'process.stdout.write("old output 🌍éEND"); process.exitCode=7'
      : 'process.stdout.write("stdout ready\\n"); process.stderr.write("stderr ready\\n"); setInterval(()=>{},1000)'
    const created = await request("terminal/create", { sessionId, command: "node", args: ["-e", script], outputByteLimit: limit }) as { terminalId: string }
    const params = { sessionId, terminalId: created.terminalId }
    notify("session/update", { sessionId, update: { sessionUpdate: "tool_call", toolCallId: "terminal-test", title: "Run verification", kind: "execute", status: "in_progress", content: [{ type: "terminal", terminalId: created.terminalId }] } })
    if (variant !== "truncate" && variant !== "zero") {
      while (!cancelled && !existsSync(`${cwd}/${MARKER_FILE.release}`)) await sleep(20)
      if (!cancelled) { rmSync(`${cwd}/${MARKER_FILE.release}`, { force: true }); await request("terminal/kill", params) }
    }
    const exit = await request("terminal/wait_for_exit", params)
    const output = await request("terminal/output", params)
    await request("terminal/release", params)
    notify("session/update", { sessionId, update: { sessionUpdate: "tool_call_update", toolCallId: "terminal-test", status: "completed" } })
    say("Terminal released: " + JSON.stringify({ exit, output }))
    reply(id, { stopReason: cancelled ? "cancelled" : "end_turn" }); return
  }

  if (verb === "bash") {
    const long = rest[0] === "long"
    const command = long ? "cat notes.txt" : "echo hello"
    const output = long ? "line one\n" : "hello\n"
    const toolCallId = `call-${++nextMcpId}`
    const asTerminal = terminalsAdvertised()
    const term = shellTerminal(toolCallId)
    const names = asTerminal ? { content: [term.block] } : {}
    notify("session/update", { sessionId, update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: "Terminal",
      kind: "execute",
      status: "pending",
      rawInput: {},
      ...names,
      _meta: {
        ...(isCodex ? {} : { claudeCode: { toolName: "Bash" } }),
        ...(asTerminal ? term.info : {}),
      },
    } })
    notify("session/update", { sessionId, update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      title: command,
      kind: "execute",
      rawInput: { command, description: long ? unbroken("describe") : "Say hello" },
    } })
    if (asTerminal) {
      notify("session/update", { sessionId, update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        _meta: term.output(output),
      } })
    }
    notify("session/update", { sessionId, update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      title: "Bash",
      status: "completed",
      ...(asTerminal
        ? { ...names, _meta: term.exit(0) }
        : { content: [term.fenced(output)] }),
    } })
    say("ran it")
    reply(id, { stopReason: "end_turn" }); return
  }
  if (verb === "vanish") process.exit(1)

  if (verb === "error") {
    refuse(id, -32603, "this turn cannot be run in the mode this session is in")
    return
  }

  const moving = verb === "window" ? Number(rest[0]) : null
  const holding = verb === "window" && rest[1] === "hold"

  used += 12_000
  usageUpdate(false)
  if (holding) await released()
  if (moving !== null) size = moving
  used += 900
  usageUpdate(true)

  if (verb === "window") {
    say(`the context window is ${size} now.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "crash") {
    say("about to fall over")
    await sleep(20)
    process.exit(1)
  }

  if (verb === "slow" && argument === "steering") {
    steerDelayMs = SLOW_STEER_MS
    say("steering will answer slowly from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "slow") {
    say("thinking")
    for (let tick = 0; tick < 200 && !cancelled; tick++) {
      await takeSteering()
      await sleep(50)
    }
    reply(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  if (verb === "deaf") {
    say("thinking, and no longer listening")
    deaf = true
    process.stdin.destroy()
    await sleep(30_000)
    return
  }

  if (verb === "talkative") {
    for (let said = 1; said <= 12; said++) {
      say(`still working ${said}\n`)
      await sleep(700)
    }
    reply(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  if (verb === "picture") {
    say("here it is:")
    showPicture()
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "refuse" && argument === "busy") {
    busyRefused = true
    say("a second message while working will be refused from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "refuse" && argument === "steering") {
    steerRefused = true
    say("steering refused from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "swallow" && argument === "steering") {
    steerSwallowed = true
    say("steering will be swallowed from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "lose") {
    listRefused = true
    say("the conversation store is unreadable")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "servers") {
    say(`servers: [${servers.join(" ")}]`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "attach") {
    const [name, status] = argument.split(/\s+/)
    if (name !== undefined && status !== undefined) attachment.set(name, status)
    say(`${name} is ${status} from the next turn`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "stream") {
    const pace = argument === "slow" ? PACE : 0
    for (let at = 0; at < ANSWER.length; at += CHUNK) {
      say(ANSWER.slice(at, at + CHUNK))
      if (pace > 0) await sleep(pace)
    }
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "flood") {
    for (let line = 0; line < 40; line++) {
      say(`line ${line} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
    }
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "watch") {
    const toolCallId = `call-${++nextMcpId}`
    const task = "bwa85c0r2"
    const description = "kolu fleet watch"
    const notice = `Command running in background with ID: ${task}.`
    const asTerminal = terminalsAdvertised()
    const term = shellTerminal(toolCallId)
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "kolu watch --states waiting,awaiting --held-for 60s --nag 10m",
        status: "pending",
        rawInput: { command: "kolu watch --states waiting,awaiting", run_in_background: true },
        ...(asTerminal ? { content: [term.block] } : {}),
        _meta: {
          claudeCode: { toolName: "Bash" },
          ...(asTerminal ? term.info : {}),
        },
      },
    })
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "in_progress",
        _meta: {
          claudeCode: {
            toolName: "Bash",
            backgroundTask: { taskId: task, taskType: "local_bash", description },
          },
          ...(asTerminal ? { ...term.info, ...term.output(notice), ...term.exit(0) } : {}),
        },
        rawOutput: notice,
        content: asTerminal ? [term.block] : [term.fenced(notice)],
      },
    })
    say("armed the watch; I will keep working.")
    void released().then(() => {
      const ended = {
        taskId: task,
        taskType: "local_bash",
        description,
        status: "failed",
      }
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: "failed",
          _meta: { claudeCode: { toolName: "Bash", taskStatus: "failed", backgroundTask: ended } },
        },
      })
      const summary = `Background command "${description}" failed with exit code 3`
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: "failed",
          _meta: {
            claudeCode: {
              toolName: "Bash",
              taskStatus: "failed",
              backgroundTask: { ...ended, summary },
            },
          },
          content: [{ type: "content", content: { type: "text", text: summary } }],
        },
      })
    })
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "abandon") {
    const toolCallId = `call-${++nextMcpId}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "a call nobody ever reported on",
        status: "in_progress",
        rawInput: { abandoned: true },
      },
    })
    say("started something and gave up on it.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "twice") {
    const toolCallId = `call-${++nextMcpId}`
    const announced = {
      sessionUpdate: "tool_call",
      toolCallId,
      title: "a call reported twice",
      status: "in_progress",
      rawInput: { said: "once" },
      locations: [{ path: `${cwd}/notes.md`, line: 3 }],
    }
    const reported = {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: "completed",
      rawOutput: { said: "twice" },
      content: [
        { type: "content", content: { type: "text", text: "the same words twice" } },
      ],
    }
    notify("session/update", { sessionId, update: announced })
    notify("session/update", { sessionId, update: announced })
    notify("session/update", { sessionId, update: reported })
    notify("session/update", { sessionId, update: reported })
    say("said the same thing twice.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "benchmark-transcript") {
    for (let i = 0; i < 150; i++) {
      say(`Section ${i}\n\n\`\`\`typescript\nconst item${i} = { before: ${i}, after: ${i + 1} };\nconsole.log(item${i});\n\`\`\`\n`)
      const toolCallId = `call-${++nextMcpId}`
      notify("session/update", { sessionId, update: {
        sessionUpdate: "tool_call", toolCallId, title: `Edit benchmark-${i}.md`, status: "completed",
        rawInput: { file_path: `${cwd}/benchmark-${i}.md` },
        _meta: { claudeCode: { toolName: "Edit" } },
        content: [{ type: "diff", path: `${cwd}/benchmark-${i}.md`, oldText: `# Section ${i}\nOld explanation.\nUnchanged ending.\n`, newText: `# Section ${i}\nNew explanation.\nUnchanged ending.\n` }],
      } })
    }
    say("Benchmark transcript ready.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "hold") {
    writeFileSync(`${cwd}/${MARKER_FILE.heldPid}`, String(process.pid))
    const toolCallId = `call-${++nextMcpId}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "a tool call you can watch",
        status: "in_progress",
        rawInput: { held: argument === "" ? "until released" : argument },
        locations: [{ path: "/served/house.olai", line: 12 }],
      },
    })
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "in_progress",
        content: [
          { type: "content", content: { type: "text", text: "halfway through" } },
        ],
      },
    })
    say("working on it")
    await releasedIn(cwd, async () => { await takeSteering(); say(".") }, () => cancelled)
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "completed",
        rawOutput: { released: true },
      },
    })
    say(" — and done.")
    reply(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  if (verb === "ask") {
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      reply(id, { stopReason: "end_turn" })
      return
    }
    if (argument === "later") await released()
    const answer = await request("elicitation/create", {
      mode: "form",
      sessionId,
      toolCallId: `call-${++nextMcpId}`,
      message: "Which cabinets should I order?",
      requestedSchema: {
        type: "object",
        properties: {
          question_0: {
            type: "string",
            title: "Cabinets",
            oneOf: [
              { const: "oak", title: "oak", description: "the ones in the drawing" },
              { const: "birch", title: "birch" },
            ],
          },
          question_0_custom: {
            type: "string",
            title: "Other",
            description: "Type your own answer instead of choosing an option above (optional).",
            _meta: {
              _askUserQuestionCustomAnswer: {
                questionId: "question_0",
                isCustomAnswer: true,
              },
            },
          },
        },
      },
    })
    if (endedCancelled(id)) return
    say(`you answered: ${JSON.stringify(answer)}`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "askstrict") {
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      reply(id, { stopReason: "end_turn" })
      return
    }
    const answer = await request("elicitation/create", {
      mode: "form",
      sessionId,
      message: "How many cabinets?",
      requestedSchema: {
        type: "object",
        required: ["howMany"],
        properties: {
          howMany: { type: "integer", title: "How many" },
          note: { type: "string", title: "Note" },
        },
      },
    })
    if (endedCancelled(id)) return
    say(`you answered: ${JSON.stringify(answer)}`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "nameless") {
    const answer = await request("session/request_permission", {
      sessionId,
      toolCall: { toolCallId: `call-${++nextMcpId}`, title: "do something unnamed" },
      options: [
        { kind: "allow_once", name: "Allow Once", optionId: "allow" },
        { kind: "reject_once", name: "Deny", optionId: "reject" },
      ],
    })
    if (endedCancelled(id)) return
    const outcome = (answer as { outcome?: { outcome?: string; optionId?: string } })
      ?.outcome
    say(`permission: ${outcome?.optionId ?? outcome?.outcome ?? "nothing"}`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "plan" || verb === "permit") {
    const plan = verb === "plan"
    const toolCallId = `call-${++nextMcpId}`
    const toolName = plan ? "ExitPlanMode" : "mcp__olai__outlines_done"
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: plan ? "Ready to code?" : toolName,
        status: "pending",
        rawInput: {},
        _meta: { claudeCode: { toolName } },
      },
    })
    const answer = await request("session/request_permission", {
      sessionId,
      toolCall: { toolCallId, title: plan ? "Ready to code?" : toolName },
      options: plan
        ? [
          { kind: "allow_always", name: 'Yes, and use "auto" mode', optionId: "auto" },
          { kind: "allow_always", name: "Yes, and auto-accept edits", optionId: "acceptEdits" },
          { kind: "allow_once", name: "Yes, and manually approve edits", optionId: "default" },
          { kind: "reject_once", name: "No, keep planning", optionId: "plan" },
        ]
        : [
          { kind: "reject_once", name: "Deny", optionId: "reject" },
          { kind: "allow_once", name: "Allow Once", optionId: "allow" },
        ],
    })
    if (endedCancelled(id)) return
    const outcome = (answer as { outcome?: { outcome?: string; optionId?: string } })
      ?.outcome
    say(`permission: ${outcome?.optionId ?? outcome?.outcome ?? "nothing"}`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "model") {
    liveModel = argument
    say(`switched to ${argument}.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "reconfig") {
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "config_option_update", configOptions: configOptions() },
    })
    say("the session's options were re-announced.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "edit") {
    const toolCallId = `call-${++nextMcpId}`
    const file = argument === "" ? "notes.md" : argument
    const texts = file.endsWith(".olai")
      ? EDITED_OUTLINE
      : file === "huge.md"
      ? REWRITTEN
      : file === "long.md"
      ? LONG_EDITED
      : EDITED
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: `Edit ${file}`,
        status: "in_progress",
        rawInput: { file_path: `${cwd}/${file}` },
        _meta: { claudeCode: { toolName: "Edit" } },
        content: [
          {
            type: "diff",
            path: `${cwd}/${file}`,
            oldText: texts.before,
            newText: texts.after,
          },
        ],
      },
    })
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
    })
    say(`rewrote \`${file}\`.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "hunks") {
    const toolCallId = `call-${++nextMcpId}`
    const file = argument === "" ? "notes.md" : argument
    const path = `${cwd}/${file}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: `Edit ${file}`,
        status: "in_progress",
        rawInput: { file_path: path },
        _meta: { claudeCode: { toolName: "Edit" } },
        content: [
          {
            type: "diff",
            path,
            oldText: EDITED_HUNKS[0]?.before,
            newText: EDITED_HUNKS[0]?.after,
          },
        ],
      },
    })
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        _meta: { claudeCode: { toolName: "Edit" } },
        content: EDITED_HUNKS.map((hunk) => ({
          type: "diff",
          path,
          oldText: hunk.before,
          newText: hunk.after,
        })),
        locations: EDITED_HUNKS.map(() => ({ path })),
      },
    })
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
    })
    say(`rewrote \`${file}\` in ${EDITED_HUNKS.length} places.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "subagent") {
    const announce = (
      toolCallId: string,
      title: string,
      claudeCode: Record<string, unknown>,
      differs: {
        readonly rawInput?: Record<string, unknown>
        readonly status?: string
      } = {},
    ): void => {
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title,
          status: differs.status ?? "in_progress",
          rawInput: differs.rawInput ?? { description: title },
          _meta: { claudeCode },
        },
      })
    }
    const spawn = (id: string, said: string, kind?: string): void => {
      lastSpawn = id
      announce(id, SPAWN_TITLE, { toolName: "Agent", subagent: true }, {
        rawInput: {
          description: said,
          prompt: `${said}, and report back`,
          ...(kind === undefined ? {} : { subagent_type: kind }),
        },
        status: "pending",
      })
    }
    const inside = (id: string, title: string, parent: string): void =>
      announce(id, title, { toolName: "Grep", parentToolUseId: parent })
    const reported = (call: string, said: string): void =>
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: call,
          status: "completed",
          content: [{ type: "content", content: { type: "text", text: said } }],
        },
      })

    if (argument === "asks" || argument === "elicits") {
      const elicits = argument === "elicits"
      const agent = `agent-${++nextMcpId}`
      const before = `sub-${++nextMcpId}`
      const asking = `call-${++nextMcpId}`
      const after = `sub-${++nextMcpId}`
      spawn(agent, "explore the outline", "Explore")
      inside(before, "grep for cabinets", agent)
      announce(asking, elicits ? "AskUserQuestion" : "run a command", {
        toolName: elicits ? "AskUserQuestion" : "Bash",
        parentToolUseId: agent,
      })
      const answer = elicits
        ? await request("elicitation/create", {
          mode: "form",
          sessionId,
          toolCallId: asking,
          message: "Which cabinets should I order?",
          requestedSchema: {
            type: "object",
            properties: {
              question_0: {
                type: "string",
                title: "Cabinets",
                oneOf: [{ const: "oak", title: "oak" }, { const: "birch", title: "birch" }],
              },
            },
          },
        })
        : await request("session/request_permission", {
          sessionId,
          toolCall: {
            toolCallId: asking,
            title: "run a command",
            _meta: { claudeCode: { toolName: "Bash", parentToolUseId: agent } },
          },
          options: [
            { kind: "allow_once", name: "Allow Once", optionId: "allow" },
            { kind: "reject_once", name: "Deny", optionId: "reject" },
          ],
        })
      if (endedCancelled(id)) return
      completed(asking)
      inside(after, "grep for worktops", agent)
      for (const call of [before, after, agent]) completed(call)
      const outcome = (answer as { outcome?: { outcome?: string; optionId?: string } })
        ?.outcome
      say(
        elicits
          ? `you answered: ${JSON.stringify(answer)}`
          : `permission: ${outcome?.optionId ?? outcome?.outcome ?? "nothing"}`,
      )
      reply(id, { stopReason: "end_turn" })
      return
    }

    if (argument === "again") {
      const agent = lastSpawn
      if (agent === null) {
        say("nobody has been sent out yet.")
        reply(id, { stopReason: "end_turn" })
        return
      }
      const more = `sub-${++nextMcpId}`
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: agent,
          status: "in_progress",
          _meta: { claudeCode: {} },
        },
      })
      say("sent it more work.")
      await released()
      inside(more, "push the branch", agent)
      completed(more)
      reported(agent, "the branch is pushed.")
      say(" the agent reported back again.")
      reply(id, { stopReason: "end_turn" })
      return
    }

    if (argument === "crash") {
      spawn(`agent-${++nextMcpId}`, "read every note", "Explore")
      say("sent an agent out.")
      await released()
      process.exit(1)
    }

    if (argument === "slow") {
      const alone = `agent-${++nextMcpId}`
      const read = `sub-${++nextMcpId}`
      spawn(alone, "read every note", "Explore")
      say("sent an agent out.")
      await released()
      inside(read, "read the note", alone)
      completed(read)
      reported(alone, "there are three notes.")
      say(" the agent reported back.")
      reply(id, { stopReason: "end_turn" })
      return
    }

    if (argument === "notify") {
      const agent = `agent-${++nextMcpId}`
      const task = "a4015bf2ba1fa514d"
      const description = "count the ticks"
      spawn(agent, description, "Explore")
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: agent,
          status: "in_progress",
          _meta: {
            claudeCode: {
              toolName: "Agent",
              subagent: true,
              backgroundTask: { taskId: task, taskType: "local_agent", description },
            },
          },
        },
      })
      say("sent an agent out; I will keep working.")
      void released().then(() => {
        const ended = {
          taskId: task,
          taskType: "local_agent",
          description,
          status: "completed",
        }
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: { toolName: "Agent", taskStatus: "completed", backgroundTask: ended },
            },
          },
        })
        const summary = `Agent "${description}" finished`
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: {
                toolName: "Agent",
                taskStatus: "completed",
                backgroundTask: { ...ended, summary },
              },
            },
            content: [{ type: "content", content: { type: "text", text: summary } }],
          },
        })
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "user_message_chunk",
            content: {
              type: "text",
              text:
                "<task-notification>\n" +
                `<task-id>${task}</task-id>\n` +
                `<tool-use-id>${agent}</tool-use-id>\n` +
                "<status>completed</status>\n" +
                `<summary>${summary}</summary>\n` +
                "<result>I have thorough coverage now. Here is the factual report.\n\n" +
                "# Findings\n\nThere are three notes.\n</result>\n" +
                "</task-notification>",
            },
            _meta: { claudeCode: { origin: { kind: "task-notification" } } },
          },
        })
      })
      reply(id, { stopReason: "end_turn" })
      return
    }

    if (argument === "report") {
      const agent = `agent-${++nextMcpId}`
      const task = "a4015bf2ba1fa514d"
      const description = "count the ticks"
      spawn(agent, description, "Explore")
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: agent,
          status: "in_progress",
          _meta: {
            claudeCode: {
              toolName: "Agent",
              subagent: true,
              backgroundTask: { taskId: task, taskType: "local_agent", description },
            },
          },
        },
      })
      say("sent an agent out; I will keep working.")
      void released().then(() => {
        const ended = {
          taskId: task,
          taskType: "local_agent",
          description,
          status: "completed",
        }
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: { toolName: "Agent", taskStatus: "completed", backgroundTask: ended },
            },
          },
        })
        const summary = `Agent "${description}" finished`
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: {
                toolName: "Agent",
                taskStatus: "completed",
                backgroundTask: { ...ended, summary },
              },
            },
            content: [{ type: "content", content: { type: "text", text: summary } }],
          },
        })
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            _meta: {
              claudeCode: {
                backgroundTask: {
                  taskId: task,
                  report:
                    "I have thorough coverage now. Here is the factual report.\n\n" +
                    "# Findings\n\nThere are three notes.\n",
                },
              },
            },
          },
        })
      })
      reply(id, { stopReason: "end_turn" })
      return
    }

    const first = `agent-${++nextMcpId}`
    const second = `agent-${++nextMcpId}`
    const cabinets = `sub-${++nextMcpId}`
    const note = `sub-${++nextMcpId}`
    const worktops = `sub-${++nextMcpId}`
    spawn(first, "explore the outline", "Explore")
    inside(cabinets, "grep for cabinets", first)
    spawn(second, "review the notes")
    inside(note, "read the note", second)
    inside(worktops, "grep for worktops", first)
    for (const call of [cabinets, note, worktops, first, second]) completed(call)
    say("both agents reported back.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "context") {
    const named = [...text.matchAll(/^Node in context: `([^`]+)`(.*)$/gm)].map(
      (match) => ({ id: match[1] ?? "", said: match[2] ?? "" }),
    )
    if (named.length === 0) {
      say("no node in context.")
      reply(id, { stopReason: "end_turn" })
      return
    }
    for (const { id: node, said } of named) {
      const read = await useTool("outlines_read", { id: node })
      const found = read["structuredContent"] as { title?: string } | undefined
      say(
        `\`${node}\` is the node titled ${found?.title ?? "?"}` +
          `${said.includes("; trashed") ? ", and it was put away" : ""}.\n`,
      )
    }
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "name") {
    say(`look at \`${argument}\`.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "fragments") {
    say("[local](#local)\n\n## Local\n\nA footnote[^one].\n\n[^one]: Local footnote.\n")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "links") {
    say(
      "the note is [the cabinets note](notes/cabinets.md) " +
        "and the row is [the order row](/#order).\n",
    )
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "done" || verb === "late-done") {
    await useTool("outlines_done", { id: argument }, verb === "late-done")
    say(`marked \`${argument}\` done.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "oauth") {
    if (!clientCanElicitUrl()) {
      say("this client does not draw a URL elicitation")
      reply(id, { stopReason: "end_turn" })
      return
    }
    await authenticateMcpServer(argument === "" ? "example" : argument)
    say(`signed in to ${argument === "" ? "example" : argument}.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "external") {
    const [server, tool, ...json] = rest
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(json.join(" ") || "{}") as Record<string, unknown>
    } catch (thrown) {
      say(`could not parse the arguments as JSON: ${String(thrown)}`)
      reply(id, { stopReason: "end_turn" })
      return
    }
    if (server === undefined || tool === undefined) {
      say(`usage: external <server> <tool> <json-args>`)
      reply(id, { stopReason: "end_turn" })
      return
    }
    say(await useExternal(server, tool, args))
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "add") {
    const outlines = await callMcp("tools/call", { name: "outlines_index", arguments: {} })
    const listed = (outlines["structuredContent"] as
      | { outlines?: ReadonlyArray<{ file: string }> }
      | undefined)?.outlines ?? []
    const file = listed.find((one) => one.file !== "_olai/Trash.olai")?.file
    await useTool("outlines_add", { file, title: argument })
    say(`added \`${argument}\`.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "search") {
    const found = await useTool("search_nodes", { text: argument })
    say(`searched: ${JSON.stringify(found["structuredContent"])}`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  const attached = [...text.matchAll(/^Attached file: (.+)$/gm)].map((match) => match[1] ?? "")
  if (attached.length > 0) {
    for (const file of attached) {
      const bytes = existsSync(file) ? statSync(file).size : -1
      say(`read ${bytes} bytes from ${basename(file)}\n`)
      if (text.includes("verify attachment bytes") && bytes >= 0) {
        const digest = createHash("sha256").update(readFileSync(file)).digest("hex")
        say(`sha256 of ${basename(file)}: ${digest}\n`)
      }
    }
    reply(id, { stopReason: "end_turn" })
    return
  }

  say(`you said: ${text}`)
  reply(id, { stopReason: "end_turn" })
}

const openSession = (params: Record<string, unknown>): void => {
  if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
  forwardsInit = Array.isArray(
    ((params["_meta"] as { claudeCode?: { emitRawSDKMessages?: unknown } } | undefined)
      ?.claudeCode?.emitRawSDKMessages),
  )
  const given = (params["mcpServers"] ?? []) as ReadonlyArray<{
    type?: string
    name?: string
    url?: string
    headers?: ReadonlyArray<{ name: string; value: string }>
    command?: string
    args?: ReadonlyArray<string>
    env?: ReadonlyArray<{ name: string; value: string }>
  }>
  servers = given.map((server) => server.name ?? "?")
  const http = given.find((server) => server.type === "http")
  mcp = http?.url === undefined ? null : {
    url: http.url,
    headers: Object.fromEntries(
      (http.headers ?? []).map((header) => [header.name, header.value]),
    ),
  }
  dropAttached()
  externals = new Map(
    given
      .filter((server) => server.type === undefined && typeof server.command === "string")
      .map((server) => [server.name ?? "?", server]),
  )
}

const replay = async (): Promise<void> => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "what did " },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "we decide?" },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId: "replayed-1",
      title: "read the notes",
      status: "completed",
      rawInput: { file_path: `${cwd}/notes.md` },
      rawOutput: { read: true },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "we decided to order the cabinets." },
    },
  })
  if (sessionId === "fake-stored-old") {
    if (existsSync(`${cwd}/${MARKER_FILE.longHistory}`)) {
      rmSync(`${cwd}/${MARKER_FILE.longHistory}`, { force: true })
      for (let call = 0; call < 100; call++) {
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: `long-${call}`,
            title: `step ${call}`,
            status: "completed",
            rawInput: { file_path: `${cwd}/notes.md` },
            rawOutput: { read: true, text: "the quick brown fox jumps over the lazy dog. ".repeat(45) },
          },
        })
      }
    }
    const slow = existsSync(`${cwd}/${MARKER_FILE.slowReplay}`)
    if (slow) rmSync(`${cwd}/${MARKER_FILE.slowReplay}`, { force: true })
    for (let line = 0; line < 40; line++) {
      say(`line ${line} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
      if (slow) await new Promise((done) => setTimeout(done, 25))
    }
    if (existsSync(`${cwd}/${MARKER_FILE.wantLate}`)) {
      rmSync(`${cwd}/${MARKER_FILE.wantLate}`, { force: true })
      void released().then(() => {
        say(`late line — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
      })
    }
  }
}

const STEER_METHOD = "_session/steering"

const promptTextOf = (params: Record<string, unknown>): string =>
  ((params["prompt"] ?? []) as ReadonlyArray<{ text?: string }>)
    .map((block) => block.text ?? "")
    .join("")

const steerTurn = (id: unknown, params: Record<string, unknown>): void => {
  const answer = (): void => {
    if (steerSwallowed) return
    if (steerRefused) {
      refuse(id, -32000, "this turn cannot be steered")
      return
    }
    if (!running) {
      reply(id, { outcome: "promptRequired", reason: "noRunningTurn" })
      return
    }
    steered.push(promptTextOf(params))
    reply(id, { outcome: "injected" })
  }
  if (steerDelayMs === 0) {
    answer()
    return
  }
  setTimeout(answer, steerDelayMs)
}

const authenticateDeviceCode = async (id: unknown): Promise<void> => {
  const elicitationId = `device-${++nextLink}`
  const code = "WXYZ-12345"
  const answered = request("elicitation/create", {
    mode: "url",
    requestId: id,
    url: "https://chatgpt.com/device",
    elicitationId,
    message: `Sign in to ChatGPT and enter this code: ${code}`,
  })
  let settled = false
  const done = await Promise.race([
    waitAtThePage(() => !settled).then((at) =>
      at ? { kind: "at-the-page" as const } : { kind: "gave-up" as const }
    ),
    answered.then((response) => {
      settled = true
      return { kind: "answered" as const, response }
    }),
  ])
  settled = true
  if (done.kind === "answered") {
    const accepted = typeof done.response === "object" && done.response !== null &&
      "action" in done.response && done.response.action === "accept"
    if (!accepted) {
      refuse(id, -32602, "the sign-in was cancelled")
      return
    }
  }
  if (done.kind === "gave-up") {
    refuse(id, -32603, "the device-code sign-in was never completed")
    return
  }
  appendFileSync(`${cwd}/${MARKER_FILE.signedIn}`, "")
  writeFileSync(`${cwd}/${MARKER_FILE.identity}`, JSON.stringify({
    kind: "account",
    label: "ChatGPT Plus",
    account: { email: "signed-in@example.com", plan: "plus" },
  }))
  publishIdentity()
  notify("elicitation/complete", { elicitationId })
  reply(id, {})
}

let nextLink = 0

const authenticateMcpServer = async (server: string): Promise<void> => {
  const elicitationId = `mcp-oauth-${++nextLink}`
  let settled = false
  const answered = request("elicitation/create", {
    mode: "url",
    sessionId,
    message: `Authenticate with MCP server ${server}`,
    url: `https://${server}.example/oauth?state=fake`,
    elicitationId,
  }).then(() => { settled = true })
  const at = await Promise.race([
    waitAtThePage(() => !settled),
    answered.then(() => false),
  ])
  settled = true
  if (!at) return
  notify("elicitation/complete", { elicitationId })
}

const handle = async (message: Record<string, unknown>): Promise<void> => {
  const id = message["id"]
  const method = message["method"]
  const params = (message["params"] ?? {}) as Record<string, unknown>

  switch (method) {
    case "initialize":
      capabilities = (params["clientCapabilities"] ?? {}) as Record<string, unknown>
      reply(id, {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: { http: true },
          sessionCapabilities: { list: {} },
          _meta: {
            ...(silent() ? {} : { authStatus: {} }),
            ...(silent() || isCodex ? {} : { claudeCode: { promptQueueing: true } }),
          },
        },
        agentInfo: { name: "fake-acp-agent", version: "0.1.0" },
        authMethods: authMethodsOffered(),
        ...(silent() ? {} : { _meta: { steering: { supported: true } } }),
      })
      publishIdentity()
      return

    case "session/list":
      if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
      if (existsSync(join(cwd, MARKER_FILE.listAsks))) {
        appendFileSync(join(cwd, MARKER_FILE.listAsks), "1\n")
      }
      if (listRefused) {
        refuse(id, -32000, "the conversation store is unreadable")
        return
      }
      reply(id, { sessions: listedSessions() })
      return

    case "session/new":
      publishIdentity()
      if (holdingOpen()) await released()
      if (needsSignature()) {
        refuse(id, -32000, "Authentication required")
        return
      }
      if (refusesToOpen("new")) {
        refuse(id, -32603, "this agent will not start a conversation in this directory")
        return
      }
      openSession(params)
      sessionId = sessionStore(cwd).enabled ? sessionStore(cwd).newId() : "fake-session-1"
      reasoning = "medium"; mode = "code"; fast = false
      currentModel = pinnedModel()
      liveModel = currentModel
      used = 0
      size = 200_000
      reply(id, { sessionId, configOptions: configOptions() })
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "available_commands_update", availableCommands: COMMANDS },
      })
      return

    case "session/load":
      publishIdentity()
      {
        const asked = typeof params["cwd"] === "string"
          ? params["cwd"].replace(/\/+$/, "")
          : cwd
        if (existsSync(join(asked, MARKER_FILE.loads))) {
          appendFileSync(join(asked, MARKER_FILE.loads), `${String(params["sessionId"])}\n`)
        }
      }
      if (needsSignature()) {
        refuse(id, -32000, "Authentication required")
        return
      }
      if (refusesToOpen("load")) {
        refuse(id, -32603, `no such conversation: ${String(params["sessionId"])}`)
        return
      }
      if (missingHere(String(params["sessionId"]))) {
        refuse(id, -32002, `no such conversation: ${String(params["sessionId"])}`)
        return
      }
      if (holdsLoad()) await released()
      {
        const directory = typeof params["cwd"] === "string" ? params["cwd"] : cwd
        const disk = sessionStore(directory)
        if (disk.enabled && disk.read(String(params["sessionId"])) === null) {
          refuse(id, -32002, `no such conversation: ${String(params["sessionId"])}`)
          return
        }
      }
      openSession(params)
      sessionId = String(params["sessionId"] ?? sessionId)
      if (sessionStore(cwd).enabled) {
        for (const update of sessionStore(cwd).read(sessionId)?.updates ?? []) {
          sendNotification("session/update", { sessionId, update })
        }
      } else if (isCodex && sessionId === "fake-stored-old") {
        await nativeActivity("agents", sessionId, notify, request, released)
        await nativeActivity("watch stopped", sessionId, notify, request, released)
      } else await replay()
      reasoning = "medium"; mode = "code"; fast = false
      currentModel = pinnedModel()
      liveModel = currentModel
      used = 0
      size = 200_000
      reply(id, { configOptions: configOptions() })
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "available_commands_update", availableCommands: COMMANDS },
      })
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "session_info_update",
          title: sessionStore(cwd).read(sessionId)?.title ?? STORED_TITLES[sessionId] ?? "a loaded conversation",
        },
      })
      return

    case "session/set_mode":
      reply(id, {})
      return

    case "session/set_config_option": {
      if (existsSync(`${cwd}/${MARKER_FILE.refuseModel}`)) {
        refuse(id, -32602, "model changes are unavailable")
        return
      }
      const value = params["value"]
      const config = configOptions().find(option => option.id === params["configId"])
      if (config && config.id !== "model") {
        if (config.id === "fast" && params["type"] === "boolean" && typeof value === "boolean") fast = value
        else if (config.id === "reasoning" && config.options?.some(row => row.value === value)) reasoning = String(value)
        else if (config.id === "mode" && config.options?.some(row => row.value === value)) mode = String(value)
        else { refuse(id, -32602, "invalid setting"); return }
        reply(id, { configOptions: configOptions() })
        return
      }
      if (params["configId"] !== "model" || typeof value !== "string") {
        refuse(id, -32602, `no such config option: ${String(params["configId"])}`)
        return
      }
      if (!OFFERED.has(value)) {
        refuse(id, -32602, `Invalid value for config option model: ${value}`)
        return
      }
      if (value === refusedForAccount()) {
        const name = MODEL_ROWS.find(row => row.value === value)?.name ?? value
        refuse(id, -32603, "Internal error", {
          details: `${name} isn't available for your account yet. Run /model to pick another model.`,
        })
        return
      }
      currentModel = value
      liveModel = value
      reply(id, { configOptions: configOptions() })
      return
    }

    case "session/prompt": {
      publishIdentity()
      const text = promptTextOf(params)
      if (needsSignature()) {
        refuse(id, -32000, "Authentication required")
        return
      }
      sessionStore(cwd).prompt(sessionId, text)
      waiting.delete(id)
      {
        const had = minted.get(sessionId)
        minted.set(sessionId, {
          title: had?.title ?? text,
          updatedAt: new Date().toISOString(),
          messageCount: (had?.messageCount ?? 0) + 2,
        })
      }
      running = true
      try {
        await runTurn(id, text)
      } finally {
        running = false
        steered.length = 0
      }
      return
    }

    case "authenticate": {
      const methodId = typeof params["methodId"] === "string" ? params["methodId"] : ""
      if (isCodex && methodId === "chat-gpt-device-code") {
        await authenticateDeviceCode(id)
        return
      }
      refuse(id, -32601, `no such method: authenticate ${methodId}`)
      return
    }

    case "session/cancel":
      cancelled = true
      withdrawRequests()
      return

    default:
      if (id !== undefined && id !== null) {
        refuse(id, -32601, `no such method: ${String(method)}`)
      }
  }
}

let queue: Promise<void> = Promise.resolve()

export function scripted(options: {
  readonly tool: ScriptedTool
  readonly flavour: "claude" | "codex"
}): void {
  toolWire = options.tool
  isCodex = options.flavour === "codex"
  readMessages(
  process.stdin,
  (message) => {
    if (message["method"] === "session/cancel") {
      cancelled = true
      withdrawRequests()
      for (const id of waiting) {
        settledEarly.add(id)
        respond(id, { stopReason: "cancelled" })
      }
      waiting.clear()
      return
    }
    if (message["method"] === STEER_METHOD) {
      steerTurn(message["id"], (message["params"] ?? {}) as Record<string, unknown>)
      return
    }
    if (message["method"] === undefined) {
      const answered = take(message["id"])
      if (answered === null) {
        noise(`fake agent: an answer to nothing: ${String(message["id"])}`)
        return
      }
      answered(message["error"] ?? message["result"])
      return
    }
    if (message["method"] === "session/prompt") {
      if ((busyRefused || isCodex) && running) {
        say("still working on the earlier turn")
        refuse(message["id"], -32603, "this agent cannot take a message while it is working")
        return
      }
      waiting.add(message["id"])
    }
    queue = queue.then(() => handle(message)).catch((cause: unknown) => {
      noise(`fake agent: ${String(cause)}`)
    })
  }, (line) => noise(`fake agent: not JSON: ${line}`))
  process.stdin.on("end", () => {
    if (!deaf) process.exit(0)
  })
}
