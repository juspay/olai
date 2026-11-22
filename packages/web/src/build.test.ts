/**
 * WHAT THE FIRST LOAD CARRIES — read off a real build, not off the source.
 *
 * The claim is one sentence: the chunks a browser EXECUTES to draw the first
 * frame hold no Markdown parser. It is worth a test because it is a property
 * of the BUNDLE and of nothing a reader can see in a file: one ordinary
 * `import` anywhere in the first paint's graph pulls ~150 KB of `micromark`,
 * `unified` and `remark-*` into the entry, and the only symptom is a slower
 * cold start. It was a byte count in two commit messages until this.
 *
 * WHAT IS ASKED, exactly. The shell names what the browser fetches: the entry
 * `<script type="module">`, and the chunks `modulepreload`ed beside it. Those
 * preloads are two different things, and the difference is the whole point —
 * the bundler writes one link per chunk the entry STATICALLY imports (they
 * are the first load), and `./build.ts` appends one per module a row asked to
 * have fetched EARLY and run LATER (`BUILD_ASSETS`' `preloadModules`, which
 * is how the markdown pipeline is warmed without being executed). So the
 * first load is the entry plus every preload that is not one of those, and
 * each is asked what source files it was built from, through its `.js.map`.
 *
 * THE OTHER HALF IS THE FALSIFIER: the parser must still be SHIPPED, in the
 * deferred chunk. A test that only looked for its absence would go green the
 * day the page stopped rendering Markdown at all.
 *
 * IT BUILDS, so it costs what a build costs (~8 s here; `../test-weights.json`
 * carries the estimate so a shard is balanced around it). There is no cheaper
 * honest way: the source graph cannot say which chunk a module lands in — the
 * source half of the same claim is `@olai/bundle`'s `fence.test.ts`.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { basename, join } from "node:path"
import { tmpdir } from "node:os"

import { expect, test } from "bun:test"

import { BUILD_ASSETS } from "@olai/bundle/assets"
import { ASSET_PREFIX, chunkFile } from "@olai/surface"

import { buildClient } from "./build.ts"

/** A source file of the Markdown parser, as a source map names it: the
 *  libraries the dialect is built from, and `@olai/prose`'s own three modules
 *  that reach them (`parse.ts`, the constructs in `obsidian.ts`, and `read.ts`
 *  which calls the parse). */
const PARSER: ReadonlyArray<RegExp> = [
  /\/micromark[^/]*\//,
  /\/unified\//,
  /\/remark-[^/]+\//,
  /\/mdast-util-from-markdown\//,
  /prose\/src\/(?:parse|obsidian|read)\.ts$/,
]

/** The source files one emitted chunk was built from.
 *
 *  EMPTY IS AN ANSWER: splitting emits a handful of chunks that are nothing
 *  but re-exports, and those carry a map with no sources because they hold no
 *  original line. A chunk with no map at all is not an answer — it is the
 *  build having stopped emitting them, which would make the claim below pass
 *  by reading nothing, so that throws. */
const sourcesOf = (assets: string, file: string): ReadonlyArray<string> => {
  const at = join(assets, `${file}.map`)
  if (!existsSync(at)) {
    throw new Error(`no sourcemap beside ${file} — this build emitted none, so what the first load holds cannot be read`)
  }
  // The bundler's own map beside the chunk it emitted; `sources` is the one
  // field read here, and an older map without it reads as no sources.
  const map: { readonly sources?: ReadonlyArray<string> } = JSON.parse(readFileSync(at, "utf8"))
  return map.sources ?? []
}

const parserIn = (assets: string, file: string): ReadonlyArray<string> =>
  sourcesOf(assets, file).filter((source) => PARSER.some((shape) => shape.test(source)))

test("the first load holds no Markdown parser, and the deferred chunk still does", async () => {
  const dist = mkdtempSync(join(tmpdir(), "olai-first-load-"))
  try {
    await buildClient(dist)
    const shell = readFileSync(join(dist, "index.html"), "utf8")
    const entry = shell.match(/<script type="module" src="([^"]+)"/)?.[1]
    expect(entry, "the shell names no module entry").toBeString()
    const preloaded = [...shell.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((link) => basename(link[1]!))
    // What a row asked to be fetched early and run later, named the way
    // `./build.ts` names it — the bundle's own declaration rather than a list
    // of chunk names written out here.
    const deferredShapes = BUILD_ASSETS.flatMap((owner) =>
      (owner.preloadModules ?? []).map((request) => chunkFile(basename(request.module, ".ts")))
    )
    expect(deferredShapes.length).toBeGreaterThan(0)
    const deferred = preloaded.filter((file) => deferredShapes.some((shape) => shape.test(file)))
    expect(deferred.length).toEqual(deferredShapes.length)

    const assets = join(dist, ASSET_PREFIX.replace(/^\/|\/$/g, ""))
    const firstLoad = [basename(entry!), ...preloaded.filter((file) => !deferred.includes(file))]
    // Named in the failure, because "a chunk carries the parser" is only
    // actionable with the source that pulled it in.
    expect(firstLoad.flatMap((file) => parserIn(assets, file).map((source) => `${file}: ${source}`))).toEqual([])
    // ...and it has not merely gone: the page still renders Markdown, out of
    // the chunk it fetches early and runs when a body is drawn.
    expect(deferred.filter((file) => parserIn(assets, file).length > 0)).not.toEqual([])
    // The claim above is only worth as much as what it read: a first load is
    // the entry and its chunks, built out of hundreds of modules, and a
    // deferred chunk is not the whole of what this build emitted.
    expect(firstLoad.length).toBeGreaterThan(1)
    expect(firstLoad.flatMap((file) => sourcesOf(assets, file)).length).toBeGreaterThan(100)
    expect(readdirSync(assets).filter((file) => file.endsWith(".js")).length).toBeGreaterThan(firstLoad.length)
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}, 180_000)
