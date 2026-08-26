/** Build the chip-geometry harness — see `./harness.tsx`. One-off driver:
 *  `bun packages/tests/geometry/build.ts <outdir>`.
 *
 *  The Solid transform and the Tailwind CLI are `@olai/web`'s devDependencies
 *  and this package is not `@olai/web`, so they are resolved FROM there rather
 *  than declared here: a throwaway evidence driver should not put three build
 *  tools in a test package's manifest. `createRequire` against web's own
 *  directory is the whole of that. */
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { paletteCss } from "../../web/src/client/theme/css.ts"
import { scaleCss } from "../../web/src/client/theme/scale.ts"
import { sizeCss } from "../../web/src/client/theme/sizes.ts"

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(HERE, "../../web")
const fromWeb = createRequire(join(WEB, "package.json"))

const { transformAsync } = fromWeb("@babel/core")
const babelSolid = fromWeb("babel-preset-solid")
const babelTypeScript = fromWeb("@babel/preset-typescript")

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

const cli = fromWeb.resolve("@tailwindcss/cli/package.json").replace(
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
