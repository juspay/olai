/**
 * WHAT ONE EVENT LINE SAYS — the fold as the words.
 *
 * The tests name the one module's three shapes and one vocabulary discipline:
 *
 *   - the three sentences of `transition`, `nag` and `heartbeat`, each
 *     spelled in words that CANNOT drift from kolu's own; and
 *   - the durations, which are `recencyText`'s phrases rather than a second
 *     calendar: the AGE is the `ago` arm's "4m ago", and the HELD FOR is the
 *     wait-chip's "38m".
 */

import { expect, test } from "bun:test"

import type { KoluEvent } from "@olai/surface"

import { eventLine } from "./events.ts"

/** One frozen draw, structurally — what `./watch.ts` freezes a row into.
 *  `holdMs` is the span the hold had at the fire time, and the two are
 *  distance-paraphrased onto the one clock the tests stand on. */
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
  } = {},
): KoluEvent => {
  const ageMs = opts.ageMs ?? 4 * 60_000
  const heldMs = opts.heldMs ?? 38 * 60_000
  return {
    id: "ev-1",
    kind,
    at: new Date(T0 - ageMs).toISOString(),
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

test("a `transition` says has been", () => {
  const line = eventLine(heldEvent("transition"), T0)
  expect(line.label).toBe("panel-step")
  expect(line.who).toBe("olai·panel-step")
  expect(line.words).toBe("has been waiting for input for 38m")
  // The AGE is kolu's own ago-phrase.
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
  // And the no-repo case answers what the Dock's group answers: nothing
  // extra, the plain label.
  expect(eventLine(heldEvent("transition", { repo: null, label: "the lane the evidence rides" }), T0).who)
    .toBe("the lane the evidence rides")
})

test("an event younger than one tick is `just now`, never a dash", () => {
  // The tab's clock ticks per minute and an event lands ahead of it,
  // briefly, every minute — the fold clamps at the seam rather than letting
  // a dash reach the one reader the age phrase was made for.
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
  // And the fold's answer is SILENCE — never "the watcher is alive", which
  // is the pill's register's to say.
  expect(line.words).toBe("")
})
