/**
 * The browser bundle.
 *
 * One implementation, two callers: `bun packages/web/src/build.ts <dist>` from
 * the Nix build, and the same command from `just serve`. The alternative — a
 * server that builds on startup — is a second build with different inputs from
 * the one CI proves, and the two would drift.
 *
 * The freshness contract — content-hashed `/assets/*` names, the `no-store`
 * shell that points at them, the commit stamped onto that shell — belongs to
 * `@kolu/surface-app/bun`. This file composes it and supplies only what is
 * genuinely olai's: the Solid JSX transform and the Tailwind stylesheet.
 *
 * The Solid transform is a Bun plugin rather than Bun's own JSX handling:
 * Bun's default transform emits `React.createElement`, which Solid does not
 * have, and `Bun.serve`'s HTML-import bundler does not honour plugins at all.
 * `Bun.build` takes a plugin array directly, so the build is driven from here.
 */

import { mkdtempSync } from "node:fs"
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
 * The stylesheet, as bytes for the helper to hash, name and write: Tailwind's
 * output with the named palettes after it.
 *
 * `@tailwindcss/cli` is invoked by its IN-TREE path, never `bunx`: bunx
 * resolves by name and falls back to fetching the package when the local copy
 * does not match, and the Nix build sandbox has no network, so that fallback
 * is a build failure. `createRequire` walks Node's own resolution outward from
 * this file, so the path stays right wherever in the workspace this ends up.
 *
 * Tailwind has no content-hash naming of its own, so it writes to a temp file
 * in the OS temp dir — both the source tree and the Nix dist may be read-only
 * — and we hand the bytes back for `buildSurfaceClient` to place under
 * `/assets/styles-<hash>.css` on the same immutable-caching contract as the JS.
 *
 * The palettes are APPENDED rather than written into `styles.css`, because
 * they are generated from a TypeScript table (`client/theme/palettes.ts`,
 * which the picker reads too) and there is no way for a `.css` file to import
 * one. Appended, they are also last, which is what a plain unlayered rule
 * needs in order to beat the `@layer theme` block Tailwind emits its own
 * `:root` in. The bytes are hashed after this, so a palette edited on disk is
 * a new `/assets/styles-<hash>.css` like any other change.
 */
const buildStylesheet = async (): Promise<ArrayBuffer> => {
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
  return new TextEncoder().encode(`${utilities}\n${paletteCss()}`).buffer as
    ArrayBuffer
}

const buildClient = async (distDir: string): Promise<void> => {
  await buildSurfaceClient({
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
}

if (import.meta.main) {
  const distDir = process.argv[2]
  if (distDir === undefined) {
    console.error("usage: bun packages/web/src/build.ts <distDir>")
    process.exit(1)
  }
  await buildClient(resolve(distDir))
}
