#!/usr/bin/env bun
/**
 * An `omp` on PATH, shaped the way the real one is on the wire.
 *
 * Oh My Pi (`https://github.com/can1357/oh-my-pi`) is the fifth engine in the
 * panel and the THIRD scripted agent in this suite, and every frame shape below
 * was captured live against **omp 18.1.21** spawned as `omp --approval-mode
 * yolo acp` (the spike, 2026-09-14 — `packages/plugins/omp/src/leg.ts` carries
 * the reading and that package's `docs.md` the prose). What it is NOT is a mode
 * of `agent/opencode/opencode` or `agent/fake-acp-agent.ts`. Two fakes keep
 * distinct fixtures because a fake whose shape is chosen by a flag is a fake
 * that can agree with the client by construction the day somebody makes the
 * flag do less than it says; a third is here for the same reason, and the
 * differences are the reason this file exists at all:
 *
 *   - **no `_meta` on any frame ABOUT A CALL, ever** — the only `_meta` omp's
 *     ACP mapper stamps anywhere is the `{ messageCount, size }` on a stored
 *     conversation's listing row (`leg.ts`'s `listedIn`). So a tool's name is
 *     reachable only at the head of the call id — `write:0`, `bash:3` — which
 *     is why nothing about a call is remembered off a frame either, and why a
 *     call nobody named is a call a person is asked about. In particular the
 *     terminal corners pi's adapter writes (`terminal_info`,
 *     `terminal_output`, `terminal_exit`) are NOT here: with olai's
 *     `terminal: true` on the handshake, the command olai watches is a
 *     process of olai's own — asked for with `terminal/create` and read back
 *     out of it — and the call that names it carries a
 *     `{ type: "terminal", terminalId }` content block rather than any
 *     metadata.
 *   - **olai's MCP tools are called through omp's own `write`.** With omp's
 *     default `tools.xdev`, `mcp__olai_outlines_read` is not announced as
 *     itself: the call is a `write` whose `rawInput.path` is the pseudo-path
 *     omp's `xd` scheme mints for it, and the tool's own answer comes back
 *     nested under `details.xdev.inner.rawContent`. Both frames are built by
 *     `olai-plugin-omp/testlib` — `announced` for the call, `wrapped` for the
 *     completion, the same two fixtures the leg's own bench uses — and nothing
 *     in this file spells that path by hand, so a fake cannot drift from the
 *     reader about the door the dispatch goes through.
 *   - **no bypass mode and no steering**: `session/set_mode` answers `-32603
 *     "Unsupported ACP mode"` (the modes are `default` and `plan`) and
 *     `_session/steering` answers `-32603 "Unknown ACP ext method"`.
 *   - **permission options lead with an ALLOW** (`allow_once`, `allow_always`,
 *     `reject_once`, `reject_always`), where the Claude adapter's list leads
 *     with the refusal — so nothing in olai may read "the first option". And on
 *     this wire NOTHING is auto-allowed: the leg's rule reads a call's NAME,
 *     every one of olai's calls here is named `write`, and the dispatch path is
 *     display only — so `permit` below reaches a person even though olai
 *     recognises the call as one of its own. That is the fail-safe direction
 *     this wire is safe to be wrong in.
 *   - **a message sent while a turn STREAMS CANCELS that turn.** omp's
 *     `prompt()` begins a cancel cleanup when the session is already streaming,
 *     so this is the one engine here that does not queue what you send mid-turn:
 *     the first request answers `stopReason: "cancelled"` and the second runs
 *     afterwards. Modelled below as real state ({@link streaming}) rather than
 *     as opencode's cancel flag and chain, because the behaviour is different
 *     and the scenarios assert it.
 *   - **a prompt arriving during an AUTONOMOUS turn** — one no client prompt
 *     owns — is refused `-32000 session_busy` with
 *     `error.data.hint = "steer|followUp|wait"`. A scripted agent cannot HAVE an
 *     autonomous turn, so the `busy` verb stages that answer itself; it is the
 *     one frame here not built by `speaking`, because `refuse` sends no `data`
 *     and the hint is the whole of what that refusal says beyond its code.
 *
 * Like the other two it calls the REAL internal MCP server over the real HTTP
 * route with the token `session/new` handed it — so a scenario drives the real
 * panel, the real ops layer and the real store, with no model in the middle.
 *
 * Behaviour is keyed on the first line of the prompt ({@link commandLine}):
 *
 *   hello         two thought chunks and then one line of prose. The chunks are
 *                 here because the real one thinks before it speaks, and a
 *                 panel must not draw a thought as the agent's words
 *   bash          an ordinary command's row: a `bash:<n>` call, kind `execute`,
 *                 a `{type: "terminal"}` block naming a CLIENT-OWNED process
 *                 asked for on olai, completed with its exit under it — and
 *                 its title the `$ ls` command from the first frame, while
 *                 the name it was announced with holds
 *   context <id>  one of olai's own reads, through the `write` door above and
 *                 really called over HTTP, so the write reaches the ops layer —
 *                 and the tool's answer said back as prose
 *   done <id>     the same for a write, which is the one olai call that CHANGES
 *                 something
 *   permit        a `write` call for one of olai's tools and then a permission
 *                 request for it — a person's to answer, as above
 *   nameless      a permission request whose call id carries no name at all
 *                 (`:<n>`): asked rather than guessed
 *   slow          a command announced and left running until a scenario says
 *                 when, so a mid-turn message lands on a turn anybody can see
 *   hush          a hold with NOTHING announced — the turn a person cancels
 *                 before the agent has said a word
 *   silent        one `usage_update` and a successful end of turn, nothing else
 *   error-silent  the same zero-token frame and then a JSON-RPC refusal for the
 *                 prompt: nothing a person can see arrived, so the panel has to
 *                 offer the message again rather than read the usage frame as
 *                 work
 *   busy          the refusal of the prompt itself, with nothing sent before it
 *   anything      one line of prose and an `end_turn`
 *
 * `OLAI_FAKE_OMP_STORED` works the way the other agents' does: unset means no
 * conversation on disk (so a client boots with `session/new`), set means
 * `session/list` answers and `session/load` replays. The stored conversation is
 * `an Oh My Pi conversation`, its id is `ses_omp_stored`, and its listing row
 * carries the corner omp really stamps — `_meta { messageCount, size }`, a
 * count rather than an inference.
 *
 * THE LISTING IS PAGED and no scenario ever sees the second page: olai sends no
 * limit and follows no cursor (`docs.md`), and this fake stores ONE
 * conversation, so `nextCursor` cannot appear. The slicing below is here so the
 * shape olai reads — a page of fifty, and a cursor only while more remain — is
 * what this file IMPLEMENTS rather than what it promises.
 *
 * A `.agent-hold-open` dot-file in the served directory makes the next session
 * open — whichever verb asked for it — sit on the wire until `the agent is
 * released`, and `.agent-hold-load` does the same for the next replay of a
 * stored conversation: the window a person meets between picking an agent and
 * its first conversation being open is one a fast machine never reaches.
 *
 * It lives in a directory of its own because that directory is what goes on a
 * spawned server's `OLAI_AGENT_PATH`: whether this machine "has omp" is a
 * property of the scenario rather than of the laptop the run is on — the same
 * argument the fake `kolu` next door makes.
 */

