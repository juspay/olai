#!/usr/bin/env bun
/**
 * An `opencode` on PATH, shaped the way the real one is on the wire.
 *
 * The claude plugin's fake (`packages/plugins/claude/e2e/fake/claude-agent-acp`)
 * is the CLAUDE CODE adapter's shape and has been since there was only one: a
 * `_meta` on every frame, tool names inside it, a bypass mode. This one is the
 * other shape, and every difference in it was captured live against
 * **opencode 2.2.7** (2026-11-11):
 *
 *   - **the tool's name is a FIELD on the frame** (`name: "shell"`,
 *     `"execute"`, `"subagent"`), and the call id is an opaque
 *     `chatcmpl-tool-<hex>` that says nothing. The `title` MOVES over a call's
 *     life — `shell` while it starts, the command once it is known — so a
 *     client that read the title as the name would get a different answer
 *     depending on when it looked.
 *   - **olai's own tools never arrive as tool calls.** Every MCP tool is
 *     dispatched through CODE MODE: one `execute` whose `rawInput.code` is
 *     JavaScript against `tools.<server>.<tool>`, whose completion reports
 *     what it ran in `rawOutput.metadata.toolCalls`, and whose content block
 *     holds the script's returned value. One `execute` can carry several.
 *   - **permission options are ALLOW-FIRST** — `once`, `always`, `reject` —
 *     where the Claude adapter's list leads with the refusal, which is why
 *     nothing in olai may read "the first option". Under an ask policy the
 *     real agent asks ONCE PER INNER CALL with the SAME frame each time, which
 *     is why one approval covers a whole script and why this fake asks about
 *     the `execute` rather than about anything inside it.
 *   - **STEERING, AND NO QUEUE** — the pair that flipped. `_session/steering`
 *     answers `{outcome:"injected"}` mid-turn and
 *     `{outcome:"promptRequired",reason:"noRunningTurn"}` when idle, while a
 *     second `session/prompt` during a turn is REFUSED with
 *     `-32603 "Session already has an active ACP prompt: <id>"`. On 1.17.9 it
 *     was exactly the other way round, and this file refuses for real — a fake
 *     that accepted two prompts would be a witness of the composer's copy and
 *     of nothing else.
 *   - **subagents are CHILD SESSIONS**, narrated on
 *     `opencode/session/child_update` — and only to a client whose
 *     `initialize` advertised `opencode/child-session-updates`. This file
 *     checks for the opt-in, so a client that stopped asking renders flat here
 *     rather than on somebody's machine.
 *   - **no bypass mode**: `session/set_mode` answers `-32602` for anything but
 *     `build` and `plan`.
 *   - **the model is in `configOptions` with the ids the picker offers**, and
 *     a change comes back in the method RESPONSE. Nothing is ever pushed.
 *
 * It is a SEPARATE FILE rather than a mode of the other agent, deliberately: a
 * fake whose shape is chosen by a flag is a fake that can agree with the client
 * by construction the day somebody makes the flag do less than it says. Two
 * adapters keep distinct fixtures, shared with each engine's own leg tests.
 *
 * Like the other one, it calls the REAL internal MCP server over the real HTTP
 * route with the token `session/new` handed it — so a scenario drives the real
 * panel, the real ops layer and the real store, with no model in the middle.
 *
 * Behaviour is keyed on the prompt text:
 *
 *   done <id>    one `execute` calling `tools.olai.outlines_done` — Code Mode,
 *                the only way an MCP tool reaches this wire, which the panel
 *                must still recognise, title, link and draw a reply for
 *   context <id> the same through `tools.olai.outlines_read` — a read, so no
 *                write story under it
 *   batch <id>   ONE `execute` carrying TWO of olai's calls. A row has one
 *                title and one reply, so a batch is drawn as the batch it is
 *                rather than claiming to be either of the calls it made
 *   fail         an `execute` whose olai call ERRORS — olai's ops layer
 *                refuses a node that is not there: `status: "error"`,
 *                `metadata.error`, and the refusal as the returned value
 *   throw        an `execute` whose SCRIPT throws before any tool runs —
 *                `toolCalls: []` and the thrown message as the value
 *   shell        a BUILTIN call (`name: "shell"`) whose title moves under it.
 *                Nothing here is olai's, so a permission for it is a person's
 *   permit <id>  ask permission for an `execute` that calls only olai's own —
 *                answered without anybody being asked
 *   foreign      ask permission for an `execute` that calls a server olai
 *                never handed over — which must reach a person
 *   dynamic <id> ask permission for an `execute` that reaches the tool table
 *                through a computed key. Every tool in it IS olai's, and it
 *                still reaches a person: one approval covers a whole script,
 *                so a script olai cannot read exhaustively is never approved
 *   nameless     ask permission for a call carrying no name at all, which must
 *                reach a person
 *   agents       a FAN-OUT: two `subagent` calls, two child sessions, each
 *                with its own calls and its own prose
 *   agent-asks   one subagent whose own call asks permission — a question that
 *                must be drawn in the CHILD's name and nobody else's
 *   agent-fails  two subagents that end badly — one `failed`, one
 *                `interrupted` — because opencode has four terminal words
 *                where the channel has three
 *   agent-nests  a child of a child: `rootSessionId` stays the root while
 *                `parentSessionId` becomes the first child's, at `depth: 2`
 *   agent-calls-olai  a subagent that runs one of OLAI's tools through its own
 *                Code Mode `execute`, asking with the root's session id and
 *                the child named only on the call
 *   agents-slow  a fan-out left running, so a cancel can land with an agent
 *                still out
 *   deaf         a turn that goes idle in the instant a steer arrives, so the
 *                steer answers `promptRequired` and the words go out as an
 *                ordinary prompt instead — heard once
 *   slow         announce a tool call and hold it, until a scenario says when —
 *                long enough to look at a turn WHILE it is running, which is
 *                when a mid-turn message is a question anybody has
 *   hush         hold the turn saying NOTHING at all until a scenario says
 *                when. `slow` announces a tool call first, so a cancel during
 *                it lands on a turn that has already shown something; this is
 *                the turn a cancel arrives at before the agent has said a
 *                word, which is the ordinary case and the one arm a silence
 *                notice must not fire on
 *   silent       a lone `usage_update` and a SUCCESSFUL `end_turn` — no prose,
 *                no tool, no error anywhere. A turn that produced nothing is
 *                a turn olai has to account for whoever the agent is, and this
 *                is the leg it is driven on
 *   quota        the shape a provider failure really has on 2.2.7: a usage
 *                frame and then a JSON-RPC ERROR carrying the provider's own
 *                words. Nothing a person can see arrived, so the message did
 *                not land and the row has to say so
 *   anything     one chunk of prose and an `end_turn`
 *
 * A message steered into a running turn is ACTED ON BY THAT TURN — `done <id>`
 * marks the node while the first turn is still going, which is the whole
 * difference between the interrupting gesture and an ordinary send.
 *
 * `OLAI_FAKE_OPENCODE_STORED` works the way the other agent's does: unset means
 * nothing is stored (so a client boots with `session/new`), set means
 * `session/list` answers and `session/load` replays.
 *
 * A `.agent-hold-open` dot-file in the directory makes the NEXT session open —
 * whichever verb asked for it — sit on the wire until `the agent is released`,
 * the same idiom the other scripted agent uses for a held load. It exists
 * because the window this suite has to reach is the one a person meets on a
 * real machine and cannot reach on a fast one: the seconds between picking an
 * agent and its first conversation being open. Held here rather than at
 * `initialize`, because that is where the boot's own permit is held and where a
 * prompt typed into the gap has to be refused.
 *
 * It lives in a directory of its own because that directory is what goes on a
 * spawned server's `OLAI_AGENT_PATH`: whether this machine "has opencode" is a
 * property of the scenario rather than of the laptop the run is on — the same
 * argument the fake `kolu` next door makes, and the reason a developer with the
 * real opencode installed still gets the same suite CI does.
 */

