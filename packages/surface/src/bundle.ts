/**
 * Where the hashed browser bundle lives.
 *
 * Addresses are prefix-free ({@link ./index.ts}'s WHAT-CAN-COLLIDE), so a
 * vault file under `assets/` is a page — and a miss under the immutable
 * prefix has to 404 rather than fall through to the shell. The hashed dir
 * therefore sits in olai's own namespace, the same `_olai/` the shelf and
 * the trash are minted into, rather than at the conventional `/assets/`.
 *
 * ONE spelling, both halves: the build writes here and the server pins the
 * same prefix. `buildSurfaceClient` reports the prefix it took so a
 * same-process caller cannot disagree; olai's build and serve are two
 * processes, so they import this.
 */

/** The request prefix of the immutable, content-hashed assets — and the
 *  dist-relative directory they are written under. Trailing slash is the
 *  shape `@kolu/surface-app`'s `assertAssetPrefix` requires. */
export const ASSET_PREFIX = "/_olai/assets/"

/**
 * What a dynamically imported module's CHUNK is called, given the module.
 *
 * `buildSurfaceClient` splits on a dynamic `import()` and names the output
 * after the split module, with the same content hash every other output gets:
 * `markdown/pipeline.ts` → `pipeline-<hash>.js`. That rule is the bundler's,
 * and three places in this repository have to know it — the build, which
 * rewrites the shell's preload placeholder to the hashed name
 * (`@olai/web`'s `build.ts`); the browser suite, which holds a chunk up by
 * routing its URL (`packages/tests/support/chunks.ts`); and the evidence
 * driver, which delays one to photograph the frame before it lands.
 *
 * ONE spelling, for {@link ASSET_PREFIX}'s reason: three processes, no shared
 * value unless they import one, and a rule that drifts goes QUIET rather than
 * red — a suite whose pattern stopped matching reports "the page never asked".
 *
 * @param module the split module's own name, without directory or extension
 * (`pipeline`, `Dropdown`).
 */
export const chunkFile = (module: string): RegExp =>
  new RegExp(`^${module}-[^/]+\\.js$`)

/** ...and the same rule as a URL under the hashed dir — what a request for
 *  that chunk looks like on the wire. */
export const chunkUrl = (module: string): RegExp =>
  new RegExp(`${ASSET_PREFIX}${module}-[^/]+\\.js$`)
