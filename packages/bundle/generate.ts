/**
 * THE ROWS, AS CODE — three generated files out of one `olai.yml`, so that file
 * is the ONLY place a plugin is named.
 *
 * ## Why anything is generated at all
 *
 * The server mounts its rows by NAME, through the loader, so `--plugins` is a
 * patch over data and a plugin's presence is a runtime fact. The browser could
 * not do that: its bundle is built ahead of time and there is no loader in the
 * tab, so it kept COMPILED-IN LISTS — `WIRES` and `PLUGINS`, hand-written, held
 * equal to the rows by a test whose whole job was to notice when somebody
 * edited two of three lists. That test was a monument to the duplication rather
 * than a fix for it, and the human's bar (2026-09-02) is that olai is one app:
 * a change that finishes the server half and covers the seam with a test does
 * not merge.
 *
 * What the browser genuinely cannot do is resolve a specifier it computes — a
 * bundler splits on a LITERAL `import()` and nothing else, so `import(`olai-plugin-${id}`)`
 * would neither split nor resolve. That is not a reason to hand-write the list;
 * it is a reason to WRITE it, from the rows, at the one moment a literal is
 * still something a program can emit. Hence this.
 *
 * ## Three files, because a plugin's name is spellable in three grammars
 *
 *   - `src/rows.generated.ts` — one row per plugin with a dynamic `import()` of
 *     its browser half. The literal specifier is what makes each plugin its own
 *     CHUNK, which is the browser's form of *no fiber, no surface, no handler*:
 *     a plugin the roster does not name is never fetched, never evaluated and
 *     registers nothing.
 *   - `src/all.generated.css` — the stylesheet chain. A `@import` is a door a
 *     plugin's name can be spelled through, and `fence.test.ts` reads one.
 *   - `src/testids.generated.ts` — every plugin's `data-testid` table, merged,
 *     with the pairwise disjointness proof the hand-written merge carried. It
 *     is generated for the same reason the other two are and it keeps its
 *     proof: a spread resolves a collision silently, so the assertion is what
 *     makes one a type error rather than a scenario that fails thirty seconds
 *     later with a timeout that says nothing.
 *
 * ## GENERATED, GITIGNORED, and produced beside the hydrated sources
 *
 * `just install` runs this, and so does the nix build's
 * `postBunNodeModulesInstallPhase` — the same place a tenant's mark is
 * installed, and for the same reason stated there: `fileset.toSource` takes
 * TRACKED content only, so a generated file is never in the store copy of the
 * tree and a packaged build is structurally incapable of shipping a stale one.
 *
 * A checked-in artefact was the alternative and loses on the argument the
 * justfile already makes about `bun.nix`: it is stale for as long as nobody
 * runs the generator, and the check that would catch it is one more leg.
 */

import { load } from "js-yaml"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "src")

/** One row. `disabled` is the row's own built-in default and rides into the
 *  emitted `ROWS`, because the composition root reads it to decide what an
 *  omitted `--plugins` runs. It reaches NONE of the other three files: what a
 *  build HAS and what a serve RUNS are two questions, and the browser learns
 *  the second off the roster cell at runtime, which is the whole of why a
 *  disabled plugin's chunk is fetched by nobody rather than absent from the
 *  build. */
interface Row {
  readonly id: string
  readonly name: string
  readonly disabled?: boolean
}

/** The rows, from the one file. It is read here rather than imported from
 *  `src/bundle.ts` so the generator does not depend on the tree it writes into:
 *  a generated file that will not compile must not stop the generator that
 *  rewrites it. */
function readRows(): ReadonlyArray<Row> {
  const file = resolve(HERE, "olai.yml")
  const parsed = load(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed)) throw new Error(`bundle: ${file} is not a list of rows`)
  return parsed.map((row: unknown, at: number) => {
    const one = row as Partial<Row>
    if (typeof one?.id !== "string" || typeof one?.name !== "string") {
      throw new Error(`bundle: row ${at} of ${file} needs an \`id\` and a \`name\``)
    }
    return { id: one.id, name: one.name, ...(one.disabled === true ? { disabled: true } : {}) }
  })
}

/** THE PACKAGE a row's module lives in — the module specifier with its subpath
 *  taken off. A row names `olai-plugin-kolu/server` because that is what the
 *  LOADER mounts; the browser half is that package's `./browser`, and the
 *  stylesheet and the testids are two more subpaths of the same package. One
 *  spelling in the file, four doors off it. */
