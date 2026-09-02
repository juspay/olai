/**
 * THE FENCE — that core does not know a plugin's name, held as claims a test
 * can be red about.
 *
 * ## Why a test and not a shell script
 *
 * The two fences this ABSORBED — `scripts/check-kolu-deps.sh`'s fourth and
 * fifth assertions and `scripts/check-odu-deps.sh`'s second and third — ended
 * in `rg … 2>/dev/null || true` over `packages/<name>/src`, and both halves of
 * that are hazards this file declines to inherit. `ripgrep` is not in the dev
 * shell's package list, so on a machine without an ambient one the redirect
 * turns "command not found" into an empty result and a GREEN fence — a fence
 * that passes by failing to run is worse than none. And `packages/<name>/src`
 * misses `packages/tests` entirely, which is the only member with no `src/`,
 * which is how four product-tier `@kolu/*` imports sat in its geometry harness
 * with `just check` green.
 *
 * A test runs under the pinned bun, walks the PACKAGE rather than its `src`,
 * and reads an import two ways — the shape `@olai/acp`'s manifest test already
 * is, and this file is that test one boundary over.
 *
 * What is LEFT in a shell script is the other job those two files did, which
 * was never the same job: agreeing with a pin's declared VERSIONS, read out of
 * the Nix store, deliberately with no `install` in front of it so it fails
 * fast. That is `scripts/check-hydrated-deps.sh` now — one script, invoked once
 * per pin, with no import fence in it at all.
 *
 * ## What it claims
 *
 *   1. **Only `@olai/bundle` names a plugin.** Held as an EQUALITY per
 *      package — `[]` for every general one — and never as a filtered list
 *      asserted empty: a pattern that rotted would report nothing found and
 *      pass, which is the failure mode the sweeps in `@olai/tests` were
 *      written after two days of exactly it.
 *   2. **No plugin imports the REGISTRY, and every plugin imports the
 *      INTERFACE.** The first is what keeps the direction a DAG the manifests
 *      express: `@olai/bundle` imports every plugin, so a plugin that imported
 *      back would be a cycle. The second is the arrow that made the split
 *      necessary — a server half is a Cordis plugin whose `inject` names
 *      services `@olai/plugin-api` declares — and it is asserted to EXIST,
 *      because a fence that only forbade would pass on a tree where the
 *      services door had quietly stopped being reachable.
 *
 *      **"No plugin imports another plugin" is NOT among these any more.**
 *      The Cordis proposal overturns it: `inject` is the dependency arm and it
 *      is reactive, so the half-wired state the ban feared is `PENDING`. What
 *      the ban protected is claim 6's: an appliance's TIER stays inside its
 *      tenant, so a plugin reaching into another's `./server` drags that
 *      appliance's client onto its own graph and goes red there.
 *   3. **A plugin is a SIBLING, and core computes none of its addresses.**
 *      Each plugin composes under its own name, no two share one, and a name
 *      is a legal tag segment because it becomes one. The framework would
 *      catch a collision at boot with a duplicate-tag throw; here it is a test,
 *      in a process that has not started yet.
 *   4. **The wire door stays a wire door.** What the browser reaches
 *      through `@olai/bundle/wire` may not pull a UI runtime onto the
 *      server's graph or an appliance's client onto the browser's — the same
 *      claim `check-kolu-deps.sh`'s fifth assertion makes about the slice one
 *      floor down, made here about the door that composes them.
 *   5. **...and the server door stays a server door.** The modules the bundle's
 *      ROWS name MAY pull an appliance's client, the vault's format and a
 *      `node:` builtin — that is what a runtime half is made of — and may not
 *      pull a browser face onto the graph of a process that renders nothing.
 *      It is the complement of claim 4 rather than a repetition of it, and the
 *      two together are why there are three doors. It is walked as each ROW's
 *      module rather than as one array's import graph, because there is no
 *      array: a row names a specifier the loader resolves at mount, so what is
 *      walked is every module this build will actually mount.
 *   6. **An appliance's PRODUCT TIER stays inside its tenant**, and the tenant
 *      is COMPUTED. Which packages may name `@kolu/padi-client` or
 *      `@odu/run-client` used to be two hand-written `grep -v` path
 *      substrings, one per script, and a hand copy of an architecture is the
 *      exact failure a fence exists to prevent — it went red the day a plugin
 *      grew a testlib that legitimately named its own appliance. Here the
 *      answer is derived: a plugin's TENANT is the set of workspace packages
 *      reachable from its own doors and from NO other plugin's, so a package
 *      two tenants share is general by construction and a third plugin brings
 *      its own tenant with it.
 *   7. **...and what a general package may not name is derived too.** The
 *      product tier is not a list either: it is every specifier a tenant
 *      resolves out of the ROOT `node_modules` that the root manifest never
 *      declared — which is exactly the hydrated set, and exactly what the
 *      isolated linker cannot refuse.
 *
 *   8. **...and no general package spells a plugin's NAME in code either.**
 *      The seven above are about imports; this one is about the other door a
 *      name gets in through — a `koluHalf(…)` call, a `wiring.kolu` slot, an
 *      `olai.cells["plugins:odu:ci"]`. None of those is an import, and every
 *      one of them was in this tree before the extraction.
 *
 *   9. **`packages/plugins/` is the tenant container and holds nothing else.**
 *      Two directions, read off two different sources — the registry's roster
 *      and the filesystem — so a plugin left outside it and a general package
 *      dropped inside it are each a red test rather than a thing a reviewer has
 *      to notice. It is what makes the appliance fold's layout an invariant
 *      instead of a habit.
 *
 * ## Where the READING is, and why it is not here
 *
 * Every claim here is an EQUALITY over a corpus, so the corpus is the whole
 * proof — and reading this repository is not what this file is about. The
 * globs, the manifests, the source walk, the four import grammars and the
 * module graph are `./tree.testlib.ts`, which knows nothing about plugins;
 * this file is the nine claims and their reasons. `mechanics.test.ts` reads
 * the same walk, which is what it stopped carrying its own copy of.
 *
 * The corpus comes off the root manifest's own `workspaces` globs rather than
 * a one-level `readdir`, and the difference is not academic: the tenants nest
 * under `packages/plugins/` now, and a one-level walk would have gone on
 * reporting `[]` from every general package while never opening either plugin.
 * A fence whose corpus can quietly shrink is the shell script this file
 * replaced, wearing a `.ts`.
 *
 * ## What it deliberately does NOT claim
 *
 * That no file anywhere SPELLS the word. Prose that names a package is not a
 * dependency, and a fence that failed on a comment is a fence people learn to
 * work around — which is `check-kolu-deps.sh`'s own ruling and is kept. Claim 8
 * therefore reads what a file COMPILES TO rather than what it says, and it is
 * scoped to production sources: a bench's fixture carries a VAULT's words
 * ("Kolu integration" as a node title, `kolu fleet watch` as a command somebody
 * ran), and the end-to-end suite spawns a fake padi over kolu's own testlib,
 * which is what testing kolu looks like.
 *
 * That claim used to be a POINTER — "the companion sweep lives in
 * `@olai/tests`" — and pi's review found it aimed at a sweep nobody had
 * written. Its reason for exile ("a sweep here reading the browser would be the
 * floor reading the roof") overstated the direction: this file already reads
 * every package's sources as text, which is where the four grammars above come
 * from, and reading is not depending. It is a claim now.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import { ROWS } from "./bundle.ts"
import { PLUGIN_NAMES, WIRES } from "./surfaces.ts"
import {
  cssImportsOf,
  dependencyNames,
  doorsOf,
  graphFrom,
  grammarOf,
  manifestAt,
  MEMBER_OF_PACKAGE,
  mainOf,
  MEMBERS,
  memberOf,
  type Named,
  packageOf,
  PACKAGES,
  runtimeImportsOf,
  REPO,
  sourcesUnder,
  specifiersOf,
  transpilers,
  walkFrom,
} from "./tree.testlib.ts"
/** This package, and the plugins it is allowed to name. Spelled as member
 *  directories because that is what the walk below has; both are DERIVED —
 *  the registry from the manifest that owns this file, the tenants from the
 *  packages the registry names — so a rename moves them without an edit here. */