import { announced, wrapped, type CallToolResult } from "olai-plugin-omp/testlib";
import { existsSync, rmSync } from "node:fs";

import { commandLine } from "../command.ts";
import { readMessages } from "../../support/ndjson.ts";
import { emitter, MARKER, released, speaking } from "../../support/scripted.ts";

/** The wire, and what an agent puts on it — the transport this file shares with
 *  the other scripted agents ({@link ../../support/scripted.ts}). What is NOT
 *  shared is anything any of them MEANS: every frame shape below is this file's
 *  own, which is the whole reason three fakes are worth having. */
const emit = emitter(process.stdout);
const { notify, refuse, request, respond, take } = speaking(emit, "omp");

/** The served directory. omp is spawned with it as the child's own WORKING
 *  DIRECTORY and nothing about it is said on the command line (`./server.ts`
 *  passes no `--cwd`, unlike the opencode row): what it does with the directory
 *  is take an absolute `cwd` in `session/new` and `session/list` and report one
 *  per listed row. */
const cwd = process.cwd();

/** A turn that gave up because somebody pressed cancel — its own class so the
 *  `session/prompt` handler can tell it from a fault and answer the stop reason
 *  a real agent would. */
class Cancelled extends Error {}

/** A turn the agent REFUSED: a JSON-RPC error for `session/prompt` rather than
 *  a stop reason, which is the shape the auth failure arrives in and the one a
 *  stop reason cannot express. */
