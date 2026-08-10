/**
 * `/media/*` — the pictures a document points at, and nothing else.
 *
 * A document is markdown in the served directory, so `![](shot.png)` means a
 * file beside it. The browser cannot read that file; it can only ask for a URL.
 * This route is that URL, and it is the ONE place bytes leave the served
 * directory over HTTP without having gone through the store.
 *
 * It is two decisions and no mechanism of its own:
 *
 *   - WHETHER to answer is `@olai/surface`'s `mediaTarget` — the traversal
 *     guard and the picture allowlist, written against the same bijection the
 *     client's renderer builds these URLs with. That is the only part of this
 *     route that is olai's;
 *   - HOW to answer is the platform's own file engine (`HttpStaticServer`),
 *     which the bundle beside us is already served by. Reading a file under a
 *     root is not a thing to hand-roll twice in one process: the engine owns
 *     the stat, the directory case, the MIME type, the byte ranges and the
 *     conditional `304` a browser asks for on every second look at a picture.
 *
 * Every way a picture is not there is one 404. The reader asked for a picture
 * and there is not one; which of the ways it is missing is not their business,
 * and saying would describe the disk to anybody who can reach the port.
 *
 * The guard is LEXICAL, and deliberately: it stops a URL from naming a file
 * outside the directory. It does not chase a symlink that a person put inside
 * their own outline directory and pointed elsewhere — that is a file they
 * placed there, in a tree they are already serving whole.
 */

import { MEDIA_PREFIX, mediaTarget } from "@olai/surface"
import { Effect } from "effect"
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from "effect/unstable/http"

/**
 * The route, over one served directory.
 *
 * `HttpRouter` ranks by specificity, so this beats the client bundle's `GET /*`
 * catch-all whichever order the layers are merged in — a picture request never
 * falls through to the SPA shell.
 */
export const mediaLayer = (root: string) =>
  HttpRouter.use((router) =>
    Effect.gen(function*() {
      // `orDie`: a file engine that cannot be built for the directory we were
      // told to serve is a misconfiguration, not a degraded mode.
      const files = yield* Effect.orDie(
        // No index and no SPA fallback: those turn a miss into a page, and a
        // miss here is a miss. This route answers with a picture or with 404.
        HttpStaticServer.make({ root, index: undefined, spa: false }),
      )

      yield* router.add(
        "GET",
        `${MEDIA_PREFIX}*`,
        (request: HttpServerRequest.HttpServerRequest) =>
          Effect.gen(function*() {
            const target = mediaTarget(request.url)
            if (target === null) return missing

            // Handed to the engine as a path of its own, re-encoded because
            // that is what it takes: `mediaTarget` decoded the URL to judge it,
            // and the engine decodes what it is given.
            return yield* files.pipe(
              Effect.provideService(
                HttpServerRequest.HttpServerRequest,
                request.modify({ url: served(target) }),
              ),
              // The engine's own misses come back as failures; they are this
              // route's 404 rather than the router's error page.
              Effect.orElseSucceed(() => missing),
            )
          }),
      )
    })
  )

/** One answer for every way a picture is not there. */
const missing = HttpServerResponse.empty({ status: 404 })

/** A checked target, as the URL the file engine resolves under the root. */
const served = (target: string): string =>
  `/${target.split("/").map(encodeURIComponent).join("/")}`
