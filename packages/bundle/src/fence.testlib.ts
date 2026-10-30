/**
 * THE DECLARATION OLAI FEEDS THE DOOR — and the one place a person writes the
 * three things no reading of the tree can derive.
 *
 * `@olai/effect-cordis/fence` answers five claims over a DECLARATION: which rows
 * there are, which files are roots, and which lexical collisions a row's word is
 * recorded in. Everything else — a package's doors, a package's row, which graph
 * kind a door belongs to — is read off the tree.
 *
 * ## What is derived here and what is written
 *
 * - **rows** come from the generated registry, which is this build's ONE place a
 *   plugin is named (`olai.yml` → `src/rows.generated.ts`). The door takes a
 *   record rather than a list because a row may span several packages, and the
 *   registry says which member each row's module lives in.
 * - **roots** are the two entries a person mounts: the tab's and the serve's.
 *   That is a claim about the build — these files may name more than one row —
 *   and no reading of the tree can make it.
 * - **collisions** are the `not-a-plugin.json` records, which live beside the
 *   files they name so a rename inside a row is a diff inside that row. Each is
 *   an EXACT count: a second occurrence in the same file is red, and so is a
 *   file that stopped spelling the word.
 * - **allowances** are the modules that hold live state behind a door on
 *   purpose, each with the argument for why the state is not an activation's.
 *   They are held as an equality — red the day the list grows, red again the day
 *   an entry stops being reachable or stops holding anything.
 * - **holders** are this tree's own slot factories: a call to one mints exactly
 *   the state the live-state claim hunts, under a `const` and with no `let` in
 *   sight. `@olai/plugin-api` is a package the door may not name, so the two
 *   doors are supplied here.
 * - **runtimes** are what a node root's walk may not reach. It is olai's list,
 *   not the door's default, because a daemon here must not evaluate an emulator
 *   either.
 */

import { existsSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { DEFAULT_RUNTIMES, type Declaration, type Holder } from "@olai/effect-cordis/fence"

import { ROWS } from "./rows.ts"
import { MEMBER_OF_PACKAGE, PACKAGES, REPO, packageOf } from "./tree.testlib.ts"

const SETTINGS_RECORD = "not-a-plugin.json"

/** Each member's recorded collisions, as the door wants them: row → file →
 *  count, with the file repo-relative because that is what a failure prints.
 *
 *  A record that is there and will not parse is a THROW: answering nothing for
 *  it would forgive every collision it was holding, in silence. */
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

/** The tab's entry and the serve's — the two files allowed to name more than one
 *  row, and the two graphs every chunk and every mounted module must agree
 *  with. */
const ROOTS = [
  { entry: "packages/web/src/client/main.tsx", graph: "browser" },
  { entry: "packages/server/src/serve.ts", graph: "node" },
] as const

/**
 * WHAT MAY HOLD LIVE STATE BEHIND A DOOR, and why each is not an activation's.
 *
 * The reason is the entry: a module that grows one of these without one is a
 * module somebody has to argue for in review rather than add to a list. Every
 * one is a process's, a page's, a memo over immutable input, or the one declared
 * broker §6 establishes.
 */
const ALLOWANCES: Readonly<Record<string, string>> = {
  // THE §6 BROKER. `Wired` promises a stable client whose subscriptions and
  // calls follow the connection, and this module is what keeps that promise: one
  // connection object for the life of the tab, redialled on a roster change,
  // with the sibling clients mutated in place. A DECLARED broker whose readers
  // name `Wired`, which is the distinction the audit's §5 draws — not a module
  // variable standing in for a service nobody declared.
  "packages/web/src/client/wire.ts": "the connection Wired brokers — plugin-system.md §6",
  // THE PAGE'S MOUNTED ROSTER, which `wire.ts` composes through. What is mounted,
  // what failed to load and whether the page must reload are facts about the
  // DOCUMENT: one host per tab, created before the first plugin starts and gone
  // when the tab is. A row that took ownership would be a row whose withdrawal
  // decided what the page still has running.
  "packages/web/src/host/runtime.ts": "the tab's one plugin host: what this document has mounted",
  // THE PAGE'S LAYER STACK. What is on top is a fact about the DOCUMENT, and its
  // lifetime is the document's: a popover pushes while it is open and pops when
  // it shuts, and there is no activation whose stop should empty it.
  "packages/web/src/client/topmost.ts": "the page's own layer stack, with no owner but the document",
  // ...AND ONE BOOLEAN HELD ACROSS ONE SYNCHRONOUS CALL. `withOfflineFocus` sets
  // it, calls, and clears it in a `finally`; nothing observes it between turns.
  // It is a re-entrancy guard rather than state.
  "packages/web/src/client/connection/focus.ts": "a re-entrancy guard, set and cleared inside one call",
  // A WARN-ONCE SET. What it holds is which sentences this page has already
  // said, so a loop cannot fill somebody's console with one line.
  "packages/web/src/client/grumble.ts": "which warnings this page has already said, once each",
  // A MEMO OVER AN IMMUTABLE INPUT, keyed by identity, so the same list answers
  // the same fold and a new list computes a new one.
  "packages/web/src/client/file/matching.ts": "a WeakMap memo keyed on the list it folds",
  "packages/markdown-ui/src/render.ts": "a memo over immutable Claims, source and rendering options",
  "packages/markdown-ui/src/title.ts": "a memo over immutable Claims, title and rendering options",
  // THE PROCESS'S OWN SIGNALS. `sigterm` installs a handler on the binary and
  // remembers what it replaced; its lifetime is the process.
  "packages/sigterm/src/sigterm.ts": "the process's signal handlers, for the life of the process",
  // A COUNTER FOR STAGED FILENAMES: a per-process nonce, not a value anybody
  // reads.
  "packages/state/src/index.ts": "a per-process nonce for staged filenames",
  // THE ENGINE'S OWN BOOKKEEPING, keyed by the thing each entry is about: a
  // host's close, a fiber's activation, a module fiber's children. It is the
  // runtime's state in the one package this tree lets be an engine.
  "packages/effect-cordis/src/host.ts": "a host's own close, keyed by that host",
  "packages/effect-cordis/src/lifecycle.ts": "the engine's activation table and each fiber's last start failure, keyed by fiber",
  "packages/effect-cordis/src/module.ts": "a module fiber's children, keyed by that fiber",

  // MEMOS OVER IMMUTABLE INPUT, every one a `WeakMap` keyed by the value it
  // folds; a new input computes a new answer and the old entry goes with the
  // object it was about.
  "packages/format/src/filter.ts": "two WeakMap memos of a record's folded text, keyed by the record",
  "packages/format/src/set.ts": "a WeakMap memo of a set's derived reading, keyed by the set",
  "packages/format/src/suggest.ts": "a WeakMap memo of a known table's index, keyed by the table",
  "packages/format/src/tape.ts": "two WeakMap memos over a derived pair, keyed by the pair",
  "packages/format/src/typing.ts": "a WeakMap memo of a derivation's declared kinds, keyed by it",
  "packages/format/src/vocabulary.ts": "a WeakMap memo of a derivation's tag counts, keyed by it",
  // ...and one file with a memo AND a diagnostic slot: `watching(null)` is the
  // default, a suite installs a listener for the length of its own case, and
  // what it hears is every narrowed write rather than any activation's value.
  "packages/format/src/validate.ts": "a WeakMap ledger memo, and one slot a suite installs a listener in",
  // A REGEX CURSOR, which is a `lastIndex` and not a value: the scan sets it to 0
  // before it starts and moves it as it goes.
  "packages/plugin-build/src/bind.ts": "a sticky regex's cursor, reset at the top of every scan",
}

/** This tree's two holder factories, by the door each comes from. */
const HOLDERS: ReadonlyArray<Holder> = [
  { from: /held\.ts$/, named: "heldService" },
  { from: /^@olai\/plugin-api$|plugin-api\/(src\/)?browser\.ts$/, named: "heldFaces" },
]

/**
 * WHAT A NODE ROOT'S WALK MAY NOT REACH — the door's default words PLUS this
 * build's, spread rather than restated.
 *
 * A hand copy is how `react` gets dropped: the default list exists because Bun's
 * default JSX runtime is React's, and a consumer who typed its own list would
 * lose exactly the entry the door's comment is about. `fence.test.ts` imports
 * THIS constant for the same reason — one spelling.
 */
export const RUNTIMES: ReadonlyArray<RegExp> = [
  ...DEFAULT_RUNTIMES,
  /^@xterm\//,
  /^@kolu\/solid-[^/]+$/,
  /^@kolu\/terminal-themes(\/|$)/,
]

/** One row per registry entry, mapped to the member its module lives in — so a
 *  rename moves it without an edit here. */
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

/** Where a collision record lives, for the claim that every recorded file is a
 *  file this build still has. */
export const RECORD_OF = (member: string): string => path.join(PACKAGES, member, SETTINGS_RECORD)
