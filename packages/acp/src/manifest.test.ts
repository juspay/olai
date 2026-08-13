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
 * Four claims:
 *
 *   1. the domain's words stay OUT — no `@olai/*` import in this package, so
 *      `UsageFailure` cannot move in by increments; refusals leave as
 *      {@link ./asks.ts}'s own `Refused` and are translated at the chat seam;
 *   2. the protocol enters the tree in exactly two packages — this one (its
 *      types) and `@olai/chat` (its subprocess). A third import of the SDK is
 *      a third place the protocol's shapes would be read;
 *   3. what may cross is ENUMERATED — the export list is closed, so a new
 *      word crossing the wall is a deliberate edit here, not a drive-by
 *      `export`;
 *   4. who may import this package is enumerated too — `@olai/surface`
 *      re-exports the wire half and `@olai/chat` consumes the projections;
 *      anything else reaching for the protocol's vocabulary should be going
 *      through the surface, exactly as `RepoState`'s consumers go through
 *      `@olai/format`.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import * as face from "./index.ts"
import * as wire from "./wire.ts"

const PACKAGES = path.join(import.meta.dirname, "..", "..")

/** Every `.ts` under a package's src. `tests` keeps its suites elsewhere and
 *  has no src at all, which is an empty answer rather than a miss. */
const sourcesOf = (pkg: string): ReadonlyArray<string> => {
  const src = path.join(PACKAGES, pkg, "src")
  if (!existsSync(src)) return []
  return readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

const packages = (): ReadonlyArray<string> =>
  readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

/** The module specifiers a file imports (or re-exports from). Import
 *  STATEMENTS only, so a claim about a word in a string or a comment cannot
 *  trip the claims about the imports. */
const importsOf = (file: string): ReadonlyArray<string> => {
  const text = readFileSync(file, "utf8")
  return [...text.matchAll(/(?:^|\n)\s*(?:import|export)[^"'\n]*?from\s+["']([^"']+)["']/g)]
    .map((match) => match[1] ?? "")
    .concat(
      [...text.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)].map((match) => match[1] ?? ""),
    )
}

describe("the manifest", () => {
  test("the domain's words stay out: this package imports no @olai sibling", () => {
    for (const file of sourcesOf("acp")) {
      const strangers = importsOf(file).filter((spec) => spec.startsWith("@olai/"))
      expect(strangers, file).toEqual([])
    }
  })

  test("this package speaks only ACP: effect, the SDK, and its own files", () => {
    const allowed = (spec: string): boolean =>
      spec === "effect" ||
      spec === "@agentclientprotocol/sdk" ||
      spec === "bun:test" ||
      spec.startsWith("node:") || // the manifest's own reading of the tree
      spec.startsWith("./")
    for (const file of sourcesOf("acp")) {
      expect(importsOf(file).filter((spec) => !allowed(spec)), file).toEqual([])
    }
  })

  test("the protocol enters the tree in exactly two packages: acp and chat", () => {
    const speaking = packages().filter((pkg) =>
      sourcesOf(pkg).some((file) =>
        importsOf(file).includes("@agentclientprotocol/sdk")
      )
    )
    expect(speaking.sort()).toEqual(["acp", "chat"])
  })

  test("what may cross is enumerated: the export list is closed", () => {
    // Runtime exports only — `Form` is a type and invisible here, which is
    // fine: a type smuggles no value across, and the schemas ARE values.
    expect(Object.keys(face).sort()).toEqual([
      "AskAnswer",
      "AskChoice",
      "AskField",
      "AskOutcome",
      "FileDiff",
      "PERMISSION_FIELD",
      "Refused",
      "YES_NO",
      "contentOf",
      "diffsOf",
      "formOf",
      "permissionFormOf",
      "relativeTo",
    ])
    // ... and the wire half carries the vocabulary alone: no payload reader
    // rides the subpath the surface re-exports.
    expect(Object.keys(wire).sort()).toEqual([
      "AskAnswer",
      "AskChoice",
      "AskField",
      "AskOutcome",
      "FileDiff",
      "YES_NO",
    ])
  })

  test("who may import this package is enumerated: surface and chat", () => {
    const importing = packages().filter((pkg) =>
      pkg !== "acp" &&
      sourcesOf(pkg).some((file) =>
        importsOf(file).some((spec) =>
          spec === "@olai/acp" || spec.startsWith("@olai/acp/")
        )
      )
    )
    expect(importing.sort()).toEqual(["chat", "surface"])
  })
})
