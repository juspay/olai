/**
 * Opencode's bets, over values — and the fail-safe rule, pinned.
 *
 * The payloads are what **opencode 2.2.7** actually sends (captured live,
 * 2026-11-11): a `name` on every frame, opaque `chatcmpl-tool-<hex>` ids,
 * olai's tools reachable only as JavaScript inside one `execute`, permission
 * options that lead with an ALLOW rather than with the refusal, and a
 * child-session notification of opencode's own.
 *
 * MOST OF THIS FILE IS ABOUT WHAT MUST NOT HAPPEN, deliberately. The rule that
 * answers a permission is the one rule in this package whose failure is not
 * recoverable by pressing something: an approval nobody gave. On this wire it
 * is harder than on any other olai speaks, because the request does not say
 * which tool it is about — `execute` is the name for olai's own tools, a
 * foreign server's and opencode's own builtins alike — so the near misses are
 * the subject. They are cheap as values and expensive to stage.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import { childIn, permissionIn, CHILD_SESSIONS } from "./activity.ts"
import { allowedWithoutAsking, mcpCall, OPENCODE, replyIn, toolsNamedIn } from "./leg.ts"
import { announced, ran, script, wrapped } from "./testlib.ts"

/** The servers a session is handed: olai's own, and an optional one when a
 *  probe answered — called `alpha`, because this package may not spell an
 *  appliance even in a fixture. `given` in `agent.ts` is exactly this list. */
const GIVEN = ["olai", "alpha"]

/** Opencode's own option list, in its own order — ALLOW FIRST, which is the
 *  opposite of the other agent's and the reason nothing here may read "the
 *  first option". These are the real `optionId`s: `once`, `always`, `reject`. */
const ASKED: ReadonlyArray<PermissionOption> = [
  { optionId: "once", name: "Allow once", kind: "allow_once" },
  { optionId: "always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject", name: "Reject", kind: "reject_once" },
]

/** A permission request's `toolCall`, as the frame the rule is handed. */
const asking = (code: string | null, name = "execute") => ({
  name,
  title: name,
  rawInput: code === null ? {} : { code },
})

describe("which tool a call is", () => {
  test("is the FIELD the frame carries, never the title and never the id", () => {
    expect(OPENCODE.toolNameIn(undefined, "shell")).toBe("shell")
    expect(OPENCODE.toolNameIn({ "opencode/child-session": { id: "ses_x" } }, "read")).toBe("read")
    // The id said the name on 1.17.9 and says nothing on 2.x.
    expect(OPENCODE.toolNameOf("chatcmpl-tool-a27391eb035485a2")).toBeNull()
    expect(OPENCODE.toolNameOf("bash:0")).toBeNull()
  })

  test("a frame that named nothing names nothing", () => {
    expect(OPENCODE.toolNameIn(undefined, undefined)).toBeNull()
    expect(OPENCODE.toolNameIn(undefined, null)).toBeNull()
    expect(OPENCODE.toolNameIn(undefined, "")).toBeNull()
  })
})

