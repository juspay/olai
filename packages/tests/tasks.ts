/**
 * What the ADAPTER says about a background task, printed as a timeline — the
 * fourth driver in this package, and the only one that talks to no olai at
 * all.
 *
 * `evidence.ts` photographs the app because what it shows is a LOOK,
 * `wire.ts` counts bytes because what it shows is a COST, and `reads.ts`
 * prints a session because what a tool surface promises is an ANSWER. What
 * this one shows is a WIRE: `chat-background-tasks-visible` rests on two
 * claims about somebody else's process, and both are the kind that gets
 * quietly re-decided by a reader who assumes rather than measures.
 *
 *   1. **the adapter completes a background task's call at LAUNCH** — which is
 *      why olai carries a patch on its pin (`acp/patches/README.md`), and
 *      which stops being true the day upstream lands one of its own;
 *   2. **a resumed subagent is the same call, going round again.** A subagent
 *      that has reported can be sent more work; the harness starts its task a
 *      second time and names the call that WOKE it, while everything the agent
 *      does goes on being stamped with the call that SPAWNED it. So olai's
 *      patch reopens the spawning call — and what a client can see of a resume
 *      is exactly what this prints;
 *   3. **the task's own EVENTS are on no wire underneath it.** A monitor's
 *      every line reaches the model and the task's output file, and no message
 *      in the SDK stream carries one — so the panel draws the task's life and
 *      not its events, and the next person to look will assume the adapter is
 *      dropping something. It is not.
 *
 * NOT PART OF THE SUITE — nothing imports it and `just e2e` never runs it. It
 * needs a REAL agent (the pinned adapter, driving a real `claude` against a
 * real session), which is exactly why it is a driver rather than a scenario:
 * what it measures is what that agent does, and a scripted one would be this
 * repo asserting its own assumption back at itself.
 *
 *   AGENT=$(nix build .#acp-agent --no-link --print-out-paths)/bin/claude-agent-acp \
 *     bun tasks.ts
 *   KIND=bash bun tasks.ts        # a background shell, whose ending carries an exit code
 *   KIND=resume bun tasks.ts      # a subagent, reported, and then sent more work
 *   RAW=1 bun tasks.ts            # every SDK message the adapter forwarded, too
 *
 * `KIND=monitor` (the default) arms a `Monitor` that ticks a few times and
 * ends; `KIND=bash` sends a shell command to the background that exits 3,
 * because the two endings are different sentences and only one of them has an
 * exit code in it. `KIND=resume` is TWO turns rather than one — spawn, then
 * wake the same agent with `SendMessage` — because a resume is only a resume
 * once somebody has reported.
 *
 * WHAT TO LOOK FOR under `KIND=resume`, against the patched pin: the second
 * `task_started` carries the SAME `task_id` as the first and a DIFFERENT
 * `tool_use_id` (the `SendMessage`), a `tool_call_update` puts the original
 * `Agent` call back to `in_progress` beside it, the agent's new calls carry
 * that same original id as their parent, and the settle closes it again.
 * Against an UNPATCHED adapter every one of those middle frames is missing,
 * which is the panel this lane was opened about: a running agent with no face.
 */

import { spawn } from "node:child_process"

import { readMessages } from "./support/ndjson.ts"

const AGENT = process.env["AGENT"] ?? "claude-agent-acp"
const KIND = process.env["KIND"] ?? "monitor"
const RAW = process.env["RAW"] === "1"
/** How long to keep listening after the turn is over. The whole point is what
 *  arrives AFTER the prompt has returned, so this is the measurement window
 *  rather than a timeout: a monitor that ticks every two seconds needs about
 *  half a minute to end on its own. */
const AFTER_MS = Number(process.env["AFTER_MS"] ?? "45000")

/** The turns each kind sends, each written to produce exactly one background
 *  task and then stop. They name the tool because what is being measured is
 *  that tool's frames; a prompt that let the model choose would measure the
 *  model.
 *
 *  A LIST rather than a prompt, for the one kind that cannot be a single turn:
 *  a resume is a thing that happens to an agent that has already reported, so
 *  the first turn has to be over before the second is worth sending. */
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
}

const prompts = PROMPTS[KIND]
if (prompts === undefined) {
  console.error(`KIND must be one of ${Object.keys(PROMPTS).join(", ")} — got "${KIND}"`)
  process.exit(2)
}

const child = spawn(AGENT, [], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] })
const started = Date.now()
/** Everything is stamped from the moment the agent was spawned, because the
 *  claim is about ORDER and DISTANCE — the launch frame, the prompt returning,
 *  and then the ending, minutes later, in no turn at all. */
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
    // A REQUEST from the agent. Permission is answered with the first
    // allow-flavoured option — this driver is not the place the auto-approval
    // rule lives, and the session asks for bypass mode besides.
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

/** What a frame about a tool call says, in the two fields this is about: the
 *  status the client is left with, and the task the adapter's `_meta` names. */
const heard = (message: Record<string, unknown>): void => {
  const method = message["method"]
  const params = (message["params"] ?? {}) as Record<string, unknown>
  if (method === "session/update") {
    const update = (params["update"] ?? {}) as Record<string, unknown>
    if (typeof update["sessionUpdate"] !== "string") return
    if (!update["sessionUpdate"].startsWith("tool_call")) return
    const claude = ((update["_meta"] ?? {}) as Record<string, unknown>)["claudeCode"] as
      | Record<string, unknown>
      | undefined
    const task = claude?.["backgroundTask"]
    // WHOSE CALL IT IS, beside the two fields above, because that is the
    // whole of what a resume can be read from: the agent's own work names the
    // call that spawned it, on its first outing and on every one after.
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
    // The four frames the CLI sends about a task's own life. Everything else
    // is the ordinary stream, and printing it would bury the thing being
    // shown — `RAW=1` is how you ask for all of it.
    const aboutTasks = sdk["type"] === "system" && subtype.startsWith("task")
      || subtype === "background_tasks_changed"
    if (aboutTasks) say(`SDK  ${subtype.padEnd(30)}`, JSON.stringify(sdk).slice(0, 240))
    else if (RAW) say(`sdk  ${String(sdk["type"])}/${subtype}`, JSON.stringify(sdk).slice(0, 160))
    // WHAT NEVER ARRIVES is the point of the whole driver, so the driver
    // CHECKS rather than trusts: a frame the harness sent carrying the
    // monitor's own output would print here and falsify the claim in
    // `acp/patches/README.md`, and the day one does this line is how anybody
    // finds out.
    //
    // The model's OWN frames are excluded, and that exclusion is the whole
    // subtlety: the agent is woken per event and says "tick-1 received", so an
    // assistant message quoting the line is the panel's existing prose rather
    // than the task's stream — matching on it would report the thing this is
    // measuring the absence of.
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
  clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
})
const opened = await ask("session/new", {
  cwd: process.cwd(),
  mcpServers: [],
  // Everything the CLI says, forwarded — which is what makes the second claim
  // checkable at all: an event the adapter dropped would still be in here.
  _meta: { claudeCode: { emitRawSDKMessages: true } },
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
