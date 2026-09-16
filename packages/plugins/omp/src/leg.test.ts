/**
 * omp's bets, over values — and the fail-safe rule, pinned.
 *
 * The payloads are what omp 18.1.21 actually sends (the spike, 2026-09-14): a
 * `write` call whose `rawInput.path` is `xd://mcp__olai_<tool>`, its completion
 * wrapping the tool's own result under `details.xdev.inner`, call ids of the
 * shape `write:0` and `bash:3`, permission options that lead with an ALLOW, and
 * not one `_meta` on any frame.
 *
 * MOST OF THIS FILE IS ABOUT WHAT MUST NOT HAPPEN, deliberately. A reader that
 * recognised a call loosely would relabel somebody's ordinary `write` as one of
 * olai's tools, and the reading it feeds is the one that draws a reply, an
 * outline and a story — so the near misses are the subject: a path outside the
 * `xd://` scheme, a name that merely CONTAINS a server's, a name that is the
 * prefix with nothing after it. They are cheap as values and expensive to
 * stage.
 *
 * TWO READERS GET MORE ATTENTION THAN THE REST because they are the two this
 * engine does differently from every other leg: what a call is aimed at is in
 * the path of a `write` rather than in the call's own name, and what it
 * answered is nested inside that `write`'s result. Both read the OTHER shape
 * too — the one a session with `tools.xdev: false` sends — and both are pinned
 * on it here, because which shape a wire is, is a setting on somebody else's
 * machine.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import { allowedWithoutAsking, OMP, toolNameOf } from "./leg.ts"
import { announced, wrapped } from "./testlib.ts"

/** The servers a session is handed: olai's own, and an optional one when a
 *  probe answered — called `alpha`, because this package may not spell an
 *  appliance even in a fixture. What is being exercised is the auto-allow
 *  spelling `mcp__<server>_`, and any server name does that.
 *  `given` in `agent.ts` is exactly this list of names. */
const GIVEN = ["olai", "alpha"]

/** omp's own option list for a permission request, in its own order — ALLOW
 *  FIRST, which is the opposite of the Claude adapter's and the reason nothing
 *  here may read "the first option". */
