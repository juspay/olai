/**
 * THE PILL'S REGISTER, as arithmetic rather than paint.
 *
 * The fold's barrel words: the link is one axis (`connected` / `absent` /
 * `skew`, answered by `padiSaid`), and the beat is a second one — on a
 * HEALTHY link the pulse's age pulls the register from `fresh` to `quiet`
 * the moment the timestamp is more than two cadences old. The counting is
 * deliberate, and this file is its house:
 *
 *   - the ring-pulse (the `fresh` register), so the pill's inspection face
 *     says `watcher pulse 2m ago` and the coat takes NOTHING; and
 *   - the quiet-fold's threshold, `everyMs * 2` — the pill's arithmetic,
 *     spelled as `watcher quiet 47m` when it crosses; and
 *   - the pre-beat window (no pulse IN yet), so the door's first drawing
 *     is the same quiet face it wears while a fresh link simply hasn't
 *     stamped you recency yet.
 */

import { expect, test } from "bun:test"

import type { KoluLink, WatchPulse } from "@olai/kolu-client/wire"

import { beatOf, padiSaid } from "./said.ts"

const T0 = 1_700_000_000_000

const connectedLink: KoluLink = {
  status: "connected",
  socket: "/tmp/padi.sock",
  told: true,
  stateRoot: "",
  surfaceVersion: "v10",
  speaks: "v10",
  since: new Date(T0 - 86_400).toISOString(),
}

const pulse = (ageMs: number, everyMs: number): WatchPulse => ({
  at: new Date(T0 - ageMs).toISOString(),
  everyMs,
})

test("the beat speaks plainly while it is fresh — the inspection sentence", () => {
  const said = padiSaid(connectedLink, pulse(120_000, 60_000), T0)
  expect(said.beat?.kind).toBe("fresh")
  expect(said.beat?.said).toBe("watcher pulse 2m ago")
  expect(said.detail).toBe("mirror connected · watcher pulse 2m ago")
  // And the register paint is quiet: no hollow, no amber, the dot says
  // as `connected` always did.
  expect(said.label).toBe("kolu")
  expect(said.dot).toBe("bg-done")
})

test("the register crosses at `everyMs * 2`, the pill's house margin", () => {
  // The fold's line: 2 × the cadence — beyond it the watcher owes a beat.
  // `age ≤ twice` is fresh; `age > twice` is quiet.
  const half = pulse(60_000, 30_000) // 2× — on the line
  const over = pulse(120_001, 30_000) // one ms past
  expect(beatOf(half, T0).kind).toBe("fresh")
  expect(beatOf(over, T0).kind).toBe("quiet")
  // And the register's words move with it: the sentence the drawer spells
  // gets the same `ago`, but the VERB folds from pulse to quiet the beat
  // IT folded.
  expect(beatOf(half, T0).said).toBe("watcher pulse 1m ago")
  expect(beatOf(over, T0).said).toBe("watcher quiet 2m")
})

test("the quiet register is loud enough to name the piece that went down", () => {
  const said = padiSaid(connectedLink, pulse(47 * 60_000, 60_000), T0)
  expect(said.beat?.kind).toBe("quiet")
  expect(said.beat?.said).toBe("watcher quiet 47m")
  // The coat is the prototype's amber — the one draw outside the link's
  // three faces this fold owns — and the words the hid-hover eats carry
  // the same phrase.
  expect(said.detail).toBe("mirror connected · watcher quiet 47m")
})

test("a fresh link that never stamped is not a quiet one — the pre-beat face", () => {
  // No pulse yet — never a beat read: the register's answer is `none`,
  // never `fresh`'s good conscience and NEVER `quiet`'s warning. The chip
  // answers `kolu` the way it did before the vault had a watcher to weigh.
  const said = padiSaid(connectedLink, null, T0)
  expect(said.beat).toBeNull()
  expect(said.detail).toContain("connected to padi")
})

test("the beat says nothing once the link has failed — the fault is the link's", () => {
  // The link is absent: whatever age the pulse owes the door is the
  // dead-horse read, and the fold's register answers `none` so the chip
  // folds onto the link's own answer — `absent`'s hollow face.
  const absent: KoluLink = { ...connectedLink, status: "absent" }
  const said = padiSaid(absent, pulse(5_000, 30_000), T0)
  expect(said.beat).toBeNull()
  expect(said.dot).toBe("bg-muted")
})
