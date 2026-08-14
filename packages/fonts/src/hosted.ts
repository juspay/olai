/**
 * The files themselves — what the derivation converts and the build copies.
 *
 * Deliberately NOT in `./typefaces.ts`, and not on this package's main entry:
 * a browser never reads this table. It asks for `/fonts/<name>.woff2` because
 * a `@font-face` rule generated at BUILD time told it to, and that rule is the
 * only thing which ever names a file. Keeping the two apart is what stops
 * seventy filenames riding into every tab's first paint to be read by nobody.
 *
 * A `family` here is the CSS name `@font-face` declares — chosen, not read out
 * of the font's own name table — so the stacks in `./typefaces.ts` can quote
 * it. That the two agree is `hosted.test.ts`'s.
 */

export interface HostedFile {
  readonly file: string
  readonly family: string
  /** A single weight (`"400"`) or a variable range (`"100 900"`). */
  readonly weight: string
  readonly style: "normal" | "italic"
}

const face = (
  file: string,
  family: string,
  weight: string,
  style: HostedFile["style"] = "normal",
): HostedFile => ({ file, family, weight, style })

const statics = (
  family: string,
  files: {
    readonly regular: string
    readonly italic?: string
    readonly bold?: string
    readonly boldItalic?: string
  },
): ReadonlyArray<HostedFile> => [
  face(files.regular, family, "400"),
  ...(files.italic === undefined
    ? []
    : [face(files.italic, family, "400", "italic")]),
  ...(files.bold === undefined ? [] : [face(files.bold, family, "700")]),
  ...(files.boldItalic === undefined
    ? []
    : [face(files.boldItalic, family, "700", "italic")]),
]

/** Every file this app hosts. Deduped by construction: a family used by
 *  two rows (Olai and Literata, Atkinson the default and Atkinson the pick)
 *  is listed once. */
export const HOSTED_FILES: ReadonlyArray<HostedFile> = [
  ...statics("Literata", {
    regular: "Literata-Regular.ttf",
    italic: "Literata-Italic.ttf",
    bold: "Literata-Bold.ttf",
    boldItalic: "Literata-BoldItalic.ttf",
  }),
  ...statics("iA Writer Quattro", {
    regular: "iAWriterQuattroS-Regular.ttf",
    italic: "iAWriterQuattroS-Italic.ttf",
    bold: "iAWriterQuattroS-Bold.ttf",
    boldItalic: "iAWriterQuattroS-BoldItalic.ttf",
  }),
  face("iAWriterMonoV.ttf", "iA Writer Mono", "100 900"),
  face("iAWriterMonoV-Italic.ttf", "iA Writer Mono", "100 900", "italic"),
  ...statics("Source Sans 3", {
    regular: "SourceSans3-Regular.ttf",
    italic: "SourceSans3-It.ttf",
    bold: "SourceSans3-Bold.ttf",
    boldItalic: "SourceSans3-BoldIt.ttf",
  }),
  ...statics("Source Serif 4", {
    regular: "SourceSerif4-Regular.ttf",
    italic: "SourceSerif4-It.ttf",
    bold: "SourceSerif4-Bold.ttf",
    boldItalic: "SourceSerif4-BoldIt.ttf",
  }),
  ...statics("Atkinson Hyperlegible Next", {
    regular: "AtkinsonHyperlegibleNext-Regular.ttf",
    italic: "AtkinsonHyperlegibleNext-Italic.ttf",
    bold: "AtkinsonHyperlegibleNext-Bold.ttf",
    boldItalic: "AtkinsonHyperlegibleNext-BoldItalic.ttf",
  }),
  face("et-book-roman-old-style-figures.ttf", "ET Book", "400"),
  face("et-book-display-italic-old-style-figures.ttf", "ET Book", "400", "italic"),
  face("et-book-bold-line-figures.ttf", "ET Book", "700"),
  face("FiraCode-VF.ttf", "Fira Code", "300 700"),
  ...statics("Geist Mono", {
    regular: "GeistMono-Regular.ttf",
    italic: "GeistMono-Italic.ttf",
    bold: "GeistMono-Bold.ttf",
    boldItalic: "GeistMono-BoldItalic.ttf",
  }),
  ...statics("IBM Plex Mono", {
    regular: "IBMPlexMono-Regular.ttf",
    italic: "IBMPlexMono-Italic.ttf",
    bold: "IBMPlexMono-Bold.ttf",
    boldItalic: "IBMPlexMono-BoldItalic.ttf",
  }),
  ...statics("IBM Plex Sans", {
    regular: "IBMPlexSans-Regular.ttf",
    italic: "IBMPlexSans-Italic.ttf",
    bold: "IBMPlexSans-Bold.ttf",
    boldItalic: "IBMPlexSans-BoldItalic.ttf",
  }),
  face("InterVariable.ttf", "Inter", "100 900"),
  face("InterVariable-Italic.ttf", "Inter", "100 900", "italic"),
  ...statics("JetBrains Mono", {
    regular: "JetBrainsMono-Regular.ttf",
    italic: "JetBrainsMono-Italic.ttf",
    bold: "JetBrainsMono-Bold.ttf",
    boldItalic: "JetBrainsMono-BoldItalic.ttf",
  }),
  ...statics("Junicode", {
    regular: "Junicode-Regular.ttf",
    italic: "Junicode-Italic.ttf",
    bold: "Junicode-Bold.ttf",
    boldItalic: "Junicode-BoldItalic.ttf",
  }),
  ...statics("Lexend", {
    regular: "Lexend-Regular.ttf",
    bold: "Lexend-Bold.ttf",
  }),
  ...statics("OpenDyslexic", {
    regular: "OpenDyslexic-Regular.otf",
    italic: "OpenDyslexic-Italic.otf",
    bold: "OpenDyslexic-Bold.otf",
    boldItalic: "OpenDyslexic-Bold-Italic.otf",
  }),
  ...statics("Open Sans", {
    regular: "OpenSans-Regular.ttf",
    italic: "OpenSans-Italic.ttf",
    bold: "OpenSans-Bold.ttf",
    boldItalic: "OpenSans-BoldItalic.ttf",
  }),
  ...statics("Crimson Pro", {
    regular: "CrimsonPro-Regular.ttf",
    italic: "CrimsonPro-Italic.ttf",
    bold: "CrimsonPro-Bold.ttf",
    boldItalic: "CrimsonPro-BoldItalic.ttf",
  }),
  ...statics("Vollkorn", {
    regular: "Vollkorn-Regular.ttf",
    italic: "Vollkorn-Italic.ttf",
    bold: "Vollkorn-Bold.ttf",
    boldItalic: "Vollkorn-BoldItalic.ttf",
  }),
  ...statics("Commit Mono", {
    regular: "CommitMono-400-Regular.ttf",
    italic: "CommitMono-400-Italic.ttf",
    bold: "CommitMono-700-Regular.ttf",
    boldItalic: "CommitMono-700-Italic.ttf",
  }),
]

/** The woff2 basename the sheet asks for, the derivation writes and the build
 *  copies — one rule, three readers. */
export const woff2Name = (file: string): string =>
  file.replace(/\.(ttf|otf)$/i, ".woff2")
