/**
 * `/media/*` — the files of the served directory a browser may fetch, and
 * nothing else.
 *
 * A document is markdown in the served directory, so `![](shot.png)` means a
 * file beside it. A `.html` in the same directory is a PAGE, drawn in a frame
 * whose `src` is this route, so `<img src="art/shot.png">` and
 * `<a href="other.html">` in it mean files beside IT. The browser cannot read
 * any of those; it can only ask for a URL. This route is that URL, and it is
 * the ONE place bytes leave the served directory over HTTP without having gone
 * through the store.
 *
 * It is three decisions and one mechanism of its own:
 *
 *   - WHETHER to answer is `@olai/surface`'s `mediaTarget` — the traversal
 *     guard and the allowlist, written against the same bijection the client
 *     builds these URLs with. What the allowlist admits is `@olai/format`'s
 *     `isAsset`: a page, a picture, a stylesheet, a script, a font;
 *   - WHAT A PAGE IS ANSWERED WITH is the SEAL (`@olai/surface`'s `seal.ts`,
 *     where the whole security argument is written and where a reviewer should
 *     start): a content policy on the RESPONSE, and the tape measure in front
 *     of the file's own bytes. That is this route's only real work, and it is
 *     below;
 *   - HOW to answer everything else is the platform's own file engine
 *     (`HttpStaticServer`), which the bundle beside us is already served by.
 *     Reading a file under a root is not a thing to hand-roll twice in one
 *     process: the engine owns the stat, the directory case, the MIME type, the
 *     byte ranges and the conditional `304` a browser asks for on every second
 *     look at a picture.
 *
 * WHY A PAGE CANNOT GO THROUGH THE ENGINE, since everything else does. The seal
 * is a prefix — the response is the tape measure and then the file, byte for
 * byte — so the response is not the file's length and cannot honestly claim to
 * be a range of it. A `Range` request answered by the engine and a prefix added
 * afterwards would be two bytes ranges of two different documents. So a page is
 * read whole and answered whole, with no `Accept-Ranges`, no `ETag` and no
 * `304`: a preview is opened by a person and is not a video being scrubbed.
 *
 * Every way a file is not there is one 404. The reader asked for something and
 * there is not one; which of the ways it is missing is not their business, and
 * saying would describe the disk to anybody who can reach the port.
 *
 * The guard is LEXICAL, and deliberately: it stops a URL from naming a file
 * outside the directory. It does not chase a symlink that a person put inside
 * their own outline directory and pointed elsewhere — that is a file they
 * placed there, in a tree they are already serving whole.
 */

import { fileKind } from "@olai/format"
import { MEDIA_PREFIX, mediaTarget, SEAL, sealPolicy } from "@olai/surface"
import { Effect, FileSystem } from "effect"
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
        // miss here is a miss. This route answers with a file or with 404.
        HttpStaticServer.make({ root, index: undefined, spa: false }),
      )
      const disk = yield* FileSystem.FileSystem

      yield* router.add(
        "GET",
        `${MEDIA_PREFIX}*`,
        (request: HttpServerRequest.HttpServerRequest) =>
          Effect.gen(function*() {
            const target = mediaTarget(request.url)
            if (target === null) return missing

            if (fileKind(target) === "hypertext") return yield* page(disk, root, target, request)

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

/** One answer for every way a file is not there. */
const missing = HttpServerResponse.empty({ status: 404 })

/** A checked target, as the URL the file engine resolves under the root. */
const served = (target: string): string =>
  `/${target.split("/").map(encodeURIComponent).join("/")}`

/** The seal's prefix as the bytes it is, encoded ONCE rather than per request:
 *  it is a constant, and a preview of a megabyte file should not pay for
 *  re-encoding half a kilobyte of ours. */
const PREFIX = new TextEncoder().encode(SEAL)

/**
 * A served `.html`, as the response a preview frame is pointed at.
 *
 * The POLICY is the whole of the seal that is not prefixed bytes, and it is
 * derived from the request's own `Host` — the only host that can be right,
 * since a policy names an origin and the origin the browser compares it against
 * is the one the browser asked for. `@olai/surface`'s `sealPolicy` is what
 * judges that header and what fails closed on a shape it will not spell.
 *
 * The other three headers are each one sentence:
 *
 *   - `Content-Type` carries the charset, so the file's own `<meta charset>`
 *     never has to be found — which matters because the prefix would push it
 *     past the 1024 bytes a parser looks in. UTF-8 is what the rest of olai
 *     already reads a served file as (`@olai/store` decodes one to text), so
 *     this says out loud what was already assumed;
 *   - `nosniff`, because a response this app declares as a document must not be
 *     re-decided by a browser's content sniffer;
 *   - `no-store`, because the file changes on disk and the frame is re-pointed
 *     at the same URL when it does. A cached preview would be the older file
 *     with a live page's confidence.
 *
 * `Referrer-Policy` is the fourth and it belongs to the promise rather than to
 * the mechanics: what the page fetches afterwards must not carry which page of
 * this vault a reader is on, and the frame element says the same thing about
 * this request itself (`Hypertext.tsx`).
 */
const page = (
  disk: FileSystem.FileSystem,
  root: string,
  target: string,
  request: HttpServerRequest.HttpServerRequest,
) =>
  disk.readFile(`${root}/${target}`).pipe(
    Effect.map((bytes) => {
      const body = new Uint8Array(PREFIX.length + bytes.length)
      body.set(PREFIX)
      body.set(bytes, PREFIX.length)
      return HttpServerResponse.uint8Array(body, {
        contentType: "text/html; charset=utf-8",
        headers: {
          "content-security-policy": sealPolicy(request.headers["host"] ?? ""),
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
          "cache-control": "no-store",
        },
      })
    }),
    // A file that was listed a moment ago and cannot be read now is a file that
    // is not there, answered exactly like one that never was.
    Effect.orElseSucceed(() => missing),
  )