const REGISTRY = MEMBER_OF_PACKAGE.get("@olai/bundle") ??
  (() => {
    throw new Error("fence: `@olai/bundle` is not a workspace member, so there is no registry to fence")
  })()

/** ...and the INTERFACE, which is the package the registry used to be half of.
 *  It names no plugin, which is what lets a plugin import it — so it is
 *  excused from the "no package outside the registry" claims below by being a
 *  different package, and holds a claim of its own instead: its SERVICES door
 *  pulls no browser face. */
const INTERFACE = MEMBER_OF_PACKAGE.get("@olai/plugin-api") ??
  (() => {
    throw new Error("fence: `@olai/plugin-api` is not a workspace member, so there is no interface to fence")
  })()

/**
 * ONE PLUGIN, ONE RECORD — its name, the package it is published as, and the
 * member directory it lives in.
 *
 * Three parallel arrays indexed together is how the first draft of this read,
 * and it is worth naming why that was wrong rather than merely long: every
 * claim below asks about ONE plugin, and a parallel-array reading spells that
 * as `PLUGIN_DIRS[index] ?? ""` — an index the type system cannot check and an
 * empty-string fallback that would turn a derivation failure into a claim
 * quietly made about the empty path. The record cannot be misaligned, and the
 * throw is where the failure belongs.
 *
 * `olai-plugin-<name>` is the one piece of arithmetic here, and it is the
 * ecosystem's: a tenant is named the way a plugin written outside this tree
 * would be, so the name says what the thing is.
 */
const TENANTS_OF: ReadonlyArray<{ name: string; pkg: string; dir: string }> = PLUGIN_NAMES.map(
  (name) => {
    const pkg = `olai-plugin-${name}`
    const dir = MEMBER_OF_PACKAGE.get(pkg)
    if (dir === undefined) {
      throw new Error(`fence: the registry names \`${pkg}\`, which is no workspace member`)
    }
    return { name, pkg, dir }
  },
)

const PLUGIN_PACKAGES = TENANTS_OF.map((one) => one.pkg)
const PLUGIN_DIRS = TENANTS_OF.map((one) => one.dir)

/** WHERE A TENANT LIVES, as a directory rather than a preference:
 *  `packages/plugins/` is the plugin container and holds nothing else. Held as
 *  an equality in its own claim below; spelled once here. */
const CONTAINER = "plugins"

/** Does this specifier name a plugin package — the bare name or a subpath
 *  under it. A claim that matched only the bare name would be green under
 *  `olai-plugin-kolu/wire`, which is the door every consumer would actually
 *  use. */
const namesAPlugin = (spec: string): boolean => PLUGIN_PACKAGES.includes(packageOf(spec))

/** One source, as `./tree.testlib.ts` reads it, PLUS the one projection that is
 *  this file's: which of its specifiers name a plugin. The reader knows nothing
 *  about plugins and must not — that is the split — so the plugin-shaped field
 *  is added here, where the word means something. */
interface Read extends Named {
  readonly plugins: ReadonlyArray<string>
}

