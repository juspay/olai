#!/usr/bin/env bun
/**
 * A scripted ACP agent, for driving the chat loop without a language model.
 *
 * It speaks just enough of the protocol to be indistinguishable from a real
 * agent as far as `packages/server/src/chat/agent.ts` is concerned:
 * line-delimited JSON-RPC on stdio, `initialize` / `session/new` /
 * `session/list` / `session/load` / `session/set_mode` / `session/prompt`,
 * `session/cancel` as a notification, and `session/update` notifications on the
 * way.
 *
 * What makes it worth having is the last thing it does: it calls the REAL
 * internal MCP server, over the real HTTP route, with the token the real
 * `session/new` handed it. So an e2e scenario drives the real panel, the real
 * ops layer and the real store — everything except the part that would need a
 * model, and that part is the one thing a CI lane cannot afford to be
 * non-deterministic about.
 *
 * Behaviour is keyed on the prompt text, so a scenario asks for what it needs:
 *
 *   done <id>    call `set_done` on that node, then say so
 *   add <title>  call `add_node` under the first outline's first root
 *   slow         dawdle, long enough to cancel
 *   crash        exit mid-turn
 *   anything     one chunk of prose and an `end_turn`
 *
 * STORED SESSIONS are an environment variable, because which boot path runs is
 * a property of the machine the agent woke up on rather than of anything the
 * client says: `OLAI_FAKE_ACP_STORED` unset means nothing is stored (so a
 * client boots with `session/new`), and set means `session/list` answers and
 * `session/load` replays.
 *
 * Dumb and deterministic on purpose. This is test infrastructure, not a
 * simulator.
 *
 * It lives in `agent/` rather than in `support/` because Cucumber imports
 * everything under `support/` as part of the world, and importing this reads
 * stdin — which, in the runner's own process, ends immediately and takes the
 * run down with it. A directory of its own is what makes that unrepresentable.
 */

const OUT = process.stdout

