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
 *   servers      name the MCP servers this session was handed
 *   slow         dawdle, long enough to cancel
 *   flood        say more than fits, so scrolling is a thing that can be tested
 *   hold         start a tool call and STOP there, until released
 *   model <id>   switch the model the way the wrapped CLI does
 *   ask          ask a structured question and report the answer
 *   plan         ask to leave plan mode, the way the adapter does
 *   permit       ask permission for an ops tool, which needs no person
 *   crash        exit mid-turn
 *   anything     one chunk of prose and an `end_turn`
 *
 * The last three are REQUESTS to the client rather than notifications, which is
 * the shape those parts of the protocol have: the agent stops until an answer
 * comes back. `ask` refuses to ask at all unless the client advertised
 * `elicitation.form` at `initialize` — which is what makes the capability
 * itself something a scenario can assert, rather than a line in a file that
 * could be deleted with every test still passing.
 *
 * `hold` is how a scenario gets to look at a turn WHILE it is happening. A
 * turn that finishes in a millisecond can only be asserted about afterwards,
 * and afterwards is precisely when the bugs this suite exists for stop being
 * visible: a row that is remounted on every frame looks perfect once the frames
 * stop. It waits for a file (`.agent-release` in the directory it was started
 * in) rather than for a clock, so the scenario says when — a dot-file, which
 * the store's walk prunes, so waiting for one is not itself an edit.
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

import { existsSync, rmSync } from "node:fs"

import { readMessages } from "../support/ndjson.ts"

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

/** The client's answers to requests WE sent, by the id we sent them under.
 *  Ids are prefixed so they cannot be mistaken for the client's own. */
const answering = new Map<string, (result: unknown) => void>()
let nextRequestId = 0

/** Ask the client something and wait. Half the protocol runs this way — a
 *  permission, an elicitation — and a scripted agent that could only notify
 *  could not exercise any of it. */
const request = (method: string, params: unknown): Promise<unknown> =>
  new Promise((resolve) => {
    const id = `agent-${++nextRequestId}`
    answering.set(id, resolve)
    emit({ jsonrpc: "2.0", id, method, params })
  })

/**
 * Take back every question still on the wire, the way a real agent does when
 * its turn is cancelled: `$/cancel_request` per outstanding id, which aborts
 * the client's handler.
 *
 * The promises are resolved HERE rather than waited on, because a cancelled
 * request gets no response — that is the point of cancelling it — so an agent
 * that went on awaiting them would hang on a turn it had just abandoned.
 */
