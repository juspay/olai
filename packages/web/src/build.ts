/**
 * The browser bundle.
 *
 * One implementation, two callers: `bun packages/web/src/build.ts <dist>` from
 * the Nix build, and the same command from `just serve`. The alternative — a
 * server that builds on startup — is a second build with different inputs from
 * the one CI proves, and the two would drift.
 *
 * The whole DIST contract — content-hashed `/assets/*` names, the `no-store`
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
 * request and the chunk lands hashed in the same immutable dir.
 *
 * The Solid transform is a Bun plugin rather than Bun's own JSX handling:
 * Bun's default transform emits `React.createElement`, which Solid does not
 * have, and `Bun.serve`'s HTML-import bundler does not honour plugins at all.
 * `Bun.build` takes a plugin array directly, so the build is driven from here.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { transformAsync } from "@babel/core"
// @ts-expect-error — the babel presets ship loose types
import babelTypeScript from "@babel/preset-typescript"
// @ts-expect-error — the babel presets ship loose types
import babelSolid from "babel-preset-solid"
import { buildSurfaceClient } from "@kolu/surface-app/bun"
import type { BunPlugin } from "bun"

import { scaleCss } from "./client/markdown/scale.ts"
import { paletteCss } from "./client/theme/css.ts"

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
  const tailwind = Bun.spawn(
    ["bun", cli, "--input", resolve(CLIENT, "styles.css"), "--output", out, "--minify"],
    { stderr: "inherit", stdout: "inherit" },
  )
  const code = await tailwind.exited
  if (code !== 0) throw new Error(`@tailwindcss/cli exited ${code}`)

  const utilities = await Bun.file(out).text()
  await Bun.$`rm -rf ${dirname(out)}`
  return utilities
}

/**
 * The whole stylesheet, as bytes for the helper to hash, name and write: the
 * utilities, then the markdown scales, then the named palettes.
 *
 * Both generated blocks are TypeScript tables that something else also reads —
 * `client/theme/palettes.ts` by the theme chips, `client/markdown/scale.ts`
 * by the browser test that holds the rendered page to it — and a `.css` file
 * cannot import one, so they are composed in here rather than written into
 * `styles.css`.
 * Their POSITION is not load-bearing — an unlayered rule beats the
 * `@layer theme` block Tailwind emits its own `:root` in wherever it is
 * written — they go last because that is the simplest composition. The one
 * cost of being outside the CLI's input is that these few blocks are the only
 * part of the sheet its minifier never sees.
 *
 * The bytes are hashed after this, so a palette edited on disk is a new
 * `/assets/styles-<hash>.css` on the same immutable-caching contract as the JS.
 */
const buildStylesheet = async (): Promise<ArrayBuffer> =>
  new Response(
    `${await tailwindUtilities()}\n${scaleCss()}\n${paletteCss()}`,
  ).arrayBuffer()

/**
 * Workflowy's Open Sans, served from /fonts/*.woff2.
 *
 * Source TTFs come from nixpkgs' `open-sans` via `OLAI_FONTS_DIR` (shell.nix
 * and default.nix). They are converted to woff2 at build time — never committed
 * — so a CDN is never asked and the repo stays free of font binaries. Missing
 * the env is a loud failure in the packaged build; the dev loop gets the same
 * env from the flake shell.
 */
const FONT_FACES = [
  "OpenSans-Regular.ttf",
  "OpenSans-Italic.ttf",
  "OpenSans-Semibold.ttf",
  "OpenSans-Bold.ttf",
] as const

const installFonts = async (distDir: string): Promise<void> => {
  const fontsDir = process.env.OLAI_FONTS_DIR
  if (fontsDir === undefined || fontsDir === "") {
    throw new Error(
      "OLAI_FONTS_DIR is unset — the flake shell and default.nix both set it " +
        "to nixpkgs' open-sans truetype directory; run via `just serve` / `nix build`.",
    )
  }
  const out = resolve(distDir, "fonts")
  mkdirSync(out, { recursive: true })

  // Loud failure if the converter is missing: the sheet names .woff2 only, so
  // there is no TTF fallback path. Both shells set OLAI_WOFF2_COMPRESS.
  const compress = process.env.OLAI_WOFF2_COMPRESS ?? "woff2_compress"
  const work = mkdtempSync(join(tmpdir(), "olai-fonts-"))

  for (const face of FONT_FACES) {
    const src = join(fontsDir, face)
    if (!existsSync(src)) {
      throw new Error(`font face missing at ${src} (OLAI_FONTS_DIR=${fontsDir})`)
    }
    const woff2Name = face.replace(/\.ttf$/i, ".woff2")
    const dest = join(out, woff2Name)
    // Skip reconvert when the woff2 is already newer than the TTF — `just serve`
    // re-runs the whole client build on every keystroke, and three compresses
    // cost ~300ms for nothing when the faces have not moved.
    if (existsSync(dest)) {
      const srcM = statSync(src).mtimeMs
      const destM = statSync(dest).mtimeMs
      if (destM >= srcM) {
        console.log(`font: ${woff2Name} (cached)`)
        continue
      }
    }
    const tmp = join(work, face)
    cpSync(src, tmp)
    const result = Bun.spawn([compress, tmp], {
      stdout: "inherit",
      stderr: "inherit",
    })
    const code = await result.exited
    if (code !== 0) {
      throw new Error(
        `${compress} exited ${code} for ${face} — is pkgs.woff2 on PATH ` +
          `(OLAI_WOFF2_COMPRESS)?`,
      )
    }
    const produced = tmp.replace(/\.ttf$/i, ".woff2")
    if (!existsSync(produced)) {
      throw new Error(`${compress} produced no ${produced}`)
    }
    cpSync(produced, dest)
    console.log(`font: ${woff2Name}`)
  }
  await Bun.$`rm -rf ${work}`
}

const buildClient = async (distDir: string): Promise<void> => {
  const { assets } = await buildSurfaceClient({
    entrypoint: resolve(CLIENT, "main.tsx"),
    distDir,
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
    // than hashed into /assets/: a manifest and an `apple-touch-icon` are read
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
  // Fonts after the surface client so a wipe of dist does not strand them,
  // and so /fonts/* is a sibling of the icons at the dist root.
  await installFonts(distDir)
}

if (import.meta.main) {
  const distDir = process.argv[2]
  if (distDir === undefined) {
    console.error("usage: bun packages/web/src/build.ts <distDir>")
    process.exit(1)
  }
  await buildClient(resolve(distDir))
}
