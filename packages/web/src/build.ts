/**
 * The browser bundle.
 *
 * One implementation, two callers: `bun packages/web/src/build.ts <dist>` from
 * the Nix build, and the same command from `just serve`. The alternative — a
 * server that builds on startup — is a second build with different inputs from
 * the one CI proves, and the two would drift.
 *
 * The Solid JSX transform is a Bun plugin rather than Bun's own JSX handling:
 * Bun's default transform emits `React.createElement`, which Solid does not
 * have, and `Bun.serve`'s HTML-import bundler does not honour plugins at all.
 * `Bun.build` takes a plugin array directly, so the build is driven from here.
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { transformAsync } from "@babel/core"
// @ts-expect-error — the babel presets ship loose types
import babelTypeScript from "@babel/preset-typescript"
// @ts-expect-error — the babel presets ship loose types
import babelSolid from "babel-preset-solid"
import { buildSurfaceClient } from "@kolu/surface-app/bun"
import type { BunPlugin } from "bun"

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

export const buildClient = async (distDir: string): Promise<void> => {
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
        build: () => Bun.file(resolve(CLIENT, "styles.css")).arrayBuffer(),
        htmlPlaceholder: `href="./styles.css"`,
      },
    ],
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