/** Every member's sources, read once, each with what it reaches for. */
const tree: ReadonlyMap<string, ReadonlyArray<Read>> = new Map(
  MEMBERS
    .map((member) => [
      member as string,
      sourcesUnder(path.join(PACKAGES, member)).map((file): Read => {
        // A scripted agent opens with a shebang; the line holds no import.
        const text = readFileSync(file, "utf8").replace(/^#![^\n]*\n/, "")
        const grammar = grammarOf(file)
        const found = grammar === "css" ? cssImportsOf(text) : specifiersOf(text)
        return {
          file: path.relative(PACKAGES, file),
          grammar,
          specs: found,
          plugins: found.filter(namesAPlugin),
        }
      }),
    ]),
)

/** ...and every package's MANIFEST, which is the fourth door and the one no
 *  reading of a source can see: `workspace:*` is how a dependency is really
 *  declared, and a package that dropped the import but kept the line is a
 *  package still standing on the wrong side of the wall. */
const declaredBy = (pkg: string): ReadonlyArray<string> =>
  dependencyNames(manifestAt(path.join(PACKAGES, pkg))).filter(namesAPlugin)

const packages = [...tree.keys()].sort()

/** What must not be on the graph of the door every listener pulls in, and why
 *  each: `solid-js` is a UI runtime and the SERVER reads this; a padi or odu
 *  client is an appliance's whole contract and the BROWSER reads this;
 *  `@olai/format` is the vocabulary a floor package has no business teaching
 *  upward; a `node:` builtin is not a thing a browser bundle may contain.
 *
 *  This is `check-kolu-deps.sh`'s fifth assertion and `check-odu-deps.sh`'s
 *  third, made once about the door that composes them rather than twice about
 *  the slices behind it. */
const FORBIDDEN = [
  /^solid-js(\/|$)/,
  /^@olai\/format(\/|$)/,
  /^node:/,
  /^@kolu\/(padi-client|terminal-vocab|solid-dockrow|solid-statepip|detect)(\/|$)/,
  /^@xterm\//,
  /^@odu\//,
] as const

/**
 * NO DOOR CARRIES A COMPONENT, and this is that claim once rather than per door.
 *
 * The two confinement lists above and below are SPECIFIER lists, and the
 * appliance fold showed what they cannot see: `NOT_ON_A_SERVER` used to name
 * `@olai/kolu-ui`, a whole package of browser faces, and that package is a
 * module directory of its tenant now. A relative `../appliance/index.ts` is not a
 * specifier any confinement list can carry, and a per-directory rule inside
 * somebody's package would be this fence inventing a layout convention and then
 * enforcing its own invention.
 *
 * So the claim is made about the FILE the walk landed in, with the instrument
 * the tree already uses to mean *this renders*: `.tsx` is JSX, JSX is a
 * component, and Bun's default JSX runtime is React's — which is the boot death
 * this whole door split was written after (`Cannot find module
 * 'react/jsx-dev-runtime'`). It needs no list and no directory name, and it is
 * STRICTLY WIDER than the entry it replaces: it catches a face in any package
 * and any folder, including one nobody has written yet.
 *
 * BOTH DOORS, not just the server's, and the wire door is the sharper case
 * rather than the redundant one. `jsx: preserve` with `jsxImportSource:
 * solid-js` means a face that imports only its siblings carries no `solid-js`
 * specifier at all, so `scanImports` sees nothing a list could match — and the
 * wire door is the one EVERY listener pulls in statically, the server's process
 * included. A general instrument wired to one of the two doors it applies to is
 * a special case wearing a mechanism's clothes.
 */
const componentsOn = (door: { files: ReadonlyArray<string> }): ReadonlyArray<string> =>
  door.files.filter((file) => file.endsWith(".tsx"))

/** The two doors, walked ONCE each. `graphFrom`'s whole argument is that one
 *  traversal answers both readings; walking the same entry again per test would
 *  be the argument undercut by its own callers, and the file re-read three
 *  times over. */
const WIRE_DOOR = graphFrom(path.join(PACKAGES, REGISTRY, "src", "wire.ts"))

/**
 * ...AND THE SERVER DOOR, which is no longer a FILE in this package.
 *
 * It was `src/server.ts`: an array of statically imported server halves, whose
 * import graph this walk followed. There is no such array — the rows in
 * `olai.yml` name each plugin's server module as a SPECIFIER and the loader
 * mounts it at runtime — so what is walked is each ROW's module, resolved off
 * the bundle rather than off an import.
 *
 * The claim it holds is unchanged and the reading is stronger: it used to be
 * "whatever the registry's `./server.ts` happened to pull in", and it is now
 * "every module this build will actually mount". A row naming a module that
 * does not exist is a walk that cannot read it, which the `unresolved` claim
 * below is about.
 */
const SERVER_DOOR = ((): ReturnType<typeof graphFrom> => {
  const graphs = ROWS.map((row) => {
    // `olai-plugin-kolu/server` → `packages/plugins/olai-plugin-kolu/src/server.ts`.
    // The one piece of arithmetic, and it is the ecosystem's rather than this
    // file's: a package's `./server` subpath is `src/server.ts` in every member
    // of this tree, and a row whose module does not resolve that way is a row
    // this walk reports rather than skips.
    const dir = MEMBER_OF_PACKAGE.get(packageOf(row.name))
    if (dir === undefined) throw new Error(`fence: the bundle row \`${row.id}\` names no workspace member`)
    return graphFrom(path.join(PACKAGES, dir, "src", "server.ts"))
  })
  return {
    reached: graphs.flatMap((one) => one.reached),
    files: [...new Set(graphs.flatMap((one) => one.files))],
    unresolved: graphs.flatMap((one) => one.unresolved),
  }
})()


describe("the wire door stays a wire door", () => {
  const reached = WIRE_DOOR.reached

  test("the walk actually crossed into both plugins", () => {
    // Not vacuous: a resolver that answered `undefined` for every workspace
    // specifier would walk one file and pass every claim below.
    const files = new Set(reached.map((one) => one.file))
    for (const tenant of TENANTS_OF) {
      expect([...files].some((f) => f.startsWith(`${tenant.dir}${path.sep}`)), tenant.name)
        .toBe(true)
    }
  })

  test("the walk resolved every edge it followed", () => {
    // THE PRECONDITION UNDER BOTH CLAIMS BELOW, and an equality like every
    // other one in this file. A specifier this walk could not follow is a hole
    // in the graph, and a graph with holes satisfies a confinement list by
    // being empty — which is the fence passing by not running, one traversal
    // down. `external` is the legitimate terminus and is not in this list.
    expect(WIRE_DOOR.unresolved).toEqual([])
  })

  test("nothing on it is a UI runtime, an appliance's client, or the format", () => {
    const bad = reached
      .filter((one) => FORBIDDEN.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
  })

  test("...and no file on it is a component at all", () => {
    expect(componentsOn(WIRE_DOOR)).toEqual([])
  })
})

/**
 * ...and what must not be on the graph of the door a COMPOSITION ROOT opens,
 * which is a shorter list and a different claim.
 *
 * A server legitimately pulls an appliance's client — that is what a runtime
 * half IS — along with the vault's format (the walks read outline records) and
 * `node:` builtins, every one of which the wire door above refuses. What it
 * must never pull is a BROWSER FACE: a UI runtime, a component library's
 * components, an emulator. That is the whole reason `./server.ts` is a third
 * door rather than a field on the manifest, and this is that reason held as a
 * claim instead of stated in a header.
 *
 * A COMPONENT LIBRARY'S BARREL is refused and its documented VALUE-ONLY subpath
 * is not, which is a distinction the libraries themselves draw and this fence
 * inherits rather than invents: `@kolu/solid-dockrow/rowValues` is that
 * package's own "pure half — every fold a consumer needs, with no JSX in the
 * import graph", split off for exactly the reason this test exists, and
 * `@olai/kolu-client` has always reached it for its row folds. Matching the
 * bare specifier is what separates "somebody imported the components" from
 * "somebody imported the arithmetic".
 */
const NOT_ON_A_SERVER = [
  /^solid-js(\/|$)/,
  /^@solid-primitives\//,
  /^@xterm\//,
  /^@kolu\/solid-[^/]+$/,
  /^@kolu\/terminal-themes(\/|$)/,
] as const


describe("the server door pulls no browser face", () => {
  const reached = SERVER_DOOR.reached

  test("the walk actually crossed into both plugins' server halves", () => {
    // Not vacuous, for the wire door's reason: a resolver that answered
    // `undefined` for every workspace specifier would walk one file and pass.
    const files = new Set(reached.map((one) => one.file))
    for (const tenant of TENANTS_OF) {
      expect([...files].some((f) => f === path.join(tenant.dir, "src", "server.ts")), tenant.name)
        .toBe(true)
    }
  })

  test("the walk resolved every edge it followed", () => {
    // The wire door's reason, one door over.
    expect(SERVER_DOOR.unresolved).toEqual([])
  })

  test("nothing on it is a UI runtime or a component library", () => {
    const bad = reached
      .filter((one) => NOT_ON_A_SERVER.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
  })

  test("...and no file on it is a component at all", () => {
    expect(componentsOn(SERVER_DOOR)).toEqual([])
  })

  test("...and the LEAF reading is not vacuous", () => {
    // `componentsOn` is the only claim in this file that reads the files a walk
    // VISITED rather than the specifiers it evaluated, so it gets its own
    // floor: a version of that reading which resolved nothing would report no
    // components by reporting no files at all. The MANIFEST door is where the
    // components legitimately are, so the same reading over that entry is the
    // positive control — it must find some.
    expect(SERVER_DOOR.files.length).toBeGreaterThan(10)
    expect(WIRE_DOOR.files.length).toBeGreaterThan(5)
    expect(componentsOn(graphFrom(path.join(PACKAGES, REGISTRY, "src", "index.ts"))).length)
      .toBeGreaterThan(0)
  })

  test("it DOES reach each appliance's client, which is the point of the door", () => {
    // The complement, said out loud: this door exists to carry exactly what the
    // wire door may not. A version of it that reached nothing would pass the
    // claim above by being empty, and the runtime halves would be somewhere
    // else — which is the arrangement this whole split replaced.
    const specs = new Set(reached.map((one) => one.spec))
    expect(specs.has("@olai/kolu-client")).toBe(true)
    expect(specs.has("@olai/odu-client")).toBe(true)
  })
})

/**
 * THE CONTAINER IS THE TENANTS, AND ONLY THE TENANTS — the directory held as an
 * equality rather than as a convention somebody remembers.
 *
 * `packages/plugins/` used to be the INTERFACE package, which is the one package
 * a plugin may not import. Putting the tenants inside a directory of that name
 * made two readings contradict each other on their face: the workspace globs
 * would have listed a container beside its own contents, and this file's graph
 * walk would have had `plugins` meaning the fence's subject in one line and the
 * thing it fences in the next. So the interface moved out to `@olai/plugin-api`
 * and `packages/plugins/` became the container — one directory, one kind of
 * thing in it. The REGISTRY then moved again, to `@olai/bundle`, when a plugin
 * started importing the interface; the container is unaffected, and the package
 * a plugin may not import is `@olai/bundle` now.
 *
 * Held BOTH WAYS, because each direction fails differently and silently:
 *
 *   - a plugin OUTSIDE the container is a tenant nobody would look for, and the
 *     day one is added at the top level nothing else in the tree objects;
 *   - a member INSIDE it that is not a plugin is the contradiction coming back —
 *     a general package sitting in the tenant directory, which the next reader
 *     would reasonably take for a tenant.
 *
 * The two sides are read from two different places (the registry's own roster,
 * and the filesystem under the container), which is what makes this an
 * agreement rather than a restatement.
 */
describe("packages/plugins is the tenant container, and holds nothing else", () => {
  test("every plugin the registry names lives in it, and nothing else does", () => {
    // THE FILESYSTEM, not `MEMBERS`, and the difference is the whole claim.
    // `MEMBERS` only admits a directory that HAS a `package.json`, so a reading
    // taken from it would be blind to exactly the case worth catching: a loose
    // `packages/plugins/shared/` of `.ts` files is not a member, so it would be
    // invisible here AND absent from `tree` — which means claims 1, 6 and 8
    // would all pass over its sources without ever opening them. That is the
    // corpus quietly shrinking, at the one directory this claim was added to
    // protect.
    const inside = readdirSync(path.join(PACKAGES, CONTAINER), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(CONTAINER, entry.name))
      .sort()
    expect(inside).toEqual([...PLUGIN_DIRS].sort())
    // ...and the container is not itself a package: a `package.json` beside the
    // tenants would put a member at `packages/plugins`, which is the name this
    // whole move was about not overloading.
    expect(existsSync(path.join(PACKAGES, CONTAINER, "package.json"))).toBe(false)
  })

  test("the reading is not vacuous", () => {
    // A container that did not exist, or a `dirname` that answered "." for
    // everything, would make the equality above `[] === []`.
    expect(PLUGIN_DIRS.length).toBeGreaterThan(1)
    for (const dir of PLUGIN_DIRS) expect(path.dirname(dir)).toBe(CONTAINER)
  })
})

describe("only the registry knows a plugin's name", () => {
  /** THE FLOOR. A corpus that came back short is the failure mode this file
   *  was written to not inherit — an empty sweep reports nothing found and
   *  every claim below passes. The number is a floor and not a count, so
   *  adding a package does not edit a test. */
  test("the sweep is actually reading the repository", () => {
    const files = [...tree.values()].flat().length
    expect(packages.length).toBeGreaterThan(15)
    expect(files).toBeGreaterThan(400)
  })

  test("no package outside the registry imports a plugin", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      const reached = tree.get(pkg)?.flatMap((s) => s.plugins.map((p) => `${s.file}: ${p}`)) ?? []
      // An EQUALITY against the empty list, never a length on a filter: a
      // pattern that rotted would report nothing and pass.
      expect(reached, pkg).toEqual([])
    }
  })

  test("no package outside the registry declares a plugin in its manifest", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      expect(declaredBy(pkg), pkg).toEqual([])
    }
  })

  test("the registry declares every plugin it imports, and no other", () => {
    const reached = new Set(tree.get(REGISTRY)?.flatMap((s) => s.plugins) ?? [])
    for (const spec of reached) expect(namesAPlugin(spec), spec).toBe(true)
    expect([...declaredBy(REGISTRY)].sort()).toEqual([...PLUGIN_PACKAGES].sort())
  })

  /**
   * A PLUGIN MAY NOT IMPORT THE REGISTRY — and MAY import another plugin, which
   * is the one claim of this file the phase RETIRED.
   *
   * ## What fell, and why it is not a hole
   *
   * "No plugin imports another plugin" was an equality here. The Cordis proposal
   * overturns it: `inject` is the dependency arm and it is REACTIVE, so the
   * half-wired state the ban feared is `PENDING` — a legitimate, inspectable
   * state the runtime resolves or reports. The first edge that needs it is the
   * spaces-mirror lane, which wants kolu's fleet beside odu's runs and which the
   * old shape could only wire by hand at the composition root.
   *
   * What the ban was PROTECTING is still protected, by a claim further down: an
   * appliance's product TIER stays inside its TENANT, so a plugin that reached
   * into another's `./server` would drag that appliance's client onto its own
   * graph and go red there. The protection moved; it did not leave.
   *
   * ## What stands
   *
   * THE REGISTRY IS STILL FORBIDDEN. `@olai/bundle` imports every plugin, so a
   * plugin importing it back is the cycle the manifests decline to express.
   * Held over the sources too, because a type-only import is a cycle a bundler
   * forgives and a reader does not — which is why this reads `specs` (the
   * positional grammar, which sees a type-only import) rather than the walk's
   * `scanImports`.
   */
  test("a plugin does not import the registry", () => {
    for (const { dir } of TENANTS_OF) {
      const back = tree.get(dir)?.flatMap((s) =>
        s.specs
          .filter((spec) => spec === "@olai/bundle" || spec.startsWith("@olai/bundle/"))
          .map((spec) => `${s.file}: ${spec}`)
      ) ?? []
      expect(back, dir).toEqual([])
    }
  })

  /**
   * ...AND IT DOES IMPORT THE INTERFACE, which is the positive half and is not
   * decoration.
   *
   * A version of this fence that only forbade things would pass on a tree where
   * the services door had quietly stopped being reachable — a plugin written
   * against a copy of the shapes, structurally, the way `olai-plugin-odu`'s
   * `server.ts` re-declared `Deliveries` for a while precisely because the
   * import WAS a cycle. So the arrow is asserted to exist.
   */
  test("...and every plugin does import the interface", () => {
    for (const { dir } of TENANTS_OF) {
      const named = tree.get(dir)?.flatMap((s) =>
        s.specs
          .filter((spec) => spec === "@olai/plugin-api" || spec.startsWith("@olai/plugin-api/"))
          .map((spec) => `${s.file}: ${spec}`)
      ) ?? []
      expect(named.length, dir).toBeGreaterThan(0)
    }
  })
})

