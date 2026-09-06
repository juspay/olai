/** Generic browser build: Solid compilation, Tailwind utilities and immutable
 * asset publication. Static head/CSS/public-file/preload policy comes from
 * bundle row asset exports, on a graph never loaded by either runtime. */

import { start } from "@olai/child"
import { mkdtempSync, rmSync } from "node:fs"
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
import { ASSET_PREFIX, chunkFile } from "@olai/surface"
import type { BunPlugin } from "bun"
import { BROWSER_ROWS } from "@olai/bundle"
import { BROWSER_MODULES_ID } from "@olai/plugin-api/mount"

import { BUILD_ASSETS } from "@olai/bundle/assets"

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

/** Row-owned generated styles follow Tailwind's layered utilities. */
const buildStylesheet = async (): Promise<ArrayBuffer> =>
  new Response(
    `${await tailwindUtilities()}\n${BUILD_ASSETS.map((asset) => asset.css?.() ?? "").join("\n")}`,
  ).arrayBuffer()

/** Preloads are requested by static asset owners; the actual hashed name
 * comes from the single build's asset report. Dynamic modules are not executed. */
const preloadAssets = async (distDir: string, assets: readonly { readonly file: string }[]): Promise<void> => {
  const links = BUILD_ASSETS.flatMap((owner) => (owner.preloadModules ?? []).map((request) => {
    const pattern = chunkFile(basename(request.module, ".ts"))
    const chunk = assets.find((asset) => pattern.test(asset.file))
    if (!chunk) throw new Error(`No emitted chunk for requested preload ${request.module}`)
    return `<link rel="modulepreload" href="${ASSET_PREFIX}${chunk.file}" fetchpriority="${request.priority ?? "auto"}" />`
  }))
  const shell = join(distDir, "index.html")
  await Bun.write(shell, (await Bun.file(shell).text()).replace("</head>", `${links.join("\n")}</head>`))
}

const buildClient = async (distDir: string): Promise<void> => {
  const resolver = createRequire(import.meta.resolve("@olai/bundle"))
  const entries = new Map(BROWSER_ROWS.map((row) => [resolver.resolve(row.specifier), row.id]))
  const browserModules: Record<string, string> = {}
  const moduleManifest: BunPlugin = {
    name: "olai-browser-module-urls",
    setup(build) {
      build.onEnd((result) => {
        if (!result.success) return
        if (!result.metafile) throw new Error("Browser module URLs require a build metafile")
        const meta = typeof result.metafile === "string" ? JSON.parse(result.metafile) : result.metafile
        for (const [file, output] of Object.entries(meta.outputs)) {
          const entry = (output as { entryPoint?: string }).entryPoint
          if (!entry) continue
          const id = entries.get(resolve(entry))
          if (id) browserModules[id] = `${ASSET_PREFIX}${basename(file)}`
        }
        for (const row of BROWSER_ROWS) if (!browserModules[row.id]) throw new Error(`No emitted browser entry for ${row.id}`)
      })
    },
  }
  // Bundle-owned static head contributions must precede deferred scripts and paint.
  const templateDir = mkdtempSync(join(tmpdir(), "olai-head-"))
  const template = join(templateDir, "index.html")
  const original = await Bun.file(resolve(CLIENT, "index.html")).text()
  await Bun.write(template, original.replace("</head>", `${BUILD_ASSETS.map((asset) => asset.head ?? "").join("\n")}</head>`))
  const { assets } = await buildSurfaceClient({
    entrypoint: resolve(CLIENT, "main.tsx"),
    distDir,
    // The same spelling the server pins — see `@olai/surface`'s ASSET_PREFIX.
    // Reported back on the result; two processes, so they share the constant
    // rather than a value one of them wrote.
    assetPrefix: ASSET_PREFIX,
    htmlTemplate: template,
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
    plugins: [solidJsx, moduleManifest],
  }).finally(() => rmSync(templateDir, { recursive: true, force: true }))
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
  await preloadAssets(distDir, assets)
  // Keep the bundler's immutable files intact. The uncached shell carries only
  // their URLs, derived from entryPoint metadata rather than parsed JS or guessed
  // hashes. A retry adds a query to the failed entry while sharing dependencies
  // with the original graph, preserving singleton runtimes and surviving state.
  const shell = join(distDir, "index.html")
  const html = await Bun.file(shell).text()
  await Bun.write(shell, html.replace("</head>", `<script id="${BROWSER_MODULES_ID}" type="application/json">${JSON.stringify(browserModules).replaceAll("<", "\\u003c")}</script></head>`))
  // Install stable public assets after the helper finishes replacing dist.
  for (const asset of BUILD_ASSETS) await asset.install?.(distDir)
}

if (import.meta.main) {
  const distDir = process.argv[2]
  if (distDir === undefined) {
    console.error("usage: bun packages/web/src/build.ts <distDir>")
    process.exit(1)
  }
  await buildClient(resolve(distDir))
}
