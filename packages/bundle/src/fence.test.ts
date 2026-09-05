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
 *      necessary — a server half is an Effect whose `needs` names service tags
 *      `@olai/plugin-api` declares — and it is asserted to EXIST,
 *      because a fence that only forbade would pass on a tree where the
 *      services door had quietly stopped being reachable.
 *
 *      **"No plugin imports another plugin" is NOT among these any more.**
 *      The Cordis proposal overturns it: `needs` is the dependency arm and it
 *      is reactive, so the half-wired state the ban feared is `waiting`. What
 *      the ban protected is claim 6's: an appliance's TIER stays inside its
 *      tenant, so a plugin reaching into another's `./server` drags that
 *      appliance's client onto its own graph and goes red there.
 *   3. **A plugin is a SIBLING, and core computes none of its addresses.**
 *      Each plugin composes under its own name, no two share one, and a name
 *      is a legal tag segment because it becomes one. The framework would
 *      catch a collision at boot with a duplicate-tag throw; here it is a test,
 *      in a process that has not started yet.
 *   4. **The browser's door names every plugin and imports none, and each
 *      plugin's own chunk stays a browser chunk.** It was one claim about one
 *      door — *the wire door stays a wire door*, `@olai/bundle/wire` being what
 *      every listener pulled in statically, forbidden a UI runtime because a
 *      SERVER read it and an appliance's client because a BROWSER did. There is
 *      no such door: the root is one ROW per plugin with a dynamic `import()`
 *      behind it, so its closure reaches no plugin at all and the bound is
 *      satisfied by there being nothing to bound — which is why the door must
 *      also SPELL every plugin, asserted first, and why what the browser
 *      actually opens is walked separately, per tenant, as the `./browser`
 *      chunk a roster fetches. The confinement went there with it: no `node:`
 *      builtin, and no appliance's product tier — the same claim
 *      `check-kolu-deps.sh`'s fifth assertion makes about the slice one floor
 *      down, made here about the door that would ship it to a reader.
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

import { BUNDLE_NAMES as PLUGIN_NAMES, ROWS } from "./rows.ts"

/**
 * THIS FILE IMPORTS NO PLUGIN, and that is a property of the FALSIFIER rather
 * than a tidiness.
 *
 * It briefly did — a `serverHalves()` that imported each row's module, so the
 * two claims about a plugin's own VALUES (its sibling key, its face maps) could
 * read them. `prove-fence.sh` caught what that cost: mutation 8 appends a
 * `.tsx` import to a server half to trip the component claim, and mutation 10
 * appends an appliance's client to the wrong tenant's dial. With the plugins
 * imported here, both of those killed this MODULE at load — the suite died
 * rather than refused, and a fence that dies is a fence that named nothing.
 *
 * So the value claims moved to `./composition.test.ts`, which already loads the
 * halves and is about what they compose to. What is left here is a sweep over
 * the tree as TEXT plus a walk over module graphs, neither of which evaluates a
 * plugin — so a plugin that will not load at all still gets every claim in this
 * file run against it, which is exactly when a fence is most worth having.
 */
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
/**
 * THE BROWSER'S DOOR, walked ONCE. `graphFrom`'s whole argument is that one
 * traversal answers both readings; walking the same entry again per test would
 * be the argument undercut by its own callers.
 *
 * It was `src/wire.ts`, and the claim it carried was that a door every listener
 * pulls in reaches each plugin's own `./wire` subpath and STOPS. There is no
 * such door: the browser's rows carry a dynamic `import()` per plugin, so the
 * closure below reaches no plugin at all and the claim gets stronger rather
 * than moving.
 */
const BROWSER_DOOR = graphFrom(path.join(PACKAGES, REGISTRY, "src", "rows.ts"))

/**
 * ...AND EACH PLUGIN'S OWN BROWSER DOOR, which is where the browser's
 * confinement claim went when `./wire` collapsed — and it went there because
 * `prove-fence.sh` said so.
 *
 * The old `./wire` door was walked with a list that forbade FIVE things, and
 * each was there for one of two reasons: `solid-js` because a SERVER read that
 * door, and `@olai/format`, `node:` builtins and every appliance client because
 * a BROWSER did. When the door collapsed, the server half of that list survived
 * intact — a server half re-exports its own `./wire`, so `NOT_ON_A_SERVER` is
 * what catches a UI runtime there now. The browser half survived NOTHING: a
 * plugin's `./wire` could pull `node:fs` and land it in the tab's chunk with no
 * claim in the tree to say otherwise.
 *
 * The falsifier found it rather than a reviewer: mutation 6 appends
 * `@olai/format` to a plugin's `./wire` and went GREEN — *the fence did not see
 * it* — where every other mutation was caught. That is exactly what a mutation
 * harness is for, and it is the second time this file has been corrected by one.
 *
 * So the door being walked is the one the TAB actually opens: each plugin's
 * `./browser`, which is the chunk a roster fetches. What it may carry is
 * genuinely different from what `./wire` could, and the list below says how.
 */
const BROWSER_DOORS: ReadonlyArray<{ readonly name: string; readonly door: Door }> = TENANTS_OF
  .map((tenant) => ({
    name: tenant.name,
    door: graphFrom(path.join(PACKAGES, tenant.dir, "src", "browser.tsx")),
  }))

/** One walked door, as the two claims below read it. */
type Door = ReturnType<typeof graphFrom>

/**
 * WHAT MUST NOT BE ON A PLUGIN'S BROWSER CHUNK — the old wire door's list with
 * the two entries removed that a browser face legitimately IS.
 *
 * `solid-js` is gone from it, and so is the `.tsx` claim: a browser half is
 * components, which is the whole reason it is a chunk of its own. `@xterm/*` is
 * gone for the same reason one tenant over — kolu's terminal door draws a
 * terminal, and the emulator is precisely the 344 KB this split exists to keep
 * off every other machine.
 *
 * What is LEFT is the half of the old list that was always about the browser:
 *
 *   - a `node:` builtin is not a thing a browser bundle may contain, and it is
 *     the sharpest entry because it fails at RUNTIME in the tab rather than at
 *     any build step;
 *   - `@odu/*` and `@kolu/padi-client` are an appliance's PRODUCT TIER, which
 *     stays behind that appliance's client package — the claim
 *     `check-kolu-deps.sh` used to make about a `-client`, held here about the
 *     door that would ship it to a reader.
 *
 * `@olai/format` is NOT on this list, and its absence is a measured decision
 * rather than an oversight: odu's chip reads the vault's own file-kind words to
 * decide what a run is about, so the format is on that chunk today and is
 * legitimately there. The old wire door forbade it because the SERVER read that
 * door and a floor package has no business teaching a daemon a vocabulary; the
 * browser is the end that spends it. Mutation 6 therefore moves to a `node:`
 * builtin, which is the entry that still means something here.
 */