describe("which tools a Code Mode script names", () => {
  test("every `tools.<server>.<tool>` in it, in source order", () => {
    expect(toolsNamedIn(script("olai", "outlines_done", { id: "n1" })))
      .toEqual([{ server: "olai", tool: "outlines_done" }])
    expect(toolsNamedIn(
      `const a = await tools.olai.ping({word:"one"});\nconst b = await tools.alpha.read({});\nreturn [a,b];`,
    )).toEqual([{ server: "olai", tool: "ping" }, { server: "alpha", tool: "read" }])
  })

  test("a script that calls nothing names nothing — which is not the same as unreadable", () => {
    expect(toolsNamedIn("return 1 + 1")).toEqual([])
    expect(toolsNamedIn("return await search({ query: 'ping' })")).toEqual([])
  })

  test("A REACH THIS CANNOT FOLLOW IS `null`, and this is the line that must never widen", () => {
    // Dynamic indexing, in every spelling. One approval covers the WHOLE
    // script, so a reader that skipped the part it could not parse would be
    // approving it.
    expect(toolsNamedIn(`return await tools["opencode"].shell({command:"rm -rf /"})`)).toBeNull()
    expect(toolsNamedIn(`const n = "opencode"; return await tools[n].shell({})`)).toBeNull()
    // A destructure keeps the table but not the path.
    expect(toolsNamedIn(`const { ping } = tools.olai; return ping({})`)).toBeNull()
    expect(toolsNamedIn(`const t = tools; return t.olai.ping({})`)).toBeNull()
    // The server named but no tool after it.
    expect(toolsNamedIn(`return tools.olai`)).toBeNull()
    // One readable call and one that is not: still `null`, because the script
    // is read whole or not at all.
    expect(toolsNamedIn(`await tools.olai.ping({}); return tools[x].y()`)).toBeNull()
  })

  test("a `tools` that is somebody else's property is not the table", () => {
    expect(toolsNamedIn(`return mine.tools.olai.ping({})`)).toEqual([])
    expect(toolsNamedIn(`return toolsmith.olai.ping({})`)).toEqual([])
  })
})

describe("which permissions are answered without asking", () => {
  test("a script whose every tool is a server we handed this session is allowed", () => {
    expect(allowedWithoutAsking("execute", GIVEN, ASKED, asking(script("olai", "outlines_done", { id: "n1" }))))
      .toBe("once")
    expect(allowedWithoutAsking("execute", GIVEN, ASKED, asking(
      `await tools.olai.ping({}); return tools.alpha.terminal_open({});`,
    ))).toBe("once")
  })

  test("and NOTHING else is — this is the line that must never widen", () => {
    const only = (code: string | null, name?: string) =>
      allowedWithoutAsking(name ?? "execute", GIVEN, ASKED, asking(code, name))
    // A server we were never given.
    expect(only(script("other", "read", {}))).toBeNull()
    // opencode's OWN builtins, which live in the same table under its own name.
    expect(only(script("opencode", "shell", { command: "rm -rf /" }))).toBeNull()
    // Ours AND somebody else's in one script: one approval would cover both.
    expect(only(`await tools.olai.ping({}); return tools.opencode.shell({});`)).toBeNull()
    // A script that reaches the table a way this cannot read.
    expect(only(`return await tools["olai"].outlines_done({id:"n1"})`)).toBeNull()
    // A script that calls no tool at all names nothing to recognise.
    expect(only("return 1 + 1")).toBeNull()
    // Not an `execute`: a shell, a subagent, a read, whatever.
    expect(only(null, "shell")).toBeNull()
    expect(only(script("olai", "outlines_done", {}), "subagent")).toBeNull()
    // The 1.x spellings, which this wire has never sent.
    expect(allowedWithoutAsking("olai_outlines_done", GIVEN, ASKED, asking(null, "olai_outlines_done"))).toBeNull()
    expect(allowedWithoutAsking("mcp__olai__outlines_done", GIVEN, ASKED, asking(null, "mcp__olai__outlines_done")))
      .toBeNull()
  })

  test("a call nobody named, and a request with no frame at all, are a person's", () => {
    expect(allowedWithoutAsking(null, GIVEN, ASKED, asking(script("olai", "ping", {})))).toBeNull()
    // The frame is optional in the contract and decisive here: without it
    // nothing is recognised, so nothing is allowed.
    expect(allowedWithoutAsking("execute", GIVEN, ASKED)).toBeNull()
    expect(allowedWithoutAsking("execute", GIVEN, ASKED, { name: "execute", rawInput: { code: 7 } })).toBeNull()
  })

  test("with no servers handed over, nothing is ours", () => {
    expect(allowedWithoutAsking("execute", [], ASKED, asking(script("olai", "outlines_done", {})))).toBeNull()
  })

  test("the option is chosen by its KIND, not by its place in the list", () => {
    const refusalFirst: ReadonlyArray<PermissionOption> = [
      { optionId: "no", name: "Reject", kind: "reject_once" },
      { optionId: "yes", name: "Allow", kind: "allow_once" },
    ]
    expect(allowedWithoutAsking("execute", GIVEN, refusalFirst, asking(script("olai", "outlines_add", {}))))
      .toBe("yes")
  })

  test("one of ours with no allow offered at all is still a person's", () => {
    const refusalsOnly: ReadonlyArray<PermissionOption> = [
      { optionId: "no", name: "Reject", kind: "reject_once" },
    ]
    expect(allowedWithoutAsking("execute", GIVEN, refusalsOnly, asking(script("olai", "outlines_add", {}))))
      .toBeNull()
    expect(allowedWithoutAsking("execute", GIVEN, [], asking(script("olai", "outlines_add", {})))).toBeNull()
  })
})

