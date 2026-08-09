/**
 * Where the browser bundle is.
 *
 * One receptacle: `OLAI_DIST_DIR`. The nix wrapper sets it to the bundle
 * derivation; `just serve` sets it to the tree it just built. A fallback that
 * walked from this file into `packages/web/dist` would be a second answer to
 * the same question — and a real `server → web` dependency expressed as a path,
 * invisible to `bun install` and to any layering check.
 *
 * The server does not build. A server that quietly rebuilt would be a second,
 * slower build with different inputs from the one CI proves.
 */

import { Data, Effect, FileSystem } from "effect"

export const DIST_ENV_VAR = "OLAI_DIST_DIR"

export class MissingBundle extends Data.TaggedError("MissingBundle")<{
  readonly reason: string
}> {
  override get message(): string {
    return this.reason
  }
}

export const clientDist = Effect.gen(function*() {
  const dist = process.env[DIST_ENV_VAR]
  if (dist === undefined || dist === "") {
    return yield* new MissingBundle({
      reason:
        `${DIST_ENV_VAR} is not set, so there is no browser bundle to serve. Run \`just serve <dir>\`, which builds one and sets it — or set it yourself to a directory built by \`just build-client\`.`,
    })
  }

  const fs = yield* FileSystem.FileSystem
  if (!(yield* fs.exists(`${dist}/index.html`))) {
    return yield* new MissingBundle({
      reason: `${DIST_ENV_VAR} is ${dist}, which holds no index.html — it points at an unbuilt directory.`,
    })
  }
  return dist
})