import { ran, script } from "olai-plugin-opencode/testlib";
import { existsSync, rmSync } from "node:fs";

import { commandLine } from "@olai/tests/agent/command.ts";
import { readMessages } from "@olai/tests/harness/ndjson.ts";
import { emitter, MARKER, released, speaking } from "@olai/tests/harness/scripted.ts";

/** The wire, and what an agent puts on it — the transport this file shares with
 *  the other scripted agent. What is NOT shared is anything either of them
 *  MEANS: every frame shape below is this file's own, which is the whole reason
 *  two fakes are worth having. */
const emit = emitter(process.stdout);
const { notify, refuse, request, respond, take } = speaking(emit, "oc");

/** The directory olai starts this agent in, which is the only one it reads.
 *  opencode 2 has no `--cwd` and answers one with its usage text on stdout,
 *  which is not ACP; this fake does the same, so a spawn that starts passing
 *  the flag again fails here rather than on somebody's machine. */
if (process.argv.includes("--cwd")) {
  process.stdout.write("USAGE\n  opencode acp [flags]\n");
  process.exit(0);
}

/**
 * THE SIGN-IN, which is a flag on `acp` rather than a program of its own.
 *
 * `opencode acp --login` runs the auth login instead of starting the server
 * (2.2.7: `if (e.login) return auth login`), and that is the command line
 * olai's sign-in has to produce — the binary the PROBE found with the
 * protocol's own `args` appended. The corner opencode writes beside it says
 * `{ command: "opencode", … }`, a bare word that resolves on nobody's `PATH`
 * when the engine was found through `OLAI_AGENT_PATH`.
 *
 * So this prints its OWN PATH and exits 0, which is what makes the scenario's
 * claim checkable: the words on the sign-in card name the file that ran, and
 * a client that had run the bare name would not have got this far.
 */
if (process.argv.includes("--login")) {
  process.stdout.write(`signed in by ${process.argv[1] ?? "nothing"}\n`);
  process.stdout.write("https://opencode.ai/fake-login?code=abc123\n");
  // ... AND THEN IT WAITS, the way a real device-code login does: the panel's
  // card is only on screen while there is a process to type into, so a login
  // that exited the moment it printed would take its own words away before
  // anybody read them. One line in is the code, and that is the end of it.
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", () => process.exit(0));
}
const cwd = process.cwd();

/** A turn that gave up because somebody pressed cancel. Its own class so the
 *  `session/prompt` handler can tell it from a fault and answer the stop reason
 *  a real agent would. */
class Cancelled extends Error {}

/** A turn the agent REFUSED — a JSON-RPC error for `session/prompt` rather
 *  than a stop reason, which is the shape a real provider failure arrives in
 *  and the one a stop reason cannot express. */
class Refused extends Error {
  constructor(message: string, readonly reason: string) {
    super(message);
  }
}

const STORED = process.env.OLAI_FAKE_OPENCODE_STORED ?? "";

/** Whether a scenario armed the boot to hang, read at the moment the open is
 *  asked for — so it can be armed and then something pressed. TAKEN: the file
 *  is removed as it is read, so one arming holds one open and the retry behind
 *  it is not held too. */
const holdingOpen = (): boolean => {
  const marker = `${cwd}/${MARKER.holdOpen}`;
  if (!existsSync(marker)) return false;
  rmSync(marker, { force: true });
  return true;
};

