import { serviceTag } from "./index.ts"
import type { Effect, FileSystem, Layer, Path, Scope } from "effect"
import type { HttpPlatform, HttpRouter, HttpServerRequest } from "effect/http"
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
   * per call. A tool is offered because the row that owns it is HERE, and it
   * leaves when that row does.
   *
   * `surface`, `resources` and `tools` are opaque on this side of the wall:
   * each is built against the row's own spec, in the row's own package. A row
   * is entered with `{}` for `resources` when it publishes nothing
   * addressable.
   */
  readonly agentRows: () => ReadonlyArray<{
    readonly name: string
    readonly surface: { readonly spec: unknown }
    readonly resources: Readonly<Record<string, unknown>>
    readonly tools: ReadonlyArray<unknown>
    readonly charter?: string
  }>
  /**
   * ...AND A BELL WHEN THE COMPOSED ROSTER MOVES. Rung at the TAIL of a
   * recompose, after every mount, every drop and the gate, so a listener
   * reading {@link agentRows} sees the generation that has just been
   * published. Returns its own removal, and a caller registers it on its
   * scope.
   */
  readonly agentRosterMoved: (run: () => void) => () => void
  /** Static owner declarations remain reserved while an owner is disabled. */
  readonly writeReservations: readonly { readonly key: string; readonly says: string; readonly file?: string }[]
}
export const TransportSurface = serviceTag<TransportSurface>("transport-surface")
