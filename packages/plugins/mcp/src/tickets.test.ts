import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { exposeRootedFaces, type FaceExposure } from "@kolu/surface/expose"
import { implementRootedSurfaces } from "@kolu/surface/server"
import type { RootedSurfaceClients } from "@kolu/surface/client"
import { Effect, Schema } from "effect"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { liveOps, type SessionRule } from "@olai/ops"
import { ticketing } from "./tickets.ts"
import { clientsFor, type Row } from "./bundle.ts"
import type { Bound } from "./authority.ts"

const contract = defineSurface({ procedures: { ops: { run: { input: Schema.Unknown, output: Schema.Unknown } } } })
const core = defineSurface({})
const ROW = "outlines"

const generation = (name: string, mounted: boolean) => {
  const invoked: string[] = []
  const runtime = implementRootedSurfaces(core, {}, {})
  if (mounted) {
    runtime.mount(ROW, contract, {
      procedures: { ops: { run: () => Effect.gen(function*() {
        const authority = yield* RequestAuthority
        if ((authority.rule as SessionRule)._tag === "closed") return yield* Effect.die(new Error("released credential"))
        invoked.push(`${name}:${authority.writer}`)
        return {}
      }) } },
    })
  }
  const expose = mounted
    ? exposeRootedFaces(core, {}, { [ROW]: contract }, { [ROW]: { "ops.run": "tool" } })
    : exposeRootedFaces(core, {}, {}, {})
  return {
    invoked,
    close: () => runtime.close(),
    rows: (): ReadonlyArray<Row> =>
      mounted ? [{ name: ROW, surface: contract, resources: {}, tools: [] }] : [],
    bound: (): Bound & { readonly expose: FaceExposure } => ({
      group: runtime.group,
      handlers: runtime.handlers,
      writes: mounted ? [`surface/${ROW}/ops/run`] : [],
      expose,
    }),
  }
}

const run = (door: RootedSurfaceClients, title: string) =>
  door.clients![ROW]!.surface.ops!.run!({ op: "title", id: "seat", title })

test("a released retained ticket remains closed when a provider returns with fresh handlers", async () => {
  const first = generation("first", true)
  const second = generation("second", true)
  const absent = generation("absent", false)
  let live = first
  let bearer: string | null = null
  const tickets = ticketing({
    reservations: [],
    bound: () => live.bound(),
    face: () => live.bound().expose,
    ops: liveOps(() => undefined),
    token: "operator",
    currentTicket: () => bearer,
    rows: () => live.rows(),
  })
  const panel = () => clientsFor(live.rows(), () => live.bound(), { writer: "mcp" })
  const one = tickets.mint(() => [], "chat-agent")
  bearer = one.bearer
  const retained = tickets.doorAt(panel())
  try {
    await Effect.runPromise(run(retained, "change"))

    live = absent
    await first.close()
    await expect(Effect.runPromise(run(retained, "change"))).rejects.toThrow("capability")

    one.release()
    live = second
    await expect(Effect.runPromise(run(retained, "change"))).rejects.toThrow("released credential")

    const next = tickets.mint(() => [], "chat-agent")
    bearer = next.bearer
    await Effect.runPromise(run(tickets.doorAt(panel()), "fresh"))
    expect([...first.invoked, ...second.invoked]).toEqual(["first:chat-agent", "second:chat-agent"])
    next.release()
  } finally {
    await Promise.all([first.close(), second.close(), absent.close()])
  }
})
