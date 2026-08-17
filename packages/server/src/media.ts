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
import { MEDIA_PREFIX, mediaTarget, SEAL, sealPolicy, spellsHost } from "@olai/surface"
import { vanished } from "@olai/store"
import { Effect, FileSystem, Stream } from "effect"
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

            if (fileKind(target) === "hypertext") {
              return yield* page(disk, root, target, request.headers["host"] ?? "")
            }

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
 *
 * WHICH OF A PAGE'S SCRIPTS ACTUALLY RUN, said here because this response is
 * what decides it and nothing else in the tree says it out loud:
 *
 *   - an INLINE `<script>` runs, and a CLASSIC `<script src="chart.js">` beside
 *     the page runs. A classic script is fetched in `no-cors` mode, so the
 *     opaque origin this document is in (the `sandbox` directive above) costs it
 *     nothing: the request goes out, this route answers it, the browser executes
 *     it. That is the ordinary saved page, and it is what the ruling of
 *     2026-08-16 was about;
 *   - a MODULE (`<script type="module">`, a dynamic `import()`) does NOT, and
 *     neither does `fetch`/`XMLHttpRequest`. Module scripts and `fetch` are
 *     CORS-mode requests always, and a request from an opaque origin needs an
 *     `Access-Control-Allow-Origin` to come back — this route sends none, so the
 *     browser discards the response. The page's console says the module was
 *     blocked by CORS; the file is not broken and the route is not failing.
 *
 * THAT IS ON PURPOSE, not an oversight to be patched the first time somebody's
 * bundle uses `type="module"`. A CORS grant is the one thing that would let a
 * document in there READ this vault's bytes as data rather than merely draw
 * them — every picture is drawable and no picture is readable today (a canvas
 * that draws one is tainted), and `fetch` over `/media/` would turn the route
 * into a file-reading API for whatever runs in the frame. The privacy promise
 * survives a page that draws; it is a different promise once a page can read.
 *
 * IF MODULES EVER BECOME REQUIRED — a saved export that will not run any other
 * way — the shape to reach for is NOT a blanket `Access-Control-Allow-Origin`,
 * on any value. It is: `Referrer-Policy: same-origin` on this response (so the
 * frame's own requests carry a `Referer`, which `no-referrer` deliberately
 * strips today), and then `Access-Control-Allow-Origin: null` answered ONLY to
 * a request whose `Referer` is this host's own `/media/` path. That grants the
 * read to documents this route itself served and to nobody else — `null` is the
 * origin EVERY opaque document sends, so granting it unconditionally grants it
 * to every sandboxed frame on the internet, which is the mistake this note
 * exists to stop. It would also cost the referrer half of the promise above,
 * and that trade should be made in the open rather than discovered.
 */
const page = (
  disk: FileSystem.FileSystem,
  root: string,
  target: string,
  host: string,
) =>
  Effect.gen(function*() {
    // SAID OUT LOUD, because the failure is otherwise invisible: a host this
    // app will not spell gets a policy with no sources in it, which is a
    // preview that draws no picture and runs no script of the page's own — and
    // nothing on screen, in the console or in the log would say why. It cannot
    // happen behind an ordinary browser; it can happen behind something that
    // rewrites `Host`, and that operator is exactly who needs the sentence.
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
    // TWO BUFFERS HANDED OVER, not one built out of both. The seal is a prefix,
    // so the obvious shape is to allocate the sum and copy each half into it —
    // which is a second whole copy of a file this app assumes can be megabytes,
    // per open, per bounce and per revision, on a route that is answered
    // `no-store` and so never comes from a cache. A stream of the two pieces is
    // the same bytes in the same order for the same cost as the read alone.
    //
    // The file is still read WHOLE first, and that is deliberate rather than
    // lazy: a read that fails has to become a 404 before any header is sent,
    // and streaming the disk handle straight out would put that decision after
    // the response had already started.
    return HttpServerResponse.stream(Stream.fromIterable([PREFIX, bytes]), {
      contentType: "text/html; charset=utf-8",
      headers: {
        "content-security-policy": sealPolicy(host),
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
      },
    })
  }).pipe(
    // …AND IT IS SAID OUT LOUD when the file is THERE and will not open. That
    // used to be somebody else's line: the preview asked for this file's body
    // over the wire as well, and the reader that answered logged what the disk
    // said (`./bodies.ts`). It does not ask any more — a preview costs a
    // revision now — so the only process left that ever opens a saved page for
    // a person is this route, and a permission bit nobody can see is exactly
    // the failure this app's log rule exists for. It is `bodies.ts`'s sentence,
    // deliberately: one story, told the same way, wherever the read happened.
    //
    // A file that has GONE says nothing, and that is what {@link vanished}
    // decides — `@olai/store`'s own reading of the platform's error, because
    // the probe asks the identical question about the identical shape and two
    // spellings of it would disagree the day a platform renames the reason.
    // Nothing is owed for a miss: the reader asked for something that is not
    // there and the 404 says exactly that.
    Effect.tapError((failure) =>
      vanished(failure) ? Effect.void : Effect.annotateLogs(
        Effect.logWarning(`olai server: ${failure.message}`),
        { file: target },
      )
    ),
    // A file that cannot be read is answered exactly like one that never was:
    // which of the ways it is missing is not the reader's business, and saying
    // would describe the disk to anybody who can reach the port.
    Effect.orElseSucceed(() => missing),
  )
