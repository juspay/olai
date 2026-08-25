/**
 * `POST /olai/resync` — look at the disk NOW, ignoring mtime+size stamps.
 *
 * The store is entitled not to notice a same-length rewrite that landed in
 * the same second: stamps are coarse on purpose, and for a change that
 * arrived from OUTSIDE that is the accepted trade (`@olai/store`'s probe).
 * An operator who just `git checkout`ed, or a test harness putting a fixture
 * back under a still-running server, cannot take that trade — the next
 * reader would be looking at a frame nobody can reproduce.
 *
 * `Store.resync` is the signal the store already honours for this (forget
 * every cached stamp, then probe, and do not return until published). The
 * Effect this route is handed also waits for in-flight writes first
 * (`Ops.idle`, composed in `serve.ts`): a look at the disk while a write
 * is still staging is a look at `.olai-*.tmp`, not at the tree the next
 * reader will be served. This route is that Effect on the listener, not a
 * test-only door: the product owns the trade, so the product owns the
 * override.
 * Loopback only — the same locality bar `/mcp` uses for a missing bearer —
 * because forcing a re-read is not a write, but it is not a page's to ask
 * either.
 */

import type { PlatformFailure } from "@olai/store"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

import { fromLoopback } from "./mcp/route.ts"

/** Where the route lives. Named once: the e2e harness POSTs the same path. */
export const RESYNC_PATH = "/olai/resync"

export const resyncRoute = (
  resync: Effect.Effect<void, PlatformFailure>,
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
          return HttpServerResponse.text(ran.failure.message, { status: 500 })
        }
        return HttpServerResponse.empty({ status: 204 })
      }),
  )
