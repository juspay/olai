/** Server-only listener contributions and the core policy they are served over.
 * A registration carries behavior, never a transport name or an enable flag. */
import { serviceTag } from "./index.ts"
import type { Effect, FileSystem, Layer, Path, Scope } from "effect"
import type { HttpPlatform, HttpRouter, HttpServerRequest } from "effect/unstable/http"
import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"
import type { ServedGeneration } from "@kolu/surface/expose"
import type { SurfaceAppConnection, SurfaceAppEvent } from "@kolu/surface-app/serve"

export type Routes = Layer.Layer<never, never, HttpRouter.HttpRouter | FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform | HttpRouter.Request<"Error", unknown>>
export interface ListenerContribution {
  /** Supplemental routes use an existing transport; they never open a port. */
  readonly passive?: boolean
  readonly routes?: Routes
  readonly upgrade?: {
    readonly path: string
    readonly handle: (request: IncomingMessage, socket: Duplex, head: Buffer) => void
  }
}
export interface TransportSurface {
  /** Acquisitions are independent; each scope withdraws only what it added. */
  readonly register: (contribution: ListenerContribution) => Effect.Effect<void, never, Scope.Scope>
  readonly routes: Routes
  readonly live: () => ServedGeneration & { readonly expose: NonNullable<ServedGeneration["expose"]> }
  readonly services: (connection: SurfaceAppConnection<string>) => Layer.Layer<never>
  readonly upgradeHeaders: () => ReadonlyArray<string>
  readonly allowedOrigins: ReadonlyArray<string>
  readonly report: (event: SurfaceAppEvent<string>) => void
  readonly who: (headers: HttpServerRequest.HttpServerRequest["headers"]) => { readonly login: string } | null
  readonly clientDist: Effect.Effect<string>
  /** Authoritative selected browser-only rows, for boot before the socket opens. */
  readonly browserBoot?: () => ReadonlyArray<string>
  readonly hostname: string
  readonly token: string
  /** The composed agent generation; credential providers own attribution. */
  readonly agent: () => ServedGeneration & { readonly expose: NonNullable<ServedGeneration["expose"]>; readonly writes: readonly string[] }
  /**
   * WHICH ROWS ARE STANDING AND WHAT AGENT VERBS EACH BROUGHT — read afresh,
   * per call, for the reason every other reading of a live roster here is.
   *
   * THIS SLOT HELD `dispatch`, and the swap is #546. While six rows shared the
   * bare `surface/ops/run`, the composer published which VARIANTS of it were
   * live, and `olai-plugin-mcp` decided whether to advertise a write tool by
   * looking its `op` up in that table. Members carry their owner's name now, so
   * there is no shared tag to enumerate the owners of — and no filter to run
   * either: a tool is offered because the row that owns it is HERE, and it
   * leaves when that row does.
   *
   * `surface`, `resources` and `tools` are opaque on this side of the wall for
   * the reason `Sibling`'s are: a row's tools and its resource map are built
   * against the row's own spec, in the row's own package, where the compiler
   * can see both.
   *
   * `resources` RIDES ALONG BECAUSE THE BUNDLE IS BUILT FROM THIS READING.
   * `serveSurfaceAsMcp` takes a rooted bundle since juspay/kolu#2234 — one
   * entry per standing row, each its own surface beside its OWN expose map —
   * and there is no other live source for the second half. A row is entered
   * with `{}` when it publishes nothing addressable, which is most of them, and
   * `olai-plugin-mcp`'s `siblingsOf` leaves those out of the bundle.
   */
  readonly agentRows: () => ReadonlyArray<{
    readonly name: string
    readonly surface: { readonly spec: unknown }
    readonly resources: Readonly<Record<string, unknown>>
    readonly tools: ReadonlyArray<unknown>
  }>
  /**
   * ...AND A BELL WHEN THE COMPOSED ROSTER MOVES.
   *
   * A tab learns it from core's `plugins` cell and REDIALS. A face that is not
   * a wire client has no cell to watch, and a projecting one holds a RESOLVED
   * table — `serveSurfaceAsMcp` composes the resource URIs and the tool names
   * once and dispatches out of them — so it has to be handed a new roster in
   * place (`reroster`) rather than restarted, which would drop every open
   * subscription for a row it had nothing to do with.
   *
   * Rung at the TAIL of a recompose, after every mount, every drop and the
   * gate, so a listener reading {@link agentRows} sees the generation that has
   * just been published. Returns its own removal, and a caller registers it on
   * its scope like everything else here.
   */
  readonly agentRosterMoved: (run: () => void) => () => void
  /** Static owner declarations remain reserved while an owner is disabled. */
  readonly writeReservations: readonly { readonly key: string; readonly says: string }[]
}
export const TransportSurface = serviceTag<TransportSurface>("transport-surface")
