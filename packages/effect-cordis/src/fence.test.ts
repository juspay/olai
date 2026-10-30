/**
 * THE DOOR, DRIVEN WITH A TOY WORKSPACE — no product noun in the file, on
 * purpose.
 *
 * Every claim here is made over a workspace written to a temp directory: two
 * rows (`alpha`, `beta`), one host, one roster and two roots. That is the same
 * shape `src/plugin.test.ts` takes with toy services, and for the same reason —
 * the door's subjects are ROWS, DOORS, ROOTS and NAMES, and a fixture built out
 * of them says what a claim is about without a reader having to hold one build
 * in their head. The moment a fixture needs a real product's word, the door has
 * grown a noun it does not own.
 *
 * The three halves:
 *
 *   - a CLEAN toy workspace, where each claim is asked on its own (a green
 *     report is not evidence until it is asked one claim at a time);
 *   - `prove`, which breaks a COPY of that workspace once per claim and asserts
 *     the claim that names each defect refused it — and did not colour another;
 *   - the reading itself, over the shapes it must catch and the legitimate
 *     twins it must pass — because a sweep is only ever as good as what it can
 *     SEE, and a pattern that stopped matching is GREEN everywhere.
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import {
  CLAIMS,
  cssImportsOf,
  type Declaration,
  DEFAULT_RUNTIMES,
  doorsOf,
  fence,
  intoCode,
  isBench,
  liveStateIn,
  type Manifest,
  prove,
  readWorkspace,
  rowsFromManifests,
  specifiersOf,
  withoutComments,
} from "./fence.ts"

// ── the fixture ────────────────────────────────────────────────────────

/** One file per path, the value its text. Paths are repo-relative and POSIX,
 *  which is what every reading in `fence.ts` speaks. */
type Files = Readonly<Record<string, string>>

const manifest = (fields: Manifest): string => JSON.stringify(fields, null, 2)

/**
 * A WORKSPACE ON DISK, for the length of one callback.
 *
 * The temp directory is the whole point: a fence that could only be asked about
 * the tree it lives in could not be tested at all, and `prove` would have no
 * copy to break.
 */