/**
 * ...AND THE MANIFEST DOOR IS OPENED BY THE THING THAT RENDERS, AND BY NOTHING
 * ELSE.
 *
 * The three doors are three graphs and the fence above walks two of them from
 * the INSIDE — what `./wire.ts` and `./server.ts` may reach. This is the same
 * claim from the OUTSIDE, and it is here because the inside walk cannot see it:
 * a consumer that opens the wrong door is a consumer's line, not this package's.
 *
 * The failure it prevents is not a stylistic one. The root carries every
 * plugin's browser faces — SolidJS components, and behind kolu's a terminal
 * emulator — so a server process that reaches it evaluates a `.tsx`, and Bun's
 * default JSX runtime is React's: the boot dies on `Cannot find module
 * 'react/jsx-dev-runtime'` before the server has served anything. That is not
 * hypothetical; it is what `@olai/server`'s `pluginPolicy.ts` did the day the
 * manifests grew faces, reaching the root for a list of STRINGS that `./wire`
 * exports too.
 *
 * So the rule is stated as an EQUALITY per package, for the reason every claim
 * in this file is: `@olai/web` renders, and may open the manifests; every other
 * package outside this one reaches a SUBPATH or nothing. A subpath is not
 * matched, because that is the whole point — `./wire`, `./server`, `./testids`
 * and `./all.css` are exactly what a consumer is meant to name.
 */