describe("what a row is CALLED, and what it answered", () => {
  const reply = { id: "order", title: "order cabinets", file: "house.olai", sort: "done" }
  const result = { content: [{ type: "text" as const, text: JSON.stringify(reply) }], structuredContent: reply }

  test("one olai tool in one script names the row and draws its reply", () => {
    const code = script("olai", "outlines_done", { id: "order" })
    const done = { ...announced(code), ...wrapped("olai", "outlines_done", { id: "order" }, result) }
    expect(mcpCall(done, GIVEN)).toEqual({ server: "olai", tool: "outlines_done" })
    expect(replyIn(done.rawOutput, done.content)).toEqual(reply)
  })

  test("... and names it from the SCRIPT before the completion reports anything", () => {
    expect(mcpCall(announced(script("olai", "outlines_read", { id: "n1" })), GIVEN))
      .toEqual({ server: "olai", tool: "outlines_read" })
    // The empty first frame names nothing, which is why a row may not be
    // named from it.
    expect(mcpCall(announced(null), GIVEN)).toBeNull()
  })

  test("A BATCH IS THE BATCH, never the first of what it ran", () => {
    const code = `const a = await tools.olai.ping({});\nreturn [a, await tools.olai.outlines_read({id:"n1"})];`
    const batch = { ...announced(code), ...ran([{ tool: "olai.ping" }, { tool: "olai.outlines_read" }], [1, 2]) }
    expect(mcpCall(batch, GIVEN)).toBeNull()
  })

  test("a foreign server's tool, and a script that ran none, are nobody's row", () => {
    expect(mcpCall(announced(script("github", "create_pr", {})), GIVEN)).toBeNull()
    expect(mcpCall({ ...announced("return 1+1"), ...ran([], 2) }, GIVEN)).toBeNull()
    // Not an `execute` at all.
    expect(mcpCall({ name: "shell", title: "ls", rawInput: { command: "ls" } }, GIVEN)).toBeNull()
  })

  test("what the completion REPORTED beats what the script said it would do", () => {
    // A script naming two, a run reporting one: the run is the record.
    const frame = {
      ...announced(`await tools.olai.ping({}); return tools.olai.outlines_read({id:"n1"})`),
      ...ran([{ tool: "olai.outlines_read" }], reply),
    }
    expect(mcpCall(frame, GIVEN)).toEqual({ server: "olai", tool: "outlines_read" })
  })

  test("a failed olai call is still that call, and answers no reply", () => {
    const frame = {
      ...announced(script("olai", "outlines_done", { id: "gone" })),
      ...ran([{ tool: "olai.outlines_done", status: "error" as const }], "Permission.DeclinedError"),
    }
    expect(mcpCall(frame, GIVEN)).toEqual({ server: "olai", tool: "outlines_done" })
    expect(replyIn(frame.rawOutput, frame.content)).toBeUndefined()
  })

  test("a reply this cannot parse is no reply at all", () => {
    // The 1.17.9 shapes, which carry nothing on this wire.
    expect(replyIn({ metadata: { structuredContent: reply } }, undefined)).toBeUndefined()
    expect(replyIn({ output: JSON.stringify({ structuredContent: reply }) }, undefined)).toBeUndefined()
    // Prose, an array, a block of another type.
    expect(replyIn({}, [{ type: "content", content: { type: "text", text: "just prose" } }])).toBeUndefined()
    expect(replyIn({}, [{ type: "content", content: { type: "text", text: "[1,2,3]" } }])).toBeUndefined()
    expect(replyIn({}, [{ type: "diff", path: "/a" }])).toBeUndefined()
    expect(replyIn({}, "permission denied")).toBeUndefined()
  })
})