const withdrawRequests = (): void => {
  for (const [id, resolve] of [...answering]) {
    answering.delete(id)
    notify("$/cancel_request", { requestId: id })
    resolve(null)
  }
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
/** The NAMES of every MCP server the client handed us, in the order it sent
 *  them. Olai's own is the http one this file actually calls; the rest are
 *  somebody else's programs on the host, which this file has no business
 *  spawning — reporting that they arrived is the whole of what a scenario
 *  about them can ask. */
let servers: ReadonlyArray<string> = []
/** Set by a `session/cancel` notification, cleared when a prompt is accepted. */
let cancelled = false
/** What the client said it can do, out of `initialize`. Read for one thing: a
 *  client that did not advertise `elicitation.form` is one a real adapter would
 *  never ask a structured question of, and this one does not either. */
let capabilities: Record<string, unknown> = {}

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

/** The file a scenario touches to let a held turn go on. */
const RELEASE = ".agent-release"
/** Long enough that a slow machine is not the reason a scenario fails, short
 *  enough that a scenario which forgot to release fails on its own assertion
 *  rather than on the runner's timeout. */
const HOLD_LIMIT_MS = 30_000

const released = async (onTick?: () => void): Promise<void> => {
  const marker = `${cwd}/${RELEASE}`
  for (let waited = 0; waited < HOLD_LIMIT_MS; waited += 100) {
    if (existsSync(marker)) {
      rmSync(marker, { force: true })
      return
    }
    onTick?.()
    await sleep(100)
  }
  noise("fake agent: nothing released the held turn; going on anyway")
}

/**
 * The message the Claude Code adapter forwards from the CLI it wraps.
 *
 * It is what a real `/model` produces and the config option does NOT: the CLI
 * handles that command itself, so the picker goes on reporting what the session
 * started on. Reproducing that here is the only way an e2e can tell a header
 * that follows the running model from one that follows the picker.
 */
const sdkInit = (model: string): void => {
  notify("_claude/sdkMessage", {
    sessionId,
    message: { type: "system", subtype: "init", model },
  })
}

/** A turn that was cancelled while it was waiting on the client ends as a
 *  cancelled turn. Answers whether it did, so the caller stops there. */
const endedCancelled = (id: unknown): boolean => {
  if (!cancelled) return false
  respond(id, { stopReason: "cancelled" })
  return true
}

/** Whether the client said it can draw a form. `{}` is how the protocol spells
 *  "yes" — the presence of the key is the whole of the claim. */
const canElicit = (): boolean => {
  const elicitation = capabilities["elicitation"] as
    | { form?: unknown }
    | null
    | undefined
  return elicitation?.form != null
}

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

  if (verb === "servers") {
    // The list, as one definite line: `servers: [olai kolu]`. A scenario about
    // what a session was GIVEN can then assert the whole answer rather than
    // the absence of a word, which is the only shape of that claim a streaming
    // panel can be asked for without waiting to see whether more arrives.
    say(`servers: [${servers.join(" ")}]`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "flood") {
    // Chunk by chunk into ONE entry, which is what an answer is: what has to
    // overflow the pane is a single growing paragraph, because a list that
    // grows by rows and an answer that grows by tokens are the two cases and
    // only the second one is hard.
    for (let line = 0; line < 40; line++) {
      say(`line ${line} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
    }
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "hold") {
    const toolCallId = `call-${++nextMcpId}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "a tool call you can watch",
        status: "in_progress",
        rawInput: { held: argument === "" ? "until released" : argument },
        locations: [{ path: "/served/house.jsonl", line: 12 }],
      },
    })
    // What a real call does while it runs: says something about itself. Sent
    // BEFORE the release, so a scenario can prove the panel drew it without
    // waiting for the call to finish — which is the whole difference between
    // progress and a result.
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
    // AFTER the frame, so it is this paragraph that is left open: a tool call
    // closes the one before it, which is what makes the two states — a call
    // running and an answer growing — observable at the same moment.
    // Chunk after chunk for as long as the hold lasts, because ONE chunk only
    // proves a paragraph appeared. What a streaming panel has to do is grow the
    // paragraph that is already on screen, and that is a claim about the second
    // chunk and every one after it.
    say("working on it")
    await released(() => say("."))
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
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "ask") {
    // Byte for byte the shape `askUserQuestionsToCreateRequest` builds for one
    // single-select question: the question as the message, a titled `oneOf`,
    // and the per-question "Other" box marked with the shared `_meta` key.
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      respond(id, { stopReason: "end_turn" })
      return
    }
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
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "plan" || verb === "permit") {
    // The two permission requests that matter, told apart ONLY by the tool
    // name the announcement carries: a plan exit is a person's to answer, and
    // an ops call is not. `permit` must never draw a form; `plan` must always
    // draw one, and must never come back `auto` unless somebody pressed it.
    const plan = verb === "plan"
    const toolCallId = `call-${++nextMcpId}`
    const toolName = plan ? "ExitPlanMode" : "mcp__olai__set_done"
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
        // `auto` FIRST and allow-flavoured: this is the option a client that
        // answered by machine used to pick, silently.
        ? [
          { kind: "allow_always", name: 'Yes, and use "auto" mode', optionId: "auto" },
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
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "model") {
    sdkInit(argument)
    say(`switched to ${argument}.`)
    respond(id, { stopReason: "end_turn" })
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
  const given = (params["mcpServers"] ?? []) as ReadonlyArray<{
    type?: string
    name?: string
    url?: string
    headers?: ReadonlyArray<{ name: string; value: string }>
  }>
  servers = given.map((server) => server.name ?? "?")
  const http = given.find((server) => server.type === "http")
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
      capabilities = (params["clientCapabilities"] ?? {}) as Record<string, unknown>
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
      // A real session says what it is running as it starts. It agrees with
      // the picker here, which is the case the client must NOT treat as a
      // change: a session announcing itself is not a session switching.
      sdkInit("fake-model-1")
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
      sdkInit("fake-model-1")
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
      withdrawRequests()
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

/** One turn at a time, in the order they arrived — but the READ loop keeps
 *  going, which is what lets a cancel arrive during a prompt. */
let queue: Promise<void> = Promise.resolve()

readMessages(
  process.stdin,
  (message) => {
    // A cancel must be seen NOW, not behind the turn it is cancelling.
    if (message["method"] === "session/cancel") {
      cancelled = true
      withdrawRequests()
      return
    }
    // An answer to something WE asked. It cannot go through the queue: the turn
    // that asked is sitting in it, waiting for exactly this.
    if (message["method"] === undefined) {
      const id = String(message["id"])
      const answering_ = answering.get(id)
      if (answering_ === undefined) {
        noise(`fake agent: an answer to nothing: ${id}`)
        return
      }
      answering.delete(id)
      answering_(message["error"] ?? message["result"])
      return
    }
    queue = queue.then(() => handle(message)).catch((cause: unknown) => {
      noise(`fake agent: ${String(cause)}`)
    })
  },
  (line) => noise(`fake agent: not JSON: ${line}`),
)

process.stdin.on("end", () => process.exit(0))