describe("only the renderer opens the manifest door", () => {
  /** The one package whose job is to draw a plugin's faces. Spelled as a
   *  directory name because that is what the walk has. */
  const RENDERER = "web"

  test("no package but the browser imports `@olai/bundle` itself", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY || pkg === RENDERER) continue
      // The BARE specifier alone. A subpath is the supported reach and is
      // deliberately not matched — a claim that caught `@olai/bundle/wire`
      // would forbid the door this whole split exists to offer.
      //
      // Read off `Named.specs`, which is the corpus read ONCE at module scope in
      // whichever grammar each file has. Re-reading here to ask a second
      // question of the same text is what that field.s own comment forbids, and
      // it is the most expensive thing in this file when it happens.
      const reached = tree.get(pkg)?.flatMap((s) =>
        s.specs.filter((spec) => spec === "@olai/bundle").map(() => s.file)
      ) ?? []
      expect(reached, pkg).toEqual([])
    }
  })

  /**
   * ...AND THE SERVICES DOOR PULLS NO BROWSER FACE, which is the claim the
   * INTERFACE package owes now that it is one.
   *
   * `@olai/plugin-api` is two doors: the root is what a browser half is written
   * against and its fields return `JSX.Element`, and `./services` is what a
   * SERVER half is written against. A server that reached the first would
   * evaluate a `.tsx` and die on `react/jsx-dev-runtime` before it served
   * anything — the same hazard the three-door split has always been about, one
   * package over — so the services door is walked and held to the same list a
   * server door is.
   */
  test("the services door pulls no browser face", () => {
    const door = graphFrom(path.join(PACKAGES, INTERFACE, "src", "services.ts"))
    expect(door.unresolved).toEqual([])
    const bad = door.reached
      .filter((one) => NOT_ON_A_SERVER.some((rule) => rule.test(one.spec)))
      .map((one) => `: `)
    expect([...new Set(bad)].sort()).toEqual([])
    expect(componentsOn(door)).toEqual([])
    // Not vacuous: the door reaches at least the contract beside it.
    expect(door.files.length).toBeGreaterThan(1)
  })
})

describe("a plugin is a sibling, and core computes none of its addresses", () => {
  test("every plugin is composed under its own name, and no two share one", () => {
    const names: ReadonlyArray<string> = WIRES.map((wire) => wire.name)
    expect([...names].sort()).toEqual([...PLUGIN_NAMES].sort())
    // The sibling KEY is the wire prefix, so two plugins with one name is two
    // sets of members at one address — which `composeSurfaceContracts` would
    // catch at boot with a duplicate-tag throw, in a process that has already
    // started. Here it is a test.
    expect(new Set(names).size, names.join(", ")).toBe(names.length)
  })

  test("a plugin's name is a legal tag segment, because it becomes one", () => {
    // `assertTagSegment` refuses an empty name and one containing "/", and it
    // refuses at boot. The framework's reason is the sharper one and it is
    // worth keeping in view here: a name carrying the separator would spell
    // one tag with two different members behind it, which the duplicate check
    // could not see. A plugin's name is also its preferences row and its docs
    // slug, so the bar this holds it to is a little higher than the
    // framework's — a word, not a path.
    for (const wire of WIRES) {
      expect([wire.name, /^[a-z][a-z0-9-]*$/.test(wire.name)]).toEqual([wire.name, true])
    }
  })

  test("every face a plugin names is a face it wrote a map for", () => {
    // An empty map and an ABSENT map mean the same thing to `exposeFaces`
    // (deny in full) and different things to a reader: an empty one asserts
    // the plugin considered the face and declined, which is a claim worth
    // being able to make, but a face key holding nothing at all is more
    // likely a half-finished edit. This is the one shape check on a value the
    // compiler sees only as a record of records.
    for (const wire of WIRES) {
      for (const [face, map] of Object.entries(wire.faces)) {
        expect([`${wire.name}/${face}`, Object.keys(map).length > 0])
          .toEqual([`${wire.name}/${face}`, true])
      }
    }
  })
})

/**
 * AN APPLIANCE'S PRODUCT TIER STAYS INSIDE ITS TENANT — the claim
 * `check-kolu-deps.sh`'s fourth assertion and `check-odu-deps.sh`'s second
 * made, made once, and with both of its lists COMPUTED instead of typed.
 *
 * ## The wall, and why it is a package wall
 *
 * The human's ruling, the sixth sitting: *"a directory wall can be broken
 * easily by importing; package walls cannot, and are conceptually
 * self-explanatory."* padi lives behind `@olai/kolu-client` and odu's run client
 * behind `@olai/odu-client` — each names no olai package at all, and the
 * resolver, not a sweep, is what proves it. The plugin package on top of each is
 * olai's own judgement ABOUT that appliance, and since the appliance fold it is
 * also every face that appliance wears: `@olai/kolu-ui` folded into
 * `olai-plugin-kolu` as a module directory, because nothing on that side of the
 * wall was ever the appliance's implementation. The DIAL is where the ruling
 * still bites, and it did not move.
 * No general package may name any of it. ZERO EXCEPTIONS was itself a ruling —
 * a file-grained exception in a package-grained fence is discipline dressed as
 * physics — and the one entry in {@link DEBT} below is a recorded BREACH held
 * as an equality, which is the opposite of an exception: it is red the day it
 * grows and red again the day it is fixed.
 *
 * ## Why both lists are derived, which is the whole point of doing this again
 *
 * The two shell fences each carried the answer BY HAND — a `PRODUCT=` alternation
 * of six specifiers in one, and `grep -v '/packages/odu-client/'` in the other.
 * A hand copy of an architecture is precisely what a fence exists to prevent,
 * and this one failed the way hand copies fail: a plugin package grew a testlib
 * that served its own appliance's real surface, which is the tenancy working
 * exactly as designed, and `check-odu-deps.sh` called it a wall breach because
 * its list said `odu-client` and nothing else.
 *
 * So:
 *
 *   - **A TENANT is computed from the registry.** Walk each plugin's own code
 *     doors — the `.ts` targets of its `exports` map, so the doors are the
 *     manifest's answer and not this file's — and collect the workspace
 *     packages the walk reaches. A package reached from TWO plugins is general
 *     by construction (`@olai/format` is: both plugins' vault walks read
 *     records) and drops out. What is left for kolu is
 *     `plugins/olai-plugin-kolu` and `kolu-client`; for odu,
 *     `plugins/olai-plugin-odu` and `odu-client`. Nobody typed those.
 *
 *   - **A TIER is computed from the tenant.** Whatever a tenant names that
 *     resolves out of the ROOT `node_modules` and is declared in NO manifest —
 *     not the root's, not the naming package's own — is hydrated: copied into
 *     that one directory from a Nix pin (`nix/kolu.nix`, `nix/odu.nix`), where
 *     every package in the tree resolves it whether it declared it or not.
 *     That last clause is the whole reason a fence is needed for these and for
 *     nothing else: the isolated linker (bunfig.toml) already refuses a
 *     specifier a manifest does not declare, so `@xterm/*` — which the old
 *     `PRODUCT` alternation listed — needs no fence at all. It is ordinary npm,
 *     and dropping it is not a relaxation.
 *
 *   - **The FRAMEWORK tier is out of scope, and it is the one thing still
 *     spelled.** `@kolu/surface*` is olai's foundation, imported anywhere, like
 *     `effect` — `check-kolu-deps.sh`'s own ruling, kept in its own words. It is
 *     a tier boundary rather than a confinement table, which is why it survives
 *     as a rule while both lists became derivations.
 */

