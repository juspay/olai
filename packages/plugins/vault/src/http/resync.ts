import { NO_DIRECTORY, type Ops, type Store } from "@olai/ops"
import type { PlatformFailure } from "@olai/store"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"

import { fromLoopback } from "@olai/plugin-api/http"

export const RESYNC_PATH = "/olai/resync"

export const resyncDirectory = (
  currentDirectory: () => { readonly store: Pick<Store, "refresh"> } | undefined,
  currentGate: () => Pick<Ops, "idle"> | undefined,
) => Effect.gen(function*() {
  const directory = currentDirectory()
  const gate = currentGate()
  if (!directory || !gate) return yield* Effect.fail(NO_DIRECTORY)
  yield* gate.idle
  if (currentDirectory() !== directory || currentGate() !== gate) return yield* Effect.fail(NO_DIRECTORY)
  yield* directory.store.refresh("verified")
})

export const resyncRoute = (
  resync: Effect.Effect<void, PlatformFailure | { readonly reason: string }>,
) =>
  HttpRouter.add(
    "POST",
    RESYNC_PATH,
    (request: HttpServerRequest.HttpServerRequest) =>
      Effect.gen(function*() {
        const remote = request.remoteAddress
        if (!Option.isSome(remote) || !fromLoopback(remote.value)) {
          return HttpServerResponse.text("loopback only", { status: 403 })
        }
        const ran = yield* Effect.result(resync)
        if (ran._tag === "Failure") {
          return HttpServerResponse.text("message" in ran.failure ? ran.failure.message : ran.failure.reason, { status: 500 })
        }
        return HttpServerResponse.empty({ status: 204 })
      }),
  )
