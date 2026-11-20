import { existsSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { DEFAULT_RUNTIMES, type Declaration, type Holder } from "@olai/effect-cordis/fence"

import { ROWS } from "./rows.ts"
import { MEMBER_OF_PACKAGE, PACKAGES, REPO, packageOf } from "./tree.testlib.ts"

const SETTINGS_RECORD = "not-a-plugin.json"

const COLLISIONS: Readonly<Record<string, Readonly<Record<string, number>>>> = (() => {
  const found: Record<string, Record<string, number>> = {}
  for (const member of MEMBER_OF_PACKAGE.values()) {
    const at = path.join(REPO, "packages", member, SETTINGS_RECORD)
    if (!existsSync(at)) continue
    let said: unknown
    try {
      said = JSON.parse(readFileSync(at, "utf8"))
    } catch (cause) {
      throw new Error(`fence: packages/${member}/${SETTINGS_RECORD} did not parse — ${String(cause)}`)
    }
    if (typeof said !== "object" || said === null || Array.isArray(said)) {
      throw new Error(`fence: packages/${member}/${SETTINGS_RECORD} must be an object of row to file counts`)
    }
    for (const [row, files] of Object.entries(said)) {
      if (row.startsWith("//")) continue
      if (typeof files !== "object" || files === null || Array.isArray(files)) {
        throw new Error(`fence: packages/${member}/${SETTINGS_RECORD}: "${row}" must be an object of file to count`)
      }
      for (const [file, count] of Object.entries(files)) {
        if (typeof count !== "number" || count < 1) {
          throw new Error(
            `fence: packages/${member}/${SETTINGS_RECORD}: "${row}" → "${file}" must be a positive count, ` +
              "because a recorded file that stopped spelling the word is exactly what this record is for",
          )
        }
        const at = `packages/${member}/${file}`
        ;(found[row] ??= {})[at] = count
      }
    }
  }
  return found
})()

const ROOTS = [
  { entry: "packages/web/src/client/main.tsx", graph: "browser" },
  { entry: "packages/server/src/serve.ts", graph: "node" },
] as const

const ALLOWANCES: Readonly<Record<string, string>> = {
  "packages/web/src/client/wire.ts": "the connection Wired brokers — plugin-system.md, what crosses the wire",
  "packages/web/src/host/runtime.ts": "the tab's one plugin host: what this document has mounted",
  "packages/web/src/client/topmost.ts": "the page's own layer stack, with no owner but the document",
  "packages/web/src/client/connection/focus.ts": "a re-entrancy guard, set and cleared inside one call",
  "packages/web/src/client/grumble.ts": "which warnings this page has already said, once each",
  "packages/web/src/client/file/matching.ts": "a WeakMap memo keyed on the list it folds",
  "packages/markdown-ui/src/render.ts": "a memo over immutable Claims, source and rendering options",
  "packages/markdown-ui/src/title.ts": "a memo over immutable Claims, title and rendering options",
  "packages/sigterm/src/sigterm.ts": "the process's signal handlers, for the life of the process",
  "packages/state/src/index.ts": "a per-process nonce for staged filenames",
  "packages/effect-cordis/src/host.ts": "a host's own close, keyed by that host",
  "packages/effect-cordis/src/lifecycle.ts": "the engine's activation table and each fiber's last start failure, keyed by fiber",
  "packages/effect-cordis/src/module.ts": "a module fiber's children, keyed by that fiber",

  "packages/format/src/filter.ts": "two WeakMap memos of a record's folded text, keyed by the record",
  "packages/format/src/set.ts": "a WeakMap memo of a set's derived reading, keyed by the set",
  "packages/format/src/suggest.ts": "a WeakMap memo of a known table's index, keyed by the table",
  "packages/format/src/tape.ts": "two WeakMap memos over a derived pair, keyed by the pair",
  "packages/format/src/typing.ts": "a WeakMap memo of a derivation's declared kinds, keyed by it",
  "packages/format/src/vocabulary.ts": "a WeakMap memo of a derivation's tag counts, keyed by it",
  "packages/format/src/validate.ts": "a WeakMap ledger memo, and one slot a suite installs a listener in",
}

const HOLDERS: ReadonlyArray<Holder> = [
  { from: /held\.ts$/, named: "heldService" },
  { from: /^@olai\/plugin-api$|plugin-api\/(src\/)?browser\.ts$/, named: "heldFaces" },
]

export const RUNTIMES: ReadonlyArray<RegExp> = [
  ...DEFAULT_RUNTIMES,
  /^@xterm\//,
  /^@kolu\/solid-[^/]+$/,
  /^@kolu\/terminal-themes(\/|$)/,
]

const ROW_PACKAGES: Readonly<Record<string, ReadonlyArray<string>>> = Object.fromEntries(
  ROWS.map((row) => {
    const member = MEMBER_OF_PACKAGE.get(packageOf(row.name))
    if (member === undefined) {
      throw new Error(`fence: the registry row \`${row.id}\` names \`${row.name}\`, which is no workspace member`)
    }
    return [row.id, [`packages/${member}`]]
  }),
)

export const DECLARATION: Declaration = {
  repo: REPO,
  rows: ROW_PACKAGES,
  roots: [...ROOTS],
  collisions: COLLISIONS,
  allowances: ALLOWANCES,
  holders: HOLDERS,
  runtimes: RUNTIMES,
}

export const RECORD_OF = (member: string): string => path.join(PACKAGES, member, SETTINGS_RECORD)