class Refused extends Error {}

/** Whether a scenario asked for a conversation on disk. The variable being
 *  PRESENT at all is the signal; `hooks.ts` sets it only for a `@omp`
 *  scenario that also asked for stored sessions. */
const STORED = process.env.OLAI_FAKE_OMP_STORED ?? "";

/** The hold's own tick, kept here so the loop it paces reads as what it is —
 *  a poll rather than a promise somebody else resolves. */
const sleep = (millis: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, millis);
  return promise;
};

/** The one stored conversation, when a scenario asked for one. omp's own ids
 *  look like this; nothing reads the shape, but a scenario that accidentally
 *  matched another agent's `…_stored` would be asserting nothing. */
const STORED_SESSION = "ses_omp_stored";

/** Its title, and the title a fresh session announces: one fake with one
 *  conversation in it, so the sentence a row carries does not change with how
 *  the conversation was reached. */
const TITLE = "an Oh My Pi conversation";

/** How many rows one page carries — omp's own page size, per `docs.md`. With a
 *  single conversation stored, nothing here ever reaches a second page. */
const PAGE = 50;

let sessionId = "";

/** The MCP server olai handed this session — its url, its name, and the headers
 *  its token travels in — which is what makes a tool "ours" on this wire, at
 *  the `mcp__<server>_` prefix. */
let mcp: { url: string; headers: Record<string, string>; name: string } | null = null;

/** The number on the current call. omp mints `<tool>:<n>` and the number is the
 *  CALL's, not the tool's. */
let nextCall = 0;

/** The id a JSON-RPC request to olai's own MCP server travels under. Its own
 *  counter rather than the one above, because it is this file's bookkeeping:
 *  not one byte of it crosses the ACP wire, and the call ids are what a
 *  scenario reads. */
let nextRequest = 0;

/** How many sessions this process has opened, which is all the session id a
 *  fresh `session/new` needs. */
let openedSessions = 0;

/** The three settings a session carries, moved by `session/set_config_option`
 *  and reported back in the whole set every time one of them changes. */
let currentMode = "default";
let currentModel = "litellm/kimi-k3";
let currentThinking = "auto";

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
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextRequest, method, params }),
  });
  if (response.status === 202) return {};
  const body = (await response.json()) as { result?: Record<string, unknown> };
  return body.result ?? {};
};

// ── the frames ─────────────────────────────────────────────────────────

const say = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  });
};

/** A thought, which is not speech: the same shape a message chunk has, in the
 *  update kind ACP reserves for what the agent is working out rather than what
 *  it is telling you. Nothing in this suite draws one as the agent's words, and
 *  that is the claim the `hello` verb is here to let a scenario make. */
const think = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text } },
  });
};

/** A call id, this agent's way: the tool's name, a colon, and the call's
 *  number. It is the ONLY place the name is said — this wire has no `_meta` for
 *  it to ride in. */
const callIdFor = (tool: string): string => `${tool}:${nextCall++}`;

