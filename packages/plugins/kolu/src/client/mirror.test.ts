import { describe, expect, it } from "bun:test"
import { Effect, Fiber, Schedule, Stream } from "effect"

import type { FleetTerminal, KoluLink } from "./wire/index.ts"
import { DaemonContractSkewError } from "@kolu/surface-daemon-supervisor/dial"

import { type Dial, type PadiSurfaceClient, SPEAKS } from "./link.ts"
import { frameOf, makeMirror } from "./mirror.ts"

const recorder = () => {
  const links: KoluLink[] = []
  const rows = new Map<string, FleetTerminal>()
  const removed: string[] = []
  const lines: string[] = []
  const cleared: string[] = []
  const faces: Array<PadiSurfaceClient | null> = []
  return {
    links,
    rows,
    removed,
    cleared,
    lines,
    faces,
    sink: {
      link: (state: KoluLink) => links.push(state),
      upsert: (id: string, row: FleetTerminal) => {
        rows.set(id, row)
      },
      remove: (id: string) => {
        rows.delete(id)
        removed.push(id)
      },
      clearedRow: (id: string) => {
        rows.delete(id)
        cleared.push(id)
      },
      face: (padi: PadiSurfaceClient | null) => {
        faces.push(padi)
      },
      say: (line: string) => lines.push(line),
    },
  }
}

const liveFace = () => ({
  padi: {
    surface: {
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

const faceWith = (
  ids: ReadonlyArray<string>,
  screen: (input: { id: string }) => Effect.Effect<string> = () => Effect.succeed(""),
) => ({
  padi: {
    surface: {
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
              pr: { kind: "absent" },
              agent: null,
              cwd: `/tmp/${input.key}`,
              git: { kind: "unresolved" },
              lastActivityAt: null,
            }),
            Stream.never,
          ),
      },
      screen: { text: screen },
    },
  },
})

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

const noPadi: Dial = () => Effect.fail(new Error("ENOENT: no such file or directory"))

const AT = "2026-08-25T12:00:00-04:00"

const FULL_ID = "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44"