/** What the ROOT declares — `dependencies` and `devDependencies` both, because
 *  either one puts a package where the whole tree can reach it. */
const ROOT_DECLARED: ReadonlySet<string> = new Set(dependencyNames(manifestAt(REPO)))

/** THE FRAMEWORK TIER, and the only list in this block that a person wrote.
 *  `@kolu/surface`, `-app`, `-cli`, `-mcp`, `-daemon`, `-daemon-supervisor`:
 *  olai's app is BUILT on them — the surface composition every one of these
 *  claims is about is theirs — so they are imported anywhere, like `effect`.
 *  Confining them would be confining the framework to a tenant.
 *
 *  `cordis` and `@cordisjs/plugin-*` are the SAME TIER and the arm is
 *  PERMANENT, which is the one thing that changed about this rule this phase.
 *  It arrived in the spike as a note saying "drop the two arms the day the
 *  spike is deleted"; the spike is deleted and the arms stayed, because Cordis
 *  is now the runtime olai's server composition is built on — a plugin imports
 *  it to type its own `apply`, the composition root mounts the bundle on it,
 *  and the interface package's services extend its `Service`. Confining it to a
 *  tenant would be confining the framework to a tenant, which is exactly the
 *  sentence above one pin over. It is hydrated from the npins pin
 *  (`nix/cordis.nix`) the way every `@kolu/*` member is, which is why it needs
 *  the arm at all. */
const FRAMEWORK = /^(?:@kolu\/surface(-[a-z]+)*|cordis|@cordisjs\/plugin-[a-z]+)(\/|$)/

/** Is this specifier, named by this package, a HYDRATED one — copied into the
 *  root `node_modules` from a Nix pin, where every package resolves it whether
 *  it declared it or not.
 *
 *  The last clause is the load-bearing one and is a filesystem question rather
 *  than a pattern: a directory under the root `node_modules` that no manifest
 *  in the tree asked for is, by construction, one the hydrate step put there.
 *  It is also what keeps the loose reader above honest — `specifiersOf` matches
 *  prose that merely looks like a specifier (deliberately: over-including fails
 *  a boundary claim rather than passing one), and a sentence is not a directory. */
const isHydrated = (pkg: string, spec: string, own: ReadonlySet<string>): boolean => {
  if (spec.startsWith(".") || spec.startsWith("/")) return false
  if (spec.startsWith("node:") || spec.startsWith("bun:") || spec === "bun") return false
  if (spec.startsWith("@olai/")) return false
  if (FRAMEWORK.test(spec)) return false
  const name = packageOf(spec)
  if (ROOT_DECLARED.has(name) || own.has(name)) return false
  return existsSync(path.join(REPO, "node_modules", name))
}

/** Every hydrated specifier one package names, in any of the grammars the
 *  readers above cover, as `file: specifier` so a failure reads as something to
 *  open. */
const hydratedIn = (pkg: string): ReadonlyArray<string> => {
  const own = new Set(dependencyNames(manifestAt(path.join(PACKAGES, pkg))))
  return (tree.get(pkg) ?? []).flatMap((source) =>
    [...new Set(source.specs)]
      .filter((spec) => isHydrated(pkg, spec, own))
      .map((spec) => `${source.file}: ${spec}`)
  ).sort()
}

/** A plugin's own CODE doors, read off its `exports` map — the manifest's
 *  answer rather than this file's guess at one, so a fourth door added there is
 *  walked here without an edit. `./all.css` is not a module and drops out. */
const codeDoorsOf = (dir: string): ReadonlyArray<string> => {
  const manifest = manifestAt(dir)
  if (manifest === undefined) return []
  // THROUGH `doorsOf`, not through a cast. This is the one function that
  // enumerates ALL of a tenant's doors — it feeds CLOSURES, TENANTS,
  // TENANT_MEMBERS and TIERS — so a door it drops is a tenant closure that
  // shrank, which is what `doorsOf` refuses a conditional or wildcard export
  // for. A cast would have read one as `[object Object]`, failed the suffix
  // test, and dropped it in silence: the exact hole, in the exact function
  // where it costs the most.
  const targets = [...Object.values(doorsOf(manifest)), mainOf(manifest) ?? ""]
  return [...new Set(targets)].filter((t) => /\.tsx?$/.test(t)).map((t) => path.join(dir, t))
}

/** Which workspace packages one plugin's doors reach. Both the file a walk
 *  landed IN and the workspace specifier it reached FOR are counted: a leaf
 *  module with no imports of its own is visited and records nothing, and the
 *  package it belongs to is a tenant member all the same. */
const reachedBy = (entries: ReadonlyArray<string>): ReadonlySet<string> => {
  const packages = new Set<string>()
  for (const entry of entries) {
    for (const one of walkFrom(entry)) {
      const member = memberOf(one.file)
      if (member !== undefined) packages.add(member)
      const named = MEMBER_OF_PACKAGE.get(packageOf(one.spec))
      if (named !== undefined) packages.add(named)
    }
  }
  return packages
}

const CLOSURES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  TENANTS_OF.map(({ name, dir }) => {
    const reached = new Set(reachedBy(codeDoorsOf(path.join(PACKAGES, dir))))
    reached.add(dir)
    return [name, reached] as const
  }),
)

/** THE TENANTS. A package one plugin reaches and no other does — everything
 *  shared drops out, which is what makes this a derivation rather than a
 *  restatement. The registry is excluded by name because it reaches every
 *  plugin by definition and is the one package that may. */
const TENANTS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  [...CLOSURES].map(([name, own]) => [
    name,
    new Set(
      [...own].filter((pkg) =>
        pkg !== REGISTRY &&
        ![...CLOSURES].some(([other, theirs]) => other !== name && theirs.has(pkg))
      ),
    ),
  ]),
)

