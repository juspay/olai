import { load } from "js-yaml"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "src")

declare const WORD: unique symbol

type RowWord = string & { readonly [WORD]: true }

interface Row {
  readonly id: RowWord
  readonly name: RowWord
  readonly disabled?: boolean
  readonly profiles?: ReadonlyArray<string>
  readonly switchHint?: string
  readonly section: string
  readonly label?: string
  readonly quiet?: boolean
}

function readRows(): ReadonlyArray<Row> {
  const file = resolve(HERE, "olai.yml")
  const parsed = load(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed)) throw new Error(`bundle: ${file} is not a list of rows`)
  return parsed.map((row: unknown, at: number): Row => {
    const one = row as Partial<Omit<Row, "id" | "name">> & { readonly id?: string; readonly name?: string }
    if (typeof one?.id !== "string" || typeof one?.name !== "string") {
      throw new Error(`bundle: row ${at} of ${file} needs an \`id\` and a \`name\``)
    }
    if (one.profiles !== undefined && (!Array.isArray(one.profiles) || one.profiles.some((profile) => typeof profile !== "string"))) throw new Error(`bundle: ${one.id} profiles must be words`)
    if (one.switchHint !== undefined && typeof one.switchHint !== "string") throw new Error(`bundle: ${one.id} switchHint must be a sentence`)
    if (typeof one.section !== "string" || one.section.length === 0) throw new Error(`bundle: ${one.id} needs a \`section\` for the plugins panel`)
    if (one.label !== undefined && (typeof one.label !== "string" || one.label.length === 0)) throw new Error(`bundle: ${one.id} label must be a name`)
    if (one.quiet !== undefined && one.quiet !== true) throw new Error(`bundle: ${one.id} quiet must be true when present`)
    if ("config" in one) throw new Error(`bundle: ${one.id} config belongs to its plugin schema, not olai.yml`)
    return {
      id: rowWord(one.id, `row ${at} of ${file}: id`),
      name: rowWord(one.name, `${one.id}: name`),
      section: one.section,
      ...(one.label === undefined ? {} : { label: one.label }),
      ...(one.disabled === true ? { disabled: true } : {}),
      ...(one.profiles === undefined ? {} : { profiles: one.profiles }),
      ...(one.switchHint === undefined ? {} : { switchHint: one.switchHint }),
      ...(one.quiet === true ? { quiet: true } : {}),
    }
  })
}

const ROW_WORD = /^[@A-Za-z0-9._/-]+$/

const rowWord = (value: string, what: string): RowWord => {
  if (!ROW_WORD.test(value)) {
    throw new Error(
      `bundle: ${what} is ${JSON.stringify(value)}, which is not a plugin's word — a row's \`id\` and `
        + "`name` are letters, digits, `@`, `.`, `_`, `-` and `/`, because this generator writes them "
        + "into source and splices them into module specifiers",
    )
  }
  return value as RowWord
}

const packageOf = (row: Row): string => {
  const at = row.name.indexOf("/")
  return at === -1 ? row.name : row.name.slice(0, at)
}

const packageDirOf = (row: Row): string => {
  let directory = dirname(Bun.resolveSync(row.name, HERE))
  while (!existsSync(join(directory, "package.json"))) {
    const parent = dirname(directory)
    if (parent === directory) throw new Error(`bundle: no manifest for ${row.name}`)
    directory = parent
  }
  return directory
}

const hasDoor = (row: Row, door: string): boolean => {
  const manifest = JSON.parse(readFileSync(join(packageDirOf(row), "package.json"), "utf8"))
  return Object.hasOwn(manifest.exports ?? {}, door)
}

const sourceLiteral = (value: string): string =>
  JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029")

