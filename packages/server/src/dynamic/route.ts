/**
 * `GET /_olai/plugins/<name>-<version>.js` — where a plugin the VAULT defines
 * serves its browser half.
 *
 * ## Why there is a route at all
 *
 * A built plugin's browser half is a CHUNK in the bundle, split out by a literal
 * `import()` in a generated row (`@olai/bundle`'s `rows.ts`), and the tab loads
 * only the chunks the roster names. A vault-defined plugin has no chunk: its
 * source was written after this binary was built, and the app's own bundler is
 * long gone. So the serve compiles it (`@olai/plugin-build`) and answers it here,
 * and the tab's redial treats it exactly as it treats a compiled-in row — a
 * thunk that resolves to a module with a plugin in it.
 *
 * ## The name carries the version, and that is the caching
 *
 * The URL is `<name>-<version>.js`, so an edit somebody approved is a DIFFERENT
 * URL. Nothing here has to invalidate anything, no tab can be handed the code
 * that was approved before the edit, and the response says `no-store` anyway:
 * the bytes are held in memory by a live mount, and a version that is no longer
 * mounted is a 404 rather than something a cache should be answering from.
 *
 * ## What it will NOT answer
 *
 * Anything but the exact path of a browser half that is MOUNTED right now. A
 * version that has been replaced, a plugin that was switched off, a definition
 * nobody approved: all 404. The lookup is an equality against the paths the
 * roster published, so there is no path to traverse and nothing on a disk this
 * route can reach — which is the whole of its security argument and is why it is
 * three lines rather than an allowlist.
 */

import { PLUGIN_CHUNK_PREFIX } from "@olai/surface"
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

import type { DynamicRuntime } from "./runtime.ts"

/** The route, over the runtime that holds the built halves. A `null` runtime is
 *  a serve with no vault behind it, and it answers nothing rather than not
 *  binding: the path is the same on every serve, and a 404 is the honest
 *  reading of "this serve has no such plugin". */
export const pluginChunks = (dynamic: DynamicRuntime | null) =>
  HttpRouter.add(
    "GET",
    `${PLUGIN_CHUNK_PREFIX}:file`,
    (request: HttpServerRequest.HttpServerRequest) =>
      Effect.sync(() => {
        const text = dynamic?.chunk(new URL(request.url, "http://olai").pathname) ?? null
        if (text === null) return HttpServerResponse.text("no such plugin chunk", { status: 404 })
        return HttpServerResponse.text(text, {
          status: 200,
          headers: {
            "content-type": "text/javascript; charset=utf-8",
            // NOT IMMUTABLE, though the name is content-addressed: what makes
            // an asset cacheable for a year is that it was built once and will
            // be served by every later boot of the same build. This one is
            // built from a note in somebody's vault and is gone the moment the
            // plugin is switched off — so a cache holding it would be holding
            // code the serve has already stopped standing behind.
            "cache-control": "no-store",
          },
        })
      }),
  )