const withTree = <T>(files: Files, body: (repo: string) => T): T => {
  const repo = mkdtempSync(path.join(os.tmpdir(), "cordis-fence-test-"))
  try {
    for (const [file, text] of Object.entries(files)) {
      const at = path.join(repo, file)
      mkdirSync(path.dirname(at), { recursive: true })
      writeFileSync(at, text)
    }
    return body(repo)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

/**
 * THE CLEAN WORKSPACE — a host with one browser root and one node root, two
 * rows, a roster, and one door of each package a stranger opens.
 *
 * Three files earn their keep beyond the obvious:
 *
 *   - `host/src/shared.ts` imports `./faces.json`, so the walk reaches a DATA
 *     leaf. A copy `prove` makes that dropped non-source files would report a
 *     graph hole the real tree does not have.
 *   - `host/src/view.tsx` holds a regex containing `*​/` and JSX text with `//`
 *     in it, which is what a scanner-only comment stripper gets wrong.
 *   - `roster/src/rows.ts` names both rows as DATA — a loader's table — which
 *     is how a build that mounts rows by specifier composes them at all.
 */
const TOY: Files = {
  "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),

  "packages/host/package.json": manifest({
    name: "toy-host",
    exports: { ".": "./src/index.ts", "./shared": "./src/shared.ts" },
  }),
  "packages/host/src/index.ts": "export const host = 1\n",
  "packages/host/src/faces.json": manifest({ faces: 1 }),
  "packages/host/src/shared.ts": [
    'import faces from "./faces.json"',
    "export const shared = (n: number): number => n + faces.faces",
    "",
  ].join("\n"),
  // A regex whose body contains `/*`, a comment, and JSX text containing `//`:
  // a scanner cannot lex either, and a stripper that guessed would blank the
  // code between them.
  "packages/host/src/view.tsx": [
    "const pattern = /\\/\\*/",
    "// HIDE_ME alpha",
    "export const view = () => <div>{pattern.source} // still code</div>",
    'export const named = "keyword"',
    "",
  ].join("\n"),
  "packages/host/src/root.ts": [
    'import { host } from "./index.ts"',
    'import "toy-row-alpha/browser"',
    'import "toy-roster"',
    "export const root = host",
    "",
  ].join("\n"),
  "packages/host/src/server-root.ts": [
    'import { host } from "./index.ts"',
    'import "toy-row-beta/server"',
    "export const root = host",
    "",
  ].join("\n"),

  // The roster: a member a root reaches, that names every row as DATA.
  "packages/roster/package.json": manifest({ name: "toy-roster", exports: { ".": "./src/rows.ts" } }),
  "packages/roster/src/rows.ts": [
    "export const ROWS = [",
    '  { id: "alpha", name: "toy-row-alpha" },',
    '  { id: "beta", name: "toy-row-beta" },',
    "]",
    "",
  ].join("\n"),

  "packages/row-alpha/package.json": manifest({
    name: "toy-row-alpha",
    exports: { ".": "./src/index.ts", "./browser": "./src/browser.ts", "./contract": "./src/contract.ts" },
    cordis: { row: "alpha" },
  }),
  "packages/row-alpha/src/index.ts": "export const alpha = 1\n",
  "packages/row-alpha/src/contract.ts": 'export const NAME = "alpha"\n',
  "packages/row-alpha/src/browser.ts": [
    'import { NAME } from "./contract.ts"',
    'import { shared } from "toy-host/shared"',
    'import "solid-js"',
    "export const draw = () => NAME + shared(1)",
    "",
  ].join("\n"),

  "packages/row-beta/package.json": manifest({
    name: "toy-row-beta",
    exports: { ".": "./src/index.ts", "./server": "./src/server.ts" },
    cordis: { row: "beta" },
  }),
  "packages/row-beta/src/index.ts": "export const beta = 1\n",
  "packages/row-beta/src/server.ts": ['import { readFileSync } from "node:fs"', "export const read = readFileSync", ""].join("\n"),
}

/** The declaration the clean workspace is read by: the two entries as roots,
 *  and NO collisions — the state every consumer starts in, which the positive
 *  control must not call vacuous. */
const TOY_DECLARATION = {
  roots: [
    { entry: "packages/host/src/root.ts", graph: "browser" },
    { entry: "packages/host/src/server-root.ts", graph: "node" },
  ],
  collisions: {},
} as const

const declared = (repo: string, over: Partial<Declaration> = {}): Declaration => ({
  repo,
  rows: ["alpha", "beta"],
  roots: [...TOY_DECLARATION.roots],
  collisions: TOY_DECLARATION.collisions,
  ...over,
})

/** The clean workspace's report, one declaration, computed once — the shape a
 *  consumer's test file takes. */
const clean = (over: Partial<Declaration> = {}) =>
  withTree(TOY, (repo) => {
    const declaration = declared(repo, over)
    return { report: fence(declaration), repo, declaration }
  })

/** The clean workspace plus one appended line to an existing file — most of the
 *  defects below are one import a person added. */
const plus = (file: string, line: string): Files => ({ [file]: `${TOY[file] ?? ""}${line}\n` })

/** The clean workspace plus one broken file, as the sentences the named claim
 *  says. */
const broken = (files: Files, over: Partial<Declaration> = {}) =>
  withTree({ ...TOY, ...files }, (repo) => fence(declared(repo, over)))

// ── the clean workspace ────────────────────────────────────────────────

describe("a clean workspace", () => {
  const { report } = clean()

  test("the fence is green, with no collision record at all", () => {
    // The positive control is PER ROW (`names`), so "no collisions anywhere" is
    // the state a clean tree is allowed to be in — a global "the sweep found
    // something somewhere" would call this vacuous.
    expect(report.findings).toEqual([])
  })

  for (const claim of CLAIMS) {
    test(`...and \`${claim}\` is green on its own`, () => {
      expect(report.red(claim)).toEqual([])
    })
  }

  test("the reading is a reading of something", () => {
    // THE FLOORS, and they are the door's own counts: a floor stated against a
    // number a bench recomputed would be a floor over a second reading, and a
    // resolver that answered `undefined` once would move both together.
    const reading = report.reading
    expect(reading.members).toBe(4)
    expect(reading.rows).toBe(2)
    expect(reading.registry).toBe("packages/roster")
    expect(reading.production).toBeGreaterThan(10)
    expect(reading.compiled).toBeGreaterThan(10)
    expect(reading.doors).toBeGreaterThan(1)
    expect(reading.onARootWalk).toBeGreaterThan(3)
    expect(reading.sources).toBe(reading.production)
  })

  test("it names every row, from the manifests", () => {
    withTree(TOY, (repo) => {
      expect(Object.keys(rowsFromManifests(repo)).sort()).toEqual(["alpha", "beta"])
      expect(readWorkspace(repo).members).toHaveLength(4)
    })
  })
})

// ── prove ──────────────────────────────────────────────────────────────

describe("prove", () => {
  test("every claim catches the defect it is about, and nothing else notices", () => {
    const proof = withTree(TOY, (repo) => prove(declared(repo)))
    expect(proof.baseline).toEqual([])
    // FIVE CLAIMS, SIX MUTATIONS: `names` is planted twice, once as the
    // env-shaped knob (`_` is a separator) and once in the form a hyphenated row
    // is actually written in.
    expect(proof.mutations.map((one) => [one.claim, one.caught])).toEqual([
      ["imports", true],
      ["door-graphs", true],
      ["names", true],
      ["names", true],
      ["live-state", true],
      ["registry", true],
    ])
    // NO SPILL is part of `ok`: a mutation that reddened another claim has not
    // shown this one is awake, it has shown `prove` is over-eager. This is also
    // the regression test for the copy: without `host/src/faces.json`, every
    // mutation would spill into `door-graphs` as a graph hole.
    expect(proof.mutations.filter((one) => one.spill.length > 0)).toEqual([])
    expect(proof.ok).toBe(true)
  })

  test("a node-only consumer can prove its own claim", () => {
    // The plan follows the ROOT KIND: a builtin is the browser's defect and a UI
    // runtime is the node's, so a workspace with no browser root still has a
    // door-graphs mutation.
    const files: Files = {
      ...TOY,
      "packages/host/src/root.ts": 'import "toy-roster"\nexport const root = 1\n',
      "packages/host/src/server-root.ts": [
        'import { host } from "./index.ts"',
        'import "toy-row-beta/server"',
        'import "toy-row-alpha/contract"',
        'import "toy-roster"',
        "export const root = host",
        "",
      ].join("\n"),
    }
    const proof = withTree(files, (repo) =>
      prove(
        declared(repo, {
          roots: [{ entry: "packages/host/src/server-root.ts", graph: "node" }],
        }),
      ),
    )
    expect(proof.baseline).toEqual([])
    const graphs = proof.mutations.find((one) => one.claim === "door-graphs")
    expect(graphs?.caught).toBe(true)
    expect(graphs?.what).toContain("UI runtime")
    expect(proof.ok).toBe(true)
  })

  test("...and odu's shape: a root outside every package, rows from manifests, no roster", () => {
    // THE SECOND CONSUMER, EXACTLY: entries at `src/main.ts` beside the
    // packages, a node-only root, each row declaring itself on its own manifest,
    // and the root composing them by importing the row packages DIRECTLY. There
    // is no roster package in that layout, so `composed` has to be read off the
    // root file itself — and a root file is not a package source, which is the
    // seam this test exists for.
    const files: Files = {
      "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
      "src/main.ts": [
        'import { shared } from "toy-host/shared"',
        'import { a } from "toy-row-alpha"',
        'import { b } from "toy-row-beta"',
        "export const main = [shared, a, b]",
        "",
      ].join("\n"),
      "packages/host/package.json": manifest({ name: "toy-host", exports: { "./shared": "./src/shared.ts" } }),
      "packages/host/src/shared.ts": "export const shared = 1\n",
      "packages/row-alpha/package.json": manifest({
        name: "toy-row-alpha",
        exports: { ".": "./src/index.ts" },
        cordis: { row: "alpha" },
      }),
      "packages/row-alpha/src/index.ts": 'import { shared } from "toy-host/shared"\nexport const a = shared\nexport const alphaName = "alpha"\n',
      "packages/row-beta/package.json": manifest({
        name: "toy-row-beta",
        exports: { ".": "./src/index.ts" },
        cordis: { row: "beta" },
      }),
      "packages/row-beta/src/index.ts": 'import { shared } from "toy-host/shared"\nexport const b = shared\nexport const betaName = 1\n',
    }
    const report = withTree(files, (repo) =>
      fence({
        repo,
        rows: rowsFromManifests(repo),
        roots: [{ entry: "src/main.ts", graph: "node" }],
        collisions: {},
      }),
    )
    expect(report.findings).toEqual([])
    // NO ROSTER IS A STATE, not a defect: the rows are composed by the entry.
    expect(report.reading.registry).toBeUndefined()

    const proof = withTree(files, (repo) =>
      prove({
        repo,
        rows: rowsFromManifests(repo),
        roots: [{ entry: "src/main.ts", graph: "node" }],
        collisions: {},
      }),
    )
    expect(proof.baseline).toEqual([])
    expect(proof.mutations.map((one) => one.caught)).toEqual([true, true, true, true, true, true])
    expect(proof.mutations.filter((one) => one.spill.length > 0)).toEqual([])
    expect(proof.ok).toBe(true)
  })

  test("the copy leaves no directory behind when it throws", () => {
    // `prove` owns the directory now, so a copy that dies mid-write still leaves
    // a path to delete. The throw is real: a member holds a dangling symlink,
    // which `copyInto` reaches (it copies every file of a member, not only the
    // sources) and `copyFileSync` refuses.
    const repo = mkdtempSync(path.join(os.tmpdir(), "cordis-fence-test-"))
    try {
      for (const [file, text] of Object.entries(TOY)) {
        const at = path.join(repo, file)
        mkdirSync(path.dirname(at), { recursive: true })
        writeFileSync(at, text)
      }
      symlinkSync("/nonexistent/nowhere", path.join(repo, "packages/host/dangling.bin"))
      // The test's own directory is named with the same prefix, so it is
      // subtracted from both counts.
      const leftovers = (): ReadonlyArray<string> =>
        readdirSync(os.tmpdir()).filter((one) => one.startsWith("cordis-fence-") && one !== path.basename(repo))
      const before = leftovers().length
      expect(() => prove(declared(repo))).toThrow()
      expect(leftovers().length).toBe(before)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test("a red baseline is refused rather than proved over", () => {
    const proof = withTree({ ...TOY, "packages/host/src/evildoer.ts": 'export const name = "alpha"\n' }, (repo) =>
      prove(declared(repo)),
    )
    expect(proof.ok).toBe(false)
    expect(proof.mutations).toEqual([])
    expect(proof.baseline.map((one) => one.claim)).toContain("names")
  })

  test("a declaration with nothing to break fails the mutation, not the fence", () => {
    // ONE row: there is no second row for `imports` to import, so the proof must
    // report that as a miss rather than quietly running four mutations. The
    // baseline has to be green for the proof to run at all.
    const files: Files = {
      "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
      "packages/host/package.json": manifest({ name: "toy-host", exports: { ".": "./src/index.ts" } }),
      "packages/host/src/index.ts": 'import "toy-one/browser"\nexport const host = 1\n',
      "packages/ui/package.json": manifest({ name: "toy-ui", exports: { "./button": "./src/button.ts" } }),
      "packages/ui/src/button.ts": "export const button = 1\n",
      "packages/one/package.json": manifest({
        name: "toy-one",
        exports: { ".": "./src/index.ts", "./browser": "./src/browser.ts" },
        cordis: { row: "one" },
      }),
      "packages/one/src/index.ts": "export const one = 1\n",
      "packages/one/src/browser.ts": "export const draw = 1\n",
    }
    const proof = withTree(files, (repo) =>
      prove({
        repo,
        rows: ["one"],
        roots: [{ entry: "packages/host/src/index.ts", graph: "browser" }],
        collisions: {},
      }),
    )
    expect(proof.baseline).toEqual([])
    expect(proof.ok).toBe(false)
    const imports = proof.mutations.find((one) => one.claim === "imports")
    expect(imports?.caught).toBe(false)
    expect(imports?.why).toContain("nothing to break")
  })

})

// ── each claim, over its own defect ───────────────────────────────────

describe("imports", () => {
  test("a host production file importing a row is red", () => {
    const report = broken({ "packages/host/src/index.ts": 'import "toy-row-beta/server"\nexport const host = 1\n' })
    expect(report.red("imports")).toEqual([
      "packages/host/src/index.ts: toy-row-beta/server — a host package imports the `beta` row outside a root file",
    ])
  })

  test("a row import that names no declared door is red", () => {
    const report = broken({
      "packages/row-alpha/src/browser.ts": 'import "toy-row-beta/src/index.ts"\nexport const draw = 1\n',
    })
    expect(report.red("imports")).toEqual([
      "packages/row-alpha/src/browser.ts: toy-row-beta/src/index.ts — `packages/row-beta` declares no such door; " +
        "a row reaches another row only through a door its manifest declares",
    ])
  })

  test("...and a declared door is the way through", () => {
    // The positive half, so the claim is not merely forbidding: a row opening
    // another's `./contract` is the door working.
    const report = broken({
      "packages/row-alpha/src/browser.ts": 'import { beta } from "toy-row-beta"\nexport const draw = beta\n',
    })
    expect(report.red("imports")).toEqual([])
  })

  test("a row importing a host's file by path is red", () => {
    const report = broken({
      "packages/row-alpha/src/browser.ts": 'import "../../host/src/index.ts"\nexport const draw = 1\n',
    })
    expect(report.red("imports")).toEqual([
      "packages/row-alpha/src/browser.ts: ../../host/src/index.ts — a row imports `packages/host` by path; " +
        "a row reaches another row only through a door its manifest declares",
    ])
  })

  test("a row importing the roster is red, and the roster may name rows", () => {
    const report = broken({
      "packages/row-alpha/src/browser.ts": 'import "toy-roster"\nexport const draw = 1\n',
    })
    expect(report.red("imports")).toContain(
      "packages/row-alpha/src/browser.ts: toy-roster — a row imports the registry, which names every row; that is " +
        "the cycle the manifests cannot express",
    )
  })

  test("the manifest door is not read here: only an import crosses a boundary", () => {
    // A `workspace:*` line with the import dropped is still a package standing
    // on the wrong side of the wall, and it is deliberately NOT this claim's.
    const report = broken({
      "packages/other/package.json": manifest({ name: "toy-other", dependencies: { "toy-row-alpha": "*" } }),
    })
    expect(report.red("imports")).toEqual([])
  })

  test("a workspace with no cross-package import is red, not quiet", () => {
    const report = withTree(
      {
        "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
        "packages/one/package.json": manifest({
          name: "toy-one",
          exports: { ".": "./src/index.ts" },
          cordis: { row: "one" },
        }),
        "packages/one/src/index.ts": "export const one = 1\n",
      },
      (repo) => fence({ repo, rows: ["one"], roots: [{ entry: "packages/one/src/index.ts", graph: "node" }] }),
    )
    expect(report.red("imports")).toContain(
      "vacuous: no file imports another package of this workspace, so every boundary claim here is empty",
    )
    // ...and a tree where no source names a row's PACKAGE says so too.
    expect(report.red("imports")).toContain(
      "vacuous: no source names a row's package at all — by specifier or by the string a loader resolves — so " +
        "nothing here ties a row to a package",
    )
  })
})

describe("door-graphs", () => {
  test("a browser root's walk reaching a builtin is red", () => {
    const report = broken(plus("packages/host/src/root.ts", 'import "node:fs"'))
    expect(report.red("door-graphs")).toEqual([
      "packages/host/src/root.ts: node:fs — a browser root's walk reaches a builtin, which no tab can satisfy",
    ])
  })

  test("...through a door, not only at the entry", () => {
    const report = broken({ "packages/host/src/shared.ts": 'import "node:path"\nexport const shared = 1\n' })
    expect(report.red("door-graphs")).toEqual([
      "packages/host/src/shared.ts: node:path — a browser root's walk reaches a builtin, which no tab can satisfy",
    ])
  })

  test("a node root's walk reaching a UI runtime is red, and the list is a parameter", () => {
    const report = broken(plus("packages/host/src/server-root.ts", 'import "solid-js"'))
    expect(report.red("door-graphs")).toEqual([
      "packages/host/src/server-root.ts: solid-js — a node root's walk reaches a UI runtime",
    ])
    // ...and a consumer whose runtime words are its own — the DEFAULT list, plus
    // its own, which is the whole reason the default is exported.
    const other = broken(plus("packages/host/src/server-root.ts", 'import "@xterm/xterm"'), {
      runtimes: [...DEFAULT_RUNTIMES, /^@xterm\//],
    })
    expect(other.red("door-graphs")).toEqual([
      "packages/host/src/server-root.ts: @xterm/xterm — a node root's walk reaches a UI runtime",
    ])
  })

  test("an edge the walk could not follow is red rather than a shorter graph", () => {
    const report = broken(plus("packages/host/src/root.ts", 'import "toy-row-alpha/nope"'))
    expect(report.red("door-graphs")).toEqual([
      "packages/host/src/root.ts: unresolved edge — packages/host/src/root.ts: toy-row-alpha/nope — packages/row-alpha opens no `./nope` door",
    ])
  })

  test("a type-only edge is erased, in both spellings, but is still a boundary edge", () => {
    // A walk follows what a listener PAYS FOR. `import type`, `export type` and
    // an import whose every binding is `type` compile to nothing — and one
    // module over, the SAME lines are still a package standing on the wrong side
    // of a wall, which is why the boundary reading sees them.
    const files: Files = {
      ...TOY,
      "packages/host/src/root.ts": [
        'import { type Widget } from "toy-ui/widgets"',
        'export type { Gadget } from "toy-ui/widgets"',
        'import type { Thing } from "toy-ui/widgets"',
        'import { shared } from "toy-host/shared"',
        'import "toy-row-alpha/browser"',
        "export const root = shared",
        "",
      ].join("\n"),
      "packages/ui/package.json": manifest({ name: "toy-ui", exports: { "./widgets": "./src/widgets.ts" } }),
      "packages/ui/src/widgets.ts": 'import "node:fs"\nexport const widget = 1\n',
    }
    const report = broken(files)
    expect(report.red("door-graphs")).toEqual([])
    // ...and the BOUNDARY reading saw the specifier, asserted by name: a reader
    // that saw nothing would also leave `imports` empty, so "imports is empty"
    // would assert nothing.
    withTree(files, (repo) => {
      const workspace = readWorkspace(repo)
      const text = TOY["packages/host/src/root.ts"] ?? ""
      expect(specifiersOf("packages/host/src/root.ts", files["packages/host/src/root.ts"] ?? text)).toContain(
        "toy-ui/widgets",
      )
      expect(workspace.specifiersOf("packages/host/src/root.ts")).toContain("toy-ui/widgets")
    })
  })

  test("a resolver that answered nothing is red, not quiet", () => {
    const report = broken({ "packages/host/src/lonesome.ts": "export const lonesome = 1\n" }, {
      roots: [{ entry: "packages/host/src/lonesome.ts", graph: "browser" }],
    })
    expect(report.red("door-graphs")).toEqual([
      "packages/host/src/lonesome.ts: the walk visited 1 file(s). A resolver that answers nothing walks one " +
        "file and satisfies every confinement list by being empty.",
      "packages/host/src/lonesome.ts: the walk never left `packages/host`, so no door was measured",
    ])
  })

  test("a dynamic import is recorded and not followed", () => {
    const report = broken(plus("packages/host/src/root.ts", 'export const load = () => import("toy-row-beta/server")'))
    expect(report.red("door-graphs")).toEqual([])
  })
})

describe("names", () => {
  test("a row's name spelled in a host's code is red, with the count", () => {
    const report = broken({ "packages/host/src/index.ts": "export const alphaHalf = () => null\n" })
    expect(report.red("names")).toEqual([
      "packages/host/src/index.ts: `alpha` is spelled 1 time(s) in code; the collision record says 0 — move it into " +
        "the row's own package, or record it with a reason",
    ])
  })

  test("a recorded collision is an exact COUNT, red when it grows or shrinks", () => {
    const line = (text: string): Files => ({ "packages/host/src/index.ts": `${text}\n` })
    const recorded = { alpha: { "packages/host/src/index.ts": 1 } }
    expect(broken(line('export const ROWS = ["alpha", "alpha"]'), { collisions: recorded }).red("names")).toEqual([
      "packages/host/src/index.ts: `alpha` is spelled 2 time(s) in code; the collision record says 1",
    ])
    // 0 is not 1, and the message says which direction the record is wrong in.
    expect(broken(line("export const ROWS = []"), { collisions: recorded }).red("names")).toEqual([
      "packages/host/src/index.ts: `alpha` is spelled 0 time(s) in code; the collision record says 1",
    ])
  })

  test("a record naming a word that is no row is red", () => {
    const report = broken({}, { collisions: { ghost: {} } })
    expect(report.red("names")).toEqual(["the collision record names `ghost`, which is no row of this declaration"])
  })

  test("PROSE IS ALLOWED: a comment naming a row is stripped before the sweep", () => {
    const report = broken({ "packages/host/src/index.ts": "// alpha is a row, and this is prose\nexport const host = 1\n" })
    expect(report.red("names")).toEqual([])
  })

  test("...and so is a module specifier, which claim 1 owns", () => {
    const report = broken({ "packages/host/src/index.ts": 'import "toy-row-alpha/browser"\nexport const host = 1\n' })
    expect(report.red("names")).toEqual([])
  })

  test("THE SHOUTED CASING does not swallow a longer word", () => {
    // `PINNED` begins with `PI`; a pattern that could not tell them apart would
    // report the whole tree and be worked around within a week.
    const report = broken({ "packages/host/src/index.ts": "export const PINNED = 1\nexport const ALPHABET = 2\n" })
    expect(report.red("names")).toEqual([])
  })

  test("`_` is a separator: an env-shaped knob and a prefixed word are spellings", () => {
    // `\b` does not fire after `_`, and the env-shaped knob is exactly how a
    // build spells a row's word at a root — so both of these are red.
    for (const line of ["export const TOY_ALPHA_BIN = 1", "export const my_alpha = 1"]) {
      const report = broken({ "packages/host/src/index.ts": `${line}\n` })
      expect([line, report.red("names")]).toEqual([
        line,
        ["packages/host/src/index.ts: `alpha` is spelled 1 time(s) in code; the collision record says 0 — move it " +
          "into the row's own package, or record it with a reason"],
      ])
    }
  })

  test("a hyphenated row is spelled the camel and SNAKE ways in code", () => {
    const files: Files = {
      ...TOY,
      "packages/row-alpha/package.json": manifest({
        name: "toy-row-alpha",
        exports: { ".": "./src/index.ts", "./browser": "./src/browser.ts" },
        cordis: { row: "two-words" },
      }),
      "packages/row-beta/package.json": manifest({
        name: "toy-row-beta",
        exports: { ".": "./src/index.ts", "./server": "./src/server.ts" },
        cordis: { row: "beta" },
      }),
    }
    for (const spelling of ["twoWords", "TwoWords", "TWO_WORDS"]) {
      const report = withTree(
        { ...files, "packages/host/src/index.ts": `export const ${spelling} = 1\n` },
        (repo) => fence(declared(repo, { rows: ["two-words", "beta"] })),
      )
      expect([spelling, report.red("names").some((one) => one.includes("`two-words`"))]).toEqual([spelling, true])
    }
  })

  test("a row's word nowhere it is ALLOWED to be is red — the pattern may be asleep", () => {
    // The positive control, driven with a row whose package is the host and
    // whose word appears in none of its files: the claim must say the pattern
    // has nothing to look at, rather than passing because nothing was found.
    const report = broken({}, { rows: { alpha: ["packages/row-alpha"], beta: ["packages/row-beta"], gamma: ["packages/host"] } })
    expect(report.red("names")).toContain(
      "row `gamma` is spelled nowhere its own packages, the roots or the roster can see it — a pattern that " +
        "stopped matching would be silent, and so would a corpus that came back short",
    )
  })

  test("a bench is not product", () => {
    const report = broken({ "packages/host/src/bench.test.ts": "export const alphaHalf = () => null\n" })
    expect(report.red("names")).toEqual([])
  })
})

describe("live-state", () => {
  test("a door holding a module-scope value is red", () => {
    const report = broken({ "packages/host/src/shared.ts": "let held: unknown\nexport const current = () => held\n" })
    expect(report.red("live-state")).toEqual(["packages/host/src/shared.ts: `held` is a module-scope let/var"])
  })

  test("...and one import behind the door, which reading the door file alone would miss", () => {
    const report = broken({
      "packages/host/src/hidden.ts": "let held: unknown\nexport const current = () => held\n",
      "packages/host/src/shared.ts": 'export { current } from "./hidden.ts"\n',
    })
    expect(report.red("live-state")).toEqual([
      "packages/host/src/hidden.ts: `held` is a module-scope let/var (behind packages/host/src/shared.ts)",
    ])
  })

  test("a hole behind a door is red: the closure the allowance is judged by is read", () => {
    const report = broken({ "packages/host/src/shared.ts": 'export { current } from "./missing.ts"\n' })
    expect(report.red("live-state")).toEqual([
      "packages/host/src/shared.ts: unresolved edge — packages/host/src/shared.ts: ./missing.ts — packages/host/src/shared.ts: ./missing.ts names no file of this tree",
    ])
  })

  test("an allowance is argued, still reachable, and still holds something", () => {
    const allowed = broken(
      { "packages/host/src/shared.ts": "let held: unknown\nexport const current = () => held\n" },
      { allowances: { "packages/host/src/shared.ts": "the page's one connection, argued in the plan" } },
    )
    expect(allowed.red("live-state")).toEqual([])

    const dead = broken({}, { allowances: { "packages/host/src/shared.ts": "a module that holds nothing at all" } })
    expect(dead.red("live-state")).toEqual([
      "the allowance for `packages/host/src/shared.ts` holds nothing, so its argument is dead",
    ])

    const gone = broken({}, { allowances: { "packages/host/src/nowhere.ts": "a module nobody can open any more" } })
    expect(gone.red("live-state")).toContain(
      "the allowance for `packages/host/src/nowhere.ts` names a module no package opens across a boundary any more",
    )
  })

  test("a holder factory the host names is state, under an alias and under a namespace", () => {
    const holders = [{ from: /toy-kit\/held$/, named: "heldService" }]
    const alias = broken(
      { "packages/host/src/shared.ts": 'import { heldService as slot } from "toy-kit/held"\nexport const box = slot()\n' },
      { holders },
    )
    expect(alias.red("live-state")).toEqual(["packages/host/src/shared.ts: `box` is a module-scope slot() holder"])

    const namespace = broken(
      {
        "packages/host/src/shared.ts":
          'import * as slot from "toy-kit/held"\nexport const box = slot.heldService()\n',
      },
      { holders },
    )
    expect(namespace.red("live-state")).toEqual([
      "packages/host/src/shared.ts: `box` is a module-scope slot.heldService() holder",
    ])
  })
})

describe("registry", () => {
  test("a package on disk declaring an unnamed row is red", () => {
    const report = broken({
      "packages/row-gamma/package.json": manifest({
        name: "toy-row-gamma",
        exports: { ".": "./src/index.ts" },
        cordis: { row: "gamma" },
      }),
      "packages/row-gamma/src/index.ts": "export const gamma = 1\n",
    })
    expect(report.red("registry")).toEqual(["packages/row-gamma: declares row `gamma`, which the declaration does not name"])
  })

  test("a row no root file and no roster names is red", () => {
    // Composition is STRUCTURAL: the roster and the entries name a row's
    // PACKAGE. A word spelled three modules into a walk does not compose
    // anything, and counting it did — for every row whose word is English.
    const uncomposed = broken({
      "packages/host/src/server-root.ts": 'import { host } from "./index.ts"\nexport const root = host\n',
      "packages/roster/src/rows.ts": 'export const ROWS = [{ id: "alpha", name: "toy-row-alpha" }]\n',
    })
    expect(uncomposed.red("registry")).toEqual(["row `beta` is declared and neither a root file nor the roster names it"])
    expect(broken({}).red("registry")).toEqual([])
  })

  test("TWO rosters are red: which one is exempt would be a guess", () => {
    const report = broken({
      "packages/roster-two/package.json": manifest({ name: "toy-roster-two", exports: { ".": "./src/rows.ts" } }),
      "packages/roster-two/src/rows.ts": 'export const ROWS = ["toy-row-alpha", "toy-row-beta"]\n',
      "packages/host/src/root.ts": `${TOY["packages/host/src/root.ts"] ?? ""}import "toy-roster-two"\n`,
    })
    expect(report.red("registry")).toEqual([
      "more than one package a root's walk reaches names every row (packages/roster, packages/roster-two); the " +
        "roster must be one, or which of them is exempt from `imports` and `names` is a guess",
    ])
  })

  test("a row naming a package that is not a member is red", () => {
    const report = broken({}, {
      rows: { alpha: ["packages/row-alpha"], beta: ["packages/row-beta"], delta: ["packages/row-delta"] },
    })
    expect(report.red("registry")).toContain("row `delta` names `packages/row-delta`, which is no workspace member")
  })

  test("...and the manifest arm says the same thing from the other side", () => {
    // A record supplied by the host: the row's packages are the record's, and a
    // manifest claiming one of them in a different place is red.
    const report = broken(
      {
        "packages/host/package.json": manifest({
          name: "toy-host",
          exports: { ".": "./src/index.ts", "./shared": "./src/shared.ts" },
          cordis: { row: "alpha" },
        }),
      },
      { rows: { alpha: ["packages/row-alpha"], beta: ["packages/row-beta"] } },
    )
    expect(report.red("registry")).toContain("packages/host: declares row `alpha`, which the declaration places elsewhere")
  })

  test("no roots, and no row named by anything, are red rather than empty", () => {
    const noRoots = withTree(TOY, (repo) => fence({ repo, rows: ["alpha", "beta"], roots: [], collisions: {} }))
    expect(noRoots.red("registry")).toContain("vacuous: the declaration names no root, so no row can be composed")

    const unnamed = withTree(
      {
        "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
        "packages/host/package.json": manifest({ name: "toy-host", exports: { ".": "./src/index.ts" } }),
        "packages/host/src/index.ts": "export const host = 1\n",
        "packages/roster/package.json": manifest({ name: "toy-roster", exports: { ".": "./src/rows.ts" } }),
        "packages/roster/src/rows.ts": 'export const ROWS = ["toy-row-alpha", "toy-row-beta"]\n',
        "packages/row-alpha/package.json": manifest({ name: "toy-row-alpha", exports: { ".": "./src/index.ts" }, cordis: { row: "alpha" } }),
        "packages/row-alpha/src/index.ts": "export const alpha = 1\n",
        "packages/row-beta/package.json": manifest({ name: "toy-row-beta", exports: { ".": "./src/index.ts" }, cordis: { row: "beta" } }),
        "packages/row-beta/src/index.ts": "export const beta = 1\n",
      },
      (repo) =>
        fence({
          repo,
          rows: ["alpha", "beta"],
          roots: [{ entry: "packages/host/src/index.ts", graph: "node" }],
          collisions: {},
        }),
    )
    expect(unnamed.red("registry")).toContain(
      "vacuous: no root file or roster names any row, so the agreement above is three empty sets",
    )
  })

  test("no rows at all", () => {
    const report = withTree(TOY, (repo) => fence({ repo, rows: {}, roots: [] }))
    expect(report.red("registry")).toContain("the declaration names no rows")
    expect(report.red("door-graphs")).toContain("vacuous: the declaration names no root, so no door graph is weighed")
  })
})

// ── vacuity ────────────────────────────────────────────────────────────

describe("a corpus that came back short is red, not quiet", () => {
  test("no production source at all", () => {
    const report = withTree(
      {
        "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
        "packages/one/package.json": manifest({
          name: "toy-one",
          exports: { ".": "./src/index.ts" },
          cordis: { row: "one" },
        }),
        "packages/one/src/bench.test.ts": "export const one = 1\n",
      },
      (repo) => fence({ repo, rows: ["one"], roots: [{ entry: "packages/one/src/bench.test.ts", graph: "node" }], collisions: {} }),
    )
    expect(report.red("names")).toContain("vacuous: the name sweep read no production source")
    expect(report.red("live-state")).toContain(
      "vacuous: no module is opened across a package boundary, so the live-state claim judged nothing",
    )
  })

  test("a workspace glob that matched nothing, and a manifest that will not parse, are throws", () => {
    // Not findings: a member list this reading cannot see is a corpus every
    // claim is an equality over, and a claim asked about it would be answering
    // about nothing.
    const empty = mkdtempSync(path.join(os.tmpdir(), "cordis-fence-empty-"))
    try {
      writeFileSync(path.join(empty, "package.json"), manifest({ name: "toy", workspaces: ["packages/*"] }))
      expect(() => readWorkspace(empty)).toThrow("matched no package at all")
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }

    expect(() =>
      withTree(
        {
          "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
          "packages/broken/package.json": "{ not json",
        },
        (repo) => readWorkspace(repo),
      ),
    ).toThrow("did not parse")
  })

  test("...and an `exports` shape this reading does not know", () => {
    expect(() => doorsOf({ exports: { "./x": { import: "./x.ts" } } })).toThrow("a conditional export is a shape")
    expect(() => doorsOf({ exports: ["./x.ts"] })).toThrow("not a map")
  })
})

// ── the reading itself, over the shapes ────────────────────────────────

describe("liveStateIn", () => {
  const said = (source: string) => liveStateIn("fixture.ts", source)

  test("the three rules, and the audit's own example", () => {
    expect(said("let held: Client | undefined\nexport const current = () => held")).toEqual([
      "fixture.ts: `held` is a module-scope let/var",
    ])
    expect(said("var held\nexport const current = () => held").length).toBe(1)
    expect(said("const [a, setA] = createSignal(1)\nexport const read = a")).toEqual([
      "fixture.ts: `[a, setA]` is a module-scope createSignal()",
    ])
    expect(said("const s = createStore({})").length).toBe(1)
    expect(said("const seats = new Map()\nexport const take = (k, v) => seats.set(k, v)")).toEqual([
      "fixture.ts: `seats` is a const this module writes to",
    ])
    expect(said("const box = {}\nexport const put = (v) => { box.value = v }").length).toBe(1)
    expect(said("const by = {}\nexport const put = (k, v) => { by[k] = v }").length).toBe(1)
  })

  test("the shapes that carry a `let` without writing one", () => {
    expect(said("export const count = (() => { let n = 0; return () => ++n })()")).toEqual([
      "fixture.ts: `count` is a module-scope IIFE",
    ])
    expect(said("class R { held = new Map()\n put(k) { this.held.set(k, 1) } }\nexport const registry = new R()")).toEqual([
      "fixture.ts: `registry` is a module-scope new R()",
    ])
  })

  test("an unrelated local does not hide the write", () => {
    expect(
      said("const writers = new Map()\nexport const register = (k, v) => {\n  writers.set(k, v)\n  { const writers = []; writers.push(1) }\n}"),
    ).toEqual(["fixture.ts: `writers` is a const this module writes to"])
    expect(
      said("const rows = new Map()\nexport const count = (all) => { const rows = []\n for (const one of all) rows.push(one)\n return rows.length }"),
    ).toEqual([])
    expect(said("const held = new Map()\nexport const put = (held) => { held.set(1, 1) }")).toEqual([])
    expect(
      said("const counted = new Map()\nexport const count = (k) => {\n  { var counted = new Map() }\n  counted.set(k, 1)\n}"),
    ).toEqual([])
  })

  test("the legitimate twins pass", () => {
    expect(said("export const make = () => { const [a, setA] = createSignal(); return { a, setA } }")).toEqual([])
    expect(said('export const KINDS = new Map([["toy", 1]])\nexport const of = (k) => KINDS.get(k)')).toEqual([])
    expect(said("export const LAYER = Object.freeze({ row: 10 })")).toEqual([])
    expect(said("export class Door { private held = 1; take() { this.held += 1 } }")).toEqual([])
    expect(said('export const DEFAULT = (() => { const one = TABLE.get("a"); if (!one) throw new Error("no"); return one })()')).toEqual([])
    expect(said("class Clock { at(ms) { return Math.floor(ms / 1000) } }\nexport const CLOCK = new Clock()")).toEqual([])
    expect(said("export const stamp = new Date(0)")).toEqual([])
  })

  test("a comment quoting a prohibited shape is prose, not state", () => {
    expect(said("/** `let held` and `const [a, setA] = createSignal()` */\nexport const MS = 1")).toEqual([])
    expect(said('export const SAID = "let held = createSignal()"')).toEqual([])
  })
})

describe("the shorthands", () => {
  test("comment stripping keeps a `//` inside a string and the code after it", () => {
    const source = 'const url = "https://example.test/x"\n// a comment\nconst mime = "text/plain"\n'
    const stripped = withoutComments("fixture.ts", source)
    expect(stripped).toContain('"https://example.test/x"')
    expect(stripped).toContain('"text/plain"')
    expect(stripped).not.toContain("a comment")
    // The offsets are preserved, so a second parse sees the same file.
    expect(stripped.length).toBe(source.length)
  })

  test("...and a regex containing `/*` does not turn the rest of the file into a comment", () => {
    // THE SCANNER'S BLIND SPOT, driven through the toy: `view.tsx` holds
    // `/\/\*/` and JSX text with `//` in it, and the word after them is code.
    withTree(TOY, (repo) => {
      const tree = readWorkspace(repo)
      const code = tree.codeOf("packages/host/src/view.tsx")
      expect(code).not.toContain("HIDE_ME")
      expect(code).toContain('"keyword"')
      expect(code).toContain("pattern.source")
    })
  })

  test("intoCode subtracts the module specifier and nothing else", () => {
    const code = intoCode("fixture.ts", 'import { x } from "some-row/contract"\nexport const y = "some-row"\n')
    expect(code).not.toContain("some-row/contract")
    expect(code).toContain('"some-row"')
  })

  test("a stylesheet's own door", () => {
    expect(cssImportsOf('@import "a.css";\n@import "b.css";\nbody{}')).toEqual(["a.css", "b.css"])
  })

  test("isBench reads the container, not only a suffix", () => {
    expect(isBench("packages/one/e2e/steps/pin.ts")).toBe(true)
    expect(isBench("packages/suite/tests/hooks.ts")).toBe(true)
    expect(isBench("packages/one/src/rows.test.ts")).toBe(true)
    expect(isBench("packages/one/src/rowse.ts")).toBe(false)
  })

  test("a declaration may read benches its own way", () => {
    // The default calls `*.test.ts` a bench; a consumer whose benches are named
    // otherwise says so, and the SAME file becomes product under its reading —
    // so the word in it is red again.
    const file = { "packages/host/src/bench.test.ts": "export const alphaHalf = () => null\n" }
    expect(broken(file).red("names")).toEqual([])
    expect(broken(file, { bench: (at) => at.endsWith(".spec.ts") }).red("names")).toEqual([
      "packages/host/src/bench.test.ts: `alpha` is spelled 1 time(s) in code; the collision record says 0 — move it " +
        "into the row's own package, or record it with a reason",
    ])
  })
})