/**
 * A ROW'S OWN WORD, AS A SOURCE LITERAL — checked rather than escaped.
 *
 * Everything this generator emits is a quoted string in a file a compiler then
 * reads, and `JSON.stringify` is not a JavaScript-string escaper: JSON admits
 * U+2028 and U+2029 raw, and both are LINE TERMINATORS in source, so a value
 * carrying one closes the literal and the rest of the row becomes code
 * (`js/bad-code-sanitization`).
 *
 * The honest answer here is not a better escaper. A row's `id` is a plugin's
 * name — the sibling key, the word `--plugins` takes, the docs slug — and its
 * `name` is a module specifier; neither has ever been anything but letters,
 * digits and a few separators, and a row carrying a line terminator is a
 * malformed row rather than an exotic one. So this REFUSES it, in the file that
 * would otherwise have written it out, and `olai.yml` is the one place a person
 * edits.
 *
 * A WHITELIST and not a blacklist, for the reason every check like this is: a
 * list of what is allowed cannot be short by one character the way a list of
 * what is forbidden always eventually is.
 */
const WORDS = /^[@A-Za-z0-9._/-]+$/

const quoted = (word: string): string => {
  if (!WORDS.test(word)) {
    throw new Error(
      `bundle: ${JSON.stringify(word)} is not a plugin's word — a row's \`id\` and `
        + "`name` are letters, digits, `@`, `.`, `_`, `-` and `/`, and this generator "
        + "writes them into source rather than escaping them",
    )
  }
  return `"${word}"`
}

const packageOf = (row: Row): string => {
  const at = row.name.indexOf("/")
  return at === -1 ? row.name : row.name.slice(0, at)
}

const HEADER = (from: string) =>
  `// GENERATED from packages/bundle/olai.yml by packages/bundle/generate.ts.\n` +
  `// Do not edit: \`just install\` rewrites it, and the nix build rewrites it in\n` +
  `// its sandbox. Add a plugin by adding a ROW, which is the whole of the edit.\n` +
  `// ${from}\n`

function rowsModule(rows: ReadonlyArray<Row>): string {
  // THE SERVER'S ROWS, as data. They used to be read out of the `.yml` at
  // module load with `js-yaml` — one file, two readers, which was the honest
  // shape while nothing else was generated. It costs more than it buys now:
  // that read put `node:fs` and a YAML parser on the graph of a door whose only
  // other job is to name plugins, and `@olai/tests` and the browser both open
  // it. Emitting them keeps the ONE SOURCE — this generator reads the same
  // file, and `@cordisjs/plugin-include` still reads it itself at mount, which
  // is what makes `--plugins` a patch over rows rather than a filter in code.
  // SPELLED FIELD BY FIELD, through the same check the two doors below use.
  // `JSON.stringify(row)` emitted the whole object and was the last place a
  // row's own words reached this file without passing {@link quoted} — the
  // hazard is not the shape, it is that a JSON string and a JavaScript string
  // disagree about two characters, and an object literal carries strings just as
  // a specifier does.
  const server = rows
    .map((row) =>
      `  { id: ${quoted(row.id)}, name: ${quoted(row.name)}${
        row.disabled === true ? ", disabled: true" : ""
      } },`
    )
    .join("\n")
  const entries = rows
    .map((row) =>
      `  { id: ${quoted(row.id)}, load: () => import(${
        quoted(`${packageOf(row)}/browser`)
      }) },`
    )
    .join("\n")
  return `${HEADER("Every row, twice: what a composition root mounts and what the tab loads.")}
import type { BrowserRow, BundleRow } from "./rows.ts"

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
    .map((row) => `@import ${quoted(`${packageOf(row)}/all.css`)};`)
    .join("\n")
  return `/* GENERATED from packages/bundle/olai.yml by packages/bundle/generate.ts.
 * Do not edit. ./all.css is the door and carries the argument; this is the
 * chain. */
${imports}
`
}

function testidsModule(rows: ReadonlyArray<Row>): string {
  const names = rows.map((_, at) => `p${at}`)
  const imports = rows
    .map((row, at) =>
      `import { TESTID as p${at} } from ${quoted(`${packageOf(row)}/testids`)}`
    )
    .join("\n")
  // EVERY PAIR, because disjointness is not transitive: a and b sharing nothing
  // and b and c sharing nothing says nothing at all about a and c.
  const pairs = names.flatMap((left, at) =>
    names.slice(at + 1).map((right) => `  | Extract<Vals<typeof ${left}>, Vals<typeof ${right}>>`)
  )
  const shared = pairs.length === 0 ? "type Shared = never" : `type Shared =\n${pairs.join("\n")}`
  const merged = names.length === 0 ? "{}" : `{ ${names.map((one) => `...${one}`).join(", ")} }`
  return `${HEADER("Every plugin's test ids, merged, with the collision made unrepresentable.")}
${imports}

type Assert<T extends true> = T
type Vals<T> = T[keyof T]
${shared}
type _NoSharedPluginId = Assert<[Shared] extends [never] ? true : Shared>

export const PLUGIN_TESTID = ${merged} as const
`
}

// LAST, because everything above is a declaration and the two `const` helpers
// are not hoisted — the writes read them, so they run where the file is whole.
const rows = readRows()
writeFileSync(join(SRC, "rows.generated.ts"), rowsModule(rows))
writeFileSync(join(SRC, "all.generated.css"), styleChain(rows))
writeFileSync(join(SRC, "testids.generated.ts"), testidsModule(rows))
