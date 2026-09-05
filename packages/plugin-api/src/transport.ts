/** Server-only listener contributions and the core policy they are served over.
 * A registration carries behavior, never a transport name or an enable flag. */
import { serviceTag } from "./index.ts"
import type { Effect, FileSystem, Layer, Path, Scope } from "effect"
import type { HttpPlatform, HttpRouter, HttpServerRequest } from "effect/unstable/http"
import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"
import type { ClientOrConnection } from "@kolu/surface-mcp"
import type { ExposeMap } from "@kolu/surface/expose"
import type { ServeSurfaceAppOptions, SurfaceAppConnection, SurfaceAppEvent } from "@kolu/surface-app/serve"
import type { CommitRequest, CommitResult, PushResult } from "@olai/format"
import type { Vintage } from "@olai/store"

export type Routes = Layer.Layer<never, never, HttpRouter.HttpRouter | FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform | HttpRouter.Request<"Error", unknown>>
export interface ListenerContribution {
  readonly routes?: Routes
  readonly upgrade?: {
    readonly path: string
    readonly handle: (request: IncomingMessage, socket: Duplex, head: Buffer) => void
  }
}
export interface AgentBinding {
  readonly client: () => ClientOrConnection
  readonly expose: ExposeMap
  readonly root: string
  readonly vintage: Effect.Effect<Vintage | undefined>
  readonly fenced: (client: ClientOrConnection) => ClientOrConnection
  readonly record: (request: CommitRequest) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
}
export interface TransportSurface {
  /** Acquisitions are independent; each scope withdraws only what it added. */
  readonly register: (contribution: ListenerContribution) => Effect.Effect<void, never, Scope.Scope>
  readonly routes: Routes
  readonly live: NonNullable<ServeSurfaceAppOptions<unknown, string>["live"]>
  readonly services: (connection: SurfaceAppConnection<string>) => Layer.Layer<never>
  readonly upgradeHeaders: () => ReadonlyArray<string>
  readonly allowedOrigins: ReadonlyArray<string>
  readonly report: (event: SurfaceAppEvent<string>) => void
  readonly who: (headers: HttpServerRequest.HttpServerRequest["headers"]) => { readonly login: string } | null
  readonly clientDist: Effect.Effect<string>
  readonly hostname: string
  readonly token: string
  /** Bind core's writer and ticket fence; the plugin projects them onto tools. */
  readonly prepareAgent: (ticket: () => string | null) => Effect.Effect<AgentBinding, never, Scope.Scope>
}
export const TransportSurface = serviceTag<TransportSurface>("transport-surface")
