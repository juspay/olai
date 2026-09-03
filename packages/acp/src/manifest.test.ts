/**
 * The package's manifest, as claims a test can hold.
 *
 * The boundary this package IS used to be checked by comments — "nothing above
 * this line spells `session/update`", "a value neither owns, agreed by
 * comment" — and a comment checks nothing. A literal manifest file would be
 * foreign in this tree, so the declaration is spelled the way every other
 * claim here is: as tests over the sources, red the moment a word crosses in
 * either direction.
 *
 * Two readings of an import, because each misses what the other sees:
 *
 *   - {@link specifiersOf} finds every SPECIFIER by position — a quoted name
 *     after `from`, after a bare `import`, inside a dynamic `import(…)` or a
 *     `require(…)` — so a multi-line `import type { … }` is seen (this tree's
 *     dominant style, and the one an import-statement regex is blind to). It
 *     can only over-include — prose in a comment spelling one of those forms
 *     is seen too, as this file's own first draft proved about itself — and
 *     over-inclusion fails CLOSED for a boundary claim;
 *   - `Bun.Transpiler.scanImports` is the runtime's own reading, and it
 *     ELIDES type-only imports — which is exactly the instrument for "types
 *     only": a specifier it still sees is one that survives to runtime.
 *
 * The claims: the domain's words stay out (no `@olai/*` specifier here, so
 * `UsageFailure` cannot move in by increments — refusals leave as
 * {@link ./asks.ts}'s own `Refused`, translated at the chat seam); the
 * package speaks only ACP; the SDK is TYPES here — the runtime and its zod
 * peer stay in `@olai/chat`, which is what the architecture doc's zod
 * paragraph rests on; the protocol enters the tree in exactly two packages;
 * the export lists are closed and disjoint; and who may import which HALF is
 * a table — `@olai/surface` the wire subpath, `@olai/chat` the projections —
 * so the `./wire` carve-out is a fact and not a comment.
 */

import { readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import * as face from "./index.ts"
import * as wire from "./wire.ts"

const PACKAGES = path.join(import.meta.dirname, "..", "..")

/** Every import specifier, by POSITION rather than by statement, so a braced
 *  list broken across lines — most of this tree's imports — is seen. A `from`
 *  in prose followed by a quoted name would be seen too, which is the right
 *  direction to be wrong in: an extra specifier fails a claim rather than
 *  passing one. */
const specifiersOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*|\brequire\(\s*)["']([^"'\n]+)["']/gm)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

/** ... and the runtime's own reading, which drops type-only imports — so what
 *  it still reports is what would actually load. One transpiler per grammar,
 *  because the `ts` loader refuses JSX. */
const transpilers = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
} as const
const runtimeImportsOf = (file: string, text: string): ReadonlyArray<string> =>
  transpilers[file.endsWith(".tsx") ? "tsx" : "ts"]
    .scanImports(text)
    .map((found) => found.path)

interface Source {
  readonly file: string
  readonly specifiers: ReadonlyArray<string>
  readonly runtime: ReadonlyArray<string>
}

/** Every `.ts` under one package, skipping `node_modules` BEFORE descending.
 *
 *  It used to be one `readdirSync(recursive: true)` with a `node_modules`
 *  filter on the results, and that filter was too late: the walk had already
 *  gone in. A workspace `node_modules` is full of symlinks back to sibling
 *  packages (`@olai/surface -> ../../../surface`), each of which has a
 *  `node_modules` of its own, so the recursion descends the workspace over and
 *  over and eventually dies on `ELOOP`. It survived on luck — the chains were
 *  short — until `@olai/kolu-ui` and the surface inversion made one long
 *  enough. Refusing the directory rather than its files is the fix, and it is
 *  also just faster. */
const sourcesUnder = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === "node_modules"
        ? []
        : sourcesUnder(path.join(dir, entry.name))
    }
    return entry.isFile() && /\.tsx?$/.test(entry.name)
      ? [path.join(dir, entry.name)]
      : []
  })

/**
 * EVERY WORKSPACE MEMBER, as its directory relative to `packages/` — so a
 * top-level member is `web` and a nested tenant is `plugins/kolu`.
 *
 * Read off the ROOT MANIFEST'S OWN `workspaces` globs, because a one-level
 * `readdirSync(PACKAGES)` stopped being the same set the day the tenants moved
 * under `packages/plugins/`. It was not a silent skip — `sourcesUnder` recurses,
 * so both tenants' files were still opened and every claim below still saw them
 * — it was a MISATTRIBUTION: they were keyed under a package named `plugins`
 * that does not exist, and `olai-plugin-kolu` and `olai-plugin-odu` were not
 * keys at all. A failure here would have named a phantom.
 *
 * This is the third reading of that field in the tree, and it has to be its
 * own: `@olai/plugin-api`'s `tree.testlib.ts` answers the same question, and
 * THIS FILE'S FIRST CLAIM is that `@olai/acp` imports no `@olai` sibling —
 * reaching for it is the thing this test exists to fail. What is shared is the
 * RULE, not the code: refuse a glob shape this reading cannot expand, and
 * refuse one that matched nothing, because a corpus that came back short is a
 * sweep that did not run.
 */
