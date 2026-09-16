/** Build the chip-geometry harness — see `./harness.tsx`. One-off driver:
 *  `bun packages/plugins/kolu/e2e/geometry/build.ts <outdir>`.
 *
 *  The Solid transform and the Tailwind CLI are declared as devDependencies of
 *  THIS package, at `@olai/web`'s pinned versions, so the harness builds with
 *  the tools its own manifest names — `createRequire(import.meta.url)` against
 *  this module's directory is the whole of the resolution, and there is no
 *  reaching into another package's tree. */
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { paletteCss } from "@olai/appearance/css.ts"
import { scaleCss } from "@olai/appearance/scale.ts"
import { sizeCss } from "@olai/appearance/sizes.ts"

const HERE = dirname(fileURLToPath(import.meta.url))
const fromHERE = createRequire(import.meta.url)

const { transformAsync } = fromHERE("@babel/core")
const babelSolid = fromHERE("babel-preset-solid")
const babelTypeScript = fromHERE("@babel/preset-typescript")

const out = resolve(process.argv[2] ?? join(HERE, "dist"))
mkdirSync(out, { recursive: true })

const solidJsx: import("bun").BunPlugin = {
  name: "harness-solid",
  setup(build) {
    build.onLoad({ filter: /\.(?:js|ts)x$/ }, async (args) => {
      const source = await Bun.file(args.path).text()
      const result = await transformAsync(source, {
        filename: args.path,
        presets: [[babelSolid, {}], [babelTypeScript, {}]],
      })
      if (result?.code == null) throw new Error(`no output for ${args.path}`)
      return { contents: result.code, loader: "js" }
    })
  },
}

const built = await Bun.build({
  entrypoints: [join(HERE, "harness.tsx")],
  outdir: out,
  target: "browser",
  plugins: [solidJsx],
  naming: "[name].js",
})
if (!built.success) {
  for (const log of built.logs) console.error(log)
  throw new Error("the harness bundle failed")
}

const cli = fromHERE.resolve("@tailwindcss/cli/package.json").replace(
  /package\.json$/,
  "dist/index.mjs",
)
const css = join(out, "harness.css")
const tw = Bun.spawnSync(["bun", cli, "-i", join(HERE, "harness.css"), "-o", css])
if (tw.exitCode !== 0) throw new Error(`tailwind: ${tw.stderr.toString()}`)
writeFileSync(
  css,
  `${await Bun.file(css).text()}\n${scaleCss()}\n${sizeCss()}\n${paletteCss()}`,
)

writeFileSync(
  join(out, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./harness.css"></head>
<body class="bg-paper text-ink"><div id="root"></div>
<script type="module" src="./harness.js"></script></body></html>`,
)
console.log(`harness built at ${out}`)