describe("the padi mirror", () => {
  it("dials ONCE however many readers there are — the one-connection claim", async () => {
    const seen = recorder()
    let dials = 0
    const holding: Dial = () => {
      dials += 1
      return Effect.succeed({
        client: liveFace(),
        identity: { stateRoot: "/run/padi", surfaceVersion: "5.4" },
        startedAt: 0,
        dispose: () => {},
        onClose: () => {},
      } as never)
    }
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: holding })

    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("50 millis"))

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

    const last = seen.links.at(-1)
    expect(last?.status).toBe("absent")
    expect(last?.since).toBe(AT)
    expect(last?.socket).not.toBe("")
    expect(last?.told).toBe(false)
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
    expect(last?.told).toBe(true)
  })


  it("reports a padi it cannot SPEAK to as skew, not as absent", async () => {
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
    expect(last?.surfaceVersion).toBe("9.0")
    expect(last?.speaks).toBe(SPEAKS)
  })


  it("survives a padi it cannot speak to — a skew must not fault the runtime", async () => {
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
    await Effect.runPromise(Fiber.interrupt(fiber))

    const last = seen.links.at(-1)
    expect(last?.status).toBe("skew")
    expect(last?.surfaceVersion).toBe("99.0")
    expect(last?.speaks).toBe(SPEAKS)
  })

  it("goes back to ABSENT when a healthy link drops, and drops the rows with it", async () => {
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
    expect(mirror.screen).toBeDefined()

    close?.()
    await Effect.runPromise(Effect.sleep("50 millis"))
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(seen.links.at(-1)?.status).toBe("absent")
    expect(mirror.rows().size).toBe(0)
    const refused = await Effect.runPromise(
      Effect.flip(mirror.screen("t1", undefined, () => AT)),
    )
    expect(refused.reason).toBe("no-padi")
  })

  it("a LINK closing empties the rows on `clearedRow` — never on `remove`", async () => {
    const seen = recorder()
    let close: (() => void) | undefined
    const dropping: Dial = () =>
      Effect.succeed({
        client: faceWith([FULL_ID]),
        identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
        startedAt: 0,
        dispose: () => {},
        onClose: (cb: () => void) => {
          close = cb
        },
      } as never)
    const mirror = makeMirror(seen.sink, { env: {}, now: () => AT, dial: dropping })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("80 millis"))
    expect(seen.rows.has(FULL_ID)).toBe(true)

    close?.()
    await Effect.runPromise(Effect.sleep("50 millis"))
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(seen.cleared).toContain(FULL_ID)
    expect(seen.removed).not.toContain(FULL_ID)
    expect(mirror.rows().size).toBe(0)
  })


  it("reads a screen named by an EIGHT-CHARACTER PREFIX — the board's own spelling", async () => {
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

describe("the frame projection", () => {
  it("carries the frame's grid verbatim — one spelling, no rounding", () => {
    expect(
      frameOf({ kind: "snapshot", data: "x", topLine: 3, grid: { cols: 203, rows: 51 } }),
    ).toEqual({ kind: "snapshot", data: "x", topLine: 3, grid: { cols: 203, rows: 51 } })
  })

  it("leaves a delta alone — bytes carry no layout claim", () => {
    expect(frameOf({ kind: "delta", data: "$ " })).toEqual({ kind: "delta", data: "$ " })
  })
})

const resizingFace = (id: string, grids: ReadonlyArray<{ cols: number; rows: number }>) => {
  const attaches: Array<{ id: string; resizeTo?: { cols: number; rows: number } }> = []
  return {
    attaches,
    face: {
      padi: {
        surface: {
          terminalAttach: {
            get: (input: { id: string; resizeTo?: { cols: number; rows: number } }) => {
              attaches.push(input)
              return Stream.concat(
                Stream.make({
                  kind: "snapshot" as const,
                  data: `attach ${attaches.length}`,
                  topLine: 0,
                }),
                Stream.never,
              )
            },
          },
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
            keys: () => Stream.concat(Stream.make([id]), Stream.never),
            get: () =>
              Stream.concat(
                Stream.fromIterable(
                  grids.map((grid) => ({
                    state: "active" as const,
                    pr: { kind: "absent" as const },
                    agent: null,
                    cwd: "/tmp/t",
                    git: { kind: "unresolved" as const },
                    lastActivityAt: null,
                    grid,
                  })),
                ).pipe(Stream.schedule(Schedule.spaced("250 millis"))),
                Stream.never,
              ),
          },
          screen: { text: () => Effect.succeed("") },
        },
      },
    },
  }
}

describe("a foreign resize", () => {
  const ID = "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44"

  it("RE-ATTACHES when the record's grid moves, and does not re-assert its own", async () => {
    const seen = recorder()
    const resizing = resizingFace(ID, [{ cols: 80, rows: 24 }, { cols: 203, rows: 51 }])
    const mirror = makeMirror(seen.sink, {
      env: {},
      now: () => AT,
      dial: () =>
        Effect.succeed({
          client: resizing.face,
          identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
          startedAt: 0,
          dispose: () => {},
          onClose: () => {},
        } as never),
    })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("400 millis"))

    const frames: string[] = []
    const watching = Effect.runFork(
      Stream.runForEach(mirror.attach(ID, { cols: 100, rows: 30 }), (frame) =>
        Effect.sync(() => {
          if (frame.kind === "snapshot") frames.push(frame.data)
        })),
    )
    await Effect.runPromise(Effect.sleep("900 millis"))
    await Effect.runPromise(Fiber.interrupt(watching))
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(resizing.attaches.length).toBeGreaterThanOrEqual(2)
    expect(resizing.attaches[0]?.resizeTo).toEqual({ cols: 100, rows: 30 })
    expect(resizing.attaches[1]?.resizeTo).toBeUndefined()
    expect(frames.length).toBeGreaterThanOrEqual(2)
  })

  it("never projects padi's `resized` control frame as bytes", async () => {
    const seen = recorder()
    const resizing = resizingFace(ID, [{ cols: 80, rows: 24 }])
    resizing.face.padi.surface.terminalAttach.get = (() =>
      Stream.fromIterable([
        {
          kind: "snapshot" as const,
          data: "attach",
          topLine: 0,
          grid: { cols: 80, rows: 24 },
        },
        { kind: "resized" as const, grid: { cols: 203, rows: 51 } },
        { kind: "delta" as const, data: "after" },
      ])) as never
    const mirror = makeMirror(seen.sink, {
      env: {},
      now: () => AT,
      dial: () =>
        Effect.succeed({
          client: resizing.face,
          identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
          startedAt: 0,
          dispose: () => {},
          onClose: () => {},
        } as never),
    })
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await Effect.runPromise(Effect.sleep("400 millis"))

    const kinds: string[] = []
    const watching = Effect.runFork(
      Stream.runForEach(mirror.attach(ID, { cols: 80, rows: 24 }), (frame) =>
        Effect.sync(() => {
          kinds.push(frame.kind)
        })),
    )
    await Effect.runPromise(Effect.sleep("400 millis"))
    await Effect.runPromise(Fiber.interrupt(watching))
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(kinds).toEqual(["snapshot", "delta"])
  })
})