/**
 * A command's row, the way this agent actually runs one — and the one thing
 * here that is NOT bytes on a wire: olai advertises `terminal: true`, so the
 * command is a CLIENT-OWNED process. The turn asks olai to spawn it
 * (`terminal/create`, which is a request TO the client), the call that names
 * it carries a `{ type: "terminal", terminalId }` block in its content, and
 * whatever the command prints is olai's own process showing itself while it
 * runs — the row a person watches is drawn from the client's side of the
 * connection, not from anything this file sends. That is also what a cancel
 * stops: the process belongs to the client's lifecycle rather than to the
 * turn's, so a cancelled turn leaves the kill to olai.
 *
 * THE TITLE IS THE COMMAND, minted with the first frame — the real mapper's
 * title for a command tool is its `$ <command>` start text, and it does not
 * move — so the stable name a row keeps is still read off the id's head
 * (`bash:0`), which is the whole of `leg.ts`'s `toolNameOf`.
 *
 * NO `announceTerminal`/`finishTerminal` of the pi kind is possible on this
 * wire: the corners that pair writes on a frame's `_meta` are an extension
 * nothing in omp's ACP mapper stamps. What the pair below models is the four
 * client requests instead — create, announce; wait, drain, release, complete —
 * spelled the way `agent/fake-acp-agent.ts`'s terminal path spells them,
 * because that is the way the real one does.
 */
const announceCommand = async (
  toolCallId: string,
  command: string,
  script: string,
): Promise<{ terminalId: string }> => {
  const created = (await request("terminal/create", {
    sessionId,
    command: "node",
    args: ["-e", script],
    cwd,
    outputByteLimit: 65536,
  })) as { terminalId: string };
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: `$ ${command}`,
      kind: "execute",
      status: "in_progress",
      content: [{ type: "terminal", terminalId: created.terminalId }],
    },
  });
  return created;
};

/** ... and its completion, asked of the client in the same order the real one
 *  asks: the exit is waited on, the bytes are drained, the handle is released,
 *  and only then does the row settle. What is NOT here is a kill: a turn
 *  cancelled mid-command throws `Cancelled` past this and leaves the process
 *  to olai, whose client-owned terminals die with their turn. */
const finishCommand = async (toolCallId: string, terminalId: string): Promise<void> => {
  const params = { sessionId, terminalId };
  await request("terminal/wait_for_exit", params);
  await request("terminal/output", params);
  await request("terminal/release", params);
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
  });
};

/** A command that is done when it starts: one line and an exit, for a row the
 *  only interesting fact about is what it is called. */
const DONE_CMD = 'process.stdout.write("omp ran ls\\n")';

/** A command that runs until the scenario says when, and reports both ends of
 *  that: it prints the first line at once, watches the release marker the way
 *  this file's own hold does, and prints the second as it goes. The bytes are
 *  olai's process's bytes now — a region that says "Running" and then "Exit 0"
 *  is the CLIENT's reading of its own child, which is exactly the difference
 *  this verb's scenario is about. */
const heldCommand = (): string => {
  const marker = JSON.stringify(`${cwd}/${MARKER.release}`);
  return (
    `process.stdout.write("omp command started\\n");` +
    `const t = setInterval(() => { if (require("fs").existsSync(${marker}))` +
    ` { process.stdout.write("omp command done\\n"); process.exit(0) } }, 25);`
  );
};

/**
 * One of olai's own tools, through the door this agent dispatches it: a `write`
 * call whose `rawInput.path` is the pseudo-path `announced` mints, then the
 * REAL MCP call over HTTP, then the completion `wrapped` nests the tool's own
 * result inside `write`'s.
 *
 * The title is the INTENT — a sentence about what the call is doing, which is
 * this wire's convention for a `write` and the reason the call's id rather than
 * its title is what names it. The path is the agent's own mint rather than
 * anything a model wrote, which is what makes it the one string here that may
 * be believed.
 */
const runOurTool = async (
  tool: string,
  args: Record<string, unknown>,
  intent: string,
): Promise<Record<string, unknown>> => {
  const server = mcp?.name ?? "olai";
  const toolCallId = callIdFor("write");
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: intent,
      status: "in_progress",
      ...announced(server, tool, args),
    },
  });
  const result = await callMcp("tools/call", { name: tool, arguments: args });
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: result["isError"] === true ? "failed" : "completed",
      ...wrapped(result as unknown as CallToolResult),
    },
  });
  return result;
};

/** omp's own option list for a permission request, in its own order — ALLOW
 *  FIRST, the opposite of the Claude adapter's, which is why nothing may read
 *  "the first option" ({@link allowedWithoutAsking} chooses by `kind`). The ids
 *  and kinds are the four `leg.test.ts` records for this wire; the LABELS are
 *  this fake's own wording, because nothing in olai reads one — an option is
 *  answered by its id and chosen by its kind. */
