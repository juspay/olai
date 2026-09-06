/**
 * A RELEASED TICKET STAYS FENCED — over a rooted bundle, which is the only part
 * of this case that changed.
 *
 * The claim is exactly what it was: a door minted for a session goes on
 * refusing after that session is released, even when the provider behind it
 * RETURNS with fresh handlers, because the fence rides the writer and is read
 * per call rather than captured when the door was built. What used to hold it
 * was one flat client (`liveClient`) over bare tags and a `route` handed into
 * `ticketing`. juspay/kolu#2234 replaced both: the door is a
 * `RootedSurfaceClients` with one client per standing row, and `ticketing` takes
 * `rows` so a fenced bundle carries a client for exactly the siblings the
 * unfenced one does. So the call is
 * `panel.clients!.outlines!.surface.ops.run(…)` rather than
 * `panel.surface.ops.run(…)` — a member is addressed through the row that
 * declares it now, and there is no un-prefixed namespace left to address it in.
 */
import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { exposeRootedFaces, type FaceExposure } from "@kolu/surface/expose"
import { implementRootedSurfaces } from "@kolu/surface/server"
import type { RootedSurfaceClients } from "@kolu/surface/client"
import { Effect, Schema } from "effect"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { liveOps, type Fence } from "@olai/ops"
import { ticketing } from "./tickets.ts"
import { clientsFor, type Row } from "./bundle.ts"
import type { Bound } from "./authority.ts"

/** One row's STANDALONE spec, mounted under the key its client is built for. */
const contract = defineSurface({ procedures: { ops: { run: { input: Schema.Unknown, output: Schema.Unknown } } } })
/** No core — core's members are on no agent face. */
const core = defineSurface({})
const ROW = "outlines"

/** A generation that either serves the row or does not, so "the row left" is a
 *  roster the bundle is read out of rather than a flag. */
const generation = (name: string, mounted: boolean) => {
  const invoked: string[] = []
  const runtime = implementRootedSurfaces(core, {}, {})
  if (mounted) {
    runtime.mount(ROW, contract, {
      procedures: { ops: { run: () => Effect.gen(function*() {
        const authority = yield* RequestAuthority
        if ((authority.fence as Fence).under === null) return yield* Effect.die(new Error("released credential"))
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
    /** The rows this generation is standing — what `ticketing` mints a bundle
     *  from, and what makes a departed row ABSENT from `clients` rather than
     *  present and unserved. Nothing here publishes a `surface://` resource. */
    rows: (): ReadonlyArray<Row> =>
      mounted ? [{ name: ROW, surface: contract, resources: {}, tools: [] }] : [],
    bound: (): Bound & { readonly expose: FaceExposure } => ({
      group: runtime.group,
      handlers: runtime.handlers,
      // Scoped, as the composition root scopes a row's declared writes.
      writes: mounted ? [`surface/${ROW}/ops/run`] : [],
      expose,
    }),
  }
}

/** The one call every step below makes, through whichever door it was handed. */
const run = (door: RootedSurfaceClients, title: string) =>
  door.clients![ROW]!.surface.ops!.run!({ op: "title", id: "seat", title })

test("a released retained ticket remains fenced when a provider returns with fresh handlers", async () => {
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
  const panel = () => clientsFor(live.rows(), () => live.bound(), { writer: "mcp", fence: null })
  const one = tickets.mint(() => ({ under: "seat", forbidden: [] }), () => null, "chat-agent")
  bearer = one.bearer
  // RETAINED ACROSS EVERY GENERATION BELOW, which is the whole point: the door
  // is built once, here, and each of the three claims is about what it does
  // afterwards.
  const retained = tickets.doorAt(panel())
  try {
    await Effect.runPromise(run(retained, "change"))

    // The row leaves. Its client is still IN the retained bundle — that is what
    // "retained" means — but the generation it dispatches into serves nothing at
    // that tag, so the refusal is the absent capability's.
    live = absent
    await first.close()
    await expect(Effect.runPromise(run(retained, "change"))).rejects.toThrow("capability")

    // The ticket is released and the provider RETURNS. Fresh handlers, the same
    // held door — and the fence, read per call off the writer, is what refuses.
    one.release()
    live = second
    await expect(Effect.runPromise(run(retained, "change"))).rejects.toThrow("released credential")

    // ...and a NEW ticket over the same live generation writes, so the refusal
    // above was about the released credential rather than about anything having
    // gone stale.
    const next = tickets.mint(() => ({ under: "seat", forbidden: [] }), () => null, "chat-agent")
    bearer = next.bearer
    await Effect.runPromise(run(tickets.doorAt(panel()), "fresh"))
    expect([...first.invoked, ...second.invoked]).toEqual(["first:chat-agent", "second:chat-agent"])
    next.release()
  } finally {
    await Promise.all([first.close(), second.close(), absent.close()])
  }
})
