/**
 * `/media/*` — the pictures a document points at, and nothing else.
 *
 * A document is markdown in the served directory, so `![](shot.png)` means a
 * file beside it. The browser cannot read that file; it can only ask for a URL.
 * This route is that URL, and it is the ONE place bytes leave the served
 * directory over HTTP without having gone through the store.
 *
 * What it will answer is not decided here: `@olai/surface`'s `mediaTarget` is
 * the bijection the client's renderer writes against, and it is where the
 * traversal guard and the picture allowlist live. What is left for this file is
 * the disk — turn the name into a path under the root, refuse anything that is
 * not a readable file, and stream it.
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
import { Effect, FileSystem, Path, Result } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/**
 * The route, over one served directory.
 *
 * `HttpRouter` ranks by specificity, so this beats the client bundle's `GET /*`
 * catch-all whichever order the layers are merged in — a picture request never
 * falls through to the SPA shell.
 */
export const mediaLayer = (root: string) =>
  HttpRouter.add(
    "GET",
    `${MEDIA_PREFIX}*`,
    (request: HttpServerRequest.HttpServerRequest) =>
      Effect.gen(function*() {
        const target = mediaTarget(request.url)
        if (target === null) return missing

        const path = yield* Path.Path
        const fs = yield* FileSystem.FileSystem
        const absolute = path.join(root, ...target.split("/"))

        // Stat before serving: a directory called `art.png` would otherwise be
        // opened as a stream and fail with the response already begun.
        const info = yield* Effect.result(fs.stat(absolute))
        if (Result.isFailure(info) || info.success.type !== "File") return missing

        // The platform names the content type from the file's own extension,
        // and the extension is on the allowlist by now, so there is no second
        // table here to disagree with the first.
        return yield* Effect.orElseSucceed(
          HttpServerResponse.file(absolute),
          () => missing,
        )
      }),
  )

/** One answer for every way a picture is not there. */
const missing = HttpServerResponse.empty({ status: 404 })
