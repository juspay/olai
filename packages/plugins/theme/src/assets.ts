import { chmodSync, cpSync, existsSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { fontCss, fontPreloadHtml, FONTS_DIR, HOSTED_WOFF2 } from "@olai/fonts/build"
import { paletteCss } from "@olai/appearance/css.ts"
import { shellHead } from "@olai/appearance/shell.ts"
import { sizeCss } from "@olai/appearance/sizes.ts"
import { scaleCss } from "@olai/appearance/scale.ts"

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

export default {
  head: `${shellHead()}
${fontPreloadHtml()}`,
  css: () => [scaleCss(), sizeCss(), paletteCss(), fontCss()].join("\n"),
  install: installFonts,
}