function rowsModule(rows: ReadonlyArray<Row>): string {
  const server = rows
    .map((row) =>
      `  { id: ${sourceLiteral(row.id)}, name: ${sourceLiteral(row.name)}${hasDoor(row, "./server") ? "" : ", browserOnly: true"}${
        row.disabled === true ? ", disabled: true" : ""
      }${row.profiles === undefined ? "" : `, profiles: [${row.profiles.map(sourceLiteral).join(", ")}]`}${row.switchHint === undefined ? "" : `, switchHint: ${sourceLiteral(row.switchHint)}`}, section: ${sourceLiteral(row.section)}${row.label === undefined ? "" : `, label: ${sourceLiteral(row.label)}`}${row.quiet === true ? ", quiet: true" : ""} },`
    )
    .join("\n")
  const entries = rows
    .filter((row) => hasDoor(row, "./browser"))
    .map((row) =>
      `  { id: ${sourceLiteral(row.id)}, specifier: ${sourceLiteral(`${packageOf(row)}/browser`)}, load: () => import(${sourceLiteral(`${packageOf(row)}/browser`)}) },`
    )
    .join("\n")
  return `import type { BrowserRow, BundleRow } from "./rows.ts"

export const ROWS: ReadonlyArray<BundleRow> = [
${server}
]

export const BROWSER_ROWS: ReadonlyArray<BrowserRow> = [
${entries}
]
`
}

function styleChain(rows: ReadonlyArray<Row>): string {
  const imports = rows
    .filter((row) => hasDoor(row, "./all.css"))
    .map((row) => `@import ${sourceLiteral(`${packageOf(row)}/all.css`)};`)
    .join("\n")
  return `${imports}
`
}

function testidsModule(rows: ReadonlyArray<Row>): string {
  const names = rows.map((_, at) => `p${at}`)
  const imports = rows
    .map((row, at) =>
      `import { TESTID as p${at} } from ${sourceLiteral(`${packageOf(row)}/testids`)}`
    )
    .join("\n")
  const pairs = names.flatMap((left, at) =>
    names.slice(at + 1).map((right) => `  | Extract<Vals<typeof ${left}>, Vals<typeof ${right}>>`)
  )
  const shared = pairs.length === 0 ? "type Shared = never" : `type Shared =\n${pairs.join("\n")}`
  const merged = names.length === 0 ? "{}" : `{ ${names.map((one) => `...${one}`).join(", ")} }`
  return `${imports}

type Assert<T extends true> = T
type Vals<T> = T[keyof T]
${shared}
type _NoSharedPluginId = Assert<[Shared] extends [never] ? true : Shared>

export const PLUGIN_TESTID = ${merged} as const
`
}

const rows = readRows()
writeFileSync(join(SRC, "rows.generated.ts"), rowsModule(rows))
writeFileSync(join(SRC, "all.generated.css"), styleChain(rows))
writeFileSync(join(SRC, "testids.generated.ts"), testidsModule(rows.filter((row) => hasDoor(row, "./testids"))))

const assetRows = rows.filter((row) => hasDoor(row, "./assets"))
writeFileSync(join(SRC, "assets.generated.ts"), `import type { BuildAssets } from "./assets.ts"
${assetRows.map((row, at) => `import p${at} from ${sourceLiteral(`${packageOf(row)}/assets`)}`).join("\n")}
export const BUILD_ASSETS: ReadonlyArray<BuildAssets> = [${assetRows.map((_, at) => `p${at}`).join(", ")}]
`)

const policyRows = rows.filter((row) => hasDoor(row, "./policy"))
writeFileSync(join(SRC, "policy.generated.ts"), `import type { WriteReservation } from "./policy.ts"
${policyRows.map((row, at) => `import { writeReservations as p${at} } from ${sourceLiteral(`${packageOf(row)}/policy`)}`).join("\n")}
export const WRITE_RESERVATIONS: ReadonlyArray<WriteReservation> = [${policyRows.map((_, at) => `...p${at}`).join(", ")}]
`)

const fakeRows = rows.filter((row) => hasDoor(row, "./e2e/fake"))
writeFileSync(join(SRC, "fakes.generated.ts"), `import type { Fake } from "./fake.ts"
export interface FakeRow { readonly id: string; readonly load: () => Promise<{ readonly fake: Fake }> }
export const FAKES_ROSTER: ReadonlyArray<FakeRow> = [
${fakeRows.map((row) => `  { id: ${sourceLiteral(row.id)}, load: () => import(${sourceLiteral(`${packageOf(row)}/e2e/fake`)}) },`).join("\n")}
]
`)

const knobNames = rows.flatMap((row) => {
  const manifest = JSON.parse(readFileSync(join(packageDirOf(row), "package.json"), "utf8")) as { olai?: { knobs?: Record<string, unknown> } }
  return Object.keys(manifest.olai?.knobs ?? {})
})
writeFileSync(join(SRC, "knobs.generated.ts"), `export const KNOBS: ReadonlyArray<string> = [${knobNames.map(sourceLiteral).join(", ")}]
`)
