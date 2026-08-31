/**
 * THE GENERATOR, run by `../../default.nix` and by nothing else — bytes in, one
 * TypeScript module out.
 *
 * Six lines of argv handling around {@link ./inline.ts}, kept apart from it so
 * the transform stays a pure function a test can ask questions of and the IO
 * stays where the derivation can see it fail. The two arguments are the pinned
 * favicon's store path and the kolu revision `npins/sources.json` records.
 *
 * ## Why the revision is in the header, and why this emits `.ts` and not `.json`
 *
 * The generated file is gitignored, so a pin bump changes the logo with NO
 * REVIEWABLE DIFF — the PR shows one sha in `npins/sources.json` and nothing
 * else. That is the honest cost of never vendoring a copy. What it buys back is
 * this header: `head -3` on the generated module says which revision of which
 * repository the bytes came from, so a stale one is diagnosable by looking at it
 * rather than by reasoning about when `just install` last ran. A `.json` could
 * not carry that line, and a bundler could not tree-shake it.
 */

import { inlineMark, MARK_TOKEN } from "./inline.ts"

const path = process.argv[2]
const revision = process.argv[3]
if (path === undefined || revision === undefined) {
  throw new Error("usage: emit.ts <favicon.svg> <kolu revision> — packages/plugin-kolu/default.nix passes both")
}

const { viewBox, body } = inlineMark(await Bun.file(path).text(), path)

process.stdout.write(
  [
    `// GENERATED from juspay/kolu packages/client/favicon.svg at revision ${revision} (npins/sources.json).`,
    "// Do not edit; do not commit. packages/plugin-kolu/default.nix writes it.",
    "",
    `export const MARK_VIEWBOX = ${JSON.stringify(viewBox)}`,
    `export const MARK_TOKEN = ${JSON.stringify(MARK_TOKEN)}`,
    `export const MARK_BODY = ${JSON.stringify(body)}`,
    "",
  ].join("\n"),
)
