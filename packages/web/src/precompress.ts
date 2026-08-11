/**
 * Build-time precompressed siblings for `/assets/*`.
 *
 * The static layer in `@kolu/surface-app` already negotiates them: when a
 * client offers `br` / `gzip` and a same-named `.br` / `.gz` file sits beside
 * the identity bytes under the hashed-asset prefix, the response goes out with
 * the matching `Content-Encoding`, the ORIGINAL `Content-Type`, and
 * `Vary: Accept-Encoding`. Identity when nothing matches. Negotiation is scoped
 * to `/assets/*` only (never the `no-store` shell — kolu#1319). Binary /
 * already-compressed media types are refused server-side even if a sibling
 * exists.
 *
 * This module's only job is to WRITE those siblings after the client build, so
 * olai's packaged dist actually exercises the negotiation that kolu already
 * tested. No per-request CPU: quality is paid once at build time.
 *
 * Upstream shape worth knowing (flag in the PR, do not patch the Nix-store
 * package): `buildSurfaceClient` does not emit siblings itself, so every
 * surface-app consumer re-derives this post-step — a natural home for a
 * `precompress?: boolean` on that helper when someone next touches kolu.
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync,
} from "node:zlib"

/** Extensions we are willing to precompress. Kept tight on purpose: the
 *  server's content-type guard is the safety net for media, but we never write
 *  a `.br` next to a `.png` in the first place. Source maps are deliberately
 *  out — they are not on the first-paint path, and precompressing a multi-MB
 *  `.map` would nearly double the client derivation for a file DevTools
 *  fetches rarely (and only after a user opens them). */
const COMPRESSIBLE = new Set([".js", ".css", ".svg", ".json", ".txt", ".xml"])

/** Already a precompressed sibling — never re-encode. */
const SIBLING_EXT = new Set([".br", ".gz", ".zst"])

/** Skip tiny files: the wire headers would dominate any saving, and a 20-byte
 *  gzip wrapper around a 12-byte icon is pure noise. */
const MIN_BYTES = 256

export interface Precompressed {
  readonly file: string
  readonly raw: number
  readonly br: number | null
  readonly gz: number | null
}

const extOf = (name: string): string => {
  const i = name.lastIndexOf(".")
  return i === -1 ? "" : name.slice(i).toLowerCase()
}

/** True when `name` is a primary asset we should consider, not a sibling of one. */
const isPrimary = (name: string): boolean => {
  const ext = extOf(name)
  if (SIBLING_EXT.has(ext)) return false
  return COMPRESSIBLE.has(ext)
}

/** Compress one file's bytes. Returns null for an encoding that did not beat
 *  identity (so the server falls through to the raw file rather than shipping
 *  a larger "compressed" body). */
const compress = (
  raw: Buffer,
): { readonly br: Buffer | null; readonly gz: Buffer | null } => {
  const br = brotliCompressSync(raw, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength,
    },
  })
  const gz = gzipSync(raw, { level: 9 })
  return {
    br: br.byteLength < raw.byteLength ? br : null,
    gz: gz.byteLength < raw.byteLength ? gz : null,
  }
}

/**
 * Write `.br` and `.gz` siblings next to every compressible primary under
 * `assetsDir`. Idempotent for a clean dist: siblings are never inputs.
 *
 * Returns one row per primary considered (including those skipped for size),
 * so a caller / test can assert the win without re-walking the tree.
 */
export const precompressAssets = async (
  assetsDir: string,
): Promise<ReadonlyArray<Precompressed>> => {
  const names = await readdir(assetsDir)
  const out: Array<Precompressed> = []

  for (const name of names) {
    if (!isPrimary(name)) continue
    const path = join(assetsDir, name)
    const raw = await readFile(path)
    if (raw.byteLength < MIN_BYTES) {
      out.push({ file: name, raw: raw.byteLength, br: null, gz: null })
      continue
    }
    const { br, gz } = compress(raw)
    if (br !== null) await writeFile(`${path}.br`, br)
    if (gz !== null) await writeFile(`${path}.gz`, gz)
    out.push({
      file: name,
      raw: raw.byteLength,
      br: br?.byteLength ?? null,
      gz: gz?.byteLength ?? null,
    })
  }

  return out
}
