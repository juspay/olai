/** Build-time appearance is a bundle contribution. These bytes may run before
 * the browser roster arrives; runtime state and cleanup belong to browser.tsx.
 * A build without this row gets no theme bootstrap, palette CSS or font files. */
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fontCss, FONTS_DIR, HOSTED_WOFF2 } from "@olai/fonts/build"
import { paletteCss } from "@olai/appearance/css.ts"
import { sizeCss } from "@olai/appearance/sizes.ts"
import { scaleCss } from "@olai/appearance/scale.ts"

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

export default {
  head: readFileSync(new URL("./head.html", import.meta.url), "utf8"),
  css: () => [scaleCss(), sizeCss(), paletteCss(), fontCss()].join("\n"),
  install: installFonts,
}