describe("what a call SPAWNED", () => {
  test("a subagent call says which agent was sent and what it was sent to do", () => {
    expect(OPENCODE.spawned(undefined, {
      agent: "explore", description: "Summarise note.txt", prompt: "Read note.txt and…",
    })).toEqual({ kind: "explore", said: "Summarise note.txt" })
  })

  test("an ordinary call spawned nobody", () => {
    expect(OPENCODE.spawned(undefined, { command: "ls" })).toBeNull()
    expect(OPENCODE.spawned(undefined, undefined)).toBeNull()
  })
})

describe("child sessions", () => {
  const stamp = { id: "ses_child", parentID: "ses_root", depth: 1, title: "Summarise note.txt" }
  const child = (extra: Record<string, unknown>) => ({
    jsonrpc: "2.0",
    method: "opencode/session/child_update",
    params: {
      rootSessionId: "ses_root",
      childSessionId: "ses_child",
      parentSessionId: "ses_root",
      depth: 1,
      title: "Summarise note.txt",
      ...extra,
    },
  })

  test("a created child opens a lane under the session that spawned it", () => {
    expect(childIn(child({ type: "status", status: "created" }))).toEqual({
      kind: "activity",
      value: {
        session: "ses_root",
        update: { kind: "child", id: "ses_child", name: "Summarise note.txt", task: "Summarise note.txt" },
      },
    })
  })

  test("`running` moves nothing — the lane already said the child started", () => {
    expect(childIn(child({ type: "status", status: "running" }))).toBeNull()
  })

  test("every terminal status closes it, and an interruption is a cancellation", () => {
    const state = (status: string) => {
      const heard = childIn(child({ type: "status", status }))
      return heard?.kind === "activity" ? heard.value.update : null
    }
    expect(state("completed")).toEqual({ kind: "childEnded", id: "ses_child", state: "completed" })
    expect(state("failed")).toEqual({ kind: "childEnded", id: "ses_child", state: "failed" })
    expect(state("interrupted")).toEqual({ kind: "childEnded", id: "ses_child", state: "cancelled" })
    // A word no version has sent yet is not a lane anybody closes.
    expect(childIn(child({ type: "status", status: "pondering" }))).toBeNull()
  })

  test("a nested frame is unwrapped onto the child's own session", () => {
    const update = { sessionUpdate: "tool_call", toolCallId: "ses_child:abc", name: "read", _meta: { "opencode/child-session": stamp } }
    expect(childIn(child({ type: "update", update }))).toEqual({
      kind: "message",
      value: { jsonrpc: "2.0", method: "session/update", params: { sessionId: "ses_child", update } },
    })
  })

  test("anything else on the wire travels untouched", () => {
    expect(childIn({ method: "session/update", params: {} })).toBeNull()
    expect(childIn(child({ type: "whatever" }))).toBeNull()
    expect(childIn(null)).toBeNull()
  })

  test("A CHILD'S PERMISSION QUESTION IS ASKED IN THE CHILD'S NAME", () => {
    // opencode stamps the request with the session its CONNECTION belongs to —
    // the root — and names the child only on the call. Left alone, a
    // subagent's question would be drawn in the main agent's lane.
    const request = {
      jsonrpc: "2.0",
      id: 7,
      method: "session/request_permission",
      params: {
        sessionId: "ses_root",
        toolCall: { toolCallId: "ses_child:abc", name: "shell", _meta: { "opencode/child-session": stamp } },
        options: ASKED,
      },
    }
    const heard = permissionIn(request)
    expect(heard?.kind).toBe("message")
    expect(heard?.kind === "message" ? heard.value : null).toMatchObject({
      id: 7,
      method: "session/request_permission",
      params: { sessionId: "ses_child", toolCall: { toolCallId: "ses_child:abc" } },
    })
  })

  test("the root's own question is left exactly as it arrived", () => {
    expect(permissionIn({
      method: "session/request_permission",
      params: { sessionId: "ses_root", toolCall: { toolCallId: "abc", name: "shell" }, options: ASKED },
    })).toBeNull()
    expect(permissionIn({ method: "session/update", params: {} })).toBeNull()
  })

  test("the channel is asked for, or opencode never opens it", () => {
    expect(CHILD_SESSIONS.clientMeta).toEqual({ "opencode/child-session-updates": true })
    expect(OPENCODE.nativeActivity).toBe(CHILD_SESSIONS)
  })
})