const ASKED: ReadonlyArray<PermissionOption> = [
  { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
  { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject_once", name: "Reject", kind: "reject_once" },
  { optionId: "reject_always", name: "Always reject", kind: "reject_always" },
]

describe("which tool a call is", () => {
  test("is the head of the call id, which is the only name that holds still", () => {
    // A `write` call's title is the INTENT — a sentence the model wrote about
    // what it is doing, rewritten while the call runs. The id is minted once.
    expect(toolNameOf("write:0")).toBe("write")
    expect(toolNameOf("bash:3")).toBe("bash")
    expect(toolNameOf("mcp__olai_outlines_read:0")).toBe("mcp__olai_outlines_read")
  })

  test("takes the FIRST separator, so a colon in a name under-reads", () => {
    // Under-reading a name costs a question; over-reading one could cost an
    // approval.
    expect(toolNameOf("weird:name:0")).toBe("weird")
  })

  test("answers nothing for an id that is not one", () => {
    expect(toolNameOf("bash")).toBeNull()
    expect(toolNameOf(":0")).toBeNull()
    expect(toolNameOf("")).toBeNull()
  })

  test("is what the leg reads, and the leg reads nothing off a frame", () => {
    expect(OMP.toolNameOf("write:0")).toBe("write")
    // This wire carries no `_meta` at all, so there is no corner for a name to
    // arrive in — and answering `null` off a frame is also what keeps the call
    // registry empty for this agent: what the ID says needs no remembering.
    expect(OMP.toolNameIn({ claudeCode: { toolName: "Bash" } })).toBeNull()
  })
})

describe("an olai call, through the door this engine dispatches it", () => {
  test("is named by the `xd://` PATH of the `write` that carries it", () => {
    // THE DEFAULT SHAPE, and the one this leg exists for: the call is a
    // `write`, its id says `write:0`, and the tool actually being called is
    // named only inside the arguments.
    expect(OMP.mcpCall(announced("olai", "outlines_done", { id: "order" }), GIVEN))
      .toEqual({ server: "olai", tool: "outlines_done" })
    expect(OMP.mcpCall(announced("alpha", "outlines_read", { id: "order" }), GIVEN))
      .toEqual({ server: "alpha", tool: "outlines_read" })
  })

  test("... and by its own name when the session dispatches it top-level", () => {
    // The other shape, and the reason this reader is not just the `xd://` one:
    // a session with omp's `tools.xdev` off announces the minted name as an
    // ordinary call and puts the arguments where every other agent puts them.
    // That IS the shared rule, so it is spelled once in `@olai/acp/engine`.
    expect(OMP.mcpCall({ title: "mcp__olai_outlines_read", rawInput: { id: "order" } }, GIVEN))
      .toEqual({ server: "olai", tool: "outlines_read" })
  })

  test("reads the path FIRST, so an intent text cannot rename a call", () => {
    // A title is display text a model composes. A model that wrote
    // `mcp__olai_outlines_done` as the opening of its intent sentence would
    // otherwise have renamed its own call into one of ours — and the readings
    // that hang off this one draw a reply, an outline and a story.
    const frame = {
      ...announced("olai", "outlines_read", { id: "order" }),
      title: "mcp__olai_outlines_done",
    }
    expect(OMP.mcpCall(frame, GIVEN)).toEqual({ server: "olai", tool: "outlines_read" })
  })

  test("and NOTHING else is — these are the near misses that must stay misses", () => {
    // A path that is not the dispatch scheme: a real file, which is what most
    // `write` calls are.
    expect(OMP.mcpCall({ rawInput: { path: "house.olai", content: "{…}" } }, GIVEN)).toBeNull()
    // The scheme, and then somebody else's namespace.
    expect(OMP.mcpCall({ rawInput: { path: "xd://lsp" } }, GIVEN)).toBeNull()
    // A server we were never given, by either road.
    expect(OMP.mcpCall({ rawInput: { path: "xd://mcp__other_read" } }, GIVEN)).toBeNull()
    expect(OMP.mcpCall({ title: "mcp__other_read" }, GIVEN)).toBeNull()
    // The prefix with NOTHING after it. `startsWith(prefix)` would take it;
    // requiring the name to continue does not.
    expect(OMP.mcpCall({ rawInput: { path: "xd://mcp__olai_" } }, GIVEN)).toBeNull()
    expect(OMP.mcpCall({ title: "mcp__olai_" }, GIVEN)).toBeNull()
    // A name that merely CONTAINS one of ours, in either direction.
    expect(OMP.mcpCall({ title: "elsewhere_mcp__olai_read" }, GIVEN)).toBeNull()
    expect(OMP.mcpCall({ title: "x_mcp__olai_read" }, GIVEN)).toBeNull()
    // A longer server-shaped name, which is what a rule widened to the bare
    // server name would let through.
    expect(OMP.mcpCall({ title: "mcp__olaix_read" }, GIVEN)).toBeNull()
    // A path that is not a string, and a frame with no arguments at all.
    expect(OMP.mcpCall({ rawInput: { path: 7 } }, GIVEN)).toBeNull()
    expect(OMP.mcpCall({ title: "write", rawInput: { command: "ls" } }, GIVEN)).toBeNull()
    // With no servers handed over, nothing is ours.
    expect(OMP.mcpCall(announced("olai", "outlines_done", {}), [])).toBeNull()
  })
})

describe("what an olai call answered", () => {
  const reply = { id: "order", title: "order cabinets", file: "house.olai", sort: "done" }
  const result = { content: [{ type: "text" as const, text: JSON.stringify(reply) }], structuredContent: reply }

  test("is read from inside the `write` that dispatched it", () => {
    expect(OMP.replyIn(wrapped(result).rawOutput)).toEqual(reply)
  })

  test("... and from a top-level completion, which nests it one level up", () => {
    // The `tools.xdev: false` shape: there is no `write` to wrap it, so the
    // tool's own blocks are the result's own content.
    const output = { content: [{ type: "text", text: JSON.stringify(reply) }], details: { rawContent: result.content } }
    expect(OMP.replyIn(output)).toEqual(reply)
  })

  test("is nothing at all for a refusal, a foreign tool, or anything unparseable", () => {
    // A refusal is prose: the words are the agent's, and there is no JSON here
    // for a row to draw as data.
    const refused = { content: [{ type: "text" as const, text: "permission denied" }] }
    expect(OMP.replyIn(wrapped(refused).rawOutput)).toBeUndefined()
    // A foreign MCP server, whose content is its own business.
    expect(OMP.replyIn({ content: [{ type: "text", text: "wrote a file" }] })).toBeUndefined()
    // Whatever this is, it is not a wrapped completion.
    expect(OMP.replyIn("permission denied")).toBeUndefined()
    expect(OMP.replyIn(null)).toBeUndefined()
    expect(OMP.replyIn({ details: { xdev: { inner: { rawContent: [] } } } })).toBeUndefined()
    expect(OMP.replyIn({ details: { xdev: { inner: { rawContent: [{ type: "image", data: "…" }] } } } }))
      .toBeUndefined()
    // JSON that is not an object is not a reply either: a row draws a record.
    expect(OMP.replyIn({ details: { rawContent: [{ type: "text", text: "[1,2,3]" }] } })).toBeUndefined()
  })
})

describe("which permissions are answered without asking", () => {
  test("a tool of a server we handed this session is allowed", () => {
    expect(allowedWithoutAsking("mcp__olai_outlines_done", GIVEN, ASKED)).toBe("allow_once")
    expect(allowedWithoutAsking("mcp__alpha_terminal_open", GIVEN, ASKED)).toBe("allow_once")
  })

  test("and NOTHING else is — this is the line that must never widen", () => {
    expect(allowedWithoutAsking("mcp__other_read", GIVEN, ASKED)).toBeNull()
    // Not ours at all — the bare server name, another engine's spelling, and
    // this wire's own mint with the separator doubled.
    expect(allowedWithoutAsking("olai", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("olai_outlines_done", GIVEN, ASKED)).toBeNull()
    // The OTHER engines' spellings, which this wire has never sent.
    expect(allowedWithoutAsking("olai_read", GIVEN, ASKED)).toBeNull()
    // A LONGER server-shaped name. This is the case that would slip through if
    // the match ever widened to the bare server name, which is the likeliest
    // way somebody would try to simplify this rule.
    expect(allowedWithoutAsking("mcp__olaix_read", GIVEN, ASKED)).toBeNull()
    // An ordinary builtin, and the four omp gates by name.
    expect(allowedWithoutAsking("bash", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("edit", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("write", GIVEN, ASKED)).toBeNull()
  })

  test("a call nobody named is a call a person is asked about", () => {
    expect(allowedWithoutAsking(null, GIVEN, ASKED)).toBeNull()
  })

  test("with no servers handed over, nothing is ours", () => {
    expect(allowedWithoutAsking("mcp__olai_outlines_done", [], ASKED)).toBeNull()
  })

  test("the option is chosen by its KIND, not by its place in the list", () => {
    // omp leads with an allow and the Claude adapter leads with the refusal;
    // one rule, read off `kind`, is right on both wires.
    const refusalFirst: ReadonlyArray<PermissionOption> = [
      { optionId: "no", name: "Reject", kind: "reject_once" },
      { optionId: "yes", name: "Allow", kind: "allow_always" },
    ]
    expect(allowedWithoutAsking("mcp__olai_outlines_add", GIVEN, refusalFirst)).toBe("yes")
  })

  test("one of ours with no allow offered at all is still a person's", () => {
    const refusalsOnly: ReadonlyArray<PermissionOption> = [
      { optionId: "no", name: "Reject", kind: "reject_once" },
    ]
    expect(allowedWithoutAsking("mcp__olai_outlines_add", GIVEN, refusalsOnly)).toBeNull()
  })
})

describe("what omp does not do", () => {
  test("carries no attribution, so nothing is drawn in a subagent's name", () => {
    expect(OMP.parentToolUse({ claudeCode: { parentToolUseId: "toolu_1" } })).toBeNull()
    expect(OMP.spawned({ claudeCode: { subagent: true } }, { subagent_type: "Explore" })).toBeNull()
    expect(OMP.backgroundTask({ claudeCode: { task: "monitor" } })).toBeNull()
    expect(OMP.taskNotification("<task-notification>x</task-notification>", null)).toBeNull()
  })

  test("has no bypass mode to ask for and no way to steer a running turn", () => {
    // Both are requests omp refuses with `-32603`, so olai sends neither — see
    // the leg. `null` here is what stops them being sent.
    expect(OMP.bypassMode).toBeNull()
    expect(OMP.steering).toBeNull()
  })

  test("does NOT hold a message sent while it is busy — it replaces the turn", () => {
    // The one leg in this tree that answers `false`, and the answer is a fact
    // about its wire rather than a missing advertisement: omp's `prompt()`
    // cancels the running turn when a second prompt arrives. A handshake that
    // claimed otherwise does not move this: what olai promises a person comes
    // from what the agent DOES, and this is the one place the two are known to
    // disagree by construction.
    expect(OMP.queues({ agentCapabilities: { promptQueueing: true } })).toBe(false)
    expect(OMP.queues(undefined)).toBe(false)
  })

  test("forwards no messages of its own", () => {
    expect(OMP.rawMessages).toBeNull()
    // The protocol's own number: a server that fails fails `session/new`
    // outright, so there is no per-server report to read anywhere.
    expect(OMP.serversInUpdate).toBeUndefined()
  })

  test("says how long a stored conversation is, and nothing about succession", () => {
    // omp's `_meta` corner is a real count — unlike the legs that infer one —
    // and no `/clear`-shaped pair, which is one adapter's patch and not a fact
    // this wire has ever carried.
    expect(OMP.listedIn({ messageCount: 7, size: 10240 })).toEqual({ messageCount: 7, supersededBy: null })
    // A corner that is not there is a question the agent did not answer: the
    // picker draws nothing rather than a zero.
    expect(OMP.listedIn(undefined)).toBeNull()
    expect(OMP.listedIn(null)).toBeNull()
    expect(OMP.listedIn({ size: 10240 })).toEqual({ messageCount: null, supersededBy: null })
    expect(OMP.listedIn({ messageCount: "many" })).toEqual({ messageCount: null, supersededBy: null })
  })

  test("does not double a prologue as utterance", () => {
    // What an open sends is `available_commands_update` and a
    // `session_info_update` about the session — never the session's own words
    // arriving twice, so nothing is ever dropped from the transcript.
    expect(OMP.prologueIn({ _meta: { piAcp: { startupInfo: "omp v18.1.21" } } })).toBeNull()
  })

  test("advertises no terminal-output extension the wire does not write", () => {
    // The corner this field names (`_meta.terminal_info` / `terminal_output` /
    // `terminal_exit`) is an extension pi's adapter writes; nothing in omp's
    // ACP mapper stamps it. Declaring it would make `olai-plugin-chat`'s
    // `agent.ts` promise `_meta.terminal_output: true` to an agent that will
    // never answer it. The commands ARE drawn — through the client-owned
    // terminals `terminal: true` buys, which needs no leg saying anything.
    expect(OMP.terminalOutput).toBeUndefined()
  })

  test("reads the model picker exactly, because its values ARE the ids", () => {
    expect(OMP.models).toEqual({ config: "model", nameIn: expect.any(Function) })
    const labels = new Map([["litellm/kimi-k3", "Kimi K3"]])
    expect(OMP.models?.nameIn(labels, "litellm/kimi-k3")).toBe("Kimi K3")
    expect(OMP.models?.nameIn(labels, "openai/gpt-5")).toBeNull()
  })
})


test("MCP refusal text retains its story through omp's xdev wrapper", () => {
  const result = { isError: true, content: [{ type: "text" as const, text: "surface-mcp: `mail_archive` was refused (usage): this thread is not in you@gmail.com" }] }
  expect(OMP.replyIn(wrapped(result).rawOutput)).toEqual({ kind: "usage", reason: "this thread is not in you@gmail.com" })
})
