/**
 * WHERE A TAB'S CONNECTION DIARY LANDS — `POST /olai/diary`, which logs each
 * entry a tab posts beside the server's own account of the same socket.
 *
 * A tab says what happened to its connection in its own diary
 * (`@olai/web`'s `connection/diary.ts`) and posts it here over plain HTTP,
 * not over the socket it is reporting on: a socket that will not open cannot
 * carry the news that it will not open. Each entry is read by
 * `@olai/log/link`'s `describe` and said by {@link report}, with `side=browser`,
 * so the server's stdout is the one place to read both accounts.
 *
 * The door is a browser's, so it is gated like the websocket upgrade is: by
 * kolu's `isAllowedWsOrigin` over the same `allowedOrigins`, so one policy
 * decides both. A body is refused when it is over 64 KiB, when it is not a
 * batch (and is never echoed back or logged), and when the serve has taken
 * its ceiling of entries this minute; that last refusal is said once a minute.
 *
 * The route is core's own, registered passively on the serve's scope, not on
 * the `ws` row's: a tab's account matters most when its socket cannot open,
 * and the row being off is one way that happens. Its counter is the route's
 * own and lives as long as the serve that built it.
 */
import { isAllowedWsOrigin } from "@kolu/surface/ws-origin"
import type { Emit } from "@olai/log"
import { Batch, clip } from "@olai/log/link"
import { BROWSER_DIARY_PATH } from "@olai/plugin-api/mount"
import { Effect, Exit, Schema } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { report } from "./report.ts"

/** The largest body a tab may post: what `keepalive` and `sendBeacon` carry. */
export const DIARY_MAX_BYTES = 64 * 1024
/** How many entries the serve takes per {@link DIARY_WINDOW_MS}, from every tab
 *  together. */
export const DIARY_CEILING = 600
export const DIARY_WINDOW_MS = 60_000

const decode = Schema.decodeUnknownExit(Schema.fromJsonString(Batch))

export const diaryRoute = (options: {
  readonly allowedOrigins: ReadonlyArray<string>
  readonly say: Emit
  readonly now: () => number
}) => {
  const { say } = options
  let windowStart = Number.NEGATIVE_INFINITY
  let taken = 0
  let throttled = false

  const refuse = (status: number, why: string, origin?: string) => {
    report({ _tag: "DiaryRefused", why, ...(origin === undefined ? {} : { origin: clip(origin, 200) }) }, say)
    return HttpServerResponse.empty({ status })
  }

  return HttpRouter.add(
    "POST",
    BROWSER_DIARY_PATH,
    (request: HttpServerRequest.HttpServerRequest) =>
      Effect.gen(function*() {
        const origin = request.headers.origin
        if (!isAllowedWsOrigin({ origin, host: request.headers.host, allowedOrigins: options.allowedOrigins })) {
          return refuse(403, "origin", origin)
        }
        const length = Number(request.headers["content-length"])
        if (!Number.isFinite(length) || length > DIARY_MAX_BYTES) return refuse(413, "size")
        const text = yield* request.text
        if (text.length > DIARY_MAX_BYTES) return refuse(413, "size")
        const decoded = decode(text)
        if (Exit.isFailure(decoded)) return refuse(400, "malformed")
        const batch = decoded.value

        const at = options.now()
        if (at - windowStart >= DIARY_WINDOW_MS) {
          windowStart = at
          taken = 0
          throttled = false
        }
        if (taken + batch.entries.length > DIARY_CEILING) {
          if (!throttled) {
            throttled = true
            report({ _tag: "DiaryThrottled", ceiling: DIARY_CEILING, window: DIARY_WINDOW_MS }, say)
          }
          return HttpServerResponse.empty({ status: 429 })
        }
        taken += batch.entries.length

        if (batch.lost > 0) report({ _tag: "DiaryLost", tab: batch.tab, lost: batch.lost }, say)
        for (const entry of batch.entries) report({ _tag: "BrowserSaid", tab: batch.tab, entry }, say)
        return HttpServerResponse.empty({ status: 204 })
      }).pipe(Effect.catch(() => Effect.sync(() => refuse(400, "unreadable")))),
  )
}