const emit = (message: unknown): void => {
  OUT.write(`${JSON.stringify(message)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  emit({ jsonrpc: "2.0", id, result })
}

const notify = (method: string, params: unknown): void => {
  emit({ jsonrpc: "2.0", method, params })
}

const noise = (line: string): void => {
  process.stderr.write(`${line}\n`)
}

// ── what this process is ───────────────────────────────────────────────

/** Where the client said we are working. Remembered from `session/new` so
 *  `session/list` can answer about it. */
let cwd = process.cwd()
/** Which conversation we are in. A load moves it. */
let sessionId = "fake-session-1"
/** The MCP server the client handed us, if any: `{url, headers}`. */
let mcp: { url: string; headers: Record<string, string> } | null = null
/** Set by a `session/cancel` notification, cleared when a prompt is accepted. */
let cancelled = false

const STORED = process.env["OLAI_FAKE_ACP_STORED"] ?? ""
const stored = () => STORED !== ""

const STORED_TITLES: Record<string, string> = {
  "fake-stored-old": "an older conversation",
  "fake-stored-new": "the last conversation",
}

/** The client's own two, NEWEST LAST — so a client that takes the first entry
 *  instead of the most recently updated one adopts the wrong conversation. */
const storedSessions = () => [
  {
    sessionId: "fake-stored-old",
    cwd,
    title: STORED_TITLES["fake-stored-old"],
    updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    sessionId: "fake-stored-new",
    // The same place, spelled with a trailing slash: an agent stores the
    // spelling it was handed, and a client comparing strings would miss it.
    cwd: `${cwd}/`,
    title: STORED_TITLES["fake-stored-new"],
    updatedAt: "2026-08-01T17:30:00.000Z",
  },
]

const CONFIG_OPTIONS = [
  {
    id: "model",
    name: "Model",
    type: "select",
    currentValue: "fake-model-1",
    options: [
      { value: "fake-model-1", name: "Fake One" },
      { value: "fake-model-2", name: "Fake Two" },
    ],
  },
]

const COMMANDS = [
  { name: "review", description: "review the outline" },
  { name: "plan", description: "plan the next step" },
  { name: "compact", description: "compact the conversation" },
]

// ── the internal MCP server, called for real ───────────────────────────

let nextMcpId = 0

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

/** Announce a tool call, run it, and report how it went — the shape a real
 *  agent's `tool_call` / `tool_call_update` pair has. */
const useTool = async (
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const toolCallId = `call-${++nextMcpId}`
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: `${name}`,
      status: "in_progress",
      rawInput: args,
    },
  })

  const result = await callMcp("tools/call", { name, arguments: args })
  const failed = result["isError"] === true
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: failed ? "failed" : "completed",
      rawOutput: result,
    },
  })
  return result
}

// ── turns ──────────────────────────────────────────────────────────────

const say = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  })
}

const sleep = (millis: number) => new Promise<void>((done) => setTimeout(done, millis))

const runTurn = async (id: unknown, text: string): Promise<void> => {
  cancelled = false
  noise(`fake agent: ${text}`)

  const [verb, ...rest] = text.trim().split(/\s+/)
  const argument = rest.join(" ")

  if (verb === "crash") {
    say("about to fall over")
    await sleep(20)
    process.exit(1)
  }

  if (verb === "slow") {
    say("thinking")
    for (let tick = 0; tick < 200 && !cancelled; tick++) await sleep(50)
    respond(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  if (verb === "done") {
    await useTool("set_done", { id: argument })
    say(`marked \`${argument}\` done.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "add") {
    const outlines = await callMcp("tools/call", { name: "list_outlines", arguments: {} })
    const listed = (outlines["structuredContent"] as
      | { outlines?: ReadonlyArray<{ file: string }> }
      | undefined)?.outlines ?? []
    const file = listed[0]?.file
    await useTool("add_node", { file, title: argument })
    say(`added \`${argument}\`.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "search") {
    const found = await useTool("search_nodes", { text: argument })
    say(`searched: ${JSON.stringify(found["structuredContent"])}`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  say(`you said: ${text}`)
  respond(id, { stopReason: "end_turn" })
}

// ── the protocol ───────────────────────────────────────────────────────

const openSession = (params: Record<string, unknown>): void => {
  if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
  const servers = (params["mcpServers"] ?? []) as ReadonlyArray<{
    type?: string
    url?: string
    headers?: ReadonlyArray<{ name: string; value: string }>
  }>
  const http = servers.find((server) => server.type === "http")
  mcp = http?.url === undefined ? null : {
    url: http.url,
    headers: Object.fromEntries(
      (http.headers ?? []).map((header) => [header.name, header.value]),
    ),
  }
}

/** Replay a stored conversation, the way a real `session/load` does: every
 *  message as an ordinary `session/update`, and only then the answer. */
const replay = (): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "what did we decide?" },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "we decided to order the cabinets." },
    },
  })
}

const handle = async (message: Record<string, unknown>): Promise<void> => {
  const id = message["id"]
  const method = message["method"]
  const params = (message["params"] ?? {}) as Record<string, unknown>

  switch (method) {
    case "initialize":
      respond(id, {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: stored(),
          mcpCapabilities: { http: true },
          ...(stored() ? { sessionCapabilities: { list: {} } } : {}),
        },
        agentInfo: { name: "fake-acp-agent", version: "0.1.0" },
      })
      return

    case "session/list":
      if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
      respond(id, { sessions: stored() ? storedSessions() : [] })
      return

    case "session/new":
      openSession(params)
      sessionId = "fake-session-1"
      respond(id, { sessionId, configOptions: CONFIG_OPTIONS })
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "available_commands_update", availableCommands: COMMANDS },
      })
      return

    case "session/load":
      openSession(params)
      sessionId = String(params["sessionId"] ?? sessionId)
      replay()
      respond(id, { configOptions: CONFIG_OPTIONS })
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "available_commands_update", availableCommands: COMMANDS },
      })
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "session_info_update",
          title: STORED_TITLES[sessionId] ?? "a loaded conversation",
        },
      })
      return

    case "session/set_mode":
      respond(id, {})
      return

    case "session/prompt": {
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<
        { type?: string; text?: string }
      >
      const text = blocks.map((block) => block.text ?? "").join("")
      await runTurn(id, text)
      return
    }

    case "session/cancel":
      cancelled = true
      return

    default:
      if (id !== undefined && id !== null) {
        emit({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `no such method: ${String(method)}` },
        })
      }
  }
}

// ── stdin, line by line ────────────────────────────────────────────────

let buffered = ""
/** One turn at a time, in the order they arrived — but the READ loop keeps
 *  going, which is what lets a cancel arrive during a prompt. */
let queue: Promise<void> = Promise.resolve()

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  buffered += chunk
  for (;;) {
    const cut = buffered.indexOf("\n")
    if (cut === -1) break
    const line = buffered.slice(0, cut).trim()
    buffered = buffered.slice(cut + 1)
    if (line === "") continue

    let message: Record<string, unknown>
    try {
      message = JSON.parse(line) as Record<string, unknown>
    } catch {
      noise(`fake agent: not JSON: ${line}`)
      continue
    }
    // A cancel must be seen NOW, not behind the turn it is cancelling.
    if (message["method"] === "session/cancel") {
      cancelled = true
      continue
    }
    queue = queue.then(() => handle(message)).catch((cause: unknown) => {
      noise(`fake agent: ${String(cause)}`)
    })
  }
})

process.stdin.on("end", () => process.exit(0))