const NOT_IN_A_TAB = [
  /^node:/,
  /^@odu\//,
  /^@kolu\/padi-client(\/|$)/,
] as const

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
    // `olai-plugin-kolu/server` → `packages/plugins/kolu/src/server.ts`.
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


/**
 * THE BROWSER'S DOOR NAMES EVERY PLUGIN AND IMPORTS NONE — the claim that
 * replaced "the wire door stays a wire door", and it is stronger rather than
 * different.
 *
 * The old door reached each plugin's `./wire` subpath and STOPPED, and the
 * claims were about where it stopped: no UI runtime, no appliance's client, no
 * format, no `node:` builtin, no component. Every one of those was a bound on a
 * graph that genuinely contained two plugins.
 *
 * This door contains none. A row is an `id` and a thunk, and the thunk's
 * specifier is a string until somebody calls it — so the bounds below are
 * satisfied by there being nothing to bound, which would be a fence passing by
 * being empty if that were all that was asserted. It is not: the door must also
 * SPELL every plugin, which is the property that makes the emptiness a design
 * rather than a mistake, and it is asserted first.
 */
describe("the browser's door names every plugin and imports none", () => {
  const reached = BROWSER_DOOR.reached

  test("it spells every plugin, in a specifier a bundler can split on", () => {
    // THE FLOOR, and the one that matters here. A generated table that had
    // dropped a row, or spelled a package that does not exist, would satisfy
    // every bound below by naming nothing — so what is asserted is the
    // EQUALITY: the packages this door names are exactly the tenants.
    //
    // A dynamic import's specifier is a `spec` on the walk like any other; what
    // makes it different is that `graphFrom` follows a static one into the
    // file and leaves this one as a name. That IS the split: a literal the
    // bundler can see, and a module nothing pulls until the roster asks.
    const named = new Set(reached.filter((one) => namesAPlugin(one.spec)).map((one) => one.spec))
    expect([...named].sort()).toEqual(PLUGIN_PACKAGES.map((pkg) => `${pkg}/browser`).sort())
  })

  test("...and the walk did NOT cross into any of them", () => {
    // The complement, and the whole of what a chunk buys: a plugin's module is
    // named here and reached from here by nobody. The old door's own floor was
    // the opposite assertion — that the walk HAD crossed into both plugins —
    // which is the clearest way to say what changed.
    const files = new Set(reached.map((one) => one.file))
    const crossed = [...files].filter((file) =>
      PLUGIN_DIRS.some((dir) => file.startsWith(`${dir}${path.sep}`))
    )
    expect(crossed.sort()).toEqual([])
  })

  test("the walk resolved every edge it followed", () => {
    // THE PRECONDITION UNDER THE CLAIMS BELOW, and an equality like every
    // other one in this file. A specifier this walk could not follow is a hole
    // in the graph, and a graph with holes satisfies a confinement list by
    // being empty — which is the fence passing by not running, one traversal
    // down. `external` is the legitimate terminus and is not in this list.
    expect(BROWSER_DOOR.unresolved).toEqual([])
  })

  test("nothing on it is a UI runtime, an appliance's client, or the format", () => {
    const bad = reached
      .filter((one) => FORBIDDEN.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
  })

  test("...and no file on it is a component at all", () => {
    expect(componentsOn(BROWSER_DOOR)).toEqual([])
  })
})

/**
 * A PLUGIN'S OWN BROWSER CHUNK STAYS A BROWSER CHUNK — the claim the `./wire`
 * door used to make for the tab, kept, and aimed at the door the tab now opens.
 *
 * See {@link BROWSER_DOORS} for why it is here and what the falsifier had to
 * say about it being nowhere.
 */
describe("a plugin's browser chunk stays a browser chunk", () => {
  test("the walk crossed into every tenant's faces, and resolved every edge", () => {
    // NOT VACUOUS, in both directions at once: a resolver that answered nothing
    // would walk one file per tenant and satisfy the list below by being empty,
    // and an entry that does not exist would do the same more quietly. Every
    // tenant has a browser half — it is what its row's chunk IS — so an absent
    // one is a defect rather than a plugin that happens to draw nothing.
    for (const { name, door } of BROWSER_DOORS) {
      expect([name, door.unresolved]).toEqual([name, []])
      expect([name, door.files.length > 1]).toEqual([name, true])
    }
  })

  test("nothing on one is a `node:` builtin or an appliance's product tier", () => {
    const bad = BROWSER_DOORS.flatMap(({ name, door }) =>
      door.reached
        .filter((one) => NOT_IN_A_TAB.some((rule) => rule.test(one.spec)))
        .map((one) => `${name}: ${one.file}: ${one.spec}`)
    )
    expect([...new Set(bad)].sort()).toEqual([])
  })

  test("...and each one DOES carry components, which is what a chunk is for", () => {
    // The complement, said out loud: this door exists to carry exactly what the
    // composition root's may not. A version of it that reached nothing would
    // pass the claim above by being empty, and the faces would be on somebody
    // else's graph — which is the arrangement the split replaced.
    for (const { name, door } of BROWSER_DOORS) {
      expect([name, componentsOn(door).length > 0]).toEqual([name, true])
    }
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
 * `olai-plugin-kolu/appliance` has always reached it for its row folds. Matching the
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
    // components by reporting no files at all.
    expect(SERVER_DOOR.files.length).toBeGreaterThan(10)
    // THE POSITIVE CONTROL MOVED, and where it moved to is the phase. It used
    // to be this package's own manifest door, which held every plugin's browser
    // faces and was therefore where the components legitimately were. There is
    // no manifest door: a plugin's faces are behind its OWN `./browser`, on a
    // chunk nothing here imports. So the control is that entry — derived from
    // the tenant list rather than spelled — and it must find some.
    const tenant = TENANTS_OF[0]
    if (tenant === undefined) throw new Error("fence: this build has no plugins")
    const faces = graphFrom(path.join(PACKAGES, tenant.dir, "src", "browser.tsx"))
    expect(faces.unresolved).toEqual([])
    expect(componentsOn(faces).length).toBeGreaterThan(0)
  })

  test("it DOES reach each appliance's client, which is the point of the door", () => {
    // The complement, said out loud: this door exists to carry exactly what the
    // wire door may not. A version of it that reached nothing would pass the
    // claim above by being empty, and the runtime halves would be somewhere
    // else — which is the arrangement this whole split replaced.
    const specs = new Set(reached.map((one) => one.spec))
    expect(specs.has("olai-plugin-kolu/appliance")).toBe(true)
    expect(specs.has("olai-plugin-odu/appliance")).toBe(true)
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

describe("machine-local state has one door", () => {
  test("no plugin imports or declares the state leaf", () => {
    for (const pkg of PLUGIN_DIRS) {
      const reached = tree.get(pkg)?.flatMap((source) =>
        source.specs
          .filter((spec) => packageOf(spec) === "@olai/state")
          .map((spec) => `${source.file}: ${spec}`)
      ) ?? []
      const declared = dependencyNames(manifestAt(path.join(PACKAGES, pkg)))
        .filter((spec) => packageOf(spec) === "@olai/state")
      expect(reached, pkg).toEqual([])
      expect(declared, pkg).toEqual([])
    }
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

  /**
   * THE FOLDED TESTLIB DOORS, recorded rather than widened.
   *
   * `@olai/tests` reaches three plugins by name, and each is a claim rather than
   * a hole. KOLU's is the fake padi the e2e spawn stands on. CHAT's is the
   * panel's own two constants — how close to the foot of the transcript still
   * counts as following, and which trigger the composer has armed — which were
   * on `@olai/web`'s curated list until the panel became a row, and which a step
   * must read from the client rather than re-decide (a number typed twice
   * eventually disagrees). IDENTITY's is the same case for the same reason, one
   * row over: the header names a Given injects and the gravatar URL a Then
   * expects to see drawn were `@olai/identity`'s while that was a general
   * package, and a suite that re-typed either would go on passing after the
   * default header moved or the hash spelling changed. `olai-plugin-identity/who`
   * is the READING with no runtime in it — no Effect, no plugin API, no browser
   * — which is what makes it importable from a cucumber process at all.
   *
   * An equality against those lines and declarations is the opposite of
   * letting a general package import a plugin: a fifth file, a different
   * subpath, or a fourth plugin is red. `packages/server` carves two doors the
   * same way — the git testlib, so `headless.test.ts` does not copy `gitIn`,
   * and identity's reading, so the gravatar URL its two-door test asserts a
   * chip drew is the hash the row itself computes rather than a second
   * spelling of it.
   */
  const TESTLIB_IMPORTS: Readonly<Record<string, ReadonlyArray<string>>> = {
    tests: [
      "tests/step_definitions/chat_steps.ts: olai-plugin-chat/testlib",
      "tests/step_definitions/identity_steps.ts: olai-plugin-identity/who",
      "tests/support/hooks.ts: olai-plugin-kolu/appliance/testlib",
      "tests/support/world.ts: olai-plugin-chat/testlib",
      "tests/support/world.ts: olai-plugin-kolu/appliance/testlib",
    ],
    server: [
      "server/src/headless.test.ts: olai-plugin-git/testlib",
      "server/src/identity.test.ts: olai-plugin-identity/who",
    ],
  }
  const TESTLIB_DECLARED: Readonly<Record<string, ReadonlyArray<string>>> = {
    tests: ["olai-plugin-chat", "olai-plugin-identity", "olai-plugin-kolu"],
    server: ["olai-plugin-git", "olai-plugin-identity"],
  }

  /**
   * ONE PLUGIN DECLARING ANOTHER — recorded here, because the manifest door has
   * no carve-out for it and should not get one.
   *
   * The IMPORT claim above skips every tenant outright: *plugins may import each
   * other; that ban retired*. The MANIFEST claim below cannot afford the same
   * blanket, and the asymmetry is deliberate rather than an oversight left in
   * place. A manifest line is how a dependency is really declared — `workspace:*`
   * is what a resolver reads, and a package that dropped the import but kept the
   * line is still standing on the far side of the wall — so an equality here is
   * the only reading that stays exact when the sources move.
   *
   * TWO EDGES. The first is the one the Cordis phase named. `olai-plugin-xyne-spaces`
   * mirrors what a node agent's conversation says, so it has to know which column
   * that binding is in — and the column is chat's kind (`chat-agent-session`),
   * composed from chat's own name. The alternative was a hand-copied constant in
   * the mirror, which is the one thing that can silently disagree. The edge was
   * already real without it: this half names the `Watching` door, which chat's
   * row OFFERS, so it is `waiting` without chat either way.
   *
   * The subpath is `olai-plugin-chat/binding`, which is two strings behind a door
   * that imports nothing — so what crosses is a name, not a graph, and the tenant
   * claim below is what holds that.
   *
   * THE SECOND IS A GRAPH, and it is a MOVE rather than a new coupling. The chat
   * panel names the person over each run of their own messages, wearing the
   * picture the identity row's ladder resolved and asking through the SAME single
   * `who.get` the header chip asks through — a header saying one thing about who
   * is looking and a transcript saying another is the drift one ask exists to
   * prevent. That edge existed before this phase pointing at
   * `@olai/web/client/who/*`, because the chip was core's; it points at the row
   * that owns the subject now. What crosses is `olai-plugin-identity/person` —
   * three browser modules, no wire, no server half — and it is deliberately NOT
   * in chat's `needs`: with no identity row mounted, `who.get` is still core's
   * and answers nobody, so the face draws its silhouette rather than waiting.
   *
   * A third plugin declaring one of these, or either of these declaring a second,
   * is red on this line with the argument beside it.
   */
  const PLUGIN_DECLARED: Readonly<Record<string, ReadonlyArray<string>>> = {
    "plugins/chat": ["olai-plugin-identity"],
    "plugins/xyne-spaces": ["olai-plugin-chat"],
  }

  test("no package outside the registry imports a plugin", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      // A plugin importing its own doors — `olai-plugin-kolu/appliance` after
      // the fold — is not a general package naming a plugin. Plugins may also
      // import each other; that ban retired. This claim is the general side.
      if (PLUGIN_DIRS.includes(pkg)) continue
      const reached = tree.get(pkg)?.flatMap((s) => s.plugins.map((p) => `${s.file}: ${p}`)) ?? []
      // An EQUALITY against the recorded answer — `[]` for all but the folded
      // testlib door — never a length on a filter: a pattern that rotted would
      // report nothing and pass.
      expect([...reached].sort(), pkg).toEqual([...(TESTLIB_IMPORTS[pkg] ?? [])])
    }
  })

  test("no package outside the registry declares a plugin in its manifest", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      expect(declaredBy(pkg), pkg).toEqual([
        ...(TESTLIB_DECLARED[pkg] ?? []),
        ...(PLUGIN_DECLARED[pkg] ?? []),
      ])
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
   * overturns it: `needs` is the dependency arm and it is REACTIVE, so the
   * half-wired state the ban feared is `waiting` — a legitimate, inspectable
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
 * THE ROOT DOOR IS SAFE FOR ANY PACKAGE TO OPEN — which reverses a claim, and
 * the reversal is the phase.
 *
 * It used to be an EQUALITY per package: `@olai/web` renders and may open the
 * manifests; every other package outside this one reaches a SUBPATH or nothing.
 * The reason was sharp and was not hypothetical — the root carried every
 * plugin's browser half, which is SolidJS and, behind kolu's, a terminal
 * emulator, so a server process that reached it evaluated a `.tsx` and Bun's
 * default JSX runtime is React's: the boot died on `Cannot find module
 * 'react/jsx-dev-runtime'` before the server served anything. That is what
 * `@olai/server`'s `pluginPolicy.ts` did the day the manifests grew faces,
 * reaching the root for a list of STRINGS.
 *
 * There are no manifests. The root is one row per plugin with a dynamic
 * `import()` of its browser half, so its static closure carries no plugin, no
 * component and no UI runtime — which the describe above holds as five claims.
 * A door that cannot hurt anybody has no business forbidding anybody, and
 * `pluginPolicy.ts` reaching it for a list of strings is now the ORDINARY use
 * rather than the hazard.
 *
 * So what is left to assert is the other direction, and it is the one that
 * would go quiet if the door ever grew teeth again: that packages outside this
 * one DO open it. A claim about a door nobody opens is a claim about nothing.
 */
describe("the root door is opened by packages that render nothing", () => {
  /** The one package whose job is to draw a plugin's faces. Spelled as a
   *  directory name because that is what the walk has. */
  const RENDERER = "web"

  test("more than the renderer opens `@olai/bundle`, and that is the point", () => {
    // Read off `Named.specs`, which is the corpus read ONCE at module scope in
    // whichever grammar each file has. Re-reading here to ask a second question
    // of the same text is what that field's own comment forbids, and it is the
    // most expensive thing in this file when it happens.
    const openers = packages.filter((pkg) =>
      pkg !== REGISTRY
      && (tree.get(pkg) ?? []).some((s) => s.specs.includes("@olai/bundle"))
    )
    // NOT AN EQUALITY, deliberately, and this is the one claim in the file that
    // is not. The old rule named the packages allowed to open the door; this
    // one says the door is open, and pinning WHICH packages walk through it
    // would be a list that has to be edited every time somebody wants a plugin
    // name — for no defect it could catch, since the closure claims above are
    // what make the walk-through harmless.
    expect(openers.length).toBeGreaterThan(0)
    // ...and at least one of them renders nothing at all, which is the whole
    // reversal: the old claim's counter-example is this one's floor.
    const headless = openers.filter((pkg) => pkg !== RENDERER)
    expect(headless.length, openers.join(", ")).toBeGreaterThan(0)
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
  test("a plugin's name is a legal tag segment, because it becomes one", () => {
    // `assertTagSegment` refuses an empty name and one containing "/", and it
    // refuses at boot. The framework's reason is the sharper one and it is
    // worth keeping in view here: a name carrying the separator would spell
    // one tag with two different members behind it, which the duplicate check
    // could not see. A plugin's name is also its preferences row and its docs
    // slug, so the bar this holds it to is a little higher than the
    // framework's — a word, not a path.
    //
    // OFF THE ROWS and not off the loaded modules, which is the whole of why
    // this claim stayed here while the two beside it left. The row's `id` is
    // the sibling key — it is what the fiber is bound under and what every one
    // of its tags is composed from — so the name this holds to the grammar is
    // the name that becomes a tag, and reading it costs no import.
    for (const name of PLUGIN_NAMES) {
      expect([name, /^[a-z][a-z0-9-]*$/.test(name)]).toEqual([name, true])
    }
    // ...and no two rows claim one word. Two plugins with one name is two sets
    // of members at one address, which `composeSurfaceContracts` would catch at
    // boot with a duplicate-tag throw, in a process that has already started.
    expect(new Set(PLUGIN_NAMES).size, PLUGIN_NAMES.join(", ")).toBe(PLUGIN_NAMES.length)
  })

  // THE TWO CLAIMS THAT READ A PLUGIN'S OWN VALUES ARE IN
  // `./composition.test.ts` — that every module answers to the name its row
  // binds it under, and that every face a plugin declares is a face it wrote a
  // map for. They need the modules LOADED, and this file may not load one: see
  // the note at the top on what `prove-fence.sh` found when it did.
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
 * self-explanatory."* padi lives behind `olai-plugin-kolu/appliance` and odu's run client
 * behind `olai-plugin-odu/appliance` — each names no olai package at all, and the
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
 * of six specifiers in one, and `grep -v '/packages/odu-client/'` in the other
 * (that path is gone; the dial is `plugins/odu/src/appliance/` now).
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
 *     `plugins/kolu`; for odu, `plugins/odu`; for Spaces,
 *     `plugins/xyne-spaces`. Nobody typed those.
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
 *  `cordis` AND `@cordisjs/plugin-*` USED TO BE ON THIS LINE, and taking them
 *  off is this phase. The arm arrived in the spike as a note saying "drop it the
 *  day the spike is deleted"; the spike was deleted and the arm stayed, because
 *  Cordis had become the runtime the server composition was built on — a plugin
 *  imported it to type its own `apply`, the composition root mounted the bundle
 *  on it, the interface package's services extended its `Service`, and confining
 *  a framework to a tenant is exactly what the sentence above refuses.
 *
 *  It is not the framework any more; it is an ENGINE, behind one package. olai
 *  is written in Effect, and `@olai/effect-cordis` is the translation: a plugin
 *  is an Effect, `needs` is the requirement channel, and nothing else in this
 *  tree names Cordis at all. So the specifier goes back to being an ordinary
 *  hydrated one — confined, like `@kolu/padi-client` and `@odu/run-client`, by
 *  the claims below — with {@link BRIDGE} as the one package allowed to reach
 *  it. */
const FRAMEWORK = /^@kolu\/surface(-[a-z]+)*(\/|$)/

/** THE ENGINE, and the one package that may see it.
 *
 *  Not a tenant and not a tier: `packages/effect-cordis` is a general package
 *  every other one may import, and what is confined is the specifier rather than
 *  the package. The exemption is written as an equality below rather than only
 *  as this arm, so a second package reaching for `cordis` is red BY NAME rather
 *  than merely uncounted. */
const BRIDGE = "effect-cordis"
const ENGINE = /^(?:cordis|@cordisjs\/plugin-[a-z]+)(\/|$)/

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
  // THE ENGINE, INSIDE ITS ONE PACKAGE — see {@link BRIDGE}. Everywhere else it
  // is an ordinary hydrated specifier and the claims below refuse it.
  if (pkg === BRIDGE && ENGINE.test(spec)) return false
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

/**
 * THE TENANTS. A package one plugin reaches, no other plugin reaches, AND NO
 * GENERAL PACKAGE REACHES — everything shared drops out, which is what makes
 * this a derivation rather than a restatement.
 *
 * ## The third clause, and the row that made it necessary
 *
 * It was two clauses: reached by this plugin, reached by no other. That was
 * exact while every plugin was a TENANT over a vendored appliance — kolu's
 * closure is padi's client and nothing core wanted — and it stopped being exact
 * the day the CHAT became a row. Chat is a plugin over core's own floor: it
 * reaches `@olai/ops`, `@olai/surface`, `@olai/log`,
 * `@olai/child`, `@olai/index` and `@olai/web`, and no other plugin does. Under
 * two clauses all seven became "chat's tenant members" — which is an EXEMPTION
 * set, so seven general packages would have been quietly excused from the
 * hydrated-specifier equality, the manifest one beside it, and the name sweep.
 *
 * A tenant member is a package that exists FOR one plugin. A package the
 * composition root, the store or the format also reaches exists for olai, and
 * one plugin happening to be its only plugin-side reader does not change that.
 * So the third clause asks the general side: a package any non-plugin member
 * reaches is not anybody's tenant.
 *
 * The registry is excluded by name because it reaches every plugin by
 * definition and is the one package that may.
 */
const GENERAL_REACH: ReadonlySet<string> = new Set(
  packages
    .filter((pkg) => pkg !== REGISTRY && !PLUGIN_DIRS.includes(pkg))
    .flatMap((pkg) => [...reachedBy(codeDoorsOf(path.join(PACKAGES, pkg)))])
    // A PLUGIN'S OWN DIRECTORY IS NEVER SOMEBODY ELSE'S GENERAL PACKAGE, whoever
    // reaches it. The suite reaches two of them by name — the fake padi and the
    // panel's two constants, both recorded as equalities one claim up — and
    // without this line those two rows would drop out of their own tenant sets
    // and take their appliances' hydrated tiers with them.
    .filter((pkg) => !PLUGIN_DIRS.includes(pkg)),
)

const TENANTS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  TENANTS_OF.map(({ name, dir }) => [
    name,
    new Set(
      [...(CLOSURES.get(name) ?? [])].filter((pkg) =>
        pkg !== REGISTRY &&
        !GENERAL_REACH.has(pkg) &&
        // A PLUGIN'S OWN DIRECTORY IS ITS OWN TENANT MEMBER, whoever else
        // reaches it — the twin of the line {@link GENERAL_REACH} already keeps
        // about the general side, and it is needed for the same reason from the
        // other direction.
        //
        // The shared-package clause below asks "does another plugin reach this",
        // and while a plugin was a tenant over a VENDORED APPLIANCE that was
        // exact: nothing another plugin wanted was in kolu's closure. The Cordis
        // phase retired *no plugin consumes a plugin* — `needs` is a reactive
        // dependency arm — and the first edge it licensed is the spaces mirror
        // reaching `olai-plugin-chat/binding` for the word a node agent's
        // binding is declared under. Under the clause alone that one import
        // emptied CHAT'S OWN TENANT, and an empty tenant is not a small thing
        // here: three claims consult `TENANTS` as an exemption set, so the name
        // sweep instantly reported sixty-two files of `plugins/chat` for
        // spelling `chat`. A plugin losing its own directory because somebody
        // imported one string from it is the derivation answering a question
        // nobody asked.
        //
        // What the clause is FOR is unchanged and still runs on everything else:
        // a package two plugins share is general by construction and drops out.
        // A plugin's own package is never that — it exists for exactly one
        // plugin by definition, which is the sentence a tenant IS. What a
        // consumer may reach across that edge is bounded by the claims above:
        // no other tenant's product tier, and no door that drags one.
        (pkg === dir ||
          ![...CLOSURES].some(([other, theirs]) => other !== name && theirs.has(pkg)))
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
      chat: ["plugins/chat"],
      claude: ["plugins/claude"],
      codex: ["plugins/codex"],
      git: ["plugins/git"],
      identity: ["plugins/identity"],
      journal: ["plugins/journal"],
      kolu: ["plugins/kolu"],
      odu: ["plugins/odu"],
      opencode: ["plugins/opencode"],
      pi: ["plugins/pi"],
      "xyne-spaces": ["plugins/xyne-spaces"],
    })
    // ...and each APPLIANCE tenant has a TIER, which is the other way this
    // derivation comes back empty: a `node_modules` that was never hydrated.
    // A plugin that talks HTTP and hydrates nothing (Spaces) is a whole
    // plugin; an empty tier there is the truth, not a missed pin.
    expect(
      Object.fromEntries([...TENANTS_OF].map(({ name }) => [
        name,
        (TIERS.get(name) ?? new Set()).size > 0,
      ])),
    ).toEqual({
      // AN ENGINE HYDRATES NOTHING and neither does Spaces: a plugin that talks
      // a protocol, or HTTP, has no vendored client to confine. An empty tier
      // there is the truth rather than a missed pin, and the two `true`s are
      // what keep the derivation from being empty everywhere.
      // CHAT HYDRATES NOTHING either, and it is the sharpest instance of the
      // sentence below: it is a plugin over olai's OWN floor rather than over
      // somebody else's vendored client, so there is no vendored tier to confine.
      chat: false,
      claude: false,
      codex: false,
      git: false,
      identity: false,
      journal: false,
      kolu: true,
      odu: true,
      opencode: false,
      pi: false,
      "xyne-spaces": false,
    })
  })

  /**
   * THE ENGINE IS BEHIND ONE PACKAGE — the claim the human's ruling is, as an
   * equality.
   *
   * *olai uses Effect; for an architecture with no hacks or escape hatches,
   * plugins are written in Effect and Cordis is an engine nobody outside one
   * package sees.* Everything about that sentence is checkable and nothing about
   * it is checked by the confinement arm above on its own: `isHydrated` exempts
   * the bridge, so a second package naming `cordis` goes red as an unconfined
   * hydrated specifier — which is true, and reads as a tier failure rather than
   * as the thing it is.
   *
   * So the set is written down. A package that starts naming the engine is red
   * HERE, by name, with the ruling in the failure; and the day the bridge is
   * renamed or split, this line is the one that says so rather than a tenancy
   * arithmetic three claims down.
   *
   * BOTH GRAMMARS, because both are how a name gets in: what a source IMPORTS
   * (any of the four forms `specifiersOf` reads) and what a manifest DECLARES.
   * The bridge declares neither — the engine is hydrated from the npins pin into
   * the ROOT `node_modules`, and a manifest naming it would send bun to a
   * registry that does not have it — so the manifest half of this is empty
   * everywhere, including in the one package the import half allows.
   */
  test("Cordis is an engine nobody outside one package sees", () => {
    const naming = packages.filter((pkg) =>
      (tree.get(pkg) ?? []).some((source) => source.specs.some((spec) => ENGINE.test(spec)))
    )
    expect(naming).toEqual([BRIDGE])
    // ...and the bridge is a real package with the engine really on its graph,
    // so the equality above is not passing over a name nobody uses at all.
    expect(packages).toContain(BRIDGE)
    for (const pkg of packages) {
      expect(
        dependencyNames(manifestAt(path.join(PACKAGES, pkg))).filter((one) => ENGINE.test(one)),
        pkg,
      ).toEqual([])
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
    // about one appliance: `olai-plugin-odu/appliance` may not reach padi, and
    // `olai-plugin-kolu` may not dial a coordinator. Derived, so a third appliance
    // is fenced against the first two on the day it arrives.
    for (const [name, tier] of TIERS) {
      for (const [other, theirs] of TIERS) {
        if (other === name) continue
        expect([...tier].filter((one) => theirs.has(one)).sort(), `${name} vs ${other}`).toEqual([])
      }
    }
  })

  test("the composed doors reach every tenant door named `./wire`", () => {
    // What `check-kolu-deps.sh`'s fifth assertion and `check-odu-deps.sh`'s
    // third were FOR, kept: they read `packages/<appliance>-client/src/wire`
    // directly (those packages folded; the dials are `./appliance/wire` now),
    // and the walk above reads it only if the plugin still imports it. Without
    // this, a plugin that stopped re-exporting its appliance's wire would make
    // the purity claim above pass over a graph that no longer contains the
    // module it was written about. The doors are derived: a tenant package
    // whose manifest opens `./wire` or `./appliance/wire` must have that
    // target on the graph.
    //
    // THE GRAPH IS THE ROWS' NOW. It used to be this package's `src/wire.ts`,
    // which imported every plugin's `./wire` statically; there is no such file,
    // because the browser's rows name a chunk instead. So the walk is the one
    // the composition root actually performs — each ROW's module, which is the
    // same reading `SERVER_DOOR` is built from — and it is a wider net rather
    // than a narrower one: a server half re-exports its own `./wire`, and it
    // reaches its appliance's client, which is where the second half of these
    // doors live.
    const reached = new Set(SERVER_DOOR.files)
    const wireDoors = [...TENANT_MEMBERS].flatMap((pkg) => {
      const manifest = manifestAt(path.join(PACKAGES, pkg))
      if (manifest === undefined) return []
      const doors = doorsOf(manifest)
      return (["./wire", "./appliance/wire"] as const)
        .filter((door) => doors[door] !== undefined)
        .map((door) => path.join(pkg, doors[door]!))
    }).sort()
    // THE TENANTS' `./wire` DOORS PLUS EACH DIAL'S `./appliance/wire`. A floor
    // of `> PLUGIN_NAMES.length` used to catch the extra tenant packages; after
    // the fold those packages are gone and the extra doors are the dials, and
    // after the ENGINES arrived the plugin count stopped being a floor at all —
    // an engine composes no sibling, so it declares no `./wire` and the two
    // numbers went the wrong way past each other. What the floor is FOR is
    // unchanged: a derivation that came back empty would make the emptiness
    // asserted below mean nothing. So it is stated against the other derived
    // count instead — there are tenant `./wire` doors BEYOND the dials' — and
    // the appliance-wire count is the half that still fails if a dial's wire
    // leaves the graph.
    const applianceWires = [...TENANT_MEMBERS].filter((pkg) => {
      const manifest = manifestAt(path.join(PACKAGES, pkg))
      return manifest !== undefined && doorsOf(manifest)["./appliance/wire"] !== undefined
    })
    expect(wireDoors.length).toBeGreaterThan(applianceWires.length)
    expect(applianceWires.length).toBeGreaterThan(1)
    expect(wireDoors.filter((file) => !reached.has(file))).toEqual([])
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
 * `olai-plugin-kolu` and `olai-plugin-kolu/appliance` are import paths, which claims 1
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

  /**
   * A plugin's name as it would be SPELLED — the WHOLE word, case-folded, in
   * whatever it is glued to: `koluHalf`, `KoluUi`, `wiring.kolu` and `"odu"` all
   * count.
   *
   * ## The trailing rule, and the engine that made one necessary
   *
   * There was NO trailing boundary, on the argument that the defect this is
   * written against was `koluHalf` rather than a bare word. That was true and
   * the pattern was wrong anyway, and the engines are what showed it: `pi` is a
   * plugin name now, and `\bpi` matches `pin`, `picker`, `pieces`, `pill` — a
   * hundred and forty-nine files in the client alone, none of them about an ACP
   * engine. A fence that reports the whole tree reports nothing.
   *
   * So the name must END, and "end" is the boundary a reader's eye already uses:
   * anything that is not a lower-case letter or a digit. A CASE CHANGE ends it
   * (`koluHalf`, `piMark`), and so does a separator, a quote, a dot or a line
   * (`"odu"`, `kolu-terminal`, `wiring.kolu`, `plugins:odu:ci`). What it declines
   * to call a spelling is the name swallowed into a longer lower-case word,
   * which is a different word — and the direction that costs is the safe one to
   * be wrong in only because the corpus is swept for EVERY plugin: a general
   * package that had genuinely grown a `pistate` would be reaching for something
   * it would have to import to use, and claims 1 and 6 are what read imports.
   *
   * ## THREE CASINGS, EACH WITH ITS OWN END — and `prove-fence.sh` wrote both
   * halves of this
   *
   * The obvious spelling is `/\bkolu(?![a-z0-9])/i`, and it is wrong in the one
   * direction a fence may not be: `i` applies to the LOOKAHEAD too, so
   * `[a-z0-9]` matches the `H` of `koluHalf` and the pattern refuses the exact
   * defect it was written for. Both name mutations went `GREEN — THE FENCE DID
   * NOT SEE IT`.
   *
   * Made case-SENSITIVE with each letter as `[xX]`, it caught those and then
   * caught eighteen files that are not about a plugin at all — `PICTURE`,
   * `PINNED`, `PILL`. A SHOUTED identifier has no case change in it, so "the
   * next character is upper-case" ends a lower-case name and continues an
   * upper-case one, and one lookahead cannot mean both.
   *
   * So the name is spelled in the three casings an identifier is written in, and
   * each carries the end that belongs to it:
   *
   *   - `kolu`, `Kolu` — a lower-case run, ended by anything that is not
   *     `[a-z0-9]`: a case change (`koluHalf`, `KoluUi`, `piMark`), a
   *     separator, a quote, a dot, a line;
   *   - `KOLU` — an upper-case run, ended by anything that is not `[A-Z0-9]`:
   *     `KOLU_KIND` and `PI_ACP_PI_COMMAND` are spellings, `PINNED` and
   *     `PICTURE` are words that begin with two of the same letters.
   *
   * What it still cannot tell apart is a shouted name that ENDS a word —
   * `Math.PI` — which is why {@link NOT_A_PLUGIN} records one file.
   */
  const casings = (name: string): ReadonlyArray<string> => {
    const capital = `${name.charAt(0).toUpperCase()}${name.slice(1)}`
    return [
      `${name}(?![a-z0-9])`,
      ...(capital === name ? [] : [`${capital}(?![a-z0-9])`]),
      `${name.toUpperCase()}(?![A-Z0-9])`,
    ]
  }
  // Built ONCE per plugin rather than once per file: the filter below runs it
  // across the whole compiled corpus, which was fourteen hundred `RegExp`
  // constructions a run for two distinct patterns.
  const spelling = (name: string) => new RegExp(`\\b(?:${casings(name).join("|")})`)
  const SPELLING = new Map(PLUGIN_NAMES.map((name) => [name, spelling(name)]))
  const spellingOf = (name: string) => SPELLING.get(name) ?? spelling(name)

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

  /**
   * WHERE THE WORD IS NOT THE PLUGIN — recorded, because the engines gave a
   * plugin two names that were already English.
   *
   * The header's standing rule is that PROSE IS ALLOWED, which is why this claim
   * reads what a file COMPILES TO rather than what it says. A string literal
   * survives that, and it should: `koluHalf(…)` and
   * `olai.cells["plugins:odu:ci"]` are strings, and they are exactly what this
   * hunt is for. What it cannot tell apart is a plugin's name from a word that
   * happens to be spelled the same, and the tenants never produced one:
   * `kolu`, `odu` and `xyne-spaces` are nobody else's words.
   *
   * The engines produce two, and they are different kinds of collision:
   *
   *   - **`claude` in a VAULT'S OWN VOCABULARY.** `prop:agent=claude-opus` is
   *     the search grammar's worked example of a CUSTOM property — a lane's own
   *     `agent` key, free text, nothing to do with which ACP engine a chat panel
   *     seats. It appears in the search documentation, in a refusal's advice
   *     line, and in two MCP tool descriptions an agent reads. That is
   *     somebody's outline quoted in product copy, which the header's rule
   *     already protects one door over ("a plugin's KIND words are deliberately
   *     out of scope… they are ordinary English").
   *   - **`pi` in `Math.PI`.** A two-letter plugin name collides with the
   *     language, and no reading of a compiled file can say that this `PI` is a
   *     constant and that one would have been an engine.
   *
   * RECORDED AS AN EQUALITY rather than excused with a pattern, which is the
   * move {@link DEBT} makes and for the same reason: a fifth file is red, a
   * different plugin's name in any of these four is red, and the day the example
   * is reworded this entry is red until it is deleted. A regex tightened until
   * both of these fell out would have been the fence quietly agreeing not to
   * look at `claude-agent-acp` or `piHalf` either — and the two directions this
   * claim can fail in are not symmetric.
   */
  const NOT_A_PLUGIN: Readonly<Record<string, ReadonlyArray<string>>> = {
    claude: [
      "format/src/filter.ts",
      "format/src/searching.ts",
      "ops/src/tools.ts",
    ],
    pi: ["web/src/client/theme/tagInk.ts"],
    /** `journal` is also an ordinary domain word: patch/search/tool metadata
     * use it in their own vocabularies, unrelated to the plugin row. */
    journal: [
      "format/src/patch.ts",
      "format/src/searching.ts",
      "ops/src/tools.ts",
      "sigterm/src/sigterm.ts",
    ],
    /**
     * `chat` IS AN ENGLISH WORD, and these five are the three ways that costs.
     *
     * **THE WRITER, in the ledger.** `chat-agent` is what a commit made through
     * the panel's own MCP face is recorded as — a word written into trailers on
     * a disk, in repositories that already have thousands of them. Renaming it
     * would put two spellings of one writer into one repository's history, on
     * the release that shipped the rename, and buy nothing: the word is a fact
     * about WHO asked, and the answer is still "the agent in the conversation".
     * `format/src/committing.ts` declares it; `server/src/serve.ts` binds the
     * face under it and `server/src/mcp/tickets.ts` binds the fenced one.
     *
     * **THE OLD STATE LAYOUT.** The server door recognizes the former
     * `chat/<hash>.json` path so core can fold it into the plugin document on
     * first write. It names a historical directory, not a plugin import or
     * address, and disappears when that migration window closes.
     *
     * **SOMEBODY ELSE'S ROUTES.** Xyne Spaces posts to `/api/apps/chat/…` —
     * that is their API, read off their own source and never guessed, and the
     * two files that spell it are that plugin's own dial and the fake server its
     * bench stands up. It is the same case as `prop:agent=claude-opus` in the
     * search grammar three rows up: a word in somebody else's vocabulary that
     * happens to be a plugin's name here.
     *
     * RECORDED AS AN EQUALITY rather than excused with a pattern, which is the
     * move the two above make and for the same reason: a sixth file is red, a
     * different plugin's name in any of these is red, and the day the writer
     * word is retired this entry is red until it is deleted.
     */
    chat: [
      "format/src/committing.ts",
      "plugins/git/src/browser/commit/said.ts",
      "plugins/git/src/ledger/pending.ts",
      "plugins/xyne-spaces/src/client.ts",
      "plugins/xyne-spaces/src/testlib/fake-spaces.ts",
      "server/src/localState.ts",
      "server/src/mcp/tickets.ts",
      "server/src/serve.ts",
      "web/src/client/layout/prefs.ts",
    ],
    /** The server's expiring migration table maps the old unkeyed `mirror/`
     * record to the tenant that wrote it. Remove with that migration row. */
    "xyne-spaces": ["server/src/localState.ts"],
    /**
     * `git` IS THE COMMAND, and `GitState` / `GIT_OFF` / `gitPolicy` are the
     * floor's names for a repository reading that stays in core: a write still
     * waits to be recorded, and the format owns the shape. The plugin is the
     * provider behind that door. These files spell the word as English or as
     * those types, not as the row.
     */
    git: [
      "format/src/committing.ts",
      "format/src/index.ts",
      "format/src/searching.ts",
      "format/src/writing.ts",
      "ops/src/tools.ts",
      "plugins/kolu/src/client/fleet.ts",
      "server/src/gitPolicy.ts",
      "server/src/main.ts",
      "server/src/published.bench.ts",
      "server/src/serve.ts",
      "web/src/client/file/delete.ts",
      "web/src/client/settings/Preferences.tsx",
       "web/src/client/trash/question.ts",
     ],
    /**
     * `identity` IS AN ENGLISH WORD, and it is the most ordinary one on this
     * list — which is why the entry is long and why every line of it is a
     * different sense of it than the row.
     *
     * **THE DOOR, which is core's.** `Identity` is a service tag
     * `@olai/plugin-api` declares and `@olai/server`'s composition root reads;
     * the row is the PROVIDER behind it. That is the `git` case one entry up,
     * exactly — a reading core defines and a plugin stands behind — and the
     * interface and `serve.ts` are spelling the tag, never the row.
     *
     * TWO SERVER FILES AND A THIRD LEFT THIS LIST, and that is the fence
     * measuring a refactor rather than tolerating one: the listener and the
     * MCP route used to be handed the DOOR and now take a header list and a
     * reading, and `server/src/identity.ts` mints that reading from a type
     * import. None of the three can name the tag any more, so the word is
     * gone from what they compile to — which is the claim this table exists
     * to be able to notice in either direction.
     *
     * **THE PROCESS's identity, which is the framework's.** `system/identity`
     * is the reserved member every kolu surface answers with its process id —
     * the stale-tab handshake — and it is a different question from who is
     * looking, argued at length in `@olai/surface`'s README. kolu's dial and
     * probe spell it, and its probe also reports on "the daemon's identity",
     * which is a third sense again.
     *
     * **A RUN's identity, which is odu's.** `identityOf(run)` is that
     * appliance's own `<sha7>#<seq>` spelling of which commit a run is of.
     *
     * **AN ATTRIBUTION RULE, in prose.** The capture tool's description says
     * `captured-by` is written from "the identity this door already has" —
     * words in a sentence an agent reads.
     *
     * **AN EDITOR's identity.** Outline and document panes key their draft
     * lifetime by file and pane. These local keys do not name the plugin.
     *
     * RECORDED AS AN EQUALITY for the reason the four entries above are: a
     * twelfth file is red, and the day one of these stops spelling the word
     * this entry is red until the line is deleted.
     */
    identity: [
      "ops/src/tools.ts",
      "plugin-api/src/services.ts",
      "plugins/kolu/src/client/detect.ts",
      "plugins/kolu/src/client/fleet.ts",
      "plugins/kolu/src/client/link.ts",
      "plugins/kolu/src/probe.ts",
      "plugins/odu/src/appliance/wire/index.ts",
      "plugins/odu/src/browser/RunMatrix.tsx",
      "plugins/odu/src/browser/words.ts",
      "plugins/odu/src/doorbell.ts",
      "server/src/serve.ts",
      "web/src/client/document/DocumentPage.tsx",
      "web/src/client/edit/Editable.tsx",
    ],
  }

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
      // An EQUALITY against the recorded answer — `[]` for all but the two
      // collisions above — never a filter asserted empty: a pattern that rotted
      // would report nothing and pass.
      expect(spelled.sort(), name).toEqual([...(NOT_A_PLUGIN[name] ?? [])])
    }
  })

  test("every recorded collision is a plugin and a file that still exist", () => {
    // A recorded exception naming a file nobody has is an exception nobody can
    // retire, and it would forgive the next breach in that package in silence.
    // The equality above catches a file that stopped spelling the word; this
    // catches one that stopped being a file, and a name that stopped being a
    // plugin.
    const seen = new Set([...compiled.values()].flat().map((one) => one.file))
    for (const [name, files] of Object.entries(NOT_A_PLUGIN)) {
      expect(PLUGIN_NAMES.includes(name), name).toBe(true)
      for (const file of files) expect([file, seen.has(file)]).toEqual([file, true])
    }
  })
})