/** The one stored conversation, when a scenario asked for one. Opencode's own
 *  ids look like this; nothing reads their shape, but a scenario that
 *  accidentally matched the other agent's `fake-stored-…` would be asserting
 *  nothing. */
const STORED_SESSION = "ses_opencode_stored";

let sessionId = "";

/** Whether THIS CLIENT asked for child-session updates at `initialize`. The
 *  real agent sends them only to a client that advertised
 *  `opencode/child-session-updates`, and flattens a child's frames into the
 *  parent's stream otherwise — so a client that stopped asking would render a
 *  fan-out flat. Checked here so that stops being true here first. */
let childSessionUpdates = false;

/** The MCP server olai handed this session, and the name it contributed —
 *  which is what makes a tool "ours" on this wire, at `tools.<server>.`. */
let mcp: { url: string; headers: Record<string, string>; name: string } | null = null;

let nextCall = 0;

// ── talking to olai's own MCP server ───────────────────────────────────

const callMcp = async (
  method: string,
  params: unknown,
): Promise<Record<string, unknown>> => {
  if (mcp === null) throw new Error("no MCP server was configured");
  const response = await fetch(mcp.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...mcp.headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextCall, method, params }),
  });
  if (response.status === 202) return {};
  const body = (await response.json()) as { result?: Record<string, unknown> };
  return body.result ?? {};
};

/** What one of olai's tools answered, as the value a Code Mode script would
 *  have returned: `tools.<server>.<tool>()` resolves to the tool's structured
 *  content, and a refusal is the tool's own words. */