const OPTIONS = [
  { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
  { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject_once", name: "Reject", kind: "reject_once" },
  { optionId: "reject_always", name: "Always reject", kind: "reject_always" },
];

/**
 * Announce a call and then ask about it, correlated by the call id — which is
 * the only correlation this wire has, and the key the panel's own registry is
 * already holding whatever it knows about the call under.
 *
 * `extra` is what the announcement carries beyond the title, and the one verb
 * that needs it is `permit`: its call is a `write` aimed at one of olai's
 * tools, so the frame carries the `announced` door rather than being a call
 * with no arguments at all.
 */
const askPermission = async (
  toolCallId: string,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "tool_call", toolCallId, title, status: "pending", ...extra },
  });
  return await request("session/request_permission", {
    sessionId,
    toolCall: { toolCallId, title },
    options: OPTIONS,
  });
};

// ── turns ──────────────────────────────────────────────────────────────

/** What one turn is: the state a `session/cancel` — or a prompt arriving while
 *  this one streams — reaches in, and nothing else. */
interface Turn {
  cancelled: boolean;
}

const turn = async (text: string, mine: Turn): Promise<string> => {
  const said = commandLine(text);

  /** The tick a held turn runs before it looks for its release. THIS is where
   *  the cancellation claims are cashed: a turn that has been cancelled gives
   *  up here, which is why the check is inside the hold's own loop rather than
   *  after it. */
  const give = (): void => {
    if (mine.cancelled) throw new Cancelled();
  };

  // ONCE BEFORE IT STARTS, for the turn that was cancelled while it waited its
  // place in the chain — a third prompt arriving on top of a second gives up
  // the second before it has done anything, exactly as a send gives up a turn
  // that is streaming.
  give();

  if (said === "hello") {
    think("weighing up hello");
    think("still weighing up hello");
    say("omp says: hello");
    return "end_turn";
  }

  if (said.startsWith("context ")) {
    const node = said.slice("context ".length).trim();
    const result = await runOurTool("outlines_read", { id: node }, `read ${node} from the outline`);
    say(JSON.stringify(result));
    return "end_turn";
  }

  if (said.startsWith("done ")) {
    const node = said.slice("done ".length).trim();
    await runOurTool("outlines_done", { id: node }, `mark ${node} done`);
    say(`marked ${node} done`);
    return "end_turn";
  }

  if (said === "permit") {
    // One of olai's own, asked about anyway — and on this wire that is the
    // ordinary case rather than the fallback. The row is a `write` whose path
    // names `mcp__olai_outlines_add`, so olai recognises it; the PERMISSION is
    // read off the call's name, which is `write`, so a person is asked. The two
    // facts are deliberately in one scenario: a path that names one of ours
    // decides what a row is CALLED and never what is approved.
    const toolCallId = callIdFor("write");
    const title = "add a node to the outline";
    const server = mcp?.name ?? "olai";
    const answered = await askPermission(
      toolCallId,
      title,
      announced(server, "outlines_add", { title: "a node worth adding" }),
    );
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "nameless") {
    // A call id with no name in it at all. There is nothing to recognise, so
    // nothing is allowed without a person — which is the fail-safe half of the
    // rule, and the id is announced first so a question has a row to arrive
    // under.
    const answered = await askPermission(`:${nextCall++}`, "do something unnamed");
    say(`permission: ${JSON.stringify(answered)}`);
    return "end_turn";
  }

  if (said === "bash") {
    const toolCallId = callIdFor("bash");
    const created = await announceCommand(toolCallId, "ls", DONE_CMD);
    await finishCommand(toolCallId, created.terminalId);
    say("ran it");
    return "end_turn";
  }

  if (said === "slow") {
    // A command LEFT RUNNING while the hold lasts, which is what makes a
    // mid-turn message observable: there is something on screen saying this
    // turn is working. The hold here watches the marker WITHOUT `released` —
    // that helper removes what it sees, and the CLIENT-OWNED child polls the
    // same file: the two of them must both see it, so the removal is this
    // verb's own, after the child has finished on it.
    const toolCallId = callIdFor("bash");
    const created = await announceCommand(toolCallId, "sleep 30", heldCommand());
    const marker = `${cwd}/${MARKER.release}`;
    while (!existsSync(marker)) {
      give();
      await sleep(100);
    }
    await finishCommand(toolCallId, created.terminalId);
    rmSync(marker, { force: true });
    say("done dawdling");
    return "end_turn";
  }

  if (said === "hush") {
    // NOTHING announced and then a hold. The only thing a scenario can wait for
    // here is the panel saying it is busy, which is the point: this is a turn a
    // person cancels before the agent has said a word.
    await released(cwd, give);
    say("finished after all");
    return "end_turn";
  }

  if (said === "silent") {
    // ONE usage frame, which is a frame — and used to be enough to convince a
    // client the agent had worked on the message — and then a turn that
    // succeeded having produced nothing.
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "usage_update", used: 0, size: 256000 },
    });
    return "end_turn";
  }

  if (said === "error-silent") {
    // The SAME zero-token frame, and then a refusal. Nothing a person can see
    // arrived, so the message did not land and the panel has to offer it again.
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "usage_update", used: 0, size: 256000 },
    });
    throw new Refused("No api key passed in");
  }

  say(`omp says: ${said}`);
  return "end_turn";
};

