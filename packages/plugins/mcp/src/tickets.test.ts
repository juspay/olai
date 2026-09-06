import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { exposeFace, type FaceExposure } from "@kolu/surface/expose"
import { implementSurface } from "@kolu/surface/server"
import { Effect, Schema } from "effect"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { liveOps, type SessionRule } from "@olai/ops"
import { ticketing } from "./tickets.ts"
import { liveClient } from "./live-client.ts"
import type { Bound } from "./authority.ts"

const contract = defineSurface({ procedures: { ops: { run: { input: Schema.Unknown, output: Schema.Unknown } } } })
const empty = defineSurface({})

test("a released retained ticket remains closed when a provider returns with fresh handlers", async () => {
  const invoked: string[] = []
  const make = (name: string) => implementSurface(contract, { procedures: { ops: { run: () => Effect.gen(function*() {
    const authority = yield* RequestAuthority
    if ((authority.rule as SessionRule)._tag === "closed") return yield* Effect.die(new Error("released credential"))
    invoked.push(`${name}:${authority.writer}`)
    return {}
  }) } } })
  const first = make("first"), second = make("second"), absent = implementSurface(empty, {})
  const face = exposeFace(contract, { "ops.run": "tool" })
  let active: Bound & { expose: FaceExposure } = { ...first, expose: face, writes: ["surface/ops/run"] }
  let bearer: string | null = null
  const tickets = ticketing({ reservations: [], bound: () => active, face: () => active.expose, ops: liveOps(() => undefined), token: "operator", currentTicket: () => bearer })
  const panel = liveClient(() => active, { writer: "mcp" })
  const one = tickets.mint(() => [], "chat-agent")
  bearer = one.bearer
  const retained = tickets.doorAt(panel)
  const write = () => retained.surface.ops.run({ op: "title", id: "seat", title: "change" })
  try {
    await Effect.runPromise(write())
    active = { ...absent, expose: exposeFace(empty, {}), writes: [] }
    await first.close()
    await expect(Effect.runPromise(write())).rejects.toThrow("capability")
    one.release()
    active = { ...second, expose: face, writes: ["surface/ops/run"] }
    await expect(Effect.runPromise(write())).rejects.toThrow("released credential")
    const next = tickets.mint(() => [], "chat-agent")
    bearer = next.bearer
    await Effect.runPromise(tickets.doorAt(panel).surface.ops.run({ op: "title", id: "seat", title: "fresh" }))
    expect(invoked).toEqual(["first:chat-agent", "second:chat-agent"])
    next.release()
  } finally { await Promise.all([first.close(), second.close(), absent.close()]) }
})
