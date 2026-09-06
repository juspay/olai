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
   * `surface` and `tools` are opaque on this side of the wall for the reason
   * `Sibling`'s are: a row's tools are built against the row's own spec, in the
   * row's own package, where the compiler can see both.
   */
  readonly agentRows: () => ReadonlyArray<{
    readonly name: string
    readonly surface: { readonly spec: unknown }
    readonly tools: ReadonlyArray<unknown>
  }>
  /**
   * ...AND EVERY VERB THIS BUILD HAS, standing or not, under its owner's name.
   *
   * The pair is not redundant, and which one a reader wants depends on whether
   * the question is about the ROSTER or about the BINARY. An MCP adapter takes
   * its tool record once and dispatches out of it forever, so a verb missing
   * from that record can never be called however its row comes and goes; the
   * list an agent is SHOWN is the live half, and that is {@link agentRows}.
   * `@olai/bundle`'s `tools.ts` argues it at length, and juspay/kolu#2233 is
   * what collapses the two back into one reading.
   *
   * AN EFFECT AND NOT A VALUE, because the registry loads the rows' tables
   * through a dynamic `import()`: a static one would put every row's verbs and
   * the whole ops layer behind them into the host's permanent entry closure,
   * which `@olai/bundle`'s `fence.test.ts` refuses. Read once, where the face
   * is built.
   */
  readonly agentTools: Effect.Effect<ReadonlyArray<{ readonly owner: string; readonly tools: ReadonlyArray<unknown> }>>
  /** Static owner declarations remain reserved while an owner is disabled. */
  readonly writeReservations: readonly { readonly key: string; readonly says: string }[]
}
export const TransportSurface = serviceTag<TransportSurface>("transport-surface")
