/**
 * WHAT ONE CONNECTION'S SERVING STACK LOGS UNDER — the serve's own logging
 * layer, the connection named on every line, and a reporter that says each
 * failed call. Wiring, beside the serve that builds it; how the lines read is
 * `./report.ts`'s.
 *
 * kolu builds each connection's RPC server on Effect's default runtime, so
 * without this a handler's `Effect.log*` and Effect RPC's own lines (a protocol
 * crash) would bypass the serve's level, format and annotations, and a failed
 * call — reported, never logged — would be said nowhere. The reporter emits
 * under the reporting fiber's own services, so its line carries what every
 * other line here does. `ErrorReporter.make` keeps Effect's own rules: it skips
 * interrupts and never reports one failure twice.
 *
 * The annotations replace rather than add to the ones in force where the serve
 * set them, which is why `annotations` (the serve's `root`) is passed in. Made
 * per call, so the reporter belongs to this connection and is released with
 * its serving scope.
 */
import type { SurfaceAppConnection } from "@kolu/surface-app/serve"
import { emitterOf } from "@olai/log"
import { ErrorReporter, Layer, References } from "effect"
import { connectionFields, failedCall } from "./report.ts"

export const connectionLogging = (
  connection: SurfaceAppConnection<string>,
  logging: Layer.Layer<never>,
  annotations: Readonly<Record<string, unknown>>,
): Layer.Layer<never> =>
  Layer.mergeAll(
    logging,
    Layer.succeed(References.CurrentLogAnnotations)({ ...annotations, ...connectionFields(connection) }),
    ErrorReporter.layer([ErrorReporter.make(({ cause, error, fiber }) => emitterOf(fiber)(failedCall(cause, error)))]),
  )
