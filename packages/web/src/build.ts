import { start } from "@kolu/child"
import { mkdtempSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { transformAsync } from "@babel/core"
import babelTypeScript from "@babel/preset-typescript"
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
 * `@tailwindcss/cli` is invoked by its in-tree path, never `bunx`: bunx falls
 * back to fetching the package when the local copy does not match, and the Nix
 * build sandbox has no network.
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

const buildStylesheet = async (): Promise<ArrayBuffer> =>
  new Response(
    `${await tailwindUtilities()}\n${BUILD_ASSETS.map((asset) => asset.css?.() ?? "").join("\n")}`,
  ).arrayBuffer()

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
  const templateDir = mkdtempSync(join(tmpdir(), "olai-head-"))
  const template = join(templateDir, "index.html")
  const original = await Bun.file(resolve(CLIENT, "index.html")).text()
  await Bun.write(template, original.replace("</head>", `${BUILD_ASSETS.map((asset) => asset.head ?? "").join("\n")}</head>`))
  const { assets } = await buildSurfaceClient({
    entrypoint: resolve(CLIENT, "main.tsx"),
    distDir,
    assetPrefix: ASSET_PREFIX,
    htmlTemplate: template,
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
  for (const asset of assets) {
    const siblings = Object.entries(asset.siblings)
      .map(([encoding, size]) => ` ${encoding}=${size}B`)
      .join("")
    console.log(`asset: ${asset.file} ${asset.bytes}B${siblings}`)
  }
  await preloadAssets(distDir, assets)
  const shell = join(distDir, "index.html")
  const html = await Bun.file(shell).text()
  await Bun.write(shell, html.replace("</head>", `<script id="${BROWSER_MODULES_ID}" type="application/json">${JSON.stringify(browserModules).replaceAll("<", "\\u003c")}</script></head>`))
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
