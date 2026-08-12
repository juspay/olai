/**
 * The markdown chunk: built beside the entry, named on the shell.
 *
 * `src/client/markdown/pipeline.ts` is ~391 KB of `unified` + remark + rehype
 * + `highlight.js` grammars, and an outline's first paint does not use one byte
 * of it (`src/client/markdown/plain.ts` says why). So it is bundled ON ITS OWN
 * and fetched when something asks for markdown — a note opened, a document, the
 * agent's reply, a title that turns out to have marks in it.
 *
 * ## Why this is a second `Bun.build` and not a flag
 *
 * `buildSurfaceClient` sets `splitting: false` and takes no option to change
 * it, so a dynamic `import()` inside the app would be INLINED into
 * `main-*.js` — deferred in evaluation, identical on the wire, which is not
 * the thing worth doing. Building the chunk here is the same shape
 * `./precompress.ts` already is: a post-step olai owns because the helper does
 * not, flagged for upstream rather than patched into the Nix store package. A
 * `splitting?: boolean` on `buildSurfaceClient` (with the `[hash]` naming it
 * already gives entries) would let this file delete most of itself.
 *
 * What it does NOT re-derive is the contract: the chunk lands in the same
 * content-hashed `/assets/` as the entry (so it is pinned `immutable` and a
 * changed byte is a changed URL), it is compressed by the same post-step, and
 * it is named on the `no-store` shell the helper wrote — which is how the page
 * finds it, and why a rebuild of the chunk alone does not change `main-*.js`.
 */

import { basename, resolve } from "node:path"

import { ASSET_DIR } from "@kolu/surface-app"
import type { BunPlugin } from "bun"

import { MARKDOWN_META } from "./client/markdown/meta.ts"

/** What the template says before the build; the exact string rewritten in
 *  `<distDir>/index.html`. Assembled from the same constant the page reads the
 *  chunk's URL with, so the shell, the rewrite and the reader are one
 *  spelling. */
const placeholderOf = (content: string): string =>
  `<meta name="${MARKDOWN_META}" content="${content}" />`

const TEMPLATE_HREF = "./markdown.js"

export interface MarkdownChunk {
  /** The URL the shell now names, e.g. `/assets/markdown-a1b2c3d4.js`. */
  readonly href: string
  /** Bytes of the chunk itself — reported by the build, so a change in what
   *  the first paint does NOT have to fetch is a number somebody can see. */
  readonly bytes: number
}

/**
 * Build it, write it into `<distDir>/assets/`, and point the shell at it.
 *
 * Runs after `buildSurfaceClient` (which writes that shell) and before
 * `precompressAssets` (which then finds one more file to compress).
 */
export const buildMarkdownChunk = async (
  clientDir: string,
  distDir: string,
  plugins: BunPlugin[],
): Promise<MarkdownChunk> => {
  const assetsDir = resolve(distDir, ASSET_DIR)
  const result = await Bun.build({
    entrypoints: [resolve(clientDir, "markdown/pipeline.ts")],
    outdir: assetsDir,
    // Named for what it is rather than for the module it starts at: this URL
    // shows up in a network panel, in a CSP report and in the e2e scenario
    // that proves an outline of plain titles never asks for it.
    naming: "markdown-[hash].[ext]",
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "linked",
    plugins,
  })
  if (!result.success) {
    const detail = result.logs.map((log) => log.message).join("\n")
    throw new Error(`the markdown chunk failed to build\n${detail}`)
  }
  const entry = result.outputs.find(
    (output) => output.kind === "entry-point" && output.path.endsWith(".js"),
  )
  if (entry === undefined) {
    throw new Error("the markdown chunk build produced no JS entry output")
  }

  const href = `/${ASSET_DIR}/${basename(entry.path)}`
  await nameOnShell(distDir, href)
  // `entry` is a Blob over what was just written — its size is already known,
  // so nothing reads the chunk back off disk to count it.
  return { href, bytes: entry.size }
}

/** Rewrite the one `<meta>` in the shell. A placeholder that is not there is a
 *  template that stopped matching this file — loud, because the quiet version
 *  is a page whose markdown never arrives and cannot say why. */
const nameOnShell = async (distDir: string, href: string): Promise<void> => {
  const shell = resolve(distDir, "index.html")
  const html = await Bun.file(shell).text()
  const placeholder = placeholderOf(TEMPLATE_HREF)
  if (!html.includes(placeholder)) {
    throw new Error(
      `${placeholder} is not in ${shell} — src/client/index.html must carry it ` +
        `byte for byte, or the page has no way to find the markdown chunk.`,
    )
  }
  await Bun.write(shell, html.replaceAll(placeholder, placeholderOf(href)))
}
