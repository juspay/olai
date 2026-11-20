import { spawn } from "node:child_process"

import { readMessages } from "./support/ndjson.ts"

const AGENT = process.env["AGENT"] ?? "claude-agent-acp"
const KIND = process.env["KIND"] ?? "monitor"
const airMeta = process.env["AIR"] === "1"
  ? { jetbrains: { air: { version: 1, capabilities: ["nativeSubagentSessions", "asyncTasks"] } } }
  : {}
const AIR_UPDATES = new Set([
  "async_task_spawned",
  "async_task_progress",
  "async_task_state_update",
  "subagent_spawned",
  "subagent_state_update",
])
const RAW = process.env["RAW"] === "1"
const AFTER_MS = Number(process.env["AFTER_MS"] ?? "45000")

const PROMPTS: Record<string, ReadonlyArray<string>> = {
  monitor: [
    'Use the Monitor tool exactly once with description "tick watch", persistent false, ' +
    "timeout_ms 60000, and command: for i in 1 2 3; do echo tick-$i; sleep 2; done. " +
    "Then reply with just the word ARMED and end your turn. Do not call any other tool.",
  ],
  bash: [
    "Run this with the Bash tool with run_in_background true: sleep 4; echo halfway; sleep 4; " +
    "exit 3 — then reply with just the word ARMED and end your turn. Do not poll it, do not " +
    "call BashOutput.",
  ],
  resume: [
    'Use the Agent tool exactly once, with description "count the ticks" and subagent_type ' +
    "general-purpose, and give it this task: run `echo tick-one` with the Bash tool, then " +
    "reply with the word ONE and nothing else. When it reports, reply with just the word " +
    "SPAWNED and end your turn. Do not call any other tool.",
    "Use SendMessage to send that SAME subagent a follow-up: run `echo tick-two` with the " +
    "Bash tool and reply with the word TWO. Do NOT spawn a new agent with the Agent tool. " +
    "When it answers, reply with just the word RESUMED and end your turn.",
  ],
  agent: [
    'Use the Agent tool exactly once, with description "count the ticks" and subagent_type ' +
    "general-purpose, and give it this task: reply with the word ONE and a markdown heading " +
    "# Findings, then stop. Run it in the background (do not wait for it). Then reply with " +
    "just the word ARMED and end your turn. Do not call any other tool.",
  ],
}

const prompts = PROMPTS[KIND]
if (prompts === undefined) {
  console.error(`KIND must be one of ${Object.keys(PROMPTS).join(", ")} — got "${KIND}"`)
  process.exit(2)
}

const child = spawn(AGENT, [], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] })
const started = Date.now()
const at = (): string => `${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s`
const say = (what: string, detail = ""): void =>
  console.log(`${at()}  ${what}${detail === "" ? "" : `  ${detail}`}`)

let nextId = 0
const waiting = new Map<number, (answer: Record<string, unknown>) => void>()
const ask = (method: string, params: unknown): Promise<Record<string, unknown>> => {
  const id = ++nextId
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
  return new Promise((answered) => waiting.set(id, answered))
}

const listen = (): void => {
  readMessages<Record<string, unknown>>(child.stdout, (message) => {
    const id = message["id"]
    if (typeof id === "number" && message["method"] === undefined) {
      waiting.get(id)?.(message)
      waiting.delete(id)
      return
    }
    if (typeof id === "number") {
      const options = (message["params"] as { options?: ReadonlyArray<Record<string, string>> })
        ?.options ?? []
      const allow = options.find((option) => option["kind"]?.startsWith("allow"))
      child.stdin.write(
        `${
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: allow === undefined
              ? {}
              : { outcome: { outcome: "selected", optionId: allow["optionId"] } },
          })
        }\n`,
      )
      return
    }
    heard(message)
  })
}

