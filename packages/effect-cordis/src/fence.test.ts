/**
 * THE DOOR, DRIVEN WITH A TOY WORKSPACE — no olai noun in the file, on purpose.
 *
 * Every claim here is made over a workspace written to a temp directory: two
 * rows, one host, two roots. That is the same shape `src/plugin.test.ts` takes
 * with toy services, and for the same reason — the door's subjects are ROWS,
 * DOORS, ROOTS and NAMES, and a fixture built out of them says what the claim
 * is about without a reader having to hold this tree in their head.
 *
 * The three halves:
 *
 *   - a CLEAN toy workspace, where each claim is asked on its own (a green
 *     report is not evidence until it is asked one claim at a time);
 *   - `prove`, which breaks a COPY of that workspace once per claim and asserts
 *     the claim that names each defect refused it;
 *   - the reading itself, over the shapes it must catch and the legitimate
 *     twins it must pass — because a sweep is only ever as good as what it can
 *     SEE, and a pattern that stopped matching is GREEN everywhere.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import {
  CLAIMS,
  cssImportsOf,
  type Declaration,
  doorsOf,
  fence,
  intoCode,
  isBench,
  liveStateIn,
  type Manifest,
  prove,
  readWorkspace,
  rowsFromManifests,
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
 * rows, one door each own package publishes.
 *
 * `shared` is the door that makes the live-state claim non-vacuous: it is the
 * one module of the HOST's that a row opens, so it is a module another package
 * can reach and it must hold nothing.
 */
