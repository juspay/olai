/**
 * THE MIRROR — one connection for N readers, and what a machine with no kolu
 * on it sees.
 *
 * Two claims, and they are the two the brief names:
 *
 *   1. **N subscribers, ONE mirror — counted.** The economy of rung 1 is that
 *      ten lane chips on a page are ten lookups into a map the server already
 *      holds and exactly one connection to padi. That is true today because the
 *      link is started once, on the runtime's scope, and it would stop being
 *      true the moment somebody moved the start into a per-reader path — with
 *      nothing anywhere noticing, because the screen would look identical. So
 *      the dial is counted and the count is asserted.
 *
 *   2. **Padi absent is a STATE.** A laptop with no kolu running is the
 *      ordinary case, and every page has to draw on it. So a dial that finds
 *      nothing must produce a `KoluLink` and an empty fleet — never a failed
 *      effect, never a log at error level, and never a fleet that has simply
 *      stopped moving with its last good rows still on screen.
 */

import { describe, expect, it } from "bun:test"
import { Effect, Fiber } from "effect"

import type { FleetTerminal, KoluLink } from "@olai/surface"
import { type Dial } from "./link.ts"
import { makeMirror } from "./mirror.ts"

/** What the mirror pushes, collected — the server's cell and collection,
 *  played by two arrays. */
const recorder = () => {
  const links: KoluLink[] = []
  const rows = new Map<string, FleetTerminal>()
  const removed: string[] = []
  const lines: string[] = []
  return {
    links,
    rows,
    removed,
    lines,
    sink: {
      link: (state: KoluLink) => links.push(state),
      upsert: (id: string, row: FleetTerminal) => {
        rows.set(id, row)
      },
      remove: (id: string) => {
        rows.delete(id)
        removed.push(id)
      },
      say: (line: string) => lines.push(line),
    },
  }
}

/** A dial that never finds anything — the machine with no kolu on it. */
const noPadi: Dial = () => Effect.fail(new Error("ENOENT: no such file or directory"))

const AT = "2026-08-25T12:00:00-04:00"

describe("the padi mirror", () => {
  it("dials ONCE however many readers there are — the one-connection claim", async () => {
    const seen = recorder()
    let dials = 0
    // A dial that connects and then holds forever: the healthy case, where a
    // second dial would only ever come from a second subscriber.
    const holding: Dial = () => {
      dials += 1
      return Effect.succeed({
        client: { padi: { surface: { screen: { text: () => Effect.succeed("") } } } },
        identity: { stateRoot: "/run/padi", surfaceVersion: "5.4" },
        startedAt: 0,
        dispose: () => {},
        // Never fires — the link stays up, which is what makes a second dial
        // unambiguously a bug rather than a reconnect.
        onClose: () => {},
      } as never)
    }
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: holding })

    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    // Let the dial land and the mirror settle.
    await Effect.runPromise(Effect.sleep("50 millis"))

    // TEN READERS. Each one is what a tab does: read the rows it was
    // snapshotted from and look its own terminal up. Not one of them may cost
    // a connection.
    for (let reader = 0; reader < 10; reader += 1) {
      expect(mirror.rows()).toBeDefined()
      mirror.rows().get(`terminal-${reader}`)
    }

    expect(mirror.dials()).toBe(1)
    expect(dials).toBe(1)
    await Effect.runPromise(Fiber.interrupt(fiber))
  })

  it("reports a machine with no padi as ABSENT, not as a failure", async () => {
    const seen = recorder()
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: noPadi })

    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("50 millis"))
    await Effect.runPromise(Fiber.interrupt(fiber))

    // The link SAID something — the hollow chip is drawn from this and not
    // from an empty fleet, which is the distinction that must not blur.
    const last = seen.links.at(-1)
    expect(last?.status).toBe("absent")
    expect(last?.since).toBe(AT)
    // And it says WHERE it looked, which is the whole of what makes a hollow
    // chip actionable.
    expect(last?.socket).not.toBe("")
    expect(last?.told).toBe(false)
    // Nothing was published as a row.
    expect(mirror.rows().size).toBe(0)
  })

  it("prefers the socket it was TOLD over the one it would guess", async () => {
    const seen = recorder()
    const mirror = makeMirror(seen.sink, {
      env: { PADI_SOCKET: "/tmp/somebody-elses-padi.sock" },
      now: () => AT,
      dial: noPadi,
    })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("50 millis"))
    await Effect.runPromise(Fiber.interrupt(fiber))

    const last = seen.links.at(-1)
    expect(last?.socket).toBe("/tmp/somebody-elses-padi.sock")
    // `told` is what lets the hollow state say "your variable points nowhere"
    // rather than "no padi is running", which are two different things to fix.
    expect(last?.told).toBe(true)
  })

  it("refuses a snapshot in words when there is no padi to read", async () => {
    const seen = recorder()
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: noPadi })
    const refused = await Effect.runPromise(
      Effect.flip(mirror.screen("terminal-1", undefined, () => AT)),
    )
    expect(refused.reason).toBe("no-padi")
    expect(refused.says).toContain("not connected")
  })
})