// ── the protocol ───────────────────────────────────────────────────────

/**
 * The three settings, as the real answer carries them: the permission mode the
 * panel's mode control is built from, the model the header follows, and a
 * thinking select beside it.
 *
 * The MODEL's values ARE the `provider/id` strings omp reports and its options'
 * `name`s are the picker's own labels, so olai needs no alias arithmetic here
 * (`leg.ts`'s `namedExactly`). The thinking levels are this file's wording for
 * the family the capture records (`off`/`auto`/levels), and the mode ids are
 * omp's two.
 */
const configOptions = () => [
  {
    type: "select",
    id: "mode",
    name: "Mode",
    category: "mode",
    currentValue: currentMode,
    options: [
      { value: "default", name: "Default" },
      { value: "plan", name: "Plan" },
    ],
  },
  {
    type: "select",
    id: "model",
    name: "Model",
    category: "model",
    currentValue: currentModel,
    options: [
      { value: "litellm/kimi-k3", name: "Kimi K3" },
      { value: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
    ],
  },
  {
    type: "select",
    id: "thinking",
    name: "Thinking",
    currentValue: currentThinking,
    options: [
      { value: "off", name: "Thinking: off" },
      { value: "auto", name: "Thinking: auto" },
      { value: "low", name: "Thinking: low" },
      { value: "high", name: "Thinking: high" },
    ],
  },
];

/** omp's two ACP modes, which is the whole of the mode surface: there is no
 *  bypass to offer, which is why olai's leg asks for none and why the mode
 *  control is what a session gets instead. */
const modes = () => ({
  currentModeId: currentMode,
  availableModes: [
    { id: "default", name: "Default" },
    { id: "plan", name: "Plan" },
  ],
});

/**
 * THE TURN IN FLIGHT, as a value with a flag on it — the state omp's `prompt()`
 * reads when it decides what a second prompt means. It is made by the prompt
 * handler ITSELF rather than by the chained work behind it, so a second prompt
 * arriving in the same read (two lines in one chunk) still finds the turn it is
 * meant to cancel.
 */
let streaming: Turn | null = null;

/**
 * The chain a turn's ANSWER waits its place in. There is no queue here — that
 * is the whole difference from the other two fakes — but a cancelled turn's
 * frames and the cancelling turn's frames must not interleave: a scenario
 * watching for a `stopReason` sees the order the agent worked in, which is the
 * first turn given up and the second one answered.
 */
let answering: Promise<unknown> = Promise.resolve();

/** Whether a scenario armed the boot to hang, read at the moment the open is
 *  asked for so it can be armed and then something pressed. TAKEN: the file is
 *  removed as it is read, so one arming holds one open and the retry behind it
 *  is not held too. */
const holdingOpen = (): boolean => {
  const marker = `${cwd}/${MARKER.holdOpen}`;
  if (!existsSync(marker)) return false;
  rmSync(marker, { force: true });
  return true;
};

/** Remember the MCP server a session was handed, and its token, which is what
 *  lets a verb below make a real call against olai's own ops layer. */
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

/** A prompt's own text, out of the content blocks the client sent. */
const promptText = (params: Record<string, unknown>): string =>
  ((params["prompt"] ?? []) as ReadonlyArray<Record<string, unknown>>)
    .map((block) => (block["type"] === "text" ? String(block["text"] ?? "") : ""))
    .join("");

/** Which row a page starts at. An offset into the list this file answers, read
 *  back the same way it is written: omp's own token is opaque to olai, which
 *  follows it blind, so the shape of it is this file's to choose — and with one
 *  conversation stored there is never one to follow. */
const pageStart = (cursor: unknown): number => {
  const at = Number(cursor ?? 0);
  return Number.isFinite(at) && at > 0 ? Math.floor(at) : 0;
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
    case "initialize":
      respond(id, {
        protocolVersion: 1,
        agentInfo: { name: "oh-my-pi", version: "18.1.21" },
        // The one method the capture records, named the way the real one
        // names it — the credentials already on this machine, described in
        // the real one's own sentence. The `terminal` method alongside it is
        // what a client advertising `auth.terminal` is offered, and olai is
        // not one. A person is never sent here by this fake — nothing in the
        // suite signs in — but a handshake that promised nothing an editor
        // can act on would be a different agent.
        authMethods: [{ id: "agent", name: "Use existing local credentials", description: "Authenticate via the provider keys/OAuth state already configured under ~/.omp." }],
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: { http: true, sse: true },
          promptCapabilities: { embeddedContext: true, image: true },
          sessionCapabilities: { list: {}, fork: {}, resume: {}, close: {} },
        },
        // NOTHING ABOUT QUEUEING, deliberately: this is the one agent here that
        // does not hold a message sent while it works, and the absence is what
        // its own handshake says about that. olai does not trust the absence
        // either (`leg.ts`'s `queues` answers `false` whatever a handshake
        // claims) — but a fake that advertised a queue would be saying
        // something the real one never says.
      });
      return;

    case "session/new": {
      if (holdingOpen()) await released(cwd);
      openSession(`ses_new_${++openedSessions}`, params);
      respond(id, { sessionId, configOptions: configOptions(), modes: modes() });
      // Behind the answer, and on the next tick, the way the real one's
      // race-guard delivers them: what an open sends is a list of slash
      // commands and a word about the session — never the session's own words
      // arriving twice, which is the doubling one of the other agents has.
      // The command list is EMPTY: this fake has no commands to publish, and
      // the frame is here for its shape rather than for its payload.
      setTimeout(() => {
        notify("session/update", {
          sessionId,
          update: { sessionUpdate: "available_commands_update", availableCommands: [] },
        });
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "session_info_update",
            title: TITLE,
            updatedAt: new Date().toISOString(),
          },
        });
      }, 0);
      return;
    }

    case "session/list": {
      // ONE PAGE OF FIFTY ROWS, and the row's directory is the one the REQUEST
      // named: omp scopes its store by the directory it serves, and which
      // spelling that store would carry is something a fake cannot know.
      const asked = typeof params["cwd"] === "string" ? String(params["cwd"]) : cwd;
      const sessions = STORED === ""
        ? []
        : [{
          sessionId: STORED_SESSION,
          cwd: asked,
          title: TITLE,
          updatedAt: "2026-08-21T10:00:00Z",
          // The real one's own corner: a count of messages, not an inference —
          // which is why the picker's row can say how long a conversation is
          // without opening it.
          _meta: { messageCount: 21, size: 8192 },
        }];
      const from = pageStart(params["cursor"]);
      const page = sessions.slice(from, from + PAGE);
      respond(id, {
        sessions: page,
        // ... and a cursor ONLY while there is more behind it, which with one
        // conversation stored is never.
        ...(from + PAGE < sessions.length ? { nextCursor: String(from + PAGE) } : {}),
      });
      return;
    }

    case "session/load": {
      const heldLoad = `${cwd}/${MARKER.holdLoad}`;
      if (existsSync(heldLoad)) {
        rmSync(heldLoad, { force: true });
        await released(cwd);
      } else if (holdingOpen()) await released(cwd);
      openSession(String(params["sessionId"]), params);
      // A replay: the person's own words as chunks, and then what the agent
      // answered — history first, the answer after, which is also the order the
      // real one delivers them in.
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "what did we say" },
        },
      });
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "omp remembers this conversation" },
        },
      });
      respond(id, { configOptions: configOptions() });
      return;
    }

    case "session/set_mode":
      // The two modes are offered as a config option and a mode list, and this
      // method is not how they move: anything asked for here — `bypassPermissions`
      // most of all — is refused with the answer the capture records.
      refuse(id, -32603, "Unsupported ACP mode");
      return;

    case "session/set_config_option": {
      const configId = String(params["configId"]);
      const value = String(params["value"]);
      if (configId === "mode") currentMode = value;
      else if (configId === "model") currentModel = value;
      else if (configId === "thinking") currentThinking = value;
      else {
        refuse(id, -32602, `Unknown config option: ${configId}`);
        return;
      }
      respond(id, { configOptions: configOptions() });
      // ... and the WHOLE set again as a notification, which is what this wire
      // does that the other two do not: a change is both an answer and an
      // update, so a client that missed the response still hears the new value.
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "config_option_update", configOptions: configOptions() },
      });
      return;
    }

    case "_session/steering":
      // No such method on this wire — and no need for one, since a plain send
      // already replaces the turn in flight (see `session/prompt` below).
      refuse(id, -32603, "Unknown ACP ext method");
      return;

    case "session/prompt": {
      const text = promptText(params);

      if (commandLine(text) === "busy") {
        // A REFUSAL OF THE PROMPT ITSELF — the shape a real omp answers with
        // when a turn it owns is already running and no client prompt owned it,
        // which is a state a scripted agent cannot be in. Hand-built rather
        // than sent through `speaking`'s `refuse`, which writes `{code,
        // message}` and nothing else: the hint is the part of this refusal a
        // client acts on, and it rides in `error.data`.
        emit({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: "session_busy",
            data: { hint: "steer|followUp|wait" },
          },
        });
        return;
      }

      // A PROMPT WHILE A TURN STREAMS CANCELS THAT TURN. This is the whole of
      // what "omp does not queue" means, and it is not `session/cancel` with a
      // different trigger: the cancelled turn gives up at its next tick and
      // answers `cancelled`, and this prompt is answered once that is done.
      const mine: Turn = { cancelled: false };
      if (streaming !== null) streaming.cancelled = true;
      streaming = mine;

      answering = answering.then(async () => {
        try {
          // The answer is the STOP REASON, and nothing else. The real one
          // carries a `usage` report beside it; nothing in this suite reads
          // that field — olai reads the `usage_update` FRAME for the same
          // question — so it is left out rather than invented here.
          respond(id, { stopReason: await turn(text, mine) });
        } catch (cause) {
          if (cause instanceof Refused) {
            refuse(id, -32603, cause.message);
            return;
          }
          // A turn nobody cancelled that still fell over is not a fault this
          // file has; `refusal` is the protocol's word for the one the agent
          // will not do, and it is the honest one to reach for.
          respond(id, { stopReason: cause instanceof Cancelled ? "cancelled" : "refusal" });
        } finally {
          if (streaming === mine) streaming = null;
        }
      });
      return;
    }

    case "session/cancel":
      // A notification, so there is nothing to answer — but there is something
      // to DO. There is nothing queued on this wire, so this is exactly what a
      // second prompt does minus the second prompt: the turn in flight gives up
      // at its next tick and answers `stopReason: "cancelled"`.
      if (streaming !== null) streaming.cancelled = true;
      return;

    default:
      if (id !== undefined) refuse(id, -32601, `method not found: ${String(method)}`);
      return;
  }
};

readMessages<Record<string, unknown>>(process.stdin, (message) => {
  void handle(message);
});