describe("steering, and what replaced queueing", () => {
  const HANDSHAKE = {
    protocolVersion: 1,
    agentInfo: { name: "OpenCode", version: "2.2.7" },
    agentCapabilities: { loadSession: true, _meta: { "opencode/child-session-updates": true } },
    _meta: { steering: { supported: true } },
  }

  test("the gesture is offered only from the agent's own positive advertisement", () => {
    expect(OPENCODE.steering?.advertised(HANDSHAKE)).toBe(true)
    expect(OPENCODE.steering?.advertised({ _meta: { steering: {} } })).toBe(false)
    expect(OPENCODE.steering?.advertised({ agentCapabilities: { steering: { supported: true } } })).toBe(false)
    expect(OPENCODE.steering?.advertised(null)).toBe(false)
  })

  test("only the outcome that CONSUMED the message counts as taken", () => {
    expect(OPENCODE.steering?.taken({ outcome: "injected" })).toBe(true)
    // No turn to put it in: the words go back out as an ordinary prompt,
    // which is what the person meant anyway.
    expect(OPENCODE.steering?.taken({ outcome: "promptRequired", reason: "noRunningTurn" })).toBe(false)
    expect(OPENCODE.steering?.taken({ outcome: "future" })).toBe(false)
    expect(OPENCODE.steering?.taken(null)).toBe(false)
    expect(OPENCODE.steering).toMatchObject({
      method: "_session/steering",
      meta: { steering: { idleBehavior: "promptRequired" } },
    })
  })

  test("NOTHING IS QUEUED: a second prompt mid-turn is refused outright", () => {
    expect(OPENCODE.queues(HANDSHAKE)).toBe(false)
  })
})

describe("what opencode still does not do", () => {
  test("no bypass mode, no forwarded channel, no listing corner, no prologue", () => {
    expect(OPENCODE.bypassMode).toBeNull()
    expect(OPENCODE.rawMessages).toBeNull()
    expect(OPENCODE.listedIn({ messageCount: 4 })).toBeNull()
    expect(OPENCODE.prologueIn({ _meta: { banner: "hello" } })).toBeNull()
    expect(OPENCODE.taskNotification("<task-notification>done</task-notification>", undefined)).toBeNull()
    expect(OPENCODE.backgroundTask({ task: "watch" })).toBeNull()
    expect(OPENCODE.parentToolUse({ "opencode/child-session": { id: "ses_child" } })).toBeNull()
    expect(OPENCODE.spelling).toBeNull()
  })

  test("the picker offers the ids it reports", () => {
    expect(OPENCODE.models?.config).toBe("model")
    expect(OPENCODE.models?.nameIn(
      new Map([["opencode/claude-sonnet-5", "opencode/Claude Sonnet 5"]]),
      "opencode/claude-sonnet-5",
    )).toBe("opencode/Claude Sonnet 5")
    expect(OPENCODE.models?.nameIn(new Map(), "opencode/kimi-k3")).toBeNull()
  })
})