const MEMBERS: ReadonlyArray<string> = (() => {
  const root = path.join(PACKAGES, "..")
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    workspaces?: ReadonlyArray<string>
  }
  const globs = manifest.workspaces
  if (globs === undefined || globs.length === 0) {
    throw new Error("acp: the root manifest declares no `workspaces`, so there is no tree to read")
  }
  const found = globs.flatMap((glob) => {
    if (!glob.startsWith("packages/")) {
      throw new Error(`acp: the workspaces glob ${JSON.stringify(glob)} names nothing under packages/`)
    }
    const members = [...new Bun.Glob(`${glob}/package.json`).scanSync({ cwd: root })]
      .map((one) => path.relative("packages", path.dirname(one)))
    if (members.length === 0) {
      throw new Error(
        `acp: the workspaces glob ${JSON.stringify(glob)} matched no package — a corpus that ` +
          "came back short is a sweep that did not run.",
      )
    }
    return members
  })
  return [...new Set(found)].sort()
})()

/** The whole tree, read ONCE: every `.ts` in every member — the package, not
 *  its `src`, so a scripted agent in `tests/agent/` counts — keyed by the
 *  member's directory. */
const tree: ReadonlyMap<string, ReadonlyArray<Source>> = new Map(
  MEMBERS
    .map((member) => [
      member as string,
      sourcesUnder(path.join(PACKAGES, member))
        .map((file): Source => {
          // A scripted agent opens with a shebang, which the transpiler
          // refuses; the line holds no import, so dropping it loses nothing.
          const text = readFileSync(file, "utf8").replace(/^#![^\n]*\n/, "")
          return { file, specifiers: specifiersOf(text), runtime: runtimeImportsOf(file, text) }
        }),
    ]),
)

const sources = (pkg: string): ReadonlyArray<Source> => tree.get(pkg) ?? []

/** The SDK by any of its doors: the package, or a path under it — the pinned
 *  SDK really exports subpaths (`experimental/v2`, …), and a claim that
 *  matched the bare name alone was green under a subpath import (this file's
 *  own review caught it). Inside `acp` the allowed-list stays the bare name
 *  on purpose: reaching for a subpath there is a manifest edit, not a drift. */
const isSdk = (spec: string): boolean =>
  spec === "@agentclientprotocol/sdk" || spec.startsWith("@agentclientprotocol/sdk/")

describe("the manifest", () => {
  test("the domain's words stay out: this package imports no @olai sibling", () => {
    for (const source of sources("acp")) {
      const strangers = source.specifiers.filter((spec) => spec.startsWith("@olai/"))
      expect(strangers, source.file).toEqual([])
    }
  })

  test("this package speaks only ACP: effect, the SDK, and its own files", () => {
    const allowed = (spec: string): boolean =>
      spec === "effect" ||
      spec === "@agentclientprotocol/sdk" ||
      spec === "bun:test" ||
      spec.startsWith("node:") || // the manifest's own reading of the tree
      spec.startsWith("./")
    for (const source of sources("acp")) {
      expect(source.specifiers.filter((spec) => !allowed(spec)), source.file).toEqual([])
    }
  })

  test("the SDK is TYPES here: no import of it survives to runtime", () => {
    // `scanImports` elides type-only imports, so an SDK specifier it still
    // reports is a runtime one — the import that would drag the SDK's code
    // and its zod peer into a closure that deliberately has neither.
    for (const source of sources("acp")) {
      expect(source.runtime.filter(isSdk), source.file).toEqual([])
    }
  })

  test("the protocol enters the tree in exactly two packages: acp and chat", () => {
    const speaking = [...tree.keys()].filter((pkg) =>
      sources(pkg).some((source) => source.specifiers.some(isSdk))
    )
    expect(speaking.sort()).toEqual(["acp", "chat"])
  })

  test("what may cross is enumerated: the export lists are closed and disjoint", () => {
    // Runtime exports only — `Form` is a type and invisible here, which is
    // fine: a type smuggles no value across, and the schemas ARE values. The
    // main entry is the PROJECTIONS: the vocabulary rides `./wire` alone,
    // because its consumers reach it through the surface's re-export and a
    // second door to the same word is a door somebody eventually uses.
    expect(Object.keys(face).sort()).toEqual([
      "PERMISSION_FIELD",
      "Refused",
      "contentOf",
      "diffsOf",
      "formOf",
      "permissionFormOf",
      "relativeTo",
      "usageIn",
    ])
    // ... and the wire half carries the vocabulary alone: no payload reader
    // rides the subpath the surface re-exports.
    expect(Object.keys(wire).sort()).toEqual([
      "AskAnswer",
      "AskChoice",
      "AskField",
      "AskOutcome",
      "FileDiff",
      "Usage",
      "YES_NO",
    ])
  })

  test("who may import which half is a table: surface the wire, chat the projections", () => {
    const imported = new Map<string, ReadonlySet<string>>(
      [...tree.keys()]
        .filter((pkg) => pkg !== "acp")
        .map((pkg) => [
          pkg,
          new Set(
            sources(pkg).flatMap((source) =>
              source.specifiers.filter(
                (spec) => spec === "@olai/acp" || spec.startsWith("@olai/acp/"),
              )
            ),
          ),
        ]),
    )
    for (const [pkg, specs] of imported) {
      const may = pkg === "surface"
        ? ["@olai/acp/wire"]
        : pkg === "chat"
        ? ["@olai/acp"]
        : []
      expect([...specs].sort(), pkg).toEqual(may)
    }
  })
})
