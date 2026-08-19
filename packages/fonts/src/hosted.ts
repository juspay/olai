/**
 * The files themselves — what the derivation converts and the build copies.
 *
 * The table is `./hosted.json`, and it is JSON for one reason: `default.nix`
 * reads THE SAME FILE. A hosted face is one thing — where its bytes come from
 * and what CSS identity they carry — and it used to be two lists in two
 * languages, a nixpkgs list here and a family/weight/style list there, joined
 * on a basename by a test that noticed when they drifted. Noticing drift is
 * not the same as being unable to drift. One list, two readers, nothing to
 * keep in step.
 *
 * Deliberately NOT in `./typefaces.ts`, and not on this package's main entry:
 * a browser never reads this table. It asks for `/fonts/<name>.woff2` because
 * a `@font-face` rule generated at BUILD time told it to, and that rule is the
 * only thing which ever names a file. Keeping the two apart is what stops
 * seventy filenames riding into every tab's first paint to be read by nobody.
 *
 * A `family` is the CSS name `@font-face` declares — chosen, not read out of
 * the font's own name table — so the stacks in `./typefaces.ts` can quote it.
 * That the two agree is `hosted.test.ts`'s.
 */

import SOURCES from "./hosted.json"

/** The one directory the faces live in — the dist subdirectory the build
 *  fills and the URL prefix the sheet asks for, which are the same directory
 *  seen from two sides. Spelled once, because renaming it in only one of them
 *  would compile, pass every test, and 404 in a browser. */
export const FONTS_DIR = "fonts"

/** One face this app serves from `/fonts/*.woff2`. `file` is the SOURCE
 *  basename `../default.nix` converts; what lands in `OLAI_FONTS_DIR`, and
 *  what the sheet asks for, is `woff2Name` of it. */
export interface HostedFile {
  readonly file: string
  readonly family: string
  /** A single weight (`"400"`) or a variable range (`"100 900"`). */
  readonly weight: string
  readonly style: "normal" | "italic"
}

/** JSON arrives as `string`, and this is the one field where that is not
 *  good enough: a typo would reach the sheet as `font-style: itallic` and be
 *  a face that silently never applies. Parsed here, once, loudly. */
const styleOf = (value: string, file: string): HostedFile["style"] => {
  if (value === "normal" || value === "italic") return value
  throw new Error(
    `hosted.json: ${file} has style "${value}" — only "normal" and "italic" ` +
      `are @font-face styles this app writes`,
  )
}

/** Every file this app hosts, flattened out of the per-source groups. Deduped
 *  by construction: a family used by two picks (Olai and Literata, Atkinson
 *  the pick and Atkinson-as-a-pick) is listed once. */
export const HOSTED_FILES: ReadonlyArray<HostedFile> = SOURCES.flatMap(
  (source) =>
    source.faces.map((face) => ({
      file: face.file,
      family: source.family,
      weight: face.weight,
      style: styleOf(face.style, face.file),
    })),
)

/** The woff2 basename the sheet asks for and the build copies.
 *
 *  The derivation spells the same rule a second time, in shell
 *  (`''${base%.*}.woff2` — it names the OUTPUT of `woff2_compress`, which is
 *  not a name it is given). Two spellings of "swap the extension" is the
 *  smallest seam left in this package, and the build's own by-name lookup is
 *  what would fail if they ever disagreed. */
export const woff2Name = (file: string): string =>
  file.replace(/\.(ttf|otf)$/i, ".woff2")
