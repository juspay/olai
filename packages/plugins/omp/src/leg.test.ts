import type { PermissionOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import { allowedWithoutAsking, OMP, toolNameOf } from "./leg.ts"
import { announced, wrapped } from "./testlib.ts"

const GIVEN = ["olai", "alpha"]

const ASKED: ReadonlyArray<PermissionOption> = [
  { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
  { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject_once", name: "Reject", kind: "reject_once" },
  { optionId: "reject_always", name: "Always reject", kind: "reject_always" },
]

describe("which tool a call is", () => {
  test("is the head of the call id, which is the only name that holds still", () => {
    expect(toolNameOf("write:0")).toBe("write")
    expect(toolNameOf("bash:3")).toBe("bash")
    expect(toolNameOf("mcp__olai_outlines_read:0")).toBe("mcp__olai_outlines_read")
  })

  test("takes the FIRST separator, so a colon in a name under-reads", () => {
    expect(toolNameOf("weird:name:0")).toBe("weird")
  })

  test("answers nothing for an id that is not one", () => {
    expect(toolNameOf("bash")).toBeNull()
    expect(toolNameOf(":0")).toBeNull()
    expect(toolNameOf("")).toBeNull()
  })

  test("is what the leg reads, and the leg reads nothing off a frame", () => {
    expect(OMP.toolNameOf("write:0")).toBe("write")
    expect(OMP.toolNameIn({ claudeCode: { toolName: "Bash" } })).toBeNull()
  })
})

describe("an olai call, through the door this engine dispatches it", () => {
  test("is named by the `xd://` PATH of the `write` that carries it", () => {
    expect(OMP.mcpCall(announced("olai", "outlines_done", { id: "order" }), GIVEN))
      .toEqual([{ server: "olai", tool: "outlines_done" }])
    expect(OMP.mcpCall(announced("alpha", "outlines_read", { id: "order" }), GIVEN))
      .toEqual([{ server: "alpha", tool: "outlines_read" }])
  })

  test("... and by its own name when the session dispatches it top-level", () => {
    expect(OMP.mcpCall({ title: "mcp__olai_outlines_read", rawInput: { id: "order" } }, GIVEN))
      .toEqual([{ server: "olai", tool: "outlines_read" }])
  })

  test("reads the path FIRST, so an intent text cannot rename a call", () => {
    const frame = {
      ...announced("olai", "outlines_read", { id: "order" }),
      title: "mcp__olai_outlines_done",
    }
    expect(OMP.mcpCall(frame, GIVEN)).toEqual([{ server: "olai", tool: "outlines_read" }])
  })

  test("and NOTHING else is — these are the near misses that must stay misses", () => {
    expect(OMP.mcpCall({ rawInput: { path: "house.olai", content: "{…}" } }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ rawInput: { path: "xd://lsp" } }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ rawInput: { path: "xd://mcp__other_read" } }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ title: "mcp__other_read" }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ rawInput: { path: "xd://mcp__olai_" } }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ title: "mcp__olai_" }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ title: "elsewhere_mcp__olai_read" }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ title: "x_mcp__olai_read" }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ title: "mcp__olaix_read" }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ rawInput: { path: 7 } }, GIVEN)).toEqual([])
    expect(OMP.mcpCall({ title: "write", rawInput: { command: "ls" } }, GIVEN)).toEqual([])
    expect(OMP.mcpCall(announced("olai", "outlines_done", {}), [])).toEqual([])
  })
})

describe("what an olai call answered", () => {
  const reply = { id: "order", title: "order cabinets", file: "house.olai", sort: "done" }
  const result = { content: [{ type: "text" as const, text: JSON.stringify(reply) }], structuredContent: reply }

  test("is read from inside the `write` that dispatched it", () => {
    expect(OMP.replyIn(wrapped(result).rawOutput)).toEqual(reply)
  })

  test("... and from a top-level completion, which nests it one level up", () => {
    const output = { content: [{ type: "text", text: JSON.stringify(reply) }], details: { rawContent: result.content } }
    expect(OMP.replyIn(output)).toEqual(reply)
  })

  test("is nothing at all for a refusal, a foreign tool, or anything unparseable", () => {
    const refused = { content: [{ type: "text" as const, text: "permission denied" }] }
    expect(OMP.replyIn(wrapped(refused).rawOutput)).toBeUndefined()
    expect(OMP.replyIn({ content: [{ type: "text", text: "wrote a file" }] })).toBeUndefined()
    expect(OMP.replyIn("permission denied")).toBeUndefined()
    expect(OMP.replyIn(null)).toBeUndefined()
    expect(OMP.replyIn({ details: { xdev: { inner: { rawContent: [] } } } })).toBeUndefined()
    expect(OMP.replyIn({ details: { xdev: { inner: { rawContent: [{ type: "image", data: "…" }] } } } }))
      .toBeUndefined()
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
    expect(allowedWithoutAsking("olai", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("olai_outlines_done", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("olai_read", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("mcp__olaix_read", GIVEN, ASKED)).toBeNull()
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
    expect(OMP.bypassMode).toBeNull()
    expect(OMP.steering).toBeNull()
  })

  test("does NOT hold a message sent while it is busy — it replaces the turn", () => {
    expect(OMP.queues({ agentCapabilities: { promptQueueing: true } })).toBe(false)
    expect(OMP.queues(undefined)).toBe(false)
  })

  test("forwards no messages of its own", () => {
    expect(OMP.rawMessages).toBeNull()
    expect(OMP.serversInUpdate).toBeUndefined()
  })

  test("says how long a stored conversation is, and nothing about succession", () => {
    expect(OMP.listedIn({ messageCount: 7, size: 10240 })).toEqual({ messageCount: 7, supersededBy: null })
    expect(OMP.listedIn(undefined)).toBeNull()
    expect(OMP.listedIn(null)).toBeNull()
    expect(OMP.listedIn({ size: 10240 })).toEqual({ messageCount: null, supersededBy: null })
    expect(OMP.listedIn({ messageCount: "many" })).toEqual({ messageCount: null, supersededBy: null })
  })

  test("does not double a prologue as utterance", () => {
    expect(OMP.prologueIn({ _meta: { piAcp: { startupInfo: "omp v18.1.21" } } })).toBeNull()
  })

  test("advertises no terminal-output extension the wire does not write", () => {
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
