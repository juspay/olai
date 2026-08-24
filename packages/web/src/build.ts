/**
 * The browser bundle.
 *
 * One implementation, two callers: `bun packages/web/src/build.ts <dist>` from
 * the Nix build, and the same command from `just serve`. The alternative — a
 * server that builds on startup — is a second build with different inputs from
 * the one CI proves, and the two would drift.
 *
 * The whole DIST contract — content-hashed `/_olai/assets/*` names, the `no-store`
 * shell that points at them, the commit stamped onto that shell, the
 * precompressed siblings the static layer negotiates, and the chunk a dynamic
 * `import()` asks for — belongs to `@kolu/surface-app/bun` (kolu#2159). This
 * file composes it and supplies only what is genuinely olai's: the Solid JSX
 * transform, the Tailwind stylesheet, the fonts and the install surface's
 * icons.
 *
 * Two post-steps used to live here and are gone rather than moved. `.br`/`.gz`
 * siblings were written by a `./precompress.ts` of ours, which could never emit
 * the `.zst` the server has PREFERRED since it stopped using Hono's
 * `serve-static` — so the negotiation's best arm had nothing to serve, in every
 * consumer, for the whole life of the feature. And the markdown pipeline was a
 * second `Bun.build` plus a hand-rewrite of the shell the helper had just
 * written, because `splitting` was hardcoded off; it is on and unconditional
 * now, so the `import()` in `client/markdown/chunk.ts` is the whole of the
 * SPLIT and the chunk lands hashed in the same immutable dir.
 *
 * ONE line of the shell is still olai's to write about that chunk, and it is
 * the only post-step left: {@link preloadPipeline} rewrites the placeholder
 * `client/index.html` carries for it, so the browser fetches the pipeline
 * alongside the entry instead of a round trip after it. The removed
 * contraption's three moving parts are not back — the hashed name comes off
 * the build's own asset report, there is no second build, no `<meta>` and no
 * reader.
 *
 * The Solid transform is a Bun plugin rather than Bun's own JSX handling:
 * Bun's default transform emits `React.createElement`, which Solid does not
 * have, and `Bun.serve`'s HTML-import bundler does not honour plugins at all.
 * `Bun.build` takes a plugin array directly, so the build is driven from here.
 */

import { start } from "@olai/child"
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { transformAsync } from "@babel/core"
// @ts-expect-error — the babel presets ship loose types
import babelTypeScript from "@babel/preset-typescript"
// @ts-expect-error — the babel presets ship loose types
import babelSolid from "babel-preset-solid"
import { buildSurfaceClient } from "@kolu/surface-app/bun"
import { ASSET_PREFIX } from "@olai/surface"
import type { BunPlugin } from "bun"

import { fontCss, FONTS_DIR, HOSTED_WOFF2 } from "@olai/fonts/build"
import { paletteCss } from "./client/theme/css.ts"
import { sizeCss } from "./client/theme/sizes.ts"
import { scaleCss } from "./client/theme/scale.ts"

const CLIENT = resolve(dirname(fileURLToPath(import.meta.url)), "client")

const solidJsx: BunPlugin = {
  name: "olai-solid",
  setup(build) {
    build.onLoad({ filter: /\.(?:js|ts)x$/ }, async (args) => {
      const source = await Bun.file(args.path).text()
      const result = await transformAsync(source, {
        filename: args.path,
        presets: [[babelSolid, {}], [babelTypeScript, {}]],
      })
      if (result?.code == null) {
        throw new Error(`the Solid transform produced no output for ${args.path}`)
      }
      return { contents: result.code, loader: "js" }
    })
  },
}

/**
 * The utilities, as Tailwind writes them.
 *
 * `@tailwindcss/cli` is invoked by its IN-TREE path, never `bunx`: bunx
 * resolves by name and falls back to fetching the package when the local copy
 * does not match, and the Nix build sandbox has no network, so that fallback
 * is a build failure. `createRequire` walks Node's own resolution outward from
 * this file, so the path stays right wherever in the workspace this ends up.
 *
 * Tailwind has no content-hash naming of its own, so it writes to a temp file
 * in the OS temp dir — both the source tree and the Nix dist may be read-only.
 */
