/**
 * pi-acp's bets, over values.
 *
 * The payloads are what pi-acp 0.0.33 actually sends (the spike, 2026-08-28 —
 * {@link ./pi.ts}'s header has the whole table): call ids of the shape
 * `bash:0` and `edit:1`, no tool-name corner on any frame, and a `session/new`
 * whose `_meta.piAcp.startupInfo` is the exact text the adapter then doubles
 * as one ordinary chunk.
 *
 * THE SUBJECT THAT MATTERS IS THE FLOOR, here even more than in the other
 * legs' files: on this wire olai's own tools DO NOT EXIST (pi-acp wires no
 * `mcpServers` through to pi), so the allow half of the fail-safe has nothing
 * to match and the near-miss table the other agents keep is one fact — never —
 * said a few ways.
 */

import { describe, expect, test } from "bun:test"

import { allowedWithoutAsking, PI, prologueIn, toolNameOf } from "./leg.ts"

describe("which tool a call is", () => {
  test("is the head of the call id, minted once — as on the opencode wire", () => {
    expect(toolNameOf("bash:0")).toBe("bash")
    expect(toolNameOf("edit:1")).toBe("edit")
    expect(toolNameOf("write:12")).toBe("write")
  })

  test("takes the FIRST separator, so a colon in a name under-reads", () => {
    expect(toolNameOf("weird:name:0")).toBe("weird")
  })

  test("answers nothing for an id that is not one", () => {
    // `pi-ui-<n>` is the one id shape this adapter asks permission with, and
    // it carries no name: an extension's confirm is a person's to answer.
    expect(toolNameOf("pi-ui-3")).toBeNull()
    expect(toolNameOf("bash")).toBeNull()
    expect(toolNameOf(":0")).toBeNull()
    expect(toolNameOf("")).toBeNull()
  })

  test("is what the leg reads, and the leg reads nothing off a frame", () => {
    expect(PI.toolNameOf("bash:0")).toBe("bash")
    expect(PI.toolNameIn({ piAcp: { toolName: "bash" } })).toBeNull()
  })
})

describe("which permissions are answered without asking", () => {
  test("NONE — olai's tools ARE pi's own now, and pi never asks on this wire", () => {
    // The pin's bridge (acp/patches/README.md) registerTools the handed
    // servers INTO the agent under the same names the other agents answer
    // by — and pi-acp still mints NO permission requests about calls on
    // such a wire: its own settings govern its tools, not an answering
    // request on ACP, so the refusal answer stands where it stood — the
    // claim is the refusal, not the shape the tool reached pi by.
    expect(allowedWithoutAsking("olai_set_done", ["olai", "alpha"], []))
      .toBeNull()
    expect(allowedWithoutAsking("mcp__olai__set_done", ["olai"], [])).toBeNull()
    // A call nobody named.
    expect(allowedWithoutAsking(null, ["olai"], [])).toBeNull()
  })
})

describe("the prologue the open doubles", () => {
  test("is the response corner's own string, verbatim — sections, nag, trailing blank and all", () => {
    // The real banner's shape (the pin's `buildStartupInfo`): a version
    // header, a rule, then markdown sections for what it found, sent as ONE
    // chunk.
    const banner = "pi v0.84.2\n---\n\n## Context\n- /served/AGENTS.md\n\n"
    const opened = {
      sessionId: "01a",
      _meta: { piAcp: { startupInfo: banner } },
    }
    expect(prologueIn(opened)).toBe(banner)
  })

  test("a load's null is nothing to drop", () => {
    expect(prologueIn({ _meta: { piAcp: { startupInfo: null } } })).toBeNull()
  })

  test("nothing shaped like it anywhere else is nothing dropped", () => {
    expect(prologueIn({ sessionId: "01a" })).toBeNull()
    expect(prologueIn(null)).toBeNull()
    expect(prologueIn(undefined)).toBeNull()
    expect(prologueIn({ _meta: { piAcp: {} } })).toBeNull()
    expect(prologueIn({ _meta: { piAcp: { startupInfo: 42 } } })).toBeNull()
    expect(prologueIn({ _meta: { piAcp: { startupInfo: "" } } })).toBeNull()
    expect(prologueIn({ _meta: {} })).toBeNull()
  })
})

describe("what pi-acp does not do", () => {
  test("carries no attribution and registers no tasks", () => {
    expect(PI.parentToolUse({ piAcp: { parent: "x" } })).toBeNull()
    expect(PI.spawned({ piAcp: { subagent: true } }, { subagent_type: "Explore" }))
      .toBeNull()
    expect(PI.backgroundTask({ piAcp: { backgroundTask: { taskId: "t" } } }))
      .toBeNull()
  })

  test("has no bypass mode to ask for and no way to steer a running turn", () => {
    // `session/set_mode` answers -32602 ("Unknown modeId") and
    // `_session/steering` -32601 — both refused on the spike, both `null`
    // here so olai sends neither. `/steering` in this adapter is a slash
    // command about pi's own delivery mode, not the extension.
    expect(PI.bypassMode).toBeNull()
    expect(PI.steering).toBeNull()
  })

  test("forwards no messages of its own", () => {
    // The model is the configOptions picker's; changes ride responses and a
    // `config_option_update`, and nothing agent-private is subscribed to.
    expect(PI.rawMessages).toBeNull()
  })

  test("says nothing beyond the protocol about a stored conversation", () => {
    // Rows are the four protocol fields; `_meta` is empty at response level
    // and never a corner on a row.
    expect(PI.listedIn({})).toBeNull()
    expect(PI.listedIn(undefined)).toBeNull()
  })
})

describe("the one YES", () => {
  test("a prompt sent mid-turn is held for its turn, in order", () => {
    // Not an advertisement — the handshake carries no `promptQueueing` word
    // anywhere. Verified on the wire against 0.0.33: a prompt sent 3s into a
    // 12-second held turn was announced queued
    // (`_meta.piAcp.{queueDepth, running}` on a `session_info_update`) and its
    // REQUEST answered when its turn came, in order.
    expect(PI.queues({ agentCapabilities: {} })).toBe(true)
  })
})
