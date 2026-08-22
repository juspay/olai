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