const returned = (result: Record<string, unknown>): unknown => {
  const content = result["content"];
  const text = Array.isArray(content) && typeof content[0]?.["text"] === "string"
    ? String(content[0]["text"])
    : "";
  if (result["isError"] === true) return text;
  if (result["structuredContent"] !== undefined) return result["structuredContent"];
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

// ── the frames ─────────────────────────────────────────────────────────

const update = (value: Record<string, unknown>, session = sessionId): void => {
  notify("session/update", { sessionId: session, update: value });
};

const say = (text: string, session = sessionId): void => {
  update({ sessionUpdate: "agent_message_chunk", messageId: `msg_${nextCall}`, content: { type: "text", text } }, session);
};

/** A call id, this agent's way: OPAQUE. It says nothing about the tool, which
 *  is why the `name` field below is the only place the name is said. */
const callIdFor = (): string => `chatcmpl-tool-${(nextCall++).toString(16).padStart(16, "0")}`;

/** The server olai handed this session, by the name olai gave it. */
const ours = (): string => mcp?.name ?? "olai";

/**
 * Announce a call, then move its TITLE under it, then complete it.
 *
 * The title moving is not decoration: it is the behaviour that makes the frame's
 * own `name` the only stable name, and a panel that named a row from the title
 * would rename it mid-run. The first frame carries an EMPTY `rawInput`, the way
 * the real one does while the model is still emitting the arguments.
 */
const runTool = async (
  name: string,
  title: string,
  args: Record<string, unknown>,
  call: () => Promise<{ rawOutput: unknown; content: unknown[]; failed?: boolean }>,
  session = sessionId,
): Promise<void> => {
  const toolCallId = callIdFor();
  update({ sessionUpdate: "tool_call", toolCallId, name, title: name, kind: "other", status: "pending", locations: [], rawInput: {} }, session);
  update({ sessionUpdate: "tool_call_update", toolCallId, status: "in_progress", kind: "other", title, locations: [], rawInput: args }, session);
  const result = await call();
  update({
    sessionUpdate: "tool_call_update",
    toolCallId,
    status: result.failed === true ? "failed" : "completed",
    locations: [],
    content: result.content,
    rawOutput: result.rawOutput,
  }, session);
};

/** One Code Mode call of one of olai's tools, start to finish. */
const codeMode = async (
  tool: string,
  args: Record<string, unknown>,
  session = sessionId,
): Promise<Record<string, unknown>> => {
  const server = ours();
  const code = script(server, tool, args);
  let answered: Record<string, unknown> = {};
  await runTool("execute", "execute", { code }, async () => {
    answered = await callMcp("tools/call", { name: tool, arguments: args });
    const failed = answered["isError"] === true;
    return {
      ...ran([{ tool: `${server}.${tool}`, status: failed ? "error" : "completed", input: args }], returned(answered)),
      failed: false,
    };
  }, session);
  return answered;
};

/** Opencode's own option list for a permission — ALLOW FIRST, with the ids the
 *  real one mints. */
const OPTIONS = [
  { optionId: "once", name: "Allow once", kind: "allow_once" },
  { optionId: "always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject", name: "Reject", kind: "reject_once" },
];

/**
 * Announce a call and then ask about it — with the FRAME the question is
 * about, because on this wire the name is `execute` for olai's tools, a
 * foreign server's and opencode's own builtins alike, and the only thing that
 * tells them apart is the script.
 */
const askPermission = async (
  name: string | null,
  title: string,
  rawInput: Record<string, unknown>,
  session = sessionId,
): Promise<unknown> => {
  const toolCallId = callIdFor();
  const call = { toolCallId, ...(name === null ? {} : { name }), title, kind: "other", status: "pending", locations: [], rawInput };
  update({ sessionUpdate: "tool_call", ...call }, session);
  return await request("session/request_permission", { sessionId: session, toolCall: call, options: OPTIONS });
};

// ── child sessions ─────────────────────────────────────────────────────

let nextChild = 0;

/** One subagent, start to finish: the `subagent` call in the parent's own
 *  stream, and the child's whole life on the channel beside it.
 *
 *  `under` is the session this child hangs off — the root for an ordinary
 *  spawn, and ANOTHER CHILD for a nested one, which is the only thing that
 *  differs on the wire at `depth: 2` (`rootSessionId` stays the root,
 *  `parentSessionId` becomes the child's). `ended` is how it finishes: the
 *  four terminal words opencode has, so a scenario can watch a lane close
 *  the ways it really closes. */
const subagent = async (
  description: string,
  work: (child: string) => Promise<void>,
  report: string,
  options: { ended?: "completed" | "failed" | "interrupted"; under?: string; depth?: number } = {},
): Promise<void> => {
  const ended = options.ended ?? "completed";
  const under = options.under ?? sessionId;
  const depth = options.depth ?? 1;
  const child = `ses_child_${++nextChild}`;
  const toolCallId = callIdFor();
  const rawInput = { agent: "explore", description, prompt: `${description}. Report one line.` };
  const announce = (value: Record<string, unknown>) =>
    depth === 1 ? update(value) : childFrame(under, childTitles.get(under) ?? "", value, depth - 1, sessionId);
  announce({ sessionUpdate: "tool_call", toolCallId, name: "subagent", title: "subagent", kind: "think", status: "pending", locations: [], rawInput: {} });
  announce({ sessionUpdate: "tool_call_update", toolCallId, status: "in_progress", kind: "think", title: "subagent", locations: [], rawInput });
  childTitles.set(child, description);
  childStatus(child, description, "created", under, depth);
  childStatus(child, description, "running", under, depth);
  await work(child);
  childStatus(child, description, ended, under, depth);
  // THE JOIN ARRIVES ONLY HERE. The in-progress frames carry `rawOutput: null`
  // on the real wire, so the child session id a completion names is the first
  // and only thing tying this row to that lane — captured twice against 2.2.7.
  announce({
    sessionUpdate: "tool_call_update",
    toolCallId,
    status: ended === "completed" ? "completed" : "failed",
    locations: [],
    content: [{ type: "content", content: { type: "text", text: `<subagent sessionID="${child}" state="${ended}">\n${report}\n</subagent>` } }],
    rawOutput: ended === "completed"
      ? { metadata: { sessionID: child, status: "completed", truncated: false } }
      : { metadata: { sessionID: child, status: "running" }, error: `Tool execution interrupted (sessionID: ${child})` },
  });
};

/** What each live child was sent to do, which is the title its own frames are
 *  prefixed with — kept so a NESTED spawn can stamp its announcement with its
 *  parent's title the way the real one does. */
const childTitles = new Map<string, string>();

const childStatus = (child: string, title: string, status: string, under = sessionId, depth = 1): void => {
  if (!childSessionUpdates) return;
  notify("opencode/session/child_update", {
    rootSessionId: sessionId,
    childSessionId: child,
    parentSessionId: under,
    depth,
    title,
    type: "status",
    status,
  });
};

/**
 * A frame of a child's own, as the real agent sends it: NESTED in the channel
 * when the client asked for it, and FLATTENED into the parent's stream when it
 * did not — stamped either way, with the child's id in front of the call id and
 * the child's title in front of the display one.
 */
const childFrame = (child: string, title: string, value: Record<string, unknown>, depth = 1, under = sessionId): void => {
  const stamped = {
    ...value,
    ...(typeof value["toolCallId"] === "string" ? { toolCallId: `${child}:${String(value["toolCallId"])}` } : {}),
    ...(typeof value["title"] === "string" ? { title: `${title}: ${String(value["title"])}` } : {}),
    _meta: { "opencode/child-session": { id: child, parentID: under, depth, title } },
  };
  if (childSessionUpdates) {
    notify("opencode/session/child_update", {
      rootSessionId: sessionId,
      childSessionId: child,
      parentSessionId: under,
      depth,
      title,
      type: "update",
      update: stamped,
    });
    return;
  }
  update(stamped);
};

// ── turns ──────────────────────────────────────────────────────────────

/** Whether a turn is in flight right now — the one flag `session/prompt` and
 *  `_session/steering` both read, and the whole of what makes this agent
 *  refuse a second prompt. */
let running = false;

/** What has been steered into the turn in flight and not yet acted on. Drained
 *  by the turn itself, which is the difference a scenario can see between a
 *  message that steered a turn and one that started another. */
const steered: string[] = [];

/** ... and whether THIS turn is one that goes idle in the instant a steer
 *  arrives (`deaf`). The flag is the race, staged: the steer is answered
 *  `promptRequired` and the turn is over, so the ordinary prompt the client
 *  falls back to is one this agent will accept. */
let deaf = false;

/** Act on what was steered in, INSIDE the turn that is still running. A
 *  deliberate subset of what a prompt can ask for: `done <id>` is spelled out
 *  because it is the one a scenario watches land. */
const takeSteering = async (): Promise<void> => {
  for (const text of steered.splice(0)) {
    const [verb, ...rest] = text.trim().split(/\s+/);
    const argument = rest.join(" ");
    if (verb === "done" && argument !== "") {
      await codeMode("outlines_done", { id: argument });
      say(` — steered mid-turn: marked \`${argument}\` done.`);
      continue;
    }
    say(` — steered mid-turn: ${text}`);
  }
};

/** Somebody pressed cancel. */
let cancelled = false;

/** Wait until a scenario says when, taking anything steered in FIRST. */
const hold = async (): Promise<void> => {
  await released(cwd, async () => {
    if (cancelled) throw new Cancelled();
    await takeSteering();
  }, () => cancelled);
  if (cancelled) throw new Cancelled();
};

const turn = async (text: string): Promise<string> => {
  // THE FIRST LINE and nothing else: olai's standing instruction and its node
  // context ride the first turn of every conversation (`prompt: first-turn`),
  // so the words a person typed are the head of what arrives here.
  const said = commandLine(text);
  const [verb, ...rest] = said.split(/\s+/);
  const argument = rest.join(" ");
  const server = ours();

  if (verb === "context" && argument !== "") {
    const result = await codeMode("outlines_read", { id: argument });
    say(JSON.stringify(result));
    return "end_turn";
  }

  if (verb === "done" && argument !== "") {
    const result = await codeMode("outlines_done", { id: argument });
    say(result["isError"] === true ? `could not mark ${argument}` : `marked ${argument} done`);
    return "end_turn";
  }

  if (verb === "batch" && argument !== "") {
    // ONE call id, TWO of olai's tools. A row has one title and one reply, so
    // nothing may claim this row is either of them.
    const code = `const read = await tools.${server}.outlines_read({ id: ${JSON.stringify(argument)} });\n`
      + `const done = await tools.${server}.outlines_done({ id: ${JSON.stringify(argument)} });\nreturn [read, done];`;
    await runTool("execute", "execute", { code }, async () => {
      const read = await callMcp("tools/call", { name: "outlines_read", arguments: { id: argument } });
      const done = await callMcp("tools/call", { name: "outlines_done", arguments: { id: argument } });
      return ran(
        [
          { tool: `${server}.outlines_read`, input: { id: argument } },
          { tool: `${server}.outlines_done`, input: { id: argument } },
        ],
        [returned(read), returned(done)],
      );
    });
    say(`batched two calls on ${argument}`);
    return "end_turn";
  }

  if (said === "fail") {
    // ONE of olai's calls, REFUSED by olai's own ops layer. The `execute` still
    // completes — Code Mode reports the error in its metadata and returns the
    // refusal as the script's value — so the row is a recognised olai call that
    // has no reply to draw, which is a different thing from a row nobody named.
    const result = await codeMode("outlines_done", { id: "no-such-node" });
    say(result["isError"] === true ? "could not mark it" : "marked it done");
    return "end_turn";
  }

  if (said === "throw") {
    // The script threw before any tool ran: nothing to report, and the thrown
    // message is the value.
    await runTool("execute", "execute", { code: "throw new Error('the script gave up')" }, async () =>
      ran([], "Error: the script gave up"));
    say("the script gave up");
    return "end_turn";
  }

  if (said === "shell") {
    // A BUILTIN, named on the frame, whose title moves under it: `shell` while
    // it starts and the command once it is known.
    await runTool("shell", "echo hi", { command: "echo hi", cwd }, async () => ({
      rawOutput: { metadata: { status: "completed", truncated: false, exit: 0 } },
      content: [{ type: "content", content: { type: "text", text: "hi\n" } }],
    }));
    say("ran it");
    return "end_turn";
  }

  if (said === "slow") {
    // A tool call is ANNOUNCED and left running while the hold lasts, which is
    // what makes a turn observable WHILE it is going.
    const toolCallId = callIdFor();
    update({ sessionUpdate: "tool_call", toolCallId, name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: {} });
    update({ sessionUpdate: "tool_call_update", toolCallId, status: "in_progress", kind: "execute", title: "sleep 20", locations: [], rawInput: { command: "sleep 20", cwd } });
    await hold();
    update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed", locations: [], content: [{ type: "content", content: { type: "text", text: "(no output)" } }], rawOutput: { metadata: { status: "completed", exit: 0 } } });
    say("done dawdling");
    return "end_turn";
  }

  if (said === "hush") {
    // NOTHING announced, and then a hold. The only thing a scenario can wait
    // for here is the PANEL saying it is busy, which is the point: this is a
    // turn a person cancels before the agent has said a word.
    await hold();
    say("finished after all");
    return "end_turn";
  }

  if (said === "silent") {
    // A turn that produced NOTHING. One usage frame — which is a frame, and
    // used to be enough to convince olai the agent had worked on the message —
    // and then a turn that succeeded having said nothing a person can see.
    update({ sessionUpdate: "usage_update", used: 0, size: 200000, cost: { amount: 0, currency: "USD" } });
    return "end_turn";
  }

  if (said === "quota") {
    // THE PROVIDER FAILURE, as 2.2.7 really sends it: a usage frame and then a
    // JSON-RPC error in the provider's own words. Nothing a person can see
    // arrived, so the message did not land — and the panel has to offer it
    // again rather than read the usage frame as work.
    update({ sessionUpdate: "usage_update", used: 0, size: 200000, cost: { amount: 0, currency: "USD" } });
    throw new Refused("Internal error: Insufficient balance. Top up at https://opencode.ai/console/billing", "provider.quota");
  }

  if (verb === "permit") {
    // One of olai's own, asked about anyway — which is the path a session whose
    // own policy says `ask` takes, and the one the fail-safe rule's ALLOW half
    // is about. The FRAME is what the rule reads: a script that calls only
    // tools of a server olai handed over.
    const code = script(server, "outlines_add", { id: argument === "" ? "kitchen" : argument });
    const answered = await askPermission("execute", "execute", { code });
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "foreign") {
    // A server olai never handed this session. Same tool name, same frame
    // shape, and a person is asked — which is the rule's REFUSE half at the
    // door it is most likely to be widened at.
    const answered = await askPermission("execute", "execute", { code: `return await tools.github.create_pr({ title: "x" });` });
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (verb === "dynamic") {
    // EVERY TOOL IN IT IS OLAI'S, and a person is still asked. One approval
    // covers a whole script, so a script this cannot read exhaustively is
    // never approved — the computed key is exactly the thing a reader that
    // skipped what it could not parse would wave through.
    const node = argument === "" ? "kitchen" : argument;
    const code = `const which = "${server}";\nreturn await tools[which].outlines_done({ id: ${JSON.stringify(node)} });`;
    const answered = await askPermission("execute", "execute", { code });
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "nameless") {
    // A frame with no `name` at all. Nothing can say which tool this is, so a
    // person is asked — the fail-safe rule's other REFUSE half.
    const answered = await askPermission(null, "do something unnamed", {});
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "agents") {
    // A FAN-OUT. Two children, each with a call and a word of its own, so a
    // scenario can see two lanes rather than one column.
    await subagent("Survey the kitchen", async (child) => {
      childFrame(child, "Survey the kitchen", {
        sessionUpdate: "tool_call", toolCallId: "c1", name: "read", title: "read", kind: "read", status: "pending", locations: [], rawInput: {},
      });
      childFrame(child, "Survey the kitchen", {
        sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed", kind: "read", title: "read house.olai", locations: [],
        content: [{ type: "content", content: { type: "text", text: "read it" } }],
      });
      childFrame(child, "Survey the kitchen", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_1", content: { type: "text", text: "the kitchen holds four rows" },
      });
    }, "the kitchen holds four rows");
    await subagent("Count the orders", async (child) => {
      childFrame(child, "Count the orders", {
        sessionUpdate: "tool_call", toolCallId: "c2", name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: {},
      });
      childFrame(child, "Count the orders", {
        sessionUpdate: "tool_call_update", toolCallId: "c2", status: "completed", kind: "execute", title: "ls", locations: [],
        content: [{ type: "content", content: { type: "text", text: "one order" } }],
      });
      childFrame(child, "Count the orders", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_2", content: { type: "text", text: "one order is outstanding" },
      });
    }, "one order is outstanding");
    say("both subagents reported");
    return "end_turn";
  }

  if (said === "agent-asks") {
    // A CHILD'S QUESTION. The real agent stamps the request with the session
    // its CONNECTION belongs to — the ROOT — and names the child only on the
    // call, which is why a panel that read the request's own session would
    // draw a subagent's question in the main agent's name.
    await subagent("Open a terminal", async (child) => {
      const toolCallId = `${child}:p1`;
      childFrame(child, "Open a terminal", {
        sessionUpdate: "tool_call", toolCallId: "p1", name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: { command: "rm -rf /tmp/x" },
      });
      const answered = await request("session/request_permission", {
        sessionId,
        toolCall: {
          toolCallId,
          name: "shell",
          title: "Open a terminal: rm -rf /tmp/x",
          kind: "execute",
          status: "pending",
          locations: [],
          rawInput: { command: "rm -rf /tmp/x" },
          _meta: { "opencode/child-session": { id: child, parentID: sessionId, depth: 1, title: "Open a terminal" } },
        },
        options: OPTIONS,
      });
      childFrame(child, "Open a terminal", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_3", content: { type: "text", text: `the subagent was told: ${JSON.stringify(answered)}` },
      });
    }, "the subagent asked and was answered");
    say("the subagent asked and was answered");
    return "end_turn";
  }

  if (said === "agent-fails") {
    // A CHILD THAT ENDED BADLY, twice over: one `failed` and one
    // `interrupted`. opencode has four terminal words where the channel has
    // three, and a lane that closed `completed` for all of them would be the
    // panel saying an agent that died came back.
    await subagent("Read the missing file", async (child) => {
      childFrame(child, "Read the missing file", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_f1", content: { type: "text", text: "there is no such file" },
      });
    }, "there is no such file", { ended: "failed" });
    await subagent("Wait for the lock", async (child) => {
      childFrame(child, "Wait for the lock", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_f2", content: { type: "text", text: "still waiting" },
      });
    }, "stopped waiting", { ended: "interrupted" });
    say("both subagents ended badly");
    return "end_turn";
  }

  if (said === "agent-nests") {
    // A CHILD OF A CHILD. `rootSessionId` stays the root and
    // `parentSessionId` becomes the first child's, so a panel that rooted a
    // lane at the request's own session would file the grandchild's work
    // under the main agent — which is the one thing `depth` exists to stop.
    await subagent("Survey the house", async (child) => {
      childFrame(child, "Survey the house", {
        sessionUpdate: "tool_call", toolCallId: "n1", name: "read", title: "read", kind: "read", status: "pending", locations: [], rawInput: {},
      });
      childFrame(child, "Survey the house", {
        sessionUpdate: "tool_call_update", toolCallId: "n1", status: "completed", kind: "read", title: "read house.olai", locations: [],
        content: [{ type: "content", content: { type: "text", text: "read it" } }],
      });
      await subagent("Count the hinges", async (grandchild) => {
        childFrame(grandchild, "Count the hinges", {
          sessionUpdate: "tool_call", toolCallId: "n2", name: "shell", title: "shell", kind: "execute", status: "pending", locations: [], rawInput: {},
        }, 2, child);
        childFrame(grandchild, "Count the hinges", {
          sessionUpdate: "tool_call_update", toolCallId: "n2", status: "completed", kind: "execute", title: "ls hinges", locations: [],
          content: [{ type: "content", content: { type: "text", text: "four hinges" } }],
        }, 2, child);
      }, "four hinges", { under: child, depth: 2 });
    }, "the house has four hinges");
    say("the nested subagent reported");
    return "end_turn";
  }

  if (said === "agent-calls-olai") {
    // ONE OF OLAI'S OWN, INSIDE A CHILD. The script is the same Code Mode
    // script the main agent would have written and the permission request is
    // stamped with the ROOT session, so the auto-allow rule has to read it
    // and the row has to land behind the CHILD's door.
    const code = script(ours(), "outlines_done", { id: "order" });
    await subagent("Mark the order", async (child) => {
      const answered = await request("session/request_permission", {
        sessionId,
        toolCall: {
          toolCallId: `${child}:e1`,
          name: "execute",
          title: "Mark the order: execute",
          kind: "other",
          status: "pending",
          locations: [],
          rawInput: { code },
          _meta: { "opencode/child-session": { id: child, parentID: sessionId, depth: 1, title: "Mark the order" } },
        },
        options: OPTIONS,
      });
      childFrame(child, "Mark the order", {
        sessionUpdate: "tool_call", toolCallId: "e1", name: "execute", title: "execute", kind: "other", status: "pending", locations: [], rawInput: {},
      });
      const result = await callMcp("tools/call", { name: "outlines_done", arguments: { id: "order" } });
      childFrame(child, "Mark the order", {
        sessionUpdate: "tool_call_update", toolCallId: "e1", status: "completed", kind: "other", title: "execute", locations: [], rawInput: { code },
        ...ran([{ tool: `${ours()}.outlines_done`, input: { id: "order" } }], returned(result)),
      });
      childFrame(child, "Mark the order", {
        sessionUpdate: "agent_message_chunk", messageId: "msg_child_4", content: { type: "text", text: `the subagent was answered ${JSON.stringify(answered)}` },
      });
    }, "marked the order");
    say("the subagent marked it");
    return "end_turn";
  }

  if (said === "agents-slow") {
    // A FAN-OUT LEFT RUNNING, so a scenario can press cancel with an agent
    // still out and watch both the lane and the panel settle.
    await subagent("Watch the kitchen", async (child) => {
      childFrame(child, "Watch the kitchen", {
        sessionUpdate: "tool_call", toolCallId: "s1", name: "shell", title: "shell", kind: "execute", status: "in_progress", locations: [], rawInput: { command: "sleep 20" },
      });
      await hold();
    }, "stopped watching", { ended: "interrupted" });
    say("the fan-out is over");
    return "end_turn";
  }

  if (said === "deaf") {
    // THE STEER THAT LOST THE RACE. The turn goes idle in the same instant
    // the steer arrives, so the agent answers `promptRequired` — one of its
    // only two outcomes — and the client sends the words as an ordinary
    // prompt instead. The claim a scenario makes on this is that they are
    // heard ONCE: a client reading an unrecognised outcome as taken would
    // lose them, and one that sent twice would double them.
    deaf = true;
    const toolCallId = callIdFor();
    update({ sessionUpdate: "tool_call", toolCallId, name: "shell", title: "shell", kind: "execute", status: "in_progress", locations: [], rawInput: { command: "sleep 20" } });
    await hold();
    update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed", locations: [], content: [{ type: "content", content: { type: "text", text: "(no output)" } }] });
    say("the turn was already over");
    return "end_turn";
  }

  await takeSteering();
  say(`opencode says: ${said}`);
  await takeSteering();
  return "end_turn";
};