/** ...and each tenant's TIER: the hydrated PACKAGES its own members name. */
const TIERS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  [...TENANTS].map(([name, members]) => [
    name,
    new Set([...members].flatMap((pkg) => hydratedIn(pkg).map((line) => packageOf(line.split(": ")[1] ?? "")))),
  ]),
)

const TENANT_MEMBERS: ReadonlySet<string> = new Set([...TENANTS.values()].flatMap((m) => [...m]))

/**
 * THE ONE RECORDED BREACH, and it is recorded rather than excused.
 *
 * `packages/tests/geometry/harness.tsx` mounts kolu's own `DockRow` and
 * `StatePip` and folds a padi record with `activePr` — product tier, in the one
 * package that sits above every other. It is not new; it is what the header of
 * this file means by "sat in its geometry harness with `just check` green",
 * because `packages/<name>/src` never looked at `packages/tests`, the only member
 * with no `src/`. Its own header calls it "not part of any suite and not
 * shipped" — a one-off driver for a shot the human asked to SEE — and where it
 * belongs under this architecture is behind `olai-plugin-kolu`, whose faces
 * those are.
 *
 * Held as an EQUALITY, which is the difference between a debt and an exception:
 * a fifth import in that harness is red, a breach in any other file is red, and
 * the day the harness moves this entry is red until it is deleted. An
 * `expect(...).toEqual([])` with a path filtered out in front of it would be
 * none of those things.
 */
const DEBT: Readonly<Record<string, ReadonlyArray<string>>> = {
  tests: [
    "tests/geometry/harness.tsx: @kolu/padi-client/surface",
    "tests/geometry/harness.tsx: @kolu/solid-dockrow",
    "tests/geometry/harness.tsx: @kolu/solid-dockrow/rowValues",
    "tests/geometry/harness.tsx: @kolu/solid-statepip",
  ],
}

describe("an appliance's product tier stays inside its tenant", () => {
  test("the tenants are exactly what is written down here", () => {
    // AN EQUALITY, NOT A FLOOR, and the difference is the whole of what a
    // tenant set decides. Three claims SKIP every tenant member — the hydrated
    // specifier equality, the manifest one beside it, and claim 8's name sweep
    // — so `TENANT_MEMBERS` is an exemption set. A floor guards it against
    // being empty and guards nothing at all against it GROWING: the day
    // `olai-plugin-odu` stops walking a vault, `@olai/format` is reached from
    // one plugin only, becomes kolu's tenant member, and is silently exempted
    // from all three — widened by an ordinary one-line import inside a plugin,
    // which is the one place a reviewer would not look for it.
    //
    // The derivation stays; what is added is that a change to it has to be
    // WRITTEN DOWN. The same move {@link DEBT} makes and for the same reason:
    // red the day it grows, and red again the day it shrinks.
    expect(
      Object.fromEntries([...TENANTS].map(([name, members]) => [name, [...members].sort()])),
    ).toEqual({
      kolu: ["kolu-client", "plugins/olai-plugin-kolu"],
      odu: ["odu-client", "plugins/olai-plugin-odu"],
    })
    // ...and each tenant has a TIER, which is the other way this derivation
    // comes back empty: a `node_modules` that was never hydrated.
    for (const { name } of TENANTS_OF) {
      expect([name, (TIERS.get(name) ?? new Set()).size > 0]).toEqual([name, true])
    }
  })

  test("every DEBT key is a package, and none of them is exempt anyway", () => {
    // A recorded breach is consulted only on the arm the loops below reach, and
    // `if (TENANT_MEMBERS.has(pkg)) continue` runs FIRST. So a `DEBT` key that
    // became a tenant member would be forgiven in silence — the one outcome
    // "held as an equality rather than as an exception" was written to prevent
    // — and a key naming a package that no longer exists is a debt nobody can
    // pay and nothing reports.
    for (const pkg of Object.keys(DEBT)) {
      expect([pkg, packages.includes(pkg)]).toEqual([pkg, true])
      expect([pkg, TENANT_MEMBERS.has(pkg)]).toEqual([pkg, false])
    }
  })

  test("no package outside a tenant names a hydrated specifier", () => {
    for (const pkg of packages) {
      if (TENANT_MEMBERS.has(pkg)) continue
      // An EQUALITY against the recorded answer — `[]` for all but the one
      // breach above — never a filter asserted empty.
      expect(hydratedIn(pkg), pkg).toEqual([...(DEBT[pkg] ?? [])])
    }
  })

  test("no package outside a tenant DECLARES one either", () => {
    // The manifest door, which no reading of a source can see. A hydrated
    // package must never appear in a manifest at all — naming one sends bun to
    // the registry for something that is not there, which `@odu/run-client`'s
    // own manifest says in as many words — so a general package declaring one
    // is a second, quieter way through the same wall.
    const tiers = new Set([...TIERS.values()].flatMap((t) => [...t]))
    for (const pkg of packages) {
      if (TENANT_MEMBERS.has(pkg)) continue
      expect(dependencyNames(manifestAt(path.join(PACKAGES, pkg))).filter((d) => tiers.has(d)), pkg)
        .toEqual([])
    }
  })

  test("no tenant names another appliance's tier", () => {
    // The claim the two shell scripts could not make at all, because each knew
    // about one appliance: `@olai/odu-client` may not reach padi, and
    // `olai-plugin-kolu` may not dial a coordinator. Derived, so a third appliance
    // is fenced against the first two on the day it arrives.
    for (const [name, tier] of TIERS) {
      for (const [other, theirs] of TIERS) {
        if (other === name) continue
        expect([...tier].filter((one) => theirs.has(one)).sort(), `${name} vs ${other}`).toEqual([])
      }
    }
  })

  test("the wire door reaches every tenant door named `./wire`", () => {
    // What `check-kolu-deps.sh`'s fifth assertion and `check-odu-deps.sh`'s
    // third were FOR, kept: they read `packages/<appliance>-client/src/wire`
    // directly, and the walk above reads it only if the plugin still imports
    // it. Without this, a plugin that stopped re-exporting its appliance's wire
    // would make the purity claim above pass over a graph that no longer
    // contains the module it was written about. The doors are derived: a tenant
    // package whose manifest opens `./wire` must be on that graph.
    const reached = new Set(
      walkFrom(path.join(PACKAGES, REGISTRY, "src", "wire.ts")).map((one) => memberOf(one.file)),
    )
    const wireDoors = [...TENANT_MEMBERS].filter((pkg) => {
      const manifest = manifestAt(path.join(PACKAGES, pkg))
      return manifest !== undefined && doorsOf(manifest)["./wire"] !== undefined
    }).sort()
    expect(wireDoors.length).toBeGreaterThan(PLUGIN_NAMES.length)
    expect(wireDoors.filter((pkg) => !reached.has(pkg))).toEqual([])
  })
})