const tailwindUtilities = async (): Promise<string> => {
  const cli = createRequire(import.meta.url)
    .resolve("@tailwindcss/cli/package.json")
    .replace(/package\.json$/, "dist/index.mjs")
  if (!(await Bun.file(cli).exists())) {
    throw new Error(
      `no @tailwindcss/cli at ${cli} — it is a devDependency of @olai/web; run \`bun install\`.`,
    )
  }

  const out = join(mkdtempSync(join(tmpdir(), "olai-css-")), "styles.css")
  const tailwind = start("bun", [
    cli,
    "--input",
    resolve(CLIENT, "styles.css"),
    "--output",
    out,
    "--minify",
  ], {
    drain: { stdout: true, stderr: true },
  })
  // Forward as it arrives so a Nix build log still shows the CLI; the box
  // is what the hang detector quotes if the CLI never exits.
  tailwind.stdout?.on("data", (chunk: string | Buffer) => {
    process.stdout.write(chunk)
  })
  tailwind.stderr?.on("data", (chunk: string | Buffer) => {
    process.stderr.write(chunk)
  })
  const close = await tailwind.wait(120_000, "@tailwindcss/cli")
  if (close.code !== 0) {
    throw new Error(`@tailwindcss/cli exited ${close.code}:\n${tailwind.said()}`)
  }

  const utilities = await Bun.file(out).text()
  await Bun.$`rm -rf ${dirname(out)}`
  return utilities
}

/**
 * The whole stylesheet, as bytes for the helper to hash, name and write: the
 * utilities, then the markdown scales, then the type sizes, then the named
 * palettes, then the faces.
 *
 * Every generated block is a TypeScript table that something else also reads —
 * `client/theme/palettes.ts` by the theme chips, `client/theme/sizes.ts` by the
 * Size row, `client/theme/scale.ts` by the browser test that holds the rendered
 * page to it — and a `.css` file cannot import one, so they are composed in
 * here rather than written into `styles.css`.
 * Their POSITION is not load-bearing — an unlayered rule beats the
 * `@layer theme` block Tailwind emits its own `:root` in wherever it is
 * written — they go last because that is the simplest composition. The one
 * cost of being outside the CLI's input is that these few blocks are the only
 * part of the sheet its minifier never sees.
 *
 * The bytes are hashed after this, so a palette edited on disk is a new
 * `/_olai/assets/styles-<hash>.css` on the same immutable-caching contract as the JS.
 */
const buildStylesheet = async (): Promise<ArrayBuffer> =>
  new Response(
    `${await tailwindUtilities()}\n${scaleCss()}\n${sizeCss()}\n${paletteCss()}\n${fontCss()}`,
  ).arrayBuffer()

/**
 * The hosted faces, served from /fonts/*.woff2 — a COPY, and nothing else.
 *
 * `OLAI_FONTS_DIR` is `@olai/fonts`'s own derivation (shell.nix and
 * default.nix both point at it), and what it holds is already woff2: the
 * conversion is a function of the font set, so it runs once in the Nix store
 * rather than 70 times per build here. Missing the env is a loud failure in
 * the packaged build; the dev loop gets the same variable from the flake
 * shell.
 *
 * The lookup stays BY NAME, one file of `HOSTED_WOFF2` at a time, rather than
 * a copy of the whole directory: that list is exactly what the sheet appended
 * above asks for, so a face it names and the derivation does not convert has
 * to fail the build rather than 404 in a browser.
 */
const installFonts = (distDir: string): void => {
  const fontsDir = process.env.OLAI_FONTS_DIR
  if (fontsDir === undefined || fontsDir === "") {
    throw new Error(
      "OLAI_FONTS_DIR is unset — the flake shell and default.nix both set it " +
        "to packages/fonts/default.nix; run via `just serve` / `nix build`.",
    )
  }
  const out = resolve(distDir, FONTS_DIR)
  mkdirSync(out, { recursive: true })

  for (const name of HOSTED_WOFF2) {
    const src = join(fontsDir, name)
    if (!existsSync(src)) {
      throw new Error(
        `font face missing at ${src} (OLAI_FONTS_DIR=${fontsDir}) — the sheet ` +
          `asks for it, so packages/fonts/default.nix has to convert it`,
      )
    }
    const dest = join(out, name)
    cpSync(src, dest)
    // The source is a store path, and its mode is read-only: copied verbatim,
    // the next build into this same dist could not overwrite its own output.
    chmodSync(dest, 0o644)
  }
  console.log(`fonts: ${HOSTED_WOFF2.length} faces from ${fontsDir}`)
}

/** The module the shell is waiting to be told the hashed name of, spelled
 *  ONCE: the placeholder is that path in an `href`, and the chunk is that
 *  module's own basename plus the hash `buildSurfaceClient` gives every output
 *  (`markdown/pipeline.ts` → `pipeline-<hash>.js`; the same rule
 *  `packages/tests/support/chunks.ts` derives a held-up chunk's URL from).
 *  Renaming the module is then one edit here and one in the shell, and a build
 *  that reaches neither fails rather than shipping a preload of nothing. */
const PIPELINE_MODULE = "./markdown/pipeline.ts"
const PIPELINE_PLACEHOLDER = `href="${PIPELINE_MODULE}"`
const PIPELINE_CHUNK = new RegExp(
  `^${basename(PIPELINE_MODULE, ".ts")}-[^/]*\\.js$`,
)

