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
import { Effect, Fiber, Stream } from "effect"

import type { FleetTerminal, KoluLink } from "@olai/surface"
import { DaemonContractSkewError } from "@kolu/surface-daemon-supervisor"

import { type Dial, SPEAKS } from "./link.ts"
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

/**
 * A padi face the MIRROR can actually live on — an empty `terminals`
 * collection that stays open.
 *
 * `mirrorRemoteSurface` subscribes to `terminals.keys` and opens a per-key
 * `get`; a face without them faults on the first frame and the link ends
 * before any of these cases has looked. An empty key set followed by
 * `Stream.never` is the smallest far end that is HEALTHY: it says "no
 * terminals" and then holds, which is a real state (a kolu with nothing open)
 * rather than a stub that happens not to crash.
 */
const liveFace = () => ({
  padi: {
    surface: {
      terminals: {
        keys: () => Stream.concat(Stream.make(NO_KEYS), Stream.never),
        get: () => Stream.never,
      },
      screen: { text: () => Effect.succeed("") },
    },
  },
})

const NO_KEYS: ReadonlyArray<string> = []

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
        client: liveFace(),
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


  it("reports a padi it cannot SPEAK to as skew, not as absent", async () => {
    // The two arms have opposite fixes — "start kolu" and "these two builds
    // disagree, here are the versions" — which is the whole reason the cell has
    // three states instead of a boolean. Nothing asserted the fold until pi's
    // review: the renderer's skew arm was unit-tested and the LINK's was not,
    // so a skew that landed on `absent` would have told a reader to start a
    // kolu that was already running.
    const seen = recorder()
    const skewed: Dial = () =>
      Effect.fail(
        new DaemonContractSkewError({
          subject: "padiSurface",
          daemonVersion: "9.0",
          requiredVersion: SPEAKS,
        }),
      )
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: skewed })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("50 millis"))
    await Effect.runPromise(Fiber.interrupt(fiber))

    const last = seen.links.at(-1)
    expect(last?.status).toBe("skew")
    // BOTH versions, because one of the two has to move and a reader cannot
    // know which without seeing the pair.
    expect(last?.surfaceVersion).toBe("9.0")
    expect(last?.speaks).toBe(SPEAKS)
  })


  it("survives a padi it cannot speak to — a skew must not fault the runtime", async () => {
    // THE ONE THAT MATTERED. `connectPadi`'s compatibility gate THROWS, so a
    // padi a major ahead arrives as a DEFECT rather than a typed failure —
    // and a handler that caught only the error channel let it escape, kill the
    // connector's fiber and fault the whole surface runtime. A skewed kolu
    // took olai's server down with it, on a machine where every page would
    // otherwise have opened fine.
    //
    // So this case dies the way the real dial dies, and asserts the two things
    // that make it survivable: the effect does not fail, and the reader is
    // told which two versions disagree.
    const seen = recorder()
    const throwing: Dial = () =>
      Effect.suspend(() => {
        throw new DaemonContractSkewError({
          subject: "padiSurface",
          daemonVersion: "99.0",
          requiredVersion: SPEAKS,
        })
      })
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: throwing })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("50 millis"))
    // STILL RUNNING — the assertion the crash would fail. An interrupt of a
    // fiber that already died on a defect is not the same thing, so the link
    // state below is what proves it kept going.
    await Effect.runPromise(Fiber.interrupt(fiber))

    const last = seen.links.at(-1)
    expect(last?.status).toBe("skew")
    expect(last?.surfaceVersion).toBe("99.0")
    expect(last?.speaks).toBe(SPEAKS)
  })

  it("goes back to ABSENT when a healthy link drops, and drops the rows with it", async () => {
    // The socket closing is the ordinary end of a connection — kolu restarted,
    // padi exited — and it has to reach a reader, or the dots freeze at their
    // last good value with nothing anywhere saying the fleet is no longer a
    // reading of anything. `onClose` never fired in this file until pi asked
    // for it.
    const seen = recorder()
    let close: (() => void) | undefined
    const dropping: Dial = () =>
      Effect.succeed({
        client: liveFace(),
        identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
        startedAt: 0,
        dispose: () => {},
        onClose: (cb: () => void) => {
          close = cb
        },
      } as never)
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: dropping })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("50 millis"))
    expect(seen.links.at(-1)?.status).toBe("connected")
    // ...and the snapshot verb is live while it is.
    expect(mirror.screen).toBeDefined()

    close?.()
    await Effect.runPromise(Effect.sleep("50 millis"))
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(seen.links.at(-1)?.status).toBe("absent")
    // EVERY row went with it: the fleet is not a reading of anything now, and
    // a chip that kept drawing a green dot would be reporting on a terminal
    // nobody can see.
    expect(mirror.rows().size).toBe(0)
    // ...and the snapshot refuses rather than reaching a dead face.
    const refused = await Effect.runPromise(
      Effect.flip(mirror.screen("t1", undefined, () => AT)),
    )
    expect(refused.reason).toBe("no-padi")
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