const heard = (message: Record<string, unknown>): void => {
  const method = message["method"]
  const params = (message["params"] ?? {}) as Record<string, unknown>
  if (method === "session/update") {
    const update = (params["update"] ?? {}) as Record<string, unknown>
    if (typeof update["sessionUpdate"] !== "string") return
    if (AIR_UPDATES.has(update["sessionUpdate"])) {
      say(`AIR  ${update["sessionUpdate"]}`, JSON.stringify(params))
      return
    }
    if (update["sessionUpdate"] === "user_message_chunk") {
      const content = update["content"] as { text?: string } | undefined
      const text = typeof content?.text === "string" ? content.text : ""
      const origin = ((update["_meta"] ?? {}) as { claudeCode?: { origin?: { kind?: string } } })
        .claudeCode?.origin?.kind
      if (text.includes("<task-notification>") || origin === "task-notification") {
        say(
          "ACP  user_message_chunk  TASK-NOTIFICATION FORWARDED AS USER SPEECH",
          text.slice(0, 160),
        )
      }
      return
    }
    if (!update["sessionUpdate"].startsWith("tool_call")) return
    const claude = ((update["_meta"] ?? {}) as Record<string, unknown>)["claudeCode"] as
      | Record<string, unknown>
      | undefined
    const task = claude?.["backgroundTask"]
    const parent = claude?.["parentToolUseId"]
    say(
      `ACP  ${String(update["sessionUpdate"]).padEnd(17)} ${
        String(update["toolCallId"] ?? "—").padEnd(30)
      } ${String(update["status"] ?? "—").padEnd(12)}`,
      `${String(claude?.["toolName"] ?? "—")}${
        claude?.["subagent"] === true ? "  subagent" : ""
      }${parent === undefined ? "" : `  parent=${String(parent)}`}${
        task === undefined ? "" : `  backgroundTask=${JSON.stringify(task)}`
      }`,
    )
    return
  }
  if (method === "_claude/sdkMessage") {
    const sdk = (params["message"] ?? {}) as Record<string, unknown>
    const subtype = String(sdk["subtype"] ?? "")
    const aboutTasks = sdk["type"] === "system" && subtype.startsWith("task")
      || subtype === "background_tasks_changed"
    if (aboutTasks) say(`SDK  ${subtype.padEnd(30)}`, JSON.stringify(sdk).slice(0, 240))
    else if (RAW) say(`sdk  ${String(sdk["type"])}/${subtype}`, JSON.stringify(sdk).slice(0, 160))
    const said = String(sdk["type"])
    const modelsOwn = said === "assistant" || said === "stream_event" || said === "result"
    if (!modelsOwn && JSON.stringify(sdk).includes("tick-1")) {
      say("SDK  A FRAME CARRYING A MONITOR'S EVENT", JSON.stringify(sdk).slice(0, 400))
    }
  }
}

listen()

await ask("initialize", {
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: false, writeTextFile: false },
    // Since 0.73.0, AIR is negotiated here; session/new metadata alone is insufficient.
    _meta: airMeta,
  },
})
const opened = await ask("session/new", {
  cwd: process.cwd(),
  mcpServers: [],
  _meta: {
    claudeCode: { emitRawSDKMessages: true },
    ...airMeta,
  },
})
const sessionId = ((opened["result"] ?? {}) as Record<string, string>)["sessionId"]
say("open", `session=${sessionId}`)
await ask("session/set_mode", { sessionId, modeId: "bypassPermissions" })

for (const [at, text] of prompts.entries()) {
  const turn = at + 1
  say(`prompt ${turn}`, `KIND=${KIND}`)
  const answered = await ask("session/prompt", { sessionId, prompt: [{ type: "text", text }] })
  const outcome = JSON.stringify(answered["result"] ?? answered["error"])
  say(`prompt ${turn} returned`, outcome.slice(0, 120))
}
say("listening", `${AFTER_MS / 1000}s — everything below arrives in NO turn`)

await new Promise((done) => setTimeout(done, AFTER_MS))
say("done")
child.kill()
process.exit(0)
