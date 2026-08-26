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
      /* THE ATTENTION FEEDS, quiet. A fake that announced the collection and
         not these would be a padi the mirror subscribes to and never hears
         from — the mirror unwinds on the FIRST subscription failure, so a
         missing member here reads as a dead link rather than as a missing
         feed. Empty and never-ending is the honest "nothing is asking of you":
         `Stream.never` after the seed is what every member here does. */
      /* The live-attach member. A fake that omitted it would be a padi whose
         `terminalAttach` is `undefined` — and the dial reads that member off
         the face on every connect, so the omission reads as a dead link rather
         than as a pane nobody opened. */
      terminalAttach: { get: () => Stream.never },
      urgency: {
        get: () =>
          Stream.concat(
            Stream.make({
              awaitingIds: [],
              finishedIds: [],
              workingIds: [],
              lingerIds: [],
            }),
            Stream.never,
          ),
      },
      activity: {
        get: () => Stream.concat(Stream.make([] as ReadonlyArray<string>), Stream.never),
      },
      terminals: {
        keys: () => Stream.concat(Stream.make(NO_KEYS), Stream.never),
        get: () => Stream.never,
      },
      screen: { text: () => Effect.succeed("") },
    },
  },
})

const NO_KEYS: ReadonlyArray<string> = []

/**
 * A padi face holding `ids` — `keys` announces them and `get` DELIVERS a
 * record for each, which is what makes the mirror actually hold an id.
 *
 * The delivery half matters: `keys` alone announces a membership the mirror
 * cannot resolve a prefix against, because what it keeps is the records. A
 * fake that announced without delivering was a fake padi with an empty fleet.
 */
const faceWith = (
  ids: ReadonlyArray<string>,
  screen: (input: { id: string }) => Effect.Effect<string> = () => Effect.succeed(""),
) => ({
  padi: {
    surface: {
      /* THE ATTENTION FEEDS, quiet. A fake that announced the collection and
         not these would be a padi the mirror subscribes to and never hears
         from — the mirror unwinds on the FIRST subscription failure, so a
         missing member here reads as a dead link rather than as a missing
         feed. Empty and never-ending is the honest "nothing is asking of you":
         `Stream.never` after the seed is what every member here does. */
      /* The live-attach member. A fake that omitted it would be a padi whose
         `terminalAttach` is `undefined` — and the dial reads that member off
         the face on every connect, so the omission reads as a dead link rather
         than as a pane nobody opened. */
      terminalAttach: { get: () => Stream.never },
      urgency: {
        get: () =>
          Stream.concat(
            Stream.make({
              awaitingIds: [],
              finishedIds: [],
              workingIds: [],
              lingerIds: [],
            }),
            Stream.never,
          ),
      },
      activity: {
        get: () => Stream.concat(Stream.make([] as ReadonlyArray<string>), Stream.never),
      },
      terminals: {
        keys: () => Stream.concat(Stream.make(ids), Stream.never),
        get: (input: { key: string }) =>
          Stream.concat(
            Stream.make({
              state: "active",
              // The forge axis a real record always carries — `activePr` reads it
              // without guarding, so omitting it is a record padi never sends.
              pr: { kind: "absent" },
              agent: null,
              cwd: `/tmp/${input.key}`,
              git: null,
              lastActivityAt: null,
            }),
            Stream.never,
          ),
      },
      screen: { text: screen },
    },
  },
})

/** A dial that hands back {@link faceWith}'s far end, healthy and holding. */
const holding = (
  ids: ReadonlyArray<string>,
  screen?: (input: { id: string }) => Effect.Effect<string>,
): Dial =>
() =>
  Effect.succeed({
    client: faceWith(ids, screen),
    identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
    startedAt: 0,
    dispose: () => {},
    onClose: () => {},
  } as never)

/** A dial that never finds anything — the machine with no kolu on it. */
const noPadi: Dial = () => Effect.fail(new Error("ENOENT: no such file or directory"))

const AT = "2026-08-25T12:00:00-04:00"

/** A terminal id as padi keys it — whole. The board names it `cb9dcd13`. */
const FULL_ID = "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44"

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


  it("reads a screen named by an EIGHT-CHARACTER PREFIX — the board's own spelling", async () => {
    // THE SECOND PRODUCTION DEFECT. The chip sent what the property holds; the
    // property holds a prefix; padi's `screen.text` declares its id a uuid, so
    // the call failed at ENCODE and the schema refusal went down the wire as a
    // DEFECT — which took the whole page with it. Resolving here means the
    // wire only ever sees a whole id.
    const seen = recorder()
    const asked: string[] = []
    const mirror = makeMirror(seen.sink, {
      env: {},
      now: () => AT,
      dial: holding([FULL_ID], (input) => {
        asked.push(input.id)
        return Effect.succeed("$ just check\n")
      }),
    })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("80 millis"))

    const answer = await Effect.runPromise(mirror.screen("cb9dcd13", undefined, () => AT))
    expect(answer.text).toContain("just check")
    // THE WHOLE ID reached padi, never the prefix.
    expect(asked).toEqual([FULL_ID])
    await Effect.runPromise(Fiber.interrupt(fiber))
  })

  it("refuses an AMBIGUOUS prefix in words, rather than picking one", async () => {
    const seen = recorder()
    const two = [FULL_ID, "cb9dcd13-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
    const mirror = makeMirror(seen.sink, {
      env: {},
      now: () => AT,
      dial: holding(two),
    })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("80 millis"))

    const refused = await Effect.runPromise(
      Effect.flip(mirror.screen("cb9dcd13", undefined, () => AT)),
    )
    expect(refused.reason).toBe("ambiguous")
    // THE COUNT, because it is what makes the next move obvious.
    expect(refused.says).toContain("2 terminals")
    await Effect.runPromise(Fiber.interrupt(fiber))
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
