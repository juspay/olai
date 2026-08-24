/**
 * `/media/*` — the files of the served directory a browser may fetch, and
 * nothing else.
 *
 * A document is markdown in the served directory, so `![](shot.png)` means a
 * file beside it. A `.html` in the same directory is a PAGE, drawn in a frame
 * whose `src` is this route, so `<img src="art/shot.png">` and
 * `<a href="other.html">` in it mean files beside IT. A picture and a `.pdf`
 * are pages of their own, drawn by pointing an `<img>` and an `<object>` here.
 * The browser cannot read any of those; it can only ask for a URL. This route
 * is that URL, and it is the ONE place bytes leave the served directory over
 * HTTP without having gone through the store.
 *
 * It is three decisions and one mechanism of its own:
 *
 *   - WHETHER to answer is `@olai/surface`'s `mediaTarget` — the traversal
 *     guard and the allowlist, written against the same bijection the client
 *     builds these URLs with. What the allowlist admits is `@olai/format`'s
 *     `isAsset`: every file whose PAGE is drawn by pointing at it — a saved
 *     page, a picture, a `.pdf` — and the parts a saved page draws itself with,
 *     a stylesheet, a script, a font;
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
 * WHAT DOES GO THROUGH THE ENGINE and still gets a word from this route is an
 * `.svg` — the engine's whole answer, with two headers added that make the file
 * inert if anybody reaches it as a document rather than as a picture
 * ({@link INERT}, which is where that argument is written).
 *
 * WHY A PAGE CANNOT GO THROUGH THE ENGINE, since everything else does. The seal
 * is a prefix — the response is the tape measure and then the file, byte for
 * byte — so the response is not the file's length and cannot honestly claim to
 * be a range of it. A `Range` request answered by the engine and a prefix added
 * afterwards would be two bytes ranges of two different documents. So a page is
 * read whole and answered whole, with no `Accept-Ranges`, no `ETag` and no
 * `304`: a preview is opened by a person and is not a video being scrubbed.
 *
 * Every way a file is not THERE is one 404. The reader asked for something and
 * there is not one; which of the ways it is missing is not their business, and
 * saying would describe the disk to anybody who can reach the port. A file
 * that is there and will not OPEN is the other sentence: a sealed page that
 * says so, the same story `./bodies.ts` tells on the wire.
 *
 * The guard is LEXICAL, and deliberately: it stops a URL from naming a file
 * outside the directory. It does not chase a symlink that a person put inside
 * their own outline directory and pointed elsewhere — that is a file they
 * placed there, in a tree they are already serving whole.
 */

