import { servingOf, type Claims } from "@olai/format"
import {
  MEDIA_PREFIX,
  mediaTarget,
  REFUSED_MARKUP,
  SEAL,
  sealPolicy,
  spellsHost,
} from "@olai/surface"
import { vanished } from "@olai/store"
import { Effect, FileSystem, type PlatformError, Stream } from "effect"
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from "effect/http"

/** `HttpRouter` ranks by specificity, so this beats the client bundle's
 *  `GET /*` catch-all whichever order the layers are merged in. */
export const mediaLayer = (root: string, table: () => Claims) =>
  HttpRouter.use((router) =>
    Effect.gen(function*() {
      const files = yield* Effect.orDie(
        HttpStaticServer.make({ root, index: undefined, spa: false }),
      )
      const disk = yield* FileSystem.FileSystem

      yield* router.add(
        "GET",
        `${MEDIA_PREFIX}*`,
        (request: HttpServerRequest.HttpServerRequest) =>
          Effect.gen(function*() {
            const claims = table()
            const target = mediaTarget(claims, request.url)
            if (target === null) return missing

            if (servingOf(claims, target).sealed) {
              return yield* page(disk, root, target, request.headers["host"] ?? "", [...claims.byExt.keys()])
            }

            return yield* files.pipe(
              Effect.provideService(
                HttpServerRequest.HttpServerRequest,
                request.modify({ url: served(target) }),
              ),
              Effect.map((response) =>
                HttpServerResponse.setHeaders(
                  response,
                  servingOf(claims, target).inert ? INERT : NOSNIFF,
                )
              ),
              Effect.orElseSucceed(() => missing),
            )
          }),
      )
    })
  )

const missing = HttpServerResponse.empty({ status: 404 })

const NOSNIFF = { "x-content-type-options": "nosniff" } as const

/** A CSP header is ignored on a response the browser loads as an IMAGE, so
 *  this costs the `<img>` path nothing; an SVG opened as a DOCUMENT is put in
 *  an opaque origin with `allow-scripts` withheld. */
const INERT = {
  "content-security-policy": "default-src 'none'; sandbox",
  "x-content-type-options": "nosniff",
} as const

const served = (target: string): string =>
  `/${target.split("/").map(encodeURIComponent).join("/")}`

const prefix = (extensions: ReadonlyArray<string>) => new TextEncoder().encode(SEAL(extensions))

const REFUSED = new TextEncoder().encode(REFUSED_MARKUP)

const sealedHeaders = (host: string) => ({
  "content-security-policy": sealPolicy(host),
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
})

/** `BadResource` is what the file API reports when a path COMPONENT is not a
 *  directory — `/media/notes/finishes.md/x.html` — which is a miss rather than
 *  a file that will not open. */
const willNotOpen = (failure: PlatformError.PlatformError): boolean =>
  !vanished(failure) && failure.reason._tag !== "BadResource"

/** `Content-Type` carries the charset because the seal prefix would push the
 *  file's own `<meta charset>` past the 1024 bytes a parser looks in. A module
 *  script, `import()` and `fetch` are CORS-mode always, so inside the opaque
 *  origin `sandbox` mints they would need `Access-Control-Allow-Origin: null`,
 *  which grants every sandboxed frame; an inline or classic `<script src>` is
 *  fetched `no-cors` and runs. */
const page = (
  disk: FileSystem.FileSystem,
  root: string,
  target: string,
  host: string,
  extensions: ReadonlyArray<string>,
) =>
  Effect.gen(function*() {
    if (!spellsHost(host)) {
      yield* Effect.annotateLogs(
        Effect.logWarning(
          "a preview was asked for on a host this server will not spell, so its " +
            "policy allows nothing to be fetched at all",
        ),
        { host, file: target },
      )
    }
    const bytes = yield* disk.readFile(`${root}/${target}`)
    return HttpServerResponse.stream(Stream.fromIterable([prefix(extensions), bytes]), {
      contentType: "text/html; charset=utf-8",
      headers: sealedHeaders(host),
    })
  }).pipe(
    Effect.tapError((failure) =>
      willNotOpen(failure)
        ? Effect.annotateLogs(
          Effect.logWarning(`olai server: ${failure.message}`),
          { file: target },
        )
        : Effect.void
    ),
    Effect.catchIf(
      willNotOpen,
      () =>
        Effect.succeed(
          HttpServerResponse.stream(Stream.fromIterable([prefix(extensions), REFUSED]), {
            contentType: "text/html; charset=utf-8",
            headers: sealedHeaders(host),
          }),
        ),
    ),
    Effect.orElseSucceed(() => missing),
  )
