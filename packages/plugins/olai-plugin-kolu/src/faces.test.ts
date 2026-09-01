/**
 * THE TENANT'S TWO FACE DIRECTORIES, HELD APART — the line the appliance fold
 * drew, checked in the package that drew it.
 *
 * ## What this is, and what it deliberately is not
 *
 * `@olai/plugin-api`'s fence declines to hold a per-directory rule inside
 * somebody's package, and that decline is right: a rule about `src/appliance/`
 * written up there would be the FENCE inventing a layout convention and then
 * enforcing its own invention, which is the argument its `.tsx` claim makes
 * about itself. Nothing here reopens that.
 *
 * What it does is the other half of the same sentence. A tenant may police its
 * OWN internals — it already does, in `./testids.ts`, whose two type-level
 * assertions are this package's claim about this package's modules — and these
 * are two directories this package created, on a line this package's README
 * states as a reading of the tree. A line stated as a reading and held nowhere
 * is a line the first mis-filed face passes green on.
 *
 * ## The two claims, and why each is owed
 *
 * **THE FILING LINE.** `src/appliance/` is every face that stands on KOLU'S OWN
 * PRODUCT TIER — its components, its vocabulary, the emulator, and the wire
 * shapes the dial publishes. `src/browser/` is every face that reaches NONE of
 * it: the pill, the drawer box, the mark, the tab's mount, the app-furniture
 * contract, all of them over values olai hands across. Both reviewers asked for
 * this, and the README's own version of it was wrong once already — it claimed
 * `src/browser/` "imports no package outside this one", which is false (every
 * module in it imports `solid-js`). The claim below is the true form: no
 * APPLIANCE TIER, which is what the directory names are about.
 *
 * **THE WALL THE FOLD DROPPED.** `@olai/kolu-ui` was a package whose manifest
 * declared `@olai/kolu-client`, `@xterm/*` and `solid-js` and not `@olai/format`
 * — so the isolated linker refused the format to every module now under
 * `src/appliance/`, and the fold handed those modules a manifest that declares
 * it. The PR argues, and both reviewers accepted, that "a browser face may not
 * read the format" is no rule this tree has: `olai-plugin-odu`'s own faces reach
 * it and `@olai/web` declares it. That argument is about whether the rule is
 * GENERAL. It is not an argument that the wall which stood here should go
 * unreplaced, and pi's reading is the sharper one: a named drop with no
 * replacement is the one place the fold is weaker in kind. This is the
 * replacement, at the altitude the drop happened — one package, its own
 * modules — rather than as a rule imposed on anybody else.
 *
 * ## Why the tier sets are spelled and not derived
 *
 * The fence DERIVES which packages may name an appliance's tier, and must:
 * that answer changes when the registry changes and a hand copy of it is the
 * failure a fence exists to prevent. This is a different question with a fixed
 * answer — which of THIS package's two directories a specifier belongs in —
 * and the tier words are the appliance's own, not the registry's. Deriving them
 * from the fence would be this file importing `@olai/plugin-api`, which is the
 * cycle the manifests decline to express.
 */

import { readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

const SRC = import.meta.dirname

/** Every source under one of this package's directories. `Bun.Glob` declines to
 *  follow a symlinked directory, so a `node_modules` inside the package is not
 *  a hazard this has to prune — the same reading `tree.testlib.ts` settled on
 *  one package over, arrived at independently because that module may not be
 *  imported from here. */
const sourcesIn = (dir: string): ReadonlyArray<string> =>
  [...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: path.join(SRC, dir) })]
    .map((one) => path.join(dir, one))
    .sort()

/** Every specifier one source reaches for, by POSITION rather than by
 *  statement, so a braced list broken across lines — this tree's dominant style
 *  — is seen, and so is a type-only import. Over-including fails a boundary
 *  claim rather than passing one, which is the right direction to be wrong in. */
const specifiersOf = (file: string): ReadonlyArray<string> =>
  [
    ...readFileSync(path.join(SRC, file), "utf8")
      .matchAll(/(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*)["']([^"'\n]+)["']/gm),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

/** KOLU'S OWN PRODUCT TIER, as the appliance publishes it: its component
 *  libraries, its vocabulary, its themes, the emulator behind its pane, and the
 *  dial that speaks its socket. `@kolu/surface*` is deliberately absent — it is
 *  the FRAMEWORK this whole app is built on, imported anywhere, which is the
 *  same carve-out the fence makes and for the same reason. */
const APPLIANCE_TIER = [
  /^@kolu\/(?!surface)/,
  /^@xterm\//,
  /^terminal-themes(\/|$)/,
  /^@olai\/kolu-client(\/|$)/,
] as const

/** ...and the vocabulary the fold newly put within reach of the faces. */
const THE_VAULT = /^@olai\/format(\/|$)/

const reaching = (dir: string, rules: ReadonlyArray<RegExp>): ReadonlyArray<string> =>
  sourcesIn(dir).flatMap((file) =>
    [...new Set(specifiersOf(file))]
      .filter((spec) => rules.some((rule) => rule.test(spec)))
      .map((spec) => `${file}: ${spec}`)
  ).sort()

describe("the tenant's two face directories", () => {
  test("the reading is not vacuous", () => {
    // A glob that answered nothing, or a specifier reader that matched nothing,
    // would make both equalities below pass over an empty corpus — which is the
    // one failure mode every sweep in this repo carries a floor against.
    expect(sourcesIn("appliance").length).toBeGreaterThan(10)
    expect(sourcesIn("browser").length).toBeGreaterThan(3)
    expect(reaching("appliance", [...APPLIANCE_TIER]).length).toBeGreaterThan(8)
  })

  test("`src/browser/` names no part of the appliance's tier", () => {
    // AN EQUALITY against the empty list, never a length on a filter: a pattern
    // that rotted would report nothing found and pass, which is the shape this
    // repo's fences are written against.
    expect(reaching("browser", [...APPLIANCE_TIER])).toEqual([])
  })

  test("`src/appliance/` names no part of the vault's vocabulary", () => {
    // The wall `@olai/kolu-ui`'s manifest used to keep, kept here instead. It is
    // a claim about a DIRECTORY rather than a package now, which is weaker in
    // kind than a resolution failure and is said so in the PR — what it is not
    // is absent.
    expect(reaching("appliance", [THE_VAULT])).toEqual([])
  })
})
