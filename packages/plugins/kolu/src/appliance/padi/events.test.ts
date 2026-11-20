import { expect, test } from "bun:test"

import type { KoluEvent } from "olai-plugin-kolu/appliance/wire"

import { eventLine } from "./events.ts"

const T0 = 1_700_000_000_000

const heldEvent = (
  kind: "transition" | "nag",
  opts: {
    state?: string
    agentState?: string | null
    heldMs?: number
    ageMs?: number
    label?: string
    repo?: string | null
    nag?: { index: number; left?: number }
  } = {},
): KoluEvent => {
  const ageMs = opts.ageMs ?? 4 * 60_000
  const heldMs = opts.heldMs ?? 38 * 60_000
  return {
    id: "ev-1",
    kind,
    at: new Date(T0 - ageMs).toISOString(),
    ...(opts.nag !== undefined ? { nag: opts.nag } : {}),
    row: {
      terminal: "dffa1c90",
      state: opts.state ?? "waiting",
      agentState: opts.agentState ?? (opts.state === "awaiting" ? "awaiting_user" : "waiting"),
      pip: {
        variant: "waiting",
        glyph: "claude-code",
        active: false,
        asking: true,
        bytesLive: false,
        hasAgent: true,
        sleeping: false,
        alert: false,
        alertLabel: "",
      },
      bucket: "awaiting",
      label: opts.label ?? "panel-step",
      labelColor: "#a2c",
      repo: opts.repo === undefined ? "olai" : opts.repo,
      since: new Date(T0 - ageMs - heldMs).toISOString(),
    },
  }
}

test("a `nag` is a hold made louder, not one made new", () => {
  const line = eventLine(heldEvent("nag"), T0)
  expect(line.words).toBe("still waiting for input for 38m")
  expect(line.asking).toBe(true)
})

test("a carrying nag's sentence is the account the wire spelled", () => {
  expect(eventLine(heldEvent("nag", { nag: { index: 2, left: 1 } }), T0).words)
    .toBe("still waiting for input for 38m — reminder 2 of 3")
  expect(eventLine(heldEvent("nag", { nag: { index: 3, left: 0 } }), T0).words)
    .toBe("still waiting for input for 38m — reminder 3 of 3, the last")
  expect(eventLine(heldEvent("nag", { nag: { index: 4 } }), T0).words)
    .toBe("still waiting for input for 38m — reminder 4")
})

test("a count on a kind that is not a nag does not become a reminder", () => {
  expect(eventLine(heldEvent("transition", { nag: { index: 2, left: 1 } }), T0).words)
    .toBe("has been waiting for input for 38m")
})

test("a `transition` says has been", () => {
  const line = eventLine(heldEvent("transition"), T0)
  expect(line.label).toBe("panel-step")
  expect(line.who).toBe("olai·panel-step")
  expect(line.words).toBe("has been waiting for input for 38m")
  expect(line.age).toBe("4m ago")
})

test("`awaiting_user` lands differently than plain `waiting`", () => {
  const line = eventLine(heldEvent("transition", {
    state: "awaiting",
    agentState: "awaiting_user",
  }), T0)
  expect(line.words).toBe("has been awaiting input for 38m")
})

test("the `who` is the Dock's own spelling — `repo·label`, or the label alone", () => {
  expect(eventLine(heldEvent("transition", { repo: "olai", label: "kolu-events-feed" }), T0).who)
    .toBe("olai·kolu-events-feed")
  expect(eventLine(heldEvent("transition", { repo: "nixos-config", label: "master" }), T0).who)
    .toBe("nixos-config·master")
  expect(eventLine(heldEvent("transition", { repo: null, label: "the lane the evidence rides" }), T0).who)
    .toBe("the lane the evidence rides")
})

test("an event younger than one tick is `just now`, never a dash", () => {
  const fresh: KoluEvent = {
    id: "ev-9",
    kind: "heartbeat",
    at: new Date(T0).toISOString(),
    row: null,
  }
  expect(eventLine(fresh, T0 - 50_000).age).toBe("just now")
})

test("a heartbeat is not a sentence — the drawer folds it out before this door", () => {
  const heartbeat: KoluEvent = {
    id: "ev-2",
    kind: "heartbeat",
    at: new Date(T0 - 45_000).toISOString(),
    row: null,
  }
  const line = eventLine(heartbeat, T0)
  expect(line.about).toBeNull()
  expect(line.label).toBe("")
  expect(line.words).toBe("")
})
