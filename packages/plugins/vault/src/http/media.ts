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

/**
 * The route, over one served directory.
 *
 * `HttpRouter` ranks by specificity, so this beats the client bundle's `GET /*`
 * catch-all whichever order the layers are merged in — a picture request never
 * falls through to the SPA shell.
 */
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

/**
 * What an `.svg` is answered with, on top of the file engine's own answer.
 *
 * An SVG reached as a DOCUMENT rather than through an `<img>` can script, in
 * this origin. `sandbox` with nothing granted puts it in an opaque origin with
 * `allow-scripts` withheld; a CSP header on a response the browser loads as an
 * IMAGE is ignored, so the picture page is unaffected.
 */
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

/**
 * Whether a failed read is one an operator is owed a log line about: the file
 * is THERE and will not open.
 *
 * `BadResource` is what the platform says when a path COMPONENT is not a
 * directory or the target is one — `/media/notes/finishes.md/x.html`, a URL
 * anybody can type and which this route claims. That is a miss: logging it
 * would let anyone who can reach the port write to the log at will.
 */
const willNotOpen = (failure: PlatformError.PlatformError): boolean =>
  !vanished(failure) && failure.reason._tag !== "BadResource"

/**
 * A served `.html`, as the response a preview frame is pointed at.
 *
 * `Content-Type` carries the charset because the seal prefix would push the
 * file's own `<meta charset>` past the 1024 bytes a parser looks in.
 *
 * WHICH OF A PAGE'S SCRIPTS RUN, since nothing else in the tree says it: an
 * inline `<script>` and a classic `<script src>` run — a classic script is
 * fetched `no-cors`, which the opaque origin costs nothing. A MODULE script,
 * a dynamic `import()` and `fetch`/`XMLHttpRequest` do not: those are CORS-mode
 * always, and an opaque origin needs an `Access-Control-Allow-Origin` this
 * route deliberately never sends — `null` is the origin every opaque document
 * sends, so granting it would grant every sandboxed frame on the internet a
 * read of this vault's bytes.
 */
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