/**
 * The one hashed name the shell has to know that the helper will not tell it:
 * the markdown pipeline's chunk.
 *
 * `buildSurfaceClient` writes a `<link rel="modulepreload">` for every chunk
 * the entry imports STATICALLY, and deliberately for none it imports
 * dynamically — preloading a dynamic chunk is fetching on first paint the very
 * thing `import()` was written not to fetch (@kolu/surface-app's
 * modulePreload.ts). For this one chunk olai wants exactly that, and says so
 * in its own shell rather than upstream, because the reason is olai's: the
 * pipeline is what every markdown surface waits on, and the wait is what put a
 * frame of raw source on the page (roadmap `markdown-raw-flash`).
 *
 * It is a PLACEHOLDER in index.html, rewritten here — the same arrangement the
 * entry and the stylesheet already have, and for the same reason: the tag's
 * place in the head is a decision a reader can see in the shell, and the hashed
 * name is a fact only the build has. The name comes off the build's own asset
 * report rather than a second `Bun.build` or a `<meta>` this file writes and
 * another reads; those three moving parts are what the header above records
 * being rid of.
 *
 * A build that finds no such chunk FAILS: it means the `import()` in
 * client/markdown/chunk.ts stopped splitting (folded into the entry, or the
 * bundler's naming rule moved), and either way a shell that quietly preloaded
 * nothing would be this fix silently gone.
 */
const preloadPipeline = async (
  distDir: string,
  assets: readonly { readonly file: string }[],
): Promise<string> => {
  const chunk = assets.find((asset) => PIPELINE_CHUNK.test(asset.file))
  if (chunk === undefined) {
    throw new Error(
      `no ${PIPELINE_CHUNK.source} in the hashed assets — the markdown pipeline is ` +
        `not a chunk of its own any more, so the shell has nothing to preload:\n  ` +
        assets.map((asset) => asset.file).join("\n  "),
    )
  }
  const shell = resolve(distDir, "index.html")
  const html = await Bun.file(shell).text()
  if (!html.includes(PIPELINE_PLACEHOLDER)) {
    throw new Error(
      `the shell has no ${PIPELINE_PLACEHOLDER} to rewrite (${shell}) — the markdown ` +
        `pipeline would be fetched only after the entry runs, which is the wait ` +
        `roadmap \`markdown-raw-flash\` is about`,
    )
  }
  const href = `${ASSET_PREFIX}${chunk.file}`
  await Bun.write(shell, html.replaceAll(PIPELINE_PLACEHOLDER, `href="${href}"`))
  return href
}

const buildClient = async (distDir: string): Promise<void> => {
  const { assets } = await buildSurfaceClient({
    entrypoint: resolve(CLIENT, "main.tsx"),
    distDir,
    // The same spelling the server pins — see `@olai/surface`'s ASSET_PREFIX.
    // Reported back on the result; two processes, so they share the constant
    // rather than a value one of them wrote.
    assetPrefix: ASSET_PREFIX,
    htmlTemplate: resolve(CLIENT, "index.html"),
    // Both placeholders must match index.html byte for byte; the helper throws
    // rather than silently shipping a shell that points at dev paths.
    entryHtmlPlaceholder: `src="./main.tsx"`,
    extraAssets: [
      {
        name: "styles",
        ext: "css",
        build: buildStylesheet,
        htmlPlaceholder: `href="./styles.css"`,
      },
    ],
    // The install surface's icons, copied verbatim to the dist ROOT rather
    // than hashed into /_olai/assets/: a manifest and an `apple-touch-icon` are read
    // by an installer, not by the shell, so their URLs have to be stable ones
    // the server's manifest can name (packages/server/src/listener.ts) and
    // must not change with their bytes.
    publicDir: resolve(CLIENT, "public"),
    plugins: [solidJsx],
  })
  // What the helper emitted, reported rather than re-walked: one row per
  // compressible file in the hashed dir — the entry, the markdown chunk the
  // `import()` split out, the stylesheet — with the identity size and whatever
  // siblings beat it. So "the entry is 700 kB and 185 kB on the wire" stays a
  // number somebody can see after the step that printed it left this file.
  for (const asset of assets) {
    const siblings = Object.entries(asset.siblings)
      .map(([encoding, size]) => ` ${encoding}=${size}B`)
      .join("")
    console.log(`asset: ${asset.file} ${asset.bytes}B${siblings}`)
  }
  console.log(`preload: ${await preloadPipeline(distDir, assets)}`)
  // Fonts after the surface client so a wipe of dist does not strand them,
  // and so /fonts/* is a sibling of the icons at the dist root.
  installFonts(distDir)
}

if (import.meta.main) {
  const distDir = process.argv[2]
  if (distDir === undefined) {
    console.error("usage: bun packages/web/src/build.ts <distDir>")
    process.exit(1)
  }
  await buildClient(resolve(distDir))
}