const TOY: Files = {
  "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),

  "packages/host/package.json": manifest({
    name: "toy-host",
    exports: { ".": "./src/index.ts", "./shared": "./src/shared.ts" },
  }),
  "packages/host/src/index.ts": "export const host = 1\n",
  "packages/host/src/shared.ts": "export const shared = (n: number): number => n + 1\n",
  "packages/host/src/root.ts": [
    'import { host } from "./index.ts"',
    'import "toy-row-alpha/browser"',
    "export const root = host",
    "",
  ].join("\n"),
  "packages/host/src/server-root.ts": [
    'import { host } from "./index.ts"',
    'import "toy-row-beta/server"',
    "export const root = host",
    "",
  ].join("\n"),
  // The roster the two roots share: the one host file that spells both rows,
  // which is what makes `registry`'s composition claim answerable at all.
  "packages/host/src/roster.ts": ['export const ROWS = ["alpha", "beta"] as const', ""].join("\n"),

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

/** The declaration the clean workspace is read by: roots are the two entries,
 *  the collision record is the roster's one spelling of each row. */
const TOY_DECLARATION = {
  roots: [
    { entry: "packages/host/src/root.ts", graph: "browser" },
    { entry: "packages/host/src/server-root.ts", graph: "node" },
  ],
  collisions: {
    alpha: { "packages/host/src/roster.ts": 1 },
    beta: { "packages/host/src/roster.ts": 1 },
  },
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

// ── the clean workspace ────────────────────────────────────────────────

describe("a clean workspace", () => {
  const { report } = clean()

  test("the fence is green", () => {
    expect(report.findings).toEqual([])
  })

  for (const claim of CLAIMS) {
    test(`...and \`${claim}\` is green on its own`, () => {
      expect(report.red(claim)).toEqual([])
    })
  }

  test("it names every row, and the report is not an empty reading", () => {
    withTree(TOY, (repo) => {
      expect(Object.keys(rowsFromManifests(repo)).sort()).toEqual(["alpha", "beta"])
      // The floors the claims assert internally are red when they are empty, so
      // a green report here means the corpus was actually read.
      const workspace = readWorkspace(repo)
      expect(workspace.members).toEqual(["packages/host", "packages/row-alpha", "packages/row-beta"])
      expect(workspace.sources.length).toBeGreaterThan(8)
    })
  })
})

// ── prove ──────────────────────────────────────────────────────────────

describe("prove", () => {
  test("every claim catches the defect it is about, and nothing else notices", () => {
    const proof = withTree(TOY, (repo) => prove(declared(repo)))
    expect(proof.baseline).toEqual([])
    expect(proof.mutations.map((one) => [one.claim, one.caught])).toEqual([
      ["imports", true],
      ["door-graphs", true],
      ["names", true],
      ["live-state", true],
      ["registry", true],
    ])
    expect(proof.mutations.filter((one) => one.spill.length > 0)).toEqual([])
    expect(proof.ok).toBe(true)
  })

  test("a red baseline is refused rather than proved over", () => {
    // The proof is "the suite went red when I broke it", which says nothing
    // unless it was green first — the same failure mode the fence exists to
    // catch, read from the other side.
    const proof = withTree(
      {
        ...TOY,
        "packages/host/src/evildoer.ts": 'export const name = "alpha"\n',
      },
      (repo) => prove({ ...declared(repo), collisions: undefined }),
    )
    expect(proof.ok).toBe(false)
    expect(proof.mutations).toEqual([])
    expect(proof.baseline.map((one) => one.claim)).toContain("names")
  })

  test("a declaration with nothing to break fails the mutation, not the fence", () => {
    // ONE row: there is no second row for `imports` to import, so the proof must
    // report that as a miss rather than quietly running four mutations. The
    // baseline has to be green for the proof to run at all, so the tree carries
    // a second HOST package for the root's walk to leave through.
    const proof = withTree(
      {
        "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
        "packages/host/package.json": manifest({
          name: "toy-host",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/host/src/index.ts": 'import "toy-ui/button"\nimport "toy-one/browser"\nexport const host = 1\n',
        "packages/host/src/roster.ts": 'export const ROWS = ["one"]\n',
        "packages/ui/package.json": manifest({ name: "toy-ui", exports: { "./button": "./src/button.ts" } }),
        "packages/ui/src/button.ts": "export const button = 1\n",
        "packages/one/package.json": manifest({
          name: "toy-one",
          exports: { ".": "./src/index.ts", "./browser": "./src/browser.ts" },
          cordis: { row: "one" },
        }),
        "packages/one/src/index.ts": "export const one = 1\n",
        "packages/one/src/browser.ts": "export const draw = 1\n",
      },
      (repo) =>
        prove({
          repo,
          rows: ["one"],
          roots: [{ entry: "packages/host/src/index.ts", graph: "browser" }],
          collisions: { one: { "packages/host/src/roster.ts": 1 } },
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

/** The clean workspace plus one appended line to an existing file — most of the
 *  defects below are one import a person added. */
const plus = (file: string, line: string): Files => ({ [file]: `${TOY[file] ?? ""}${line}\n` })

/** The clean workspace plus one broken file, as the sentences the named claim
 *  says. */
const broken = (files: Files, over: Partial<Declaration> = {}) =>
  withTree({ ...TOY, ...files }, (repo) => fence(declared(repo, over)))

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
      "packages/host/package.json": manifest({
        name: "toy-host",
        exports: { ".": "./src/index.ts", "./shared": "./src/shared.ts" },
        dependencies: { "toy-row-alpha": "*", "toy-row-beta": "*" },
      }),
      "packages/row-alpha/src/browser.ts": 'import "toy-host"\nexport const draw = 1\n',
    })
    expect(report.red("imports")).toContain(
      "packages/row-alpha/src/browser.ts: toy-host — a row imports the registry, which names every row; that is the " +
        "cycle the manifests cannot express",
    )
  })

  test("the manifest door is not read here: only an import crosses a boundary", () => {
    // A `workspace:*` line with the import dropped is still a package standing
    // on the wrong side of the wall, and it is deliberately NOT this claim's:
    // the host's own manifest claim reads it. The declaring package is a THIRD
    // one, so the rows' own imports stay where they are.
    const report = broken({
      "packages/other/package.json": manifest({ name: "toy-other", dependencies: { "toy-row-alpha": "*" } }),
    })
    expect(report.red("imports")).toEqual([])
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
    // ...and a consumer whose runtime words are its own.
    const other = broken(plus("packages/host/src/server-root.ts", 'import "@xterm/xterm"'), {
      runtimes: [/^@xterm\//],
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
    const report = broken({
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
    })
    expect(report.red("door-graphs")).toEqual([])
    // ...and the boundary reading DID see the specifier, so the elision is a
    // reading rather than a blind spot: `toy-ui` is a host opening nothing, and
    // the types above name it.
    expect(report.red("imports")).toEqual([])
  })

  test("a resolver that answered nothing is red, not quiet", () => {
    // An entry one file long: every confinement list below it is satisfied by
    // being empty, which is the failure mode the floor exists for.
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
    // The chunk boundary: a browser root names a plugin's chunk and does not
    // evaluate it, so what is behind the `import()` costs the tab nothing.
    const report = broken(plus("packages/host/src/root.ts", 'export const load = () => import("toy-row-beta/server")'))
    expect(report.red("door-graphs")).toEqual([])
  })
})

describe("names", () => {
  test("a row's name spelled in a host's code is red, with the count", () => {
    const report = broken({ "packages/host/src/index.ts": 'export const alphaHalf = () => null\n' })
    expect(report.red("names")).toEqual([
      "packages/host/src/index.ts: `alpha` is spelled 1 time(s) in code; the collision record says 0 — move it into " +
        "the row's own package, or record it with a reason",
    ])
  })

  test("a recorded collision is an exact COUNT, red when it grows or shrinks", () => {
    const grown = broken({ "packages/host/src/roster.ts": 'export const ROWS = ["alpha", "alpha", "beta"]\n' })
    expect(grown.red("names")).toEqual(["packages/host/src/roster.ts: `alpha` is spelled 2 time(s) in code; the collision record says 1"])
    const gone = broken({ "packages/host/src/roster.ts": 'export const ROWS = ["beta"]\n' })
    // 0 is not 1, and the message says which direction the record is wrong in.
    expect(gone.red("names")).toEqual(["packages/host/src/roster.ts: `alpha` is spelled 0 time(s) in code; the collision record says 1"])
  })

  test("a record naming a word that is no row is red", () => {
    const report = broken({}, { collisions: { ...TOY_DECLARATION.collisions, ghost: {} } })
    expect(report.red("names")).toEqual(["the collision record names `ghost`, which is no row of this declaration"])
  })

  test("PROSE IS ALLOWED: a comment naming a row is stripped before the sweep", () => {
    const report = broken({ "packages/host/src/index.ts": "// alpha is a row, and this is prose\nexport const host = 1\n" })
    expect(report.red("names")).toEqual([])
  })

  test("...and so is a module specifier, which claim 1 owns", () => {
    // `toy-row-alpha` in an import path is an import, and counting it here
    // would be this claim reporting on a decision that is not its own.
    const report = broken({ "packages/host/src/index.ts": 'import "toy-row-alpha/browser"\nexport const host = 1\n' })
    expect(report.red("names")).toEqual([])
  })

  test("THE SHOUTED CASING does not swallow a longer word", () => {
    // `PINNED` begins with `PI`; a pattern that could not tell them apart would
    // report the whole tree and be worked around within a week.
    const report = broken({ "packages/host/src/index.ts": "export const PINNED = 1\nexport const ALPHABET = 2\n" })
    expect(report.red("names")).toEqual([])
  })

  test("a bench is not product", () => {
    const report = broken({ "packages/host/src/bench.test.ts": 'export const alphaHalf = () => null\n' })
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

  test("an allowance is argued, still reachable, and still holds something", () => {
    const allowed = broken({ "packages/host/src/shared.ts": "let held: unknown\nexport const current = () => held\n" }, {
      allowances: { "packages/host/src/shared.ts": "the page's one connection, argued in the plan" },
    })
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

  test("a holder factory the host names is state, under an alias", () => {
    const report = broken(
      {
        "packages/host/src/shared.ts": 'import { heldService as slot } from "toy-kit/held"\nexport const box = slot()\n',
      },
      { holders: [{ from: /toy-kit\/held$/, named: "heldService" }] },
    )
    expect(report.red("live-state")).toEqual(["packages/host/src/shared.ts: `box` is a module-scope slot() holder"])
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

  test("a row no root composes is red", () => {
    // Composition is read off the walk: a root names a row's package or spells
    // its word. Remove both and the row is declared and unmounted.
    const uncomposed = broken({
      "packages/host/src/server-root.ts": "export const root = 1\n",
      "packages/host/src/roster.ts": 'export const ROWS = ["alpha"]\n',
    })
    expect(uncomposed.red("registry")).toEqual(["row `beta` is declared and no root's walk composes it"])
    expect(broken({}).red("registry")).toEqual([])
  })

  test("a row naming a package that is not a member is red", () => {
    const report = broken({}, { rows: { alpha: ["packages/row-alpha"], beta: ["packages/row-beta"], delta: ["packages/row-delta"] } })
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
})

// ── vacuity ────────────────────────────────────────────────────────────

describe("a corpus that came back short is red, not quiet", () => {
  test("no production source", () => {
    const report = withTree(
      {
        "package.json": manifest({ name: "toy", private: true, workspaces: ["packages/*"] }),
        "packages/one/package.json": manifest({ name: "toy-one", exports: { ".": "./src/index.ts" }, cordis: { row: "one" } }),
        "packages/one/src/index.ts": "export const one = 1\n",
      },
      (repo) => fence({ repo, rows: ["one"], roots: [{ entry: "packages/one/src/index.ts", graph: "node" }] }),
    )
    expect(report.red("imports")).toContain(
      "vacuous: no file imports another package of this workspace, so every boundary claim here is empty",
    )
    expect(report.red("live-state")).toContain(
      "vacuous: no module is opened across a package boundary, so the live-state claim judged nothing",
    )
  })

  test("no rows at all", () => {
    const report = withTree(TOY, (repo) => fence({ repo, rows: {}, roots: [] }))
    expect(report.red("registry")).toContain("the declaration names no rows")
    expect(report.red("door-graphs")).toContain("vacuous: the declaration names no root, so no door graph is weighed")
  })

  test("a workspace glob that matched nothing, and a manifest that will not parse, are throws", () => {
    // Not findings: a member list this reading cannot see is a corpus every
    // claim is an equality over, and a claim asked about it would be answering
    // about nothing.
    expect(() =>
      readWorkspace(
        (() => {
          const repo = mkdtempSync(path.join(os.tmpdir(), "cordis-fence-empty-"))
          writeFileSync(path.join(repo, "package.json"), manifest({ name: "toy", workspaces: ["packages/*"] }))
          return repo
        })(),
      ),
    ).toThrow("matched no package at all")

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
    expect(said("const writers = new Map()\nexport const register = (k, v) => {\n  writers.set(k, v)\n  { const writers = []; writers.push(1) }\n}")).toEqual([
      "fixture.ts: `writers` is a const this module writes to",
    ])
    expect(said("const rows = new Map()\nexport const count = (all) => { const rows = []\n for (const one of all) rows.push(one)\n return rows.length }")).toEqual([])
    expect(said("const held = new Map()\nexport const put = (held) => { held.set(1, 1) }")).toEqual([])
    expect(said("const counted = new Map()\nexport const count = (k) => {\n  { var counted = new Map() }\n  counted.set(k, 1)\n}")).toEqual([])
  })

  test("the legitimate twins pass", () => {
    expect(said("export const make = () => { const [a, setA] = createSignal(); return { a, setA } }")).toEqual([])
    expect(said("export const KINDS = new Map([[\"olai\", 1]])\nexport const of = (k) => KINDS.get(k)")).toEqual([])
    expect(said("export const LAYER = Object.freeze({ row: 10 })")).toEqual([])
    expect(said("export class Door { private held = 1; take() { this.held += 1 } }")).toEqual([])
    expect(said("export const DEFAULT = (() => { const one = TABLE.get(\"a\"); if (!one) throw new Error(\"no\"); return one })()")).toEqual([])
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

  test("intoCode subtracts the module specifier and nothing else", () => {
    const code = intoCode("fixture.ts", 'import { x } from "some-row/contract"\nexport const y = "some-row"\n')
    expect(code).not.toContain("some-row/contract")
    expect(code).toContain('"some-row"')
  })

  test("a stylesheet's own door", () => {
    expect(cssImportsOf('@import "a.css";\n@import "b.css";\nbody{}')).toEqual(["a.css", "b.css"])
  })

  test("isBench reads the container, not only a suffix", () => {
    expect(isBench("packages/plugins/kolu/e2e/steps/pin.ts")).toBe(true)
    expect(isBench("packages/tests/support/hooks.ts")).toBe(true)
    expect(isBench("packages/bundle/src/rows.test.ts")).toBe(true)
    expect(isBench("packages/bundle/src/rowse.ts")).toBe(false)
  })
})