// ── the protocol ───────────────────────────────────────────────────────

let currentModel = "opencode/kimi-k3";
let currentMode = "build";

const configOptions = () => [
  {
    id: "model",
    name: "Model",
    category: "model",
    type: "select",
    currentValue: currentModel,
    // The ids the picker offers ARE the ids it reports — no aliases, which is
    // the boring case the shared model reading also has to get right.
    options: [
      { value: "opencode/kimi-k3", name: "opencode/Kimi K3" },
      { value: "opencode/claude-sonnet-5", name: "opencode/Claude Sonnet 5" },
    ],
  },
  {
    id: "mode",
    name: "Session Mode",
    category: "mode",
    type: "select",
    currentValue: currentMode,
    options: [
      { value: "build", name: "Build", description: "The default agent." },
      { value: "plan", name: "Plan", description: "Read-only agent." },
    ],
  },
];

let openedSessions = 0;

const openSession = (id: string, params: Record<string, unknown>): void => {
  sessionId = id;
  const servers = (params["mcpServers"] ?? []) as ReadonlyArray<Record<string, unknown>>;
  const http = servers.find((server) => server["type"] === "http");
  if (http !== undefined) {
    const headers = (http["headers"] ?? []) as ReadonlyArray<{ name: string; value: string }>;
    mcp = {
      url: String(http["url"]),
      name: String(http["name"]),
      headers: Object.fromEntries(headers.map((header) => [header.name, header.value])),
    };
  }
};

