import { inlineMark, MARK_TOKEN } from "./inline.ts"

const path = process.argv[2]
const revision = process.argv[3]
const from = process.argv[4]
if (path === undefined || revision === undefined || from === undefined) {
  throw new Error("usage: emit.ts <logo.svg> <revision> <from> — packages/plugin-kit/default.nix passes all three")
}

const { viewBox, body } = inlineMark(await Bun.file(path).text(), path)

process.stdout.write(
  [
    `// GENERATED from ${from} at revision ${revision} (npins/sources.json).`,
    "// Do not edit; do not commit. packages/plugin-kit/default.nix writes it.",
    "",
    `export const MARK_VIEWBOX = ${JSON.stringify(viewBox)}`,
    `export const MARK_TOKEN = ${JSON.stringify(MARK_TOKEN)}`,
    `export const MARK_BODY = ${JSON.stringify(body)}`,
    "",
  ].join("\n"),
)
