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
  readonly agent: () => ServedGeneration & { readonly expose: NonNullable<ServedGeneration["expose"]>; readonly writes: readonly string[] }
  /**
   * Which rows are standing and what agent verbs each brought — read afresh,
   * per call. `surface`, `resources` and `tools` are opaque on this side of the
   * wall: each is built against the row's own spec, in the row's own package. A
   * row is entered with `{}` for `resources` when it publishes nothing
   * addressable.
   */
  readonly agentRows: () => ReadonlyArray<{
    readonly name: string
    readonly surface: { readonly spec: unknown }
    readonly resources: Readonly<Record<string, unknown>>
    readonly tools: ReadonlyArray<unknown>
    readonly charter?: string
  }>
  readonly agentRosterMoved: (run: () => void) => () => void
  /** Static owner declarations remain reserved while an owner is disabled. */
  readonly writeReservations: readonly { readonly key: string; readonly says: string; readonly file?: string }[]
}
export const TransportSurface = serviceTag<TransportSurface>("transport-surface")
