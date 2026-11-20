import SOURCES from "./hosted.json"

export const FONTS_DIR = "fonts"

export interface HostedFile {
  readonly file: string
  readonly family: string
  readonly weight: string
  readonly style: "normal" | "italic"
}

const styleOf = (value: string, file: string): HostedFile["style"] => {
  if (value === "normal" || value === "italic") return value
  throw new Error(
    `hosted.json: ${file} has style "${value}" — only "normal" and "italic" ` +
      `are @font-face styles this app writes`,
  )
}

export const HOSTED_FILES: ReadonlyArray<HostedFile> = SOURCES.flatMap(
  (source) =>
    source.faces.map((face) => ({
      file: face.file,
      family: source.family,
      weight: face.weight,
      style: styleOf(face.style, face.file),
    })),
)

export const woff2Name = (file: string): string =>
  file.replace(/\.(ttf|otf)$/i, ".woff2")