import { fileKind, SVG_EXT } from "@olai/format"
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
              // ...with a word from this route on top of it: every answer says
              // {@link NOSNIFF}, and an SVG comes back DEFANGED besides (see
              // {@link INERT}). It is a map over the engine's own response
              // rather than a second reader of the file, so the stat, the MIME
              // type, the range and the `304` are all still the engine's.
              Effect.map((response) =>
                HttpServerResponse.setHeaders(
                  response,
                  target.endsWith(SVG_EXT) ? INERT : NOSNIFF,
                )
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

/**
 * What EVERY file the engine answers is told about its own type: do not
 * re-decide it.
 *
 * The engine names a type from the suffix, and a content sniffer is a second
 * reader of the same bytes that may reach a different answer — which for a
 * polyglot (a file that is a valid `.png` and valid HTML at once) is the answer
 * an attacker chose. Modern browsers do not sniff `application/pdf` or
 * `image/png` into a document, so this is a belt rather than a demonstrated
 * hole; it costs one header, it is what the sealed page and the SVG already
 * say, and a route where two of the answers carry it and the rest do not is a
 * route somebody has to remember the rule for.
 */
const NOSNIFF = { "x-content-type-options": "nosniff" } as const

/**
 * What an `.svg` is answered with, on top of whatever the file engine already
 * said about it — the other half of the picture kind's promise.
 *
 * An SVG is a DOCUMENT THAT CAN SCRIPT, and that is the whole of the problem
 * this closes. A picture's page draws one in an `<img>` (`@olai/web`'s
 * `Image.tsx`), which is the element that will not run it — but this route is a
 * URL, and a URL can be typed into an address bar, opened from a link, or
 * pulled into a frame by a previewed `.html` next door. Reached that way it is
 * a document of THIS ORIGIN: its script would run beside this app's own, with
 * this app's storage and this app's cookies, which is exactly what a file
 * somebody else wrote may never have. Until the viewers, an SVG was simply
 * refused by the allowlist, at the cost of refusing it to the `<img>` too.
 *
 * So the response says what the file may do, rather than the route saying who
 * may ask for it:
 *
 *   - `sandbox` with nothing granted puts a document parsed from these bytes in
 *     an OPAQUE ORIGIN — no storage, no cookies, no reach into anything of
 *     ours, and `allow-scripts` withheld, so nothing in it runs at all. It is
 *     the same directive the saved-page seal spends, at its strictest
 *     (`@olai/surface`'s `seal.ts`);
 *   - `default-src 'none'` is the belt to that brace: nothing is fetched even
 *     if a browser one day parses the file some other way;
 *   - `nosniff`, because a response this app declares as an image must not be
 *     re-decided by a content sniffer.
 *
 * A CSP header on a response the browser is loading as an IMAGE is ignored,
 * which is what makes this free: the picture page is unaffected, and the only
 * reader who meets these directives is the one who reached the URL as a
 * document — which is precisely the reader this is about.
 */
const INERT = {
  "content-security-policy": "default-src 'none'; sandbox",
  "x-content-type-options": "nosniff",
} as const

/** A checked target, as the URL the file engine resolves under the root. */
const served = (target: string): string =>
  `/${target.split("/").map(encodeURIComponent).join("/")}`

/** The seal's prefix as the bytes it is, encoded ONCE rather than per request:
 *  it is a constant, and a preview of a megabyte file should not pay for
 *  re-encoding half a kilobyte of ours. */
const PREFIX = new TextEncoder().encode(SEAL)

/** The refused page's own bytes, encoded once for the same reason: it is a
 *  constant, and a permission bit should not pay for re-encoding a sentence. */
const REFUSED = new TextEncoder().encode(REFUSED_MARKUP)

/** The headers a sealed page rides on — the same whether the bytes after the
 *  seal are the file or the refusal. A refused page is still a document of
 *  this vault (it greets, it measures), so the policy is the same policy. */
const sealedHeaders = (host: string) => ({
  "content-security-policy": sealPolicy(host),
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
})

/**
 * Whether a failed read is one an OPERATOR is owed a line about: the file is
 * THERE and will not open.
 *
 * The reader of a MISS is owed nothing — every way a file is not there is one
 * 404 (see the header) — so for a miss this decides the LOG and only the log.
 * A file that is there and will not open is answered with a sealed page, and
 * this still decides the log, because the two producers tell one story. It
 * exists because this route is the only process left that ever opens a saved
 * page for a person: the preview asked for the body over the wire as well until
 * the head member replaced it, and the reader that answered logged what the disk
 * said (`./bodies.ts`). That sentence needed a new home, and this is it.
 *
 * TWO reasons are not owed a line, and the second is the sharp one:
 *
 *   - `NotFound` is the ordinary miss, and it is `@olai/store`'s own reading of
 *     it ({@link vanished}) rather than a second spelling — the probe asks the
 *     identical question about the identical shape, and two spellings would
 *     disagree the day a platform renames the reason.
 *   - `BadResource` is what the platform says when a path COMPONENT is not a
 *     directory or the target is one — `/media/notes/finishes.md/x.html`, which
 *     is a URL anybody can type and which this route claims (the guard is
 *     lexical and the suffix is `.html`). That is a miss too: the path names no
 *     file. Logging it would let anyone who can reach the port write to this
 *     server's log as often as they like, with a path of their choosing in it,
 *     which is the one thing a log line derived from a request must not be.
 *
 * What is left is a file the directory really holds and the process cannot read:
 * a permission bit, an I/O error, a resource in use. Bounded by what is on the
 * disk rather than by what a stranger asks for, and exactly the failure this
 * app's never-silently-ignore rule is about.
 */
const willNotOpen = (failure: PlatformError.PlatformError): boolean =>
  !vanished(failure) && failure.reason._tag !== "BadResource"

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
      headers: sealedHeaders(host),
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
    // A file that is not THERE says nothing at all — see {@link willNotOpen},
    // which is the whole of the judgement and where the reasons are argued.
    Effect.tapError((failure) =>
      willNotOpen(failure)
        ? Effect.annotateLogs(
          Effect.logWarning(`olai server: ${failure.message}`),
          { file: target },
        )
        : Effect.void
    ),
    // A file that cannot be READ is answered with a sealed page that says so,
    // not with the 404 a miss gets. Which of the ways it is unavailable is
    // still not the reader's business — the sentence does not name the errno
    // — but that it is served and will not open is. A miss stays a miss.
    Effect.catchIf(
      willNotOpen,
      () =>
        Effect.succeed(
          HttpServerResponse.stream(Stream.fromIterable([PREFIX, REFUSED]), {
            contentType: "text/html; charset=utf-8",
            headers: sealedHeaders(host),
          }),
        ),
    ),
    Effect.orElseSucceed(() => missing),
  )