const handle = async (message: Record<string, unknown>): Promise<void> => {
  const id = message["id"];
  const method = message["method"];
  const params = (message["params"] ?? {}) as Record<string, unknown>;

  // An answer to something WE asked.
  if (method === undefined) {
    take(id)?.(message["result"] ?? null);
    return;
  }

  switch (method) {
    case "initialize": {
      // THE OPT-IN, read exactly where the real one reads it. A client that
      // does not advertise this gets a subagent's frames flattened into the
      // parent's stream, with no lifecycle to draw a lane from.
      const capabilities = (params["clientCapabilities"] ?? {}) as Record<string, unknown>;
      const corner = (capabilities["_meta"] ?? {}) as Record<string, unknown>;
      childSessionUpdates = corner["opencode/child-session-updates"] === true;
      respond(id, {
        protocolVersion: 1,
        agentInfo: { name: "OpenCode", version: "2.2.7" },
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: { http: true, sse: false },
          sessionCapabilities: { list: {}, resume: {}, close: {}, delete: {}, fork: {} },
          _meta: { "opencode/child-session-updates": true },
        },
        // WHAT IT WILL SIGN SOMEBODY IN WITH, in both spellings, because the
        // real one offers both and the whole bug is which one a client
        // believes: `type: "terminal"` with `args: ["--login"]` for the agent
        // binary, and a `_meta` corner naming the bare word `opencode`. Each
        // half is conditional on the client having advertised for it, exactly
        // as 2.2.7 is.
        authMethods: [{
          id: "opencode-login",
          name: "Login with opencode",
          description: "Run `opencode auth login` in the terminal",
          ...(((capabilities["auth"] ?? {}) as Record<string, unknown>)["terminal"] === true
            ? { type: "terminal", args: ["--login"] }
            : {}),
          ...(corner["terminal-auth"] === true
            ? { _meta: { "terminal-auth": { command: "opencode", args: ["auth", "login"], label: "OpenCode Login" } } }
            : {}),
        }],
        _meta: { steering: { supported: true } },
      });
      return;
    }

    case "session/new": {
      if (holdingOpen()) await released(cwd);
      openSession(`ses_new_${++openedSessions}`, params);
      respond(id, { sessionId, configOptions: configOptions() });
      return;
    }

    case "session/list":
      // THE WHOLE DIRECTORY IN ONE PAGE, with a cursor beside it anyway: the
      // real one filters by the request's own `cwd`, ignores a `limit`, and
      // hands a `nextCursor` that answers zero rows when it is followed
      // (captured against 2.2.7 over three stored conversations). Olai
      // follows no cursor and its own client-side filter stays either way,
      // because what that guards is an agent answering more broadly than it
      // was asked.
      respond(id, {
        sessions: STORED === "" || params["cwd"] !== cwd
          ? []
          : [{ sessionId: STORED_SESSION, cwd, title: "an opencode conversation", updatedAt: "2026-11-11T10:00:00Z" }],
        nextCursor: "eyJvcmRlciI6ImRlc2MifQ==",
      });
      return;

    case "session/load": {
      const heldLoad = `${cwd}/${MARKER.holdLoad}`;
      if (existsSync(heldLoad)) {
        rmSync(heldLoad, { force: true });
        await released(cwd);
      } else if (holdingOpen()) await released(cwd);
      openSession(String(params["sessionId"]), params);
      // A replay: collapsed final frames, and the person's own words as
      // chunks. NO CHILD-SESSION FRAMES, which is a fact about the wire and
      // not an omission here: a reopened conversation that had a subagent
      // replays the `subagent` call and its report and nothing on the
      // channel, so the lane does not come back (captured against 2.2.7).
      update({ sessionUpdate: "user_message_chunk", messageId: "msg_replay_1", content: { type: "text", text: "what did we say" } });
      update({ sessionUpdate: "tool_call", toolCallId: "chatcmpl-replay", name: "subagent", title: "subagent", kind: "think", status: "pending", locations: [], rawInput: {} });
      update({
        sessionUpdate: "tool_call_update",
        toolCallId: "chatcmpl-replay",
        status: "completed",
        kind: "think",
        title: "subagent",
        locations: [],
        rawInput: { agent: "explore", description: "Survey the kitchen", prompt: "Survey the kitchen." },
        content: [{ type: "content", content: { type: "text", text: `<subagent sessionID="ses_child_replay" state="completed">\nthe kitchen holds four rows\n</subagent>` } }],
        rawOutput: { metadata: { sessionID: "ses_child_replay", status: "completed", truncated: false } },
      });
      update({ sessionUpdate: "agent_message_chunk", messageId: "msg_replay_2", content: { type: "text", text: "opencode remembers this conversation" } });
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "session/set_mode":
      // `build` and `plan`, and nothing else — which is why olai's opencode leg
      // asks for no permission mode at all.
      refuse(id, -32602, `mode not found: ${String(params["modeId"])}`);
      return;

    case "session/set_config_option": {
      const value = String(params["value"]);
      if (params["configId"] === "mode") currentMode = value;
      else currentModel = value;
      // In the RESPONSE, never as a pushed update.
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "_session/steering": {
      // TWO OUTCOMES, which is the whole list the real one has. Steering an
      // idle session is `promptRequired`, and the client sends the words as an
      // ordinary prompt instead.
      //
      // `deaf` is that same answer with a turn still on screen: the race the
      // real one loses when a turn goes idle in the instant a steer arrives.
      // The hold is released in the same breath, so by the time the client's
      // fallback prompt lands there is a turn to start.
      if (!running || deaf) {
        if (deaf) {
          deaf = false;
          running = false;
          // The marker the hold is waiting on, dropped rather than awaited:
          // this turn is OVER, which is what makes the fallback prompt land
          // on an agent with nothing running.
          void Bun.write(`${cwd}/${MARKER.release}`, "");
        }
        respond(id, { outcome: "promptRequired", reason: "noRunningTurn" });
        return;
      }
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>;
      steered.push(blocks.map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : "")).join(""));
      respond(id, { outcome: "injected" });
      return;
    }

    case "session/prompt": {
      // NO QUEUE. A second prompt while a turn runs is refused outright, which
      // is what opencode 2 does and the opposite of what 1.17.9 did.
      if (running) {
        refuse(id, -32603, `Session already has an active ACP prompt: ${sessionId}`, { service: "session" });
        return;
      }
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>;
      const text = blocks
        .map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : ""))
        .join("");
      running = true;
      cancelled = false;
      try {
        const stopReason = await turn(text);
        respond(id, { stopReason, usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 }, _meta: {} });
      } catch (cause) {
        if (cause instanceof Refused) {
          refuse(id, -32603, cause.message, { service: "session", errorName: cause.reason });
        } else {
          respond(id, { stopReason: cause instanceof Cancelled ? "cancelled" : "refusal" });
        }
      } finally {
        running = false;
        deaf = false;
        steered.length = 0;
      }
      return;
    }

    case "session/cancel":
      // A notification, so there is nothing to answer — but there is something
      // to DO: the turn that is running gives up at its next tick.
      cancelled = true;
      return;

    default:
      if (id !== undefined) refuse(id, -32601, `method not found: ${String(method)}`);
      return;
  }
};

readMessages<Record<string, unknown>>(process.stdin, (message) => {
  void handle(message);
});