/**
 * CLAIM 8 — WHAT A GENERAL PACKAGE SPELLS IN CODE, which is the sweep the
 * header used to point somewhere else for.
 *
 * The seven claims above are about IMPORTS: what a package reaches for, in any
 * of the four grammars. This one is about the other door a name gets in
 * through, and it is the one the whole extraction was measured against — a
 * `koluHalf(…)` call, a `wiring.kolu` slot, an `olai.cells["plugins:odu:ci"]`,
 * a `padi/` component: none of those is an import of a plugin PACKAGE, and
 * every one of them is a general package knowing an appliance by name.
 *
 * ## Why it is here and not in `@olai/tests`
 *
 * Because the header said it was there, and it was not — pi's review found the
 * pointer aimed at a sweep nobody had written. The choice was to write it or to
 * fix the sentence, and in a file whose whole thesis is that a claim is a test
 * rather than a paragraph, the sentence should not be the exception.
 *
 * The old sentence's reason for exile was that "a sweep here reading the
 * browser would be the floor reading the roof". That overstated it: this file
 * already READS every package's sources as text — that is what the four
 * grammars above are read out of — and reading is not depending. Nothing here
 * imports a general package, and nothing can: the manifest declines every one.
 *
 * ## PROSE IS STILL ALLOWED, and this is where that is enforced rather than
 * promised
 *
 * The header's standing rule — "a fence that failed on a comment is a fence
 * people learn to work around" (`check-kolu-deps.sh`'s own ruling, kept) — is
 * why every claim above reads specifiers rather than words. So this sweep does
 * not read the file: it reads what the file COMPILES TO. `Bun.Transpiler`'s
 * `transformSync` is a real parser, so comments are gone by construction rather
 * than by a hand-rolled stripper — the class of thing that eats the rest of a
 * line when a string literal contains `//` and turns a fence into a false
 * negative, which is the one direction a fence may never fail in.
 *
 * SPECIFIERS ARE SUBTRACTED for the same reason, using the same parser:
 * `olai-plugin-kolu` and `@olai/kolu-client` are import paths, which claims 1
 * and 6 already govern with a derived tenant and an exact recorded breach.
 * Counting them again here would be this claim reporting on a decision that is
 * not its own, and would make its failures unreadable.
 *
 * ## What it hunts is the NAME, and not every word a plugin owns
 *
 * A plugin's KIND words (`terminal`, `worktree`) are deliberately out of scope
 * and are held elsewhere, because they are a different claim with a different
 * shape: they are ordinary English, they legitimately appear in the appliance
 * packages and in the suite's own fixtures and step definitions, and what
 * matters about them is not that nobody says them but that ONE constant decides
 * them — which is `Dressing.kind` reading the plugin's own `kinds.ts`, the
 * page's `Licence` carrying the answer, and `mechanics.test.ts` holding the
 * mechanics that used to key on the other spelling.
 */
describe("only the registry knows a plugin's name in CODE, too", () => {
  /** What a file compiles to, with every import path subtracted — the two
   *  readings this claim is about, both taken with the same parser. */
  const codeOf = (file: string): string => {
    const text = readFileSync(path.join(PACKAGES, file), "utf8").replace(/^#![^\n]*\n/, "")
    const which = grammarOf(file) === "tsx" ? "tsx" : "ts"
    let js: string
    try {
      js = transpilers[which].transformSync(text)
    } catch {
      // A file this parser cannot read is a file this claim cannot make. It is
      // returned WHOLE rather than skipped, so the failure is a loud false
      // positive somebody fixes rather than a silent hole.
      return text
    }
    for (const spec of runtimeImportsOf(file, text)) js = js.split(spec).join("")
    return js
  }

  /**
   * PRODUCTION SOURCES ONLY, and the line is principled rather than a place to
   * hide the hits.
   *
   * What ships is what this claim is about: a general package's PRODUCT code
   * knowing an appliance by name. A bench and a fixture are neither, and the
   * words they carry are a VAULT'S rather than core's — a node titled "Kolu
   * integration" in a commit-message bench, a repo path `../kolu/.worktrees/a`
   * in a resolver's corpus, a chat row quoting `kolu fleet watch` because that
   * is a command a person ran. Failing on those would be failing on somebody's
   * prose with an extra step, which is the same trap the header's
   * comment-versus-code rule is written against.
   *
   * `@olai/tests` is excluded WHOLE, and it is the sharpest case: it is the
   * end-to-end suite, it spawns a fake padi over kolu's own testlib, and it
   * asserts kolu's Dock-row attributes by name. A claim that forbade it to
   * spell `kolu` would be a claim that forbade it to test kolu. Its own
   * manifest already argues the narrower carve-out it keeps (names only,
   * through `@olai/bundle/testids`), which is the import half of the same
   * question and is held by claim 1.
   *
   * `.css` is left to claim 1, which reads `@import` in the grammar CSS has.
   */
  const SUITE = "tests"
  const isBench = (file: string): boolean =>
    /\.(test|browsertest|spec|testlib)\.tsx?$/.test(file) ||
    file.split(path.sep)[0] === SUITE
  const compiled: ReadonlyMap<string, ReadonlyArray<{ file: string; code: string }>> = new Map(
    [...tree].map(([pkg, named]) => [
      pkg,
      named
        .filter((one) => one.grammar !== "css" && !isBench(one.file))
        .map((one) => ({ file: one.file, code: codeOf(one.file) })),
    ]),
  )

  /** A plugin's name as it would be SPELLED: any identifier or string that
   *  begins with it, case-folded, so `koluHalf`, `KoluUi`, `wiring.kolu` and
   *  `"odu"` all count. No trailing boundary, because the defect this is
   *  written against was `koluHalf` rather than a bare word. */
  // Built ONCE per plugin rather than once per file: the filter below runs it
  // across the whole compiled corpus, which was fourteen hundred `RegExp`
  // constructions a run for two distinct patterns.
  const SPELLING = new Map(PLUGIN_NAMES.map((name) => [name, new RegExp(`\\b${name}`, "i")]))
  const spellingOf = (name: string) => SPELLING.get(name) ?? new RegExp(`\\b${name}`, "i")

  test("the corpus actually compiled, and the subtraction did not empty it", () => {
    // Not vacuous, twice over: a transpiler that threw on everything, or a
    // subtraction that removed the whole file, would make every claim below
    // pass over nothing.
    const files = [...compiled.values()].flat()
    expect(files.length).toBeGreaterThan(300)
    expect(files.filter((one) => one.code.trim() !== "").length).toBeGreaterThan(300)
  })

  test("...and it CAN see a spelling, so the claim below is not a broken pattern", () => {
    // The registry is the one package that may spell every name, so it is also
    // the place to prove the hunt works at all. A pattern that matched nothing
    // would report an empty list from every package and pass.
    const own = compiled.get(REGISTRY) ?? []
    for (const name of PLUGIN_NAMES) {
      expect(own.some((one) => spellingOf(name).test(one.code)), name).toBe(true)
    }
  })

  test("no package outside the registry and the plugin's own tenant spells it", () => {
    for (const name of PLUGIN_NAMES) {
      const mine = TENANTS.get(name) ?? new Set<string>()
      const spelled = packages
        .filter((pkg) => pkg !== REGISTRY && !mine.has(pkg))
        .flatMap((pkg) =>
          (compiled.get(pkg) ?? [])
            .filter((one) => spellingOf(name).test(one.code))
            .map((one) => one.file)
        )
      // An EQUALITY against the empty list, like every claim above: a pattern
      // that rotted would report nothing and pass.
      expect(spelled.sort(), name).toEqual([])
    }
  })
})
