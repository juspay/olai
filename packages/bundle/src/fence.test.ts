/** olai's own architectural boundaries, on top of `@olai/effect-cordis/fence`.
 *
 * The GENERIC half moved: import boundaries, door graphs, a row's name in text
 * and code, live state behind a door, and the agreement between the rows the
 * registry names, the packages on disk and the rows the roots compose are one
 * call — `fence(DECLARATION)` — and `./fence.testlib.ts` is the declaration
 * olai feeds it. What is left here is what only this build can say: the tenancy
 * of an appliance's product tier, the container the tenants live in, the chunk
 * and server door each ROW is mounted through, the style chain generated from
 * the manifests, the Nix half of plugin isolation, and the manifest door.
 *
 * THIS FILE IMPORTS NO PLUGIN, and that is a property of the FALSIFIER rather
 * than a tidiness: a plugin that will not load at all still gets every claim in
 * this file run against it, which is exactly when a fence is most worth having.
 * `prove-fence.sh` is what holds that the claims are awake.
 *
 * Filesystem/parser machinery is `tree.testlib.ts`, which is an adapter over the
 * door now; the door itself is where a generic question is answered. */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import { CLAIMS, fence } from "@olai/effect-cordis/fence"

import { DECLARATION, RECORD_OF, RUNTIMES } from "./fence.testlib.ts"
import { BUNDLE_NAMES as PLUGIN_NAMES, ROWS } from "./rows.ts"
import {
  cssImportsOf,
  dependencyNames,
  doorsOf,
  edgesOf,
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
  REPO,
  sourcesUnder,
  ROOT_DECLARED,
  specifiersOf,
  transpilers,
  type TreeGraph,
  walkFrom,
} from "./tree.testlib.ts"

/**
 * ONE READING PER FILE PER RUN, for the whole-repo sweeps below — the same
 * argument the door makes for its own caches, kept here for the three readings
 * this file still takes over a tree that does not change during a run.
 */
const perRun = <T>(read: (key: string) => T): ((key: string) => T) => {
  const held = new Map<string, T>()
  return (key) => {
    if (held.has(key)) return held.get(key)!
    const found = read(key)
    held.set(key, found)
    return found
  }
}
/** `graphFrom`, by absolute entry. */
const graphAt = perRun(graphFrom)
/** A `packages/`-relative file's raw text. */
const sourceAt = perRun((file) => readFileSync(path.join(PACKAGES, file), "utf8"))
/** ...transpiled by the grammar its extension names. */
const transpiledAt = perRun((file) =>
  transpilers[file.endsWith(".tsx") ? "tsx" : "ts"].transformSync(sourceAt(file)),
)
/** ...its runtime import specifiers. */
const runtimeImportsAt = perRun((file) => edgesOf(file, sourceAt(file)).map((one) => one.spec))

/** This package, and the plugins it is allowed to name. Spelled as member
 *  directories because that is what the walk below has; both are DERIVED — the
 *  registry from the manifest that owns this file, the tenants from the packages
 *  the registry names — so a rename moves them without an edit here. */
const REGISTRY = MEMBER_OF_PACKAGE.get("@olai/bundle") ??
  (() => {
    throw new Error("fence: `@olai/bundle` is not a workspace member, so there is no registry to fence")
  })()

/** ...and the INTERFACE, which is the package the registry used to be half of.
 *  It names no plugin, which is what lets a plugin import it — so it holds a
 *  claim of its own instead: its SERVICES door pulls no browser face. */
const INTERFACE = MEMBER_OF_PACKAGE.get("@olai/plugin-api") ??
  (() => {
    throw new Error("fence: `@olai/plugin-api` is not a workspace member, so there is no interface to fence")
  })()

/**
 * ONE PLUGIN, ONE RECORD — its name, the package it is published as, and the
 * member directory it lives in.
 *
 * Three parallel arrays indexed together is how the first draft read, and every
 * claim below asks about ONE plugin; a record cannot be misaligned, and the
 * throw is where a derivation failure belongs rather than an empty-string path
 * a claim quietly makes about nothing.
 */
const TENANTS_OF: ReadonlyArray<{ name: string; pkg: string; dir: string }> = PLUGIN_NAMES.map((name) => {
  const pkg = `olai-plugin-${name}`
  const dir = MEMBER_OF_PACKAGE.get(pkg)
  if (dir === undefined) {
    throw new Error(`fence: the registry names \`${pkg}\`, which is no workspace member`)
  }
  return { name, pkg, dir }
})

const PLUGIN_PACKAGES = TENANTS_OF.map((one) => one.pkg)
const PLUGIN_DIRS = TENANTS_OF.map((one) => one.dir)

/** Explicit static doors are APIs, never wildcard implementation exports. A
 *  declaration only makes an edge eligible: the closure checks below prove that
 *  it does not pull a private browser/server implementation through another
 *  door. */
const staticDoors = (pkg: string): ReadonlyArray<string> => {
  const member = MEMBER_OF_PACKAGE.get(pkg)
  if (member === undefined) return []
  const manifest = manifestAt(member) as { readonly olai?: { readonly contracts?: readonly string[] } } | undefined
  const declared = manifest?.olai?.contracts ?? []
  if (!Array.isArray(declared) || declared.some((door) => typeof door !== "string" || !door.startsWith("./") || door.includes("*"))) {
    throw new Error(`fence: ${pkg} olai.contracts must name explicit static export doors`)
  }
  return [...new Set(["./contract", ...declared])]
}
const staticDoor = (spec: string): boolean => {
  const pkg = packageOf(spec)
  return staticDoors(pkg).includes(`.${spec.slice(pkg.length)}`)
}
const staticTargets = (pkg: string): ReadonlyArray<string> => {
  const member = MEMBER_OF_PACKAGE.get(pkg)
  if (!member) return []
  const manifest = manifestAt(member)
  return staticDoors(pkg).flatMap((door) => {
    const target = manifest === undefined ? undefined : doorsOf(manifest)[door]
    return target ? [path.resolve(PACKAGES, member, target)] : []
  })
}

/** WHERE A TENANT LIVES, as a directory rather than a preference:
 *  `packages/plugins/` is the plugin container and holds nothing else. */
const CONTAINER = "plugins"

/** Does this specifier name a plugin package — the bare name or a subpath under
 *  it. A claim that matched only the bare name would be green under
 *  `olai-plugin-kolu/wire`, which is the door every consumer would actually
 *  use. */
const namesAPlugin = (spec: string): boolean => PLUGIN_PACKAGES.includes(packageOf(spec))

/** One source, as `./tree.testlib.ts` reads it, PLUS the one projection that is
 *  this file's: which of its specifiers name a plugin. */
interface Read extends Named {
  readonly plugins: ReadonlyArray<string>
}

/** Every member's sources, read once, each with what it reaches for. */
const tree: ReadonlyMap<string, ReadonlyArray<Read>> = new Map(
  MEMBERS.map((member) => [
    member as string,
    sourcesUnder(path.join(PACKAGES, member)).map((file): Read => {
      // A scripted agent opens with a shebang; the line holds no import.
      const text = readFileSync(file, "utf8").replace(/^#![^\n]*\n/, "")
      const grammar = grammarOf(file)
      const relative = path.relative(PACKAGES, file)
      const found = grammar === "css" ? cssImportsOf(text) : specifiersOf(relative, text)
      return {
        file: relative,
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
const declaredBy = (pkg: string): ReadonlyArray<string> => dependencyNames(manifestAt(pkg)).filter(namesAPlugin)

const packages = [...tree.keys()].sort()

/**
 * NO DOOR CARRIES A COMPONENT, and this is that claim once rather than per door.
 *
 * The confinement lists are SPECIFIER lists, and the appliance fold showed what
 * they cannot see: a relative `../appliance/index.ts` is not a specifier any
 * confinement list can carry, and a per-directory rule inside somebody's package
 * would be this fence inventing a layout convention and then enforcing its own
 * invention. So the claim is made about the FILE the walk landed in, with the
 * instrument the tree already uses to mean *this renders*: `.tsx` is JSX, JSX is
 * a component, and Bun's default JSX runtime is React's — which is the boot
 * death this whole door split was written after.
 */
const componentsOn = (door: { files: ReadonlyArray<string> }): ReadonlyArray<string> =>
  door.files.filter((file) => file.endsWith(".tsx"))

/**
 * THE BROWSER'S DOOR, walked ONCE — the generated table of chunks.
 *
 * A row is an `id` and a thunk, and the thunk's specifier is a string until
 * somebody calls it: so the bounds below are satisfied by there being nothing to
 * bound, which would be a fence passing by being empty if that were all that was
 * asserted. It is not — the door must also SPELL every plugin, in a literal a
 * bundler can split on, which is the property that makes the emptiness a design
 * rather than a mistake.
 */
const BROWSER_DOOR = graphFrom(path.join(PACKAGES, REGISTRY, "src", "rows.ts"))

/**
 * ...AND EACH PLUGIN'S OWN BROWSER DOOR, which is the chunk a roster fetches.
 *
 * `prove-fence.sh` found this one rather than a reviewer: mutation 6 appends
 * `@olai/format` to a plugin's `./wire` and went GREEN — the fence did not see
 * it — which is exactly what a mutation harness is for. What a tab may not
 * carry is held over each plugin's `./browser`, and the list says how.
 */
const BROWSER_TENANTS = TENANTS_OF.flatMap((tenant) => {
  const manifest = manifestAt(tenant.dir)
  const target = manifest === undefined ? undefined : doorsOf(manifest)["./browser"]
  return target === undefined ? [] : [{ ...tenant, target }]
})
const BROWSER_DOORS: ReadonlyArray<{ readonly name: string; readonly door: Door }> = BROWSER_TENANTS.map(
  (tenant) => ({ name: tenant.name, door: graphFrom(path.join(PACKAGES, tenant.dir, tenant.target)) }),
)

/** One walked door, as the claims below read it. */
type Door = TreeGraph

/**
 * WHAT MUST NOT BE ON A PLUGIN'S BROWSER CHUNK.
 *
 *   - a `node:` builtin is not a thing a browser bundle may contain, and it
 *     fails at RUNTIME in the tab rather than at any build step;
 *   - `@odu/*` and `@kolu/padi-client` are an appliance's PRODUCT TIER, which
 *     stays behind that appliance's client package;
 *   - `@olai/surface/projection` IS on it, and the entry is the whole of a split
 *     this fence could not otherwise see: a row's ENTRY SCHEMA crosses to the
 *     browser while the PROJECTION that builds one is the server reading a
 *     revision, and the two lived in one `wire.ts` for exactly one commit —
 *     which put four hundred lines of slicing machinery no tab can call onto all
 *     three content chunks, with nothing red anywhere.
 *
 * `@olai/format` is NOT on this list, and its absence is measured: odu's chip
 * reads the vault's own file-kind words, so the format is on that chunk
 * legitimately.
 */
const NOT_IN_A_TAB = [
  /^node:/,
  /^@odu\//,
  /^@kolu\/padi-client(\/|$)/,
  /^@olai\/surface\/projection$/,
] as const

/**
 * ...AND THE SERVER DOOR, which is not a FILE: the rows in `olai.yml` name each
 * plugin's server module as a SPECIFIER and the loader mounts it at runtime.
 *
 * So what is walked is every module this build will actually mount, per row.
 * That is stronger than the compiled-in array it replaced, and a row naming a
 * module that does not exist is a walk that cannot read it — which the
 * `unresolved` claim below is about.
 */
const SERVER_DOOR = ((): Door => {
  const graphs = ROWS.filter((row) => !row.browserOnly).map((row) => {
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
 * NOTHING ON THE BROWSER REGISTRY'S OWN DOOR IS A UI RUNTIME, AN APPLIANCE'S
 * CLIENT, OR THE FORMAT.
 *
 * The door's `door-graphs` refuses a builtin on a browser root's walk and
 * nothing else, because those are the words every build shares. What THIS build
 * may not put behind its chunk table is its own judgement, and it is recorded
 * here rather than dropped: `solid-js` because a tab's chunk that pulls the
 * runtime has stopped being a chunk of its own, `@olai/format` because a floor
 * package that a browser already spends is not a registry's business, an
 * appliance's client because the tab must reach one through that appliance's
 * own chunk, and `@olai/surface/projection` because the projection is the
 * server's reading of a revision.
 */
const FORBIDDEN = [
  /^solid-js(\/|$)/,
  /^@olai\/format(\/|$)/,
  /^node:/,
  /^@kolu\/(padi-client|terminal-vocab|solid-dockrow|solid-statepip|detect)(\/|$)/,
  /^@xterm\//,
  /^@odu\//,
] as const

/** What must not be on the graph of the door a COMPOSITION ROOT opens. A server
 *  legitimately pulls an appliance's client, the vault's format and `node:`
 *  builtins; what it must never pull is a BROWSER FACE. A component library's
 *  BARREL is refused and its documented value-only subpath is not — a
 *  distinction the libraries draw and this fence inherits. */
/** ...and the words a server graph may not carry, which is ONE constant: the
 *  door's default spread with this build's own, declared in `fence.testlib.ts`
 *  and spent here by both the server door and the interface's. */
const NOT_ON_A_SERVER = RUNTIMES

// ── the door ───────────────────────────────────────────────────────────

/**
 * THE FIVE GENERIC CLAIMS, once, over one reading of the tree.
 *
 * Everything in this block used to be written out here in olai's nouns. It is a
 * call now, and the sentences a failure prints name a file and a rule — which is
 * what a person needs; the argument for each claim is the door's.
 */
const DOOR = fence(DECLARATION)

describe("the fence's five generic claims", () => {
  for (const claim of CLAIMS) {
    test(`${claim}`, () => {
      expect(DOOR.red(claim)).toEqual([])
    })
  }

  test("the declaration is not a reading of nothing", () => {
    // THE FLOORS, stated against the door's OWN counts — a floor recomputed here
    // would be a floor over a second reading, and a resolver that answered
    // `undefined` once would move both together and agree.
    const reading = DOOR.reading
    expect(reading.rows).toBe(PLUGIN_NAMES.length)
    expect(Object.keys(DECLARATION.rows).sort()).toEqual([...PLUGIN_NAMES].sort())
    expect(DECLARATION.roots.length).toBe(2)
    // The members and the corpus it read, which is what a sweep that came back
    // short would shrink first.
    expect(reading.members).toBeGreaterThan(15)
    expect(reading.production).toBeGreaterThan(300)
    expect(reading.compiled).toBeGreaterThan(300)
    // ...the live-state corpus, which a resolver that answered nothing would
    // leave at one file per door.
    expect(reading.doors).toBeGreaterThan(200)
    // ...and the roots' walks, which are the graphs every door claim is about.
    expect(reading.onARootWalk).toBeGreaterThan(100)
    // THE ROSTER, by name: the derivation found the registry this package's
    // claims have always meant, and it is ONE package.
    expect(reading.registry).toBe(path.join("packages", REGISTRY))
  })

  test("no product source opens the door", () => {
    // The door reads sources with a compiler, so a tab's chunk carrying it would
    // be a bundling accident rather than a boundary. A BENCH may open it — that
    // is what a `.testlib.ts` is, and `fence.testlib.ts` is the declaration — and
    // no product file does.
    const openers = [...tree].flatMap(([, sources]) =>
      sources
        .filter((source) => !/\.(?:test|browsertest|spec|testlib|bench)\.tsx?$/.test(source.file))
        .filter((source) => !source.file.split("/").includes("e2e"))
        .flatMap((source) =>
          source.specs
            .filter((spec) => spec === "@olai/effect-cordis/fence" || spec.startsWith("@olai/effect-cordis/fence/"))
            .map((spec) => `${source.file}: ${spec}`),
        ),
    )
    expect(openers).toEqual([])
  })
})

// ── olai's own claims ──────────────────────────────────────────────────

describe("the browser's door names every browser export and imports none", () => {
  const reached = BROWSER_DOOR.reached

  test("it spells exactly the browser exports, in specifiers a bundler can split on", () => {
    // THE FLOOR, and the one that matters here. A generated table that had
    // dropped a row, or spelled a package that does not exist, would satisfy
    // every bound below by naming nothing — so what is asserted is the EQUALITY.
    const named = new Set(reached.filter((one) => namesAPlugin(one.spec)).map((one) => one.spec))
    expect([...named].sort()).toEqual(BROWSER_TENANTS.map((tenant) => `${tenant.pkg}/browser`).sort())
  })

  test("...and the walk did NOT cross into any of them", () => {
    // The complement, and the whole of what a chunk buys: a plugin's module is
    // named here and reached from here by nobody.
    const files = new Set(reached.map((one) => one.file))
    const crossed = [...files].filter((file) => PLUGIN_DIRS.some((dir) => file.startsWith(`${dir}${path.sep}`)))
    expect(crossed.sort()).toEqual([])
  })

  test("the walk resolved every edge it followed", () => {
    expect(BROWSER_DOOR.unresolved).toEqual([])
  })

  test("nothing on it is a UI runtime, an appliance's client, or the format", () => {
    // The olai-only half of the confinement, and the reason it is not the door's:
    // a `solid-js` on a chunk table is this build's mistake to make.
    const bad = reached
      .filter((one) => FORBIDDEN.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
  })

  test("...and no file on it is a component at all", () => {
    expect(componentsOn(BROWSER_DOOR)).toEqual([])
  })
})

describe("a plugin's browser chunk stays a browser chunk", () => {
  test("the walk crossed into every tenant's faces, and resolved every edge", () => {
    // NOT VACUOUS, in both directions at once: a resolver that answered nothing
    // would walk one file per tenant and satisfy the list below by being empty.
    for (const { name, door } of BROWSER_DOORS) {
      expect([name, door.unresolved]).toEqual([name, []])
      expect([name, door.files.length > 1]).toEqual([name, true])
    }
  })

  test("nothing on one is a `node:` builtin or an appliance's product tier", () => {
    const bad = BROWSER_DOORS.flatMap(({ name, door }) =>
      door.reached
        .filter((one) => NOT_IN_A_TAB.some((rule) => rule.test(one.spec)))
        .map((one) => `${name}: ${one.file}: ${one.spec}`),
    )
    expect([...new Set(bad)].sort()).toEqual([])
  })

  test("each browser row carries rendering or an explicit activation", () => {
    // A scoped client provider need not draw anything. It must still contain an
    // activation, so an accidentally empty entry cannot satisfy this browser
    // ownership check simply by importing static contracts.
    for (const { name, door } of BROWSER_DOORS) {
      const activated = door.files.some(
        (file) =>
          runtimeImportsAt(file).some((spec) => spec === "@olai/plugin-api")
          && /\bdefinePlugin\s*\(/.test(sourceAt(file)),
      )
      expect([name, componentsOn(door).length > 0 || activated]).toEqual([name, true])
    }
  }, { timeout: 10_000 })

  test("nothing on one mints an id with `crypto.randomUUID`", () => {
    // A page read over plain http from another machine — the ordinary way olai
    // is read — is not a secure context, and there the method does not exist.
    // #642 called it while navigation's browser half started, and the whole page
    // came up as "Some plugins couldn't start".
    const bad = BROWSER_DOORS.flatMap(({ name, door }) =>
      door.files.filter((file) => /\bcrypto\.randomUUID\s*\(/.test(sourceAt(file))).map((file) => `${name}: ${file}`),
    )
    expect([...new Set(bad)].sort()).toEqual([])
  }, { timeout: 10_000 })
})

describe("the server door pulls no browser face", () => {
  const reached = SERVER_DOOR.reached

  test("the walk actually crossed into both plugins' server halves", () => {
    const files = new Set(reached.map((one) => one.file))
    for (const tenant of TENANTS_OF.filter((tenant) => !ROWS.find((row) => row.id === tenant.name)?.browserOnly)) {
      expect([...files].some((f) => f === path.join(tenant.dir, "src", "server.ts")), tenant.name).toBe(true)
    }
  })

  test("the walk resolved every edge it followed", () => {
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
    // `componentsOn` is the only claim here that reads the files a walk VISITED
    // rather than the specifiers it evaluated, so it gets its own floor: a
    // version of that reading which resolved nothing would report no components
    // by reporting no files at all.
    expect(SERVER_DOOR.files.length).toBeGreaterThan(10)
    // THE POSITIVE CONTROL: a plugin's own `./browser` holds the components
    // legitimately, on a chunk nothing here imports.
    const tenant = TENANTS_OF[0]
    if (tenant === undefined) throw new Error("fence: this build has no plugins")
    const faces = graphFrom(path.join(PACKAGES, tenant.dir, "src", "browser.tsx"))
    expect(faces.unresolved).toEqual([])
    expect(componentsOn(faces).length).toBeGreaterThan(0)
  })

  test("it DOES reach each appliance's client, which is the point of the door", () => {
    // The complement, said out loud: this door exists to carry exactly what the
    // browser chunk may not. A version of it that reached nothing would pass the
    // claim above by being empty.
    const specs = new Set(reached.map((one) => one.spec))
    expect(specs.has("olai-plugin-kolu/appliance")).toBe(true)
    expect(specs.has("olai-plugin-odu/appliance")).toBe(true)
  })
})

/**
 * THE CONTAINER IS THE TENANTS, AND ONLY THE TENANTS — the directory held as an
 * equality rather than as a convention somebody remembers.
 *
 * Held BOTH WAYS, because each direction fails differently and silently: a
 * plugin OUTSIDE the container is a tenant nobody would look for, and a member
 * INSIDE it that is not a plugin is a general package the next reader would
 * reasonably take for a tenant.
 */
describe("packages/plugins is the tenant container, and holds nothing else", () => {
  test("every plugin the registry names lives in it, and nothing else does", () => {
    // THE FILESYSTEM, not `MEMBERS`: a loose `packages/plugins/shared/` of `.ts`
    // files is not a member, so it would be invisible here AND absent from
    // `tree` — the corpus quietly shrinking, at the one directory this claim was
    // added to protect.
    const inside = readdirSync(path.join(PACKAGES, CONTAINER), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(CONTAINER, entry.name))
      .sort()
    expect(inside).toEqual([...PLUGIN_DIRS].sort())
    // ...and the container is not itself a package.
    expect(existsSync(path.join(PACKAGES, CONTAINER, "package.json"))).toBe(false)
  })

  test("the reading is not vacuous", () => {
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
          .map((spec) => `${source.file}: ${spec}`),
      ) ?? []
      const declared = dependencyNames(manifestAt(pkg)).filter((spec) => packageOf(spec) === "@olai/state")
      expect(reached, pkg).toEqual([])
      expect(declared, pkg).toEqual([])
    }
  })
})

describe("only the registry knows a plugin's name", () => {
  /** THE FLOOR. A corpus that came back short is the failure mode this file was
   *  written to not inherit — an empty sweep reports nothing found and every
   *  claim below passes. */
  test("the sweep is actually reading the repository", () => {
    const files = [...tree.values()].flat().length
    expect(packages.length).toBeGreaterThan(15)
    expect(files).toBeGreaterThan(400)
  })

  /**
   * THE FOLDED TESTLIB DOORS, recorded rather than widened.
   *
   * WHAT REMAINS IS THE SUITES THAT DRIVE ROWS. `@olai/tests` is the cucumber
   * harness, and a row keeps the features it promises under its own `e2e/` — so
   * what is left here is what the HARNESS itself stands on: kolu's and odu's
   * appliance doors (the fake padi and the fake run service the spawn stands
   * on), mail's pair of fakes, chat's panel constant, the six `/testids` doors
   * (which row draws one KIND of file is a question about six rows at once), and
   * `storage_keys.ts`.
   *
   * MULTIPLICITY IS PER IMPORT STATEMENT, not per unique specifier: the reader
   * hands back one entry every time a file spells a name, so five
   * `route.test.ts` lines mean five separate `import` statements. Merging two
   * into one braced list is a legitimate edit that turns this table red — delete
   * the surplus line, do not chase a phantom import.
   */
  const TESTLIB_IMPORTS: Readonly<Record<string, ReadonlyArray<string>>> = {
    tests: [
      "tests/support/hooks.ts: olai-plugin-kolu/appliance/testlib",
      "tests/support/hooks.ts: olai-plugin-mail/appliance/testlib",
      "tests/support/hooks.ts: olai-plugin-odu/appliance/testlib",
      "tests/support/storage_keys.ts: olai-plugin-alerts/keys",
      "tests/support/storage_keys.ts: olai-plugin-outlines/testlib",
      "tests/support/workers.ts: olai-plugin-mail/appliance/testlib",
      "tests/support/world.ts: olai-plugin-csv/testids",
      "tests/support/world.ts: olai-plugin-hypertext/testids",
      "tests/support/world.ts: olai-plugin-image/testids",
      "tests/support/world.ts: olai-plugin-kolu/appliance/testlib",
      "tests/support/world.ts: olai-plugin-mail/appliance/testlib",
      "tests/support/world.ts: olai-plugin-markdown/testids",
      "tests/support/world.ts: olai-plugin-odu/appliance/testlib",
      "tests/support/world.ts: olai-plugin-outlines/testids",
      "tests/support/world.ts: olai-plugin-pdf/testids",
    ],
    server: [
      "server/src/capabilities.testlib.ts: olai-plugin-vault/testlib",
      "server/src/dial.test.ts: olai-plugin-mcp/testlib",
      "server/src/headless.test.ts: olai-plugin-git/testlib",
      "server/src/lock.test.ts: olai-plugin-vault/testlib",
      "server/src/mcp/face.test.ts: olai-plugin-mcp/testlib",
      "server/src/mcp/face.test.ts: olai-plugin-mcp/testlib",
      "server/src/mcp/route.test.ts: olai-plugin-mcp/testlib",
      "server/src/mcp/tools.test.ts: olai-plugin-mcp/testlib",
      "server/src/mcp/tools.test.ts: olai-plugin-mcp/testlib",
      "server/src/mcp/tools.test.ts: olai-plugin-mcp/testlib",
      "server/src/resync.test.ts: olai-plugin-vault/testlib",
      "server/src/serve.test.ts: olai-plugin-web-app/testlib",
      "server/src/who.test.ts: olai-plugin-identity/who",
    ],
  }
  /** ...and the fourth door, which no reading of a source can see. The claim
   *  below UNIONS this list with the static-door scan, so what must be here is
   *  whatever is justified by nothing else. `@olai/web` is absent from BOTH
   *  tables and declares no plugin, which is the boundary claim stated where a
   *  MANIFEST can fail it. */
  const TESTLIB_DECLARED: Readonly<Record<string, ReadonlyArray<string>>> = {
    tests: ["olai-plugin-chat", "olai-plugin-kolu", "olai-plugin-mail", "olai-plugin-odu", "olai-plugin-outlines"],
    server: ["olai-plugin-git", "olai-plugin-identity", "olai-plugin-mcp", "olai-plugin-vault", "olai-plugin-web-app"],
  }

  test("plugins consume other plugins only through static contract doors", () => {
    // STRICTER THAN THE DOOR'S `imports` CLAIM, and kept for that reason: the
    // door allows any door a provider DECLARES, and this tree's rule is that a
    // cross-plugin edge goes through `olai.contracts` — the doors held to the
    // closure checks below.
    const other = TENANTS_OF.flatMap(({ name, dir }) =>
      tree.get(dir)?.flatMap((source) =>
        source.plugins
          .filter((spec) => packageOf(spec) !== `olai-plugin-${name}` && !staticDoor(spec))
          .map((spec) => `${source.file}: ${spec}`),
      ) ?? [],
    )
    expect(other).toEqual([])
  })

  test("cross-plugin static contracts resolve without private implementation or owned resources", () => {
    const violations: string[] = []
    for (const dir of packages) {
      const specs = new Set(tree.get(dir)?.flatMap((source) => source.plugins.filter((spec) => staticDoor(spec))) ?? [])
      for (const spec of specs) {
        const provider = MEMBER_OF_PACKAGE.get(packageOf(spec))
        expect(provider, spec).toBeDefined()
        const manifest = manifestAt(provider!)
        const target = manifest === undefined ? undefined : doorsOf(manifest)[`.${spec.slice(packageOf(spec).length)}`]
        expect(target, spec).toBeDefined()
        const graph = graphAt(path.join(PACKAGES, provider!, target!))
        expect(graph.unresolved, spec).toEqual([])
        const bad = graph.files.filter((file) => {
          const absolute = path.resolve(PACKAGES, file)
          const member = memberOf(file)
          if (!member || !PLUGIN_DIRS.includes(member)) return false
          const pkg = manifestAt(member)?.name
          if (typeof pkg !== "string") return true
          const targets = staticTargets(pkg)
          // A contract can use sibling contract helpers, but not reach back into
          // its provider's state/presentation implementation.
          const identity = /^export const name = ["'][a-z0-9-]+["'];?\s*$/.test(transpiledAt(file).trim())
          return !identity && !targets.includes(absolute) && !absolute.startsWith(path.join(PACKAGES, member, "src/contracts") + path.sep)
        })
        violations.push(...bad.map((file) => `${spec}: private implementation ${file}`))
        const acquiring = graph.files.filter((file) => {
          const member = memberOf(file)
          if (!member || !PLUGIN_DIRS.includes(member)) return false
          const code = transpiledAt(file)
          return /\b(?:setTimeout|setInterval|createRoot|watchPreference|definePlugin)\s*\(|\.addEventListener\s*\(|\bEffect\.(?:acquireRelease|fork)|new (?:MutationObserver|ResizeObserver|WebSocket)\s*\(/.test(code)
        })
        violations.push(...acquiring.map((file) => `${spec}: runtime acquisition ${file}`))
      }
    }
    expect([...new Set(violations)]).toEqual([])
    // Walks every cross-plugin contract graph; the per-run reads keep this from
    // being the slowest thing in the file.
  }, { timeout: 60_000 })

  test("general production packages name no plugins; test readers use explicit static doors", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      // A plugin importing its own doors is not a general package naming a
      // plugin.
      if (PLUGIN_DIRS.includes(pkg)) continue
      const reached = tree.get(pkg)?.flatMap((s) =>
        s.plugins
          .filter((p) => !/\.(?:test|browsertest|testlib)\.tsx?$/.test(s.file) || !staticDoor(p))
          .map((p) => `${s.file}: ${p}`),
      ) ?? []
      // An EQUALITY against the recorded answer — never a length on a filter: a
      // pattern that rotted would report nothing and pass.
      expect([...reached].sort(), pkg).toEqual([...(TESTLIB_IMPORTS[pkg] ?? [])])
    }
  })

  test("plugin dependencies correspond to static contracts or explicit testlib doors", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      expect([...declaredBy(pkg)].sort(), pkg).toEqual(
        [
          ...new Set([
            ...(TESTLIB_DECLARED[pkg] ?? []),
            ...[...new Set(tree.get(pkg)?.flatMap((source) => source.plugins.filter((spec) => staticDoor(spec)).map(packageOf)) ?? [])].filter(
              (name) => name !== manifestAt(pkg)?.name,
            ),
          ]),
        ].sort(),
      )
    }
  })

  test("the registry declares every plugin it imports, and no other", () => {
    const reached = new Set(tree.get(REGISTRY)?.flatMap((s) => s.plugins) ?? [])
    for (const spec of reached) expect(namesAPlugin(spec), spec).toBe(true)
    expect([...declaredBy(REGISTRY)].sort()).toEqual([...PLUGIN_PACKAGES].sort())
  })

  /**
   * ...AND EVERY PLUGIN DOES IMPORT THE INTERFACE, which is the positive half and
   * is not decoration. A fence that only forbade things would pass on a tree
   * where the services door had quietly stopped being reachable — a plugin
   * written against a copy of the shapes, structurally, which is what
   * `olai-plugin-odu`'s `server.ts` did for a while precisely because the import
   * WAS a cycle.
   */
  test("...and every plugin does import the interface", () => {
    for (const { dir } of TENANTS_OF) {
      const named = tree.get(dir)?.flatMap((s) =>
        s.specs
          .filter((spec) => spec === "@olai/plugin-api" || spec.startsWith("@olai/plugin-api/"))
          .map((spec) => `${s.file}: ${spec}`),
      ) ?? []
      expect(named.length, dir).toBeGreaterThan(0)
    }
  })
})

/**
 * THE ROOT DOOR IS SAFE FOR ANY PACKAGE TO OPEN — the root is one row per plugin
 * with a dynamic `import()` of its browser half, so its static closure carries
 * no plugin, no component and no UI runtime (which the browser door's claims
 * above hold).
 *
 * A door that cannot hurt anybody has no business forbidding anybody, so what is
 * left to assert is the other direction — that packages outside this one DO open
 * it, which would go quiet if the door ever grew teeth again.
 */
describe("the root door is opened by packages that render nothing", () => {
  /** The one package whose job is to draw a plugin's faces. */
  const RENDERER = "web"

  test("more than the renderer opens `@olai/bundle`, and that is the point", () => {
    const openers = packages.filter(
      (pkg) => pkg !== REGISTRY && (tree.get(pkg) ?? []).some((s) => s.specs.includes("@olai/bundle")),
    )
    // NOT AN EQUALITY, deliberately: pinning WHICH packages walk through it
    // would be a list edited every time somebody wants a plugin name, for no
    // defect it could catch.
    expect(openers.length).toBeGreaterThan(0)
    const headless = openers.filter((pkg) => pkg !== RENDERER)
    expect(headless.length, openers.join(", ")).toBeGreaterThan(0)
  })

  /**
   * ...AND THE SERVICES DOOR PULLS NO BROWSER FACE, which is the claim the
   * INTERFACE package owes now that it is one: the root is what a browser half
   * is written against and its fields return `JSX.Element`, and `./services` is
   * what a SERVER half is written against.
   */
  test("the services door pulls no browser face", () => {
    const door = graphFrom(path.join(PACKAGES, INTERFACE, "src", "services.ts"))
    expect(door.unresolved).toEqual([])
    const bad = door.reached
      .filter((one) => NOT_ON_A_SERVER.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
    expect(componentsOn(door)).toEqual([])
    // Not vacuous: the door reaches at least the contract beside it.
    expect(door.files.length).toBeGreaterThan(1)
  })
})

describe("a plugin is a sibling, and core computes none of its addresses", () => {
  test("a plugin's name is a legal tag segment, because it becomes one", () => {
    // `assertTagSegment` refuses an empty name and one containing "/", and it
    // refuses at boot. A plugin's name is also its preferences row and its docs
    // slug, so the bar is a little higher than the framework's — a word, not a
    // path.
    for (const name of PLUGIN_NAMES) {
      expect([name, /^[a-z][a-z0-9-]*$/.test(name)]).toEqual([name, true])
    }
    // ...and no two rows claim one word.
    expect(new Set(PLUGIN_NAMES).size, PLUGIN_NAMES.join(", ")).toBe(PLUGIN_NAMES.length)
  })
})

// ── the tenancy of an appliance's product tier ─────────────────────────

/**
 * AN APPLIANCE'S PRODUCT TIER STAYS INSIDE ITS TENANT.
 *
 * ## Why both lists are derived
 *
 * The two shell fences this replaced each carried the answer BY HAND, and that
 * is precisely what a fence exists to prevent: a plugin package grew a testlib
 * that served its own appliance's real surface, which is the tenancy working
 * exactly as designed, and one shell script called it a wall breach because its
 * list said `odu-client` and nothing else.
 *
 *   - **A TENANT is computed from the registry.** Walk each plugin's own code
 *     doors and collect the workspace packages the walk reaches. A package
 *     reached from TWO plugins is general by construction and drops out.
 *   - **A TIER is computed from the tenant.** Whatever a tenant names that
 *     resolves out of the ROOT `node_modules` and is declared in NO manifest is
 *     hydrated: copied into that one directory from a Nix pin, where every
 *     package in the tree resolves it whether it declared it or not. That last
 *     clause is the whole reason a fence is needed for these and for nothing
 *     else: the isolated linker already refuses a specifier a manifest does not
 *     declare.
 *   - **The FRAMEWORK tier is out of scope, and it is the one thing still
 *     spelled.** `@kolu/surface*` is olai's foundation, imported anywhere, like
 *     `effect`.
 */

/** THE FRAMEWORK TIER, and the only list in this block that a person wrote.
 *
 *  `cordis` AND `@cordisjs/plugin-*` USED TO BE ON THE SAME SIDE and are not any
 *  more: it is an ENGINE behind one package now, weighed as an ordinary hydrated
 *  specifier with {@link BRIDGE} as the one package allowed to reach it. */
const FRAMEWORK = /^@kolu\/surface(-[a-z]+)*(\/|$)/

/** THE ENGINE, and the one package that may see it. */
const BRIDGE = "effect-cordis"
const ENGINE = /^(?:cordis|@cordisjs\/plugin-[a-z]+)(\/|$)/

/** Is this specifier, named by this package, a HYDRATED one — copied into the
 *  root `node_modules` from a Nix pin, where every package resolves it whether
 *  it declared it or not.
 *
 *  The last clause is the load-bearing one and is a filesystem question rather
 *  than a pattern: a directory under the root `node_modules` that no manifest in
 *  the tree asked for is, by construction, one the hydrate step put there. */
const isHydrated = (pkg: string, spec: string, own: ReadonlySet<string>): boolean => {
  if (spec.startsWith(".") || spec.startsWith("/")) return false
  if (spec.startsWith("node:") || spec.startsWith("bun:") || spec === "bun") return false
  if (spec.startsWith("@olai/")) return false
  if (FRAMEWORK.test(spec)) return false
  // THE ENGINE, INSIDE ITS ONE PACKAGE.
  if (pkg === BRIDGE && ENGINE.test(spec)) return false
  const name = packageOf(spec)
  if (ROOT_DECLARED.has(name) || own.has(name)) return false
  return existsSync(path.join(REPO, "node_modules", name))
}

/** Every hydrated specifier one package names, in any of the grammars the
 *  readers cover, as `file: specifier` so a failure reads as something to
 *  open. */
const hydratedIn = (pkg: string): ReadonlyArray<string> => {
  const own = new Set(dependencyNames(manifestAt(pkg)))
  return (tree.get(pkg) ?? [])
    .flatMap((source) =>
      [...new Set(source.specs)].filter((spec) => isHydrated(pkg, spec, own)).map((spec) => `${source.file}: ${spec}`),
    )
    .sort()
}

/** A plugin's own CODE doors, read off its `exports` map — the manifest's answer
 *  rather than this file's guess at one. `./all.css` is not a module and drops
 *  out. */
const codeDoorsOf = (dir: string): ReadonlyArray<string> => {
  const manifest = manifestAt(dir)
  if (manifest === undefined) return []
  const targets = [...Object.values(doorsOf(manifest)), mainOf(manifest) ?? ""]
  return [...new Set(targets)].filter((t) => /\.tsx?$/.test(t)).map((t) => path.join(dir, t))
}

/** Which workspace packages one plugin's doors reach. Both the file a walk
 *  landed IN and the workspace specifier it reached FOR are counted. */
const reachedBy = (entries: ReadonlyArray<string>): ReadonlySet<string> => {
  const found = new Set<string>()
  for (const entry of entries) {
    for (const one of walkFrom(entry)) {
      const member = memberOf(one.file)
      if (member !== undefined) found.add(member)
      const named = MEMBER_OF_PACKAGE.get(packageOf(one.spec))
      if (named !== undefined) found.add(named)
    }
  }
  return found
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
 * GENERAL PACKAGE REACHES — everything shared drops out.
 *
 * ## The third clause, and the row that made it necessary
 *
 * It was two clauses: reached by this plugin, reached by no other. That stopped
 * being exact the day the CHAT became a row: chat is a plugin over core's own
 * floor, it reaches `@olai/ops`, `@olai/surface`, `@olai/log` and `@olai/web`,
 * and no other plugin does — under two clauses all of them became "chat's tenant
 * members", which is an EXEMPTION set, so seven general packages would have been
 * quietly excused from three claims at once.
 *
 * A tenant member is a package that exists FOR one plugin. A package the
 * composition root, the store or the format also reaches exists for olai, and
 * one plugin happening to be its only plugin-side reader does not change that.
 */
const GENERAL_REACH: ReadonlySet<string> = new Set(
  packages
    .filter((pkg) => pkg !== REGISTRY && !PLUGIN_DIRS.includes(pkg))
    .flatMap((pkg) => [...reachedBy(codeDoorsOf(path.join(PACKAGES, pkg)))])
    // A PLUGIN'S OWN DIRECTORY IS NEVER SOMEBODY ELSE'S GENERAL PACKAGE, whoever
    // reaches it: the suite reaches two of them by name, and without this line
    // those two rows would drop out of their own tenant sets.
    .filter((pkg) => !PLUGIN_DIRS.includes(pkg)),
)

const TENANTS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  TENANTS_OF.map(({ name, dir }) => [
    name,
    new Set(
      [...(CLOSURES.get(name) ?? [])].filter(
        (pkg) =>
          pkg !== REGISTRY &&
          !GENERAL_REACH.has(pkg) &&
          (pkg === dir || ![...CLOSURES].some(([other, theirs]) => other !== name && theirs.has(pkg))),
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

/** Product tier inside tenant — the fence is plain text, and a breach in any file
 *  is red, with no exceptions. */
const DEBT: Readonly<Record<string, ReadonlyArray<string>>> = {}

describe("an appliance's product tier stays inside its tenant", () => {
  test("the tenants are exactly what is written down here", () => {
    // AN EQUALITY, NOT A FLOOR: three claims SKIP every tenant member, so
    // `TENANT_MEMBERS` is an exemption set. A floor guards it against being
    // empty and guards nothing against it GROWING — widened by an ordinary
    // one-line import inside a plugin, which is the one place a reviewer would
    // not look for it.
    expect(Object.fromEntries([...TENANTS].map(([name, members]) => [name, [...members].sort()]))).toEqual(
      Object.fromEntries(TENANTS_OF.map(({ name, dir }) => [name, [dir]])),
    )
    // ...and each APPLIANCE tenant has a TIER, which is the other way this
    // derivation comes back empty.
    expect(
      Object.fromEntries([...TENANTS_OF].map(({ name }) => [name, (TIERS.get(name) ?? new Set()).size > 0])),
    ).toEqual(Object.fromEntries(TENANTS_OF.map(({ name }) => [name, ["kolu", "odu"].includes(name)])))
  })

  /**
   * THE ENGINE IS BEHIND ONE PACKAGE — the human's ruling as an equality.
   *
   * *olai uses Effect; plugins are written in Effect and Cordis is an engine
   * nobody outside one package sees.* Everything about that sentence is
   * checkable, and a second package naming `cordis` goes red HERE, by name, with
   * the ruling in the failure.
   *
   * BOTH GRAMMARS: what a source IMPORTS and what a manifest DECLARES. The
   * bridge declares neither — the engine is hydrated from the npins pin into the
   * ROOT `node_modules`, and a manifest naming it would send bun to a registry
   * that does not have it.
   */
  test("Cordis is an engine nobody outside one package sees", () => {
    const naming = packages.filter((pkg) => (tree.get(pkg) ?? []).some((source) => source.specs.some((spec) => ENGINE.test(spec))))
    expect(naming).toEqual([BRIDGE])
    expect(packages).toContain(BRIDGE)
    for (const pkg of packages) {
      expect(dependencyNames(manifestAt(pkg)).filter((one) => ENGINE.test(one)), pkg).toEqual([])
    }
  })

  test("every DEBT key is a package, and none of them is exempt anyway", () => {
    for (const pkg of Object.keys(DEBT)) {
      expect([pkg, packages.includes(pkg)]).toEqual([pkg, true])
      expect([pkg, TENANT_MEMBERS.has(pkg)]).toEqual([pkg, false])
    }
  })

  test("no package outside a tenant names a hydrated specifier", () => {
    for (const pkg of packages) {
      if (TENANT_MEMBERS.has(pkg)) continue
      expect(hydratedIn(pkg), pkg).toEqual([...(DEBT[pkg] ?? [])])
    }
  })

  test("no package outside a tenant DECLARES one either", () => {
    // The manifest door, which no reading of a source can see.
    const tiers = new Set([...TIERS.values()].flatMap((t) => [...t]))
    for (const pkg of packages) {
      if (TENANT_MEMBERS.has(pkg)) continue
      expect(dependencyNames(manifestAt(pkg)).filter((d) => tiers.has(d)), pkg).toEqual([])
    }
  })

  test("no tenant names another appliance's tier", () => {
    // The claim the two shell scripts could not make at all, because each knew
    // about one appliance: derived, so a third appliance is fenced against the
    // first two on the day it arrives.
    for (const [name, tier] of TIERS) {
      for (const [other, theirs] of TIERS) {
        if (other === name) continue
        expect([...tier].filter((one) => theirs.has(one)).sort(), `${name} vs ${other}`).toEqual([])
      }
    }
  })

  test("the composed doors reach every tenant door named `./wire`", () => {
    // What the two shell fences were FOR, kept: without this, a plugin that
    // stopped re-exporting its appliance's wire would make the purity claim
    // above pass over a graph that no longer contains the module it was written
    // about. The graph is the rows' — the walk the composition root performs.
    const reached = new Set(SERVER_DOOR.files)
    const wireDoors = [...TENANT_MEMBERS]
      .flatMap((pkg) => {
        const manifest = manifestAt(pkg)
        if (manifest === undefined) return []
        const doors = doorsOf(manifest)
        return (["./wire", "./appliance/wire"] as const)
          .filter((door) => doors[door] !== undefined)
          .map((door) => path.join(pkg, doors[door]!))
      })
      .sort()
    const applianceWires = [...TENANT_MEMBERS].filter((pkg) => {
      const manifest = manifestAt(pkg)
      return manifest !== undefined && doorsOf(manifest)["./appliance/wire"] !== undefined
    })
    expect(wireDoors.length).toBeGreaterThan(applianceWires.length)
    expect(applianceWires.length).toBeGreaterThan(1)
    expect(wireDoors.filter((file) => !reached.has(file))).toEqual([])
  })
})

// ── generated tables, and what a host's closure carries ────────────────

test("the composition root imports no plugin definition factory", () => {
  const definitions = (tree.get("server") ?? []).filter(
    (source) =>
      !/\.(test|testlib|bench)\./.test(source.file)
      && /\b(?:import|export)\s*\{[^}]*\bdefinePlugin\b/.test(readFileSync(path.join(PACKAGES, source.file), "utf8")),
  )
  expect(definitions.map((source) => source.file)).toEqual([])
})

test("the generated style chain contains exactly the declared stylesheet exports", () => {
  const expected = TENANTS_OF.flatMap((tenant) => {
    const manifest = manifestAt(tenant.dir)
    return manifest !== undefined && doorsOf(manifest)["./all.css"] !== undefined ? [`${tenant.pkg}/all.css`] : []
  })
  const actual = cssImportsOf(readFileSync(path.join(PACKAGES, "bundle/src/all.generated.css"), "utf8"))
  expect([...actual].sort()).toEqual(expected.sort())
  expect(BROWSER_TENANTS.length).toBeGreaterThan(0)
  expect(BROWSER_TENANTS.length).toBeLessThan(TENANTS_OF.length)
})

/** Domain-free host closures, not merely clean entry files. Static catalog
 *  declarations may cross a provider directory; runtime implementations may not. */
test("permanent host entry closures contain no Olai feature implementation", () => {
  const policyTargets = new Set(
    TENANTS_OF.flatMap((tenant) => {
      const target = doorsOf(manifestAt(tenant.dir)!)["./policy"]
      return target ? [path.relative(PACKAGES, path.resolve(PACKAGES, tenant.dir, target))] : []
    }),
  )
  const contractTargets = new Set(PLUGIN_PACKAGES.flatMap((pkg) => staticTargets(pkg).map((file) => path.relative(PACKAGES, file))))
  const entries = ["web/src/client/main.tsx", "server/src/serve.ts"]
  const violations = entries.flatMap((entry) => {
    const graph = graphFrom(path.join(PACKAGES, entry))
    expect(graph.unresolved, entry).toEqual([])
    // The host may carry typed contracts, but concrete extension locations
    // belong to the provider that draws or implements them.
    expect(graph.reached.filter((edge) => namesAPlugin(edge.spec) && edge.spec.endsWith("/slots")), entry).toEqual([])
    return graph.files
      .filter((file) => {
        const member = memberOf(file)
        return (
          member !== undefined
          && ((PLUGIN_DIRS.includes(member) && !policyTargets.has(file) && !contractTargets.has(file))
            || ["ops", "store", "edit-intents", "edit-history", "markdown-ui", "appearance"].includes(member))
        )
      })
      .map((file) => `${entry}: ${file}`)
  })
  expect(violations).toEqual([])
})

test("bundle static asset and policy catalogs match declared row exports", () => {
  for (const [door, file] of [
    ["./assets", "assets.generated.ts"],
    ["./policy", "policy.generated.ts"],
  ] as const) {
    const expected = TENANTS_OF.flatMap((tenant) =>
      doorsOf(manifestAt(tenant.dir)!)[door] ? [`${tenant.pkg}/${door.slice(2)}`] : [],
    )
    const source = readFileSync(path.join(PACKAGES, REGISTRY, "src", file), "utf8")
    expect(specifiersOf(`${REGISTRY}/src/${file}`, source).filter(namesAPlugin).sort()).toEqual(expected.sort())
    const graph = graphFrom(path.join(PACKAGES, REGISTRY, "src", file))
    expect(graph.unresolved, file).toEqual([])
    expect(graph.files.filter((name) => /\.(tsx|jsx)$/.test(name) || /\/(browser|server)\.[cm]?[jt]s$/.test(name)), file).toEqual([])
    if (door === "./policy") {
      expect(graph.reached.filter((edge) => /^node:|^solid-js(?:\/|$)/.test(edge.spec))).toEqual([])
    }
  }
})

test("outline formats never reach their registry and git/chat never select the Olai parser by import", () => {
  const olai = tree.get("plugins/outline-olai") ?? []
  expect(olai.length).toBeGreaterThan(0)
  for (const source of olai) {
    if (source.file.endsWith("/server.ts") || /\.(?:test|testlib)\./.test(source.file)) continue
    const code = readFileSync(path.join(PACKAGES, source.file), "utf8")
    expect(code).not.toMatch(/\bFileKinds\b/)
  }
  for (const member of ["plugins/git", "plugins/chat"]) {
    const sources = tree.get(member) ?? []
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source.specs.filter((spec) => spec === "olai-plugin-outline-olai" || spec.startsWith("olai-plugin-outline-olai/"))).toEqual([])
    }
  }
})

/**
 * A PLUGIN STAYS IN ITS DIRECTORY, OUTSIDE THE SOURCE GRAPH TOO — the Nix half
 * of the plugin-isolation fence.
 *
 * The claims above read a graph of who IMPORTS whom. This one reads the tree as
 * TEXT, because a plugin's Nix half and its dev-loop facts used to spread into
 * files that no module graph sees: `default.nix`, `shell.nix`, `flake.nix`,
 * `npins/`, `scripts/*`, the `justfile` and the e2e harness. A plugin's directory
 * is the one place it may know itself, so the fence is over the inverse: every
 * such file OUTSIDE `packages/plugins/`, with `#` and `//` comments stripped, may
 * not (1) contain the path `packages/plugins/`, nor (2) spell a plugin's word as
 * an identifier, path segment, tag literal or variable.
 *
 * The corpus is walked from `REPO` at read time rather than listed here, so a
 * file that stops existing is red (removed from the corpus it was meant to
 * guard) and a file that starts being one is swept.
 */
describe("a plugin stays in its directory, outside the source graph too", () => {
  const corpus = ((): ReadonlyArray<string> => {
    const out: string[] = []
    const norm = (p: string): string => p.split("\\").join("/")
    // Directories a walk must not enter: the vendored and derived trees that
    // would add a thousand `.nix` files that are nobody's spread.
    const SKIP: Record<string, true> = {
      node_modules: true,
      ".git": true,
      ".worktrees": true,
      dist: true,
      result: true,
    }
    const walk = (dir: string, rel: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const at = path.join(dir, entry.name)
        const here = rel === "" ? entry.name : `${rel}/${entry.name}`
        if (entry.isDirectory()) {
          if (SKIP[entry.name] || norm(here) === "packages/plugins") continue
          walk(at, here)
          continue
        }
        if (!entry.isFile()) continue
        const file = norm(here)
        if (
          // THE FALSIFIER IS ITS OWN EXCEPTION. `scripts/prove-fence.sh` is the
          // harness that BREAKS these exact paths to prove the fence is not
          // quietly not-running — it plants `packages/plugins/...` and
          // `OLAI_ODU_BIN` into `default.nix`, the `justfile` and `hooks.ts`. It
          // is therefore the one script that MUST name the very paths this
          // describe forbids, so it is excused whole.
          file === "scripts/prove-fence.sh" ||
          file === "bun.nix" ||
          // The subject of the fence, selected so it is swept by shape and then
          // excluded whole — a plugin is the one thing that MAY know itself.
          file.startsWith("packages/plugins/")
        ) {
          continue
        }
        if (
          (file.endsWith(".nix") && (!file.includes("/") || file === "packages/bundle/default.nix" || file.startsWith("nix/") || (file.startsWith("packages/bundle/nix/") && !file.includes("/fixtures/")))) ||
          file === "justfile" ||
          file === "shell.nix" ||
          file === "flake.nix" ||
          file.startsWith("scripts/") ||
          // The harness corpus is the FILES the fold touches. The wider
          // `support/` tree — selectors, testids, paints, scratch — is
          // UI-vocabulary by design, so words there are not a spread.
          file === "packages/tests/support/hooks.ts" ||
          file === "packages/tests/support/workers.ts" ||
          file === "packages/tests/support/fake.ts" ||
          file === "packages/tests/agent/scripted-acp.ts" ||
          file === "packages/tests/agent/command.ts" ||
          file === "packages/tests/agent/session-store.ts" ||
          file === "packages/tests/agent/native-activity.ts"
        ) {
          out.push(file)
        }
      }
    }
    walk(REPO, "")
    return out.sort()
  })()

  const stripped = (file: string): string =>
    readFileSync(path.join(REPO, file), "utf8")
      // Strip block comments in one pass before line splitting so a
      // `/** ... packages/plugins/x ... *​/` does not survive as a "path" hit.
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .map((line) => line.replace(/\s*#.*$/, "").replace(/\s*\/\/.*$/, ""))
      .join("\n")

  /** THE WORDS A FILE OUTSIDE `packages/plugins/` MAY SPELL, and why — the
   *  record held as an EQUALITY. `//`-prefixed keys are reasons, skipped by the
   *  assertions; real keys are corpus files, values the plugin words it may
   *  spell. */
  const ALLOWED: Record<string, ReadonlyArray<string> | string> = {
    "// nix/kolu.nix": "the framework's surface pin shares the tenant's word kolu",
    "nix/kolu.nix": ["kolu", "mcp"],
    "// justfile": "kolu-deps names the framework pin; git/odu are tool names, files/pins are recipe names",
    justfile: ["git", "kolu", "odu", "files", "pins"],
    "// default.nix": "kolu is the framework pin; pins is the bundle's fold vocabulary; the comments enumerate the wrapper-baked knobs (OLAI_ACP_*, OLAI_ODU_BIN, OLAI_HIMALAYA) so the wrap text explains itself",
    "default.nix": ["claude#knob", "codex#knob", "pi#knob", "kolu", "odu#knob", "mail#knob", "pins"],
    "// flake.nix": "the flake folds plugin Nix halves as flake outputs through the fold (kolu is the npins source name); the e2e shell names nixpkgs' `playwright-mcp` for the browsing row's live scenarios",
    "flake.nix": ["kolu", "mcp"],
    "// packages/bundle/default.nix": "the bundle fold names the framework's surface pin and the bundle's pin vocabulary",
    "packages/bundle/default.nix": ["kolu", "pins"],
    "// packages/bundle/nix/fold-check.nix": "asserts fixture containers named after bundle vocabulary",
    "packages/bundle/nix/fold-check.nix": ["pins"],
    "// nix/home/*.nix": "home-manager module's option names (a user's outlines directory) and one mention of a plugin by word (opencode's env key in an error string)",
    "nix/home/check.nix": ["settings", "outlines"],
    "nix/home/module.nix": ["opencode", "outlines"],
    "// scripts/check-hydrated-deps.sh": "names the pins directory the framework hydrate writes into",
    "scripts/check-hydrated-deps.sh": ["pins"],
    "// scripts/cordis-graph.ts": "walks plugin words to draw the cordis graph",
    "scripts/cordis-graph.ts": ["ui-renderer", "layout"],
    "// scripts/test-shard.sh": "spells the git CLI and one odu-shaped perf bucket; per-member heavy-test weights come from each member's own test-weights.json",
    "scripts/test-shard.sh": ["git", "odu", "files"],
    "// shell.nix": "the dev shell carries OLAI_KOLU_HYDRATE / OLAI_KOLU_EXTERNALS — harness constants outside any plugin's `olai.knobs`; the vault's OSS_OLAI_VAULT workspace import does not match `OLAI_VAULT` and is not a knob spelling",
    "shell.nix": ["kolu", "pins"],
    "// packages/tests/support/hooks.ts": "the e2e harness's per-tag setup spells the plugins its scenario tags drive (`@alerts`, `@markdown-paints`), the tool suites it exercises (git, files, search, capture), and the worker constants it seeds; its comments name OLAI_HIMALAYA so the mail row's knob counts",
    "packages/tests/support/hooks.ts": ["alerts", "git", "search", "kolu", "odu", "mail", "mail#knob", "files", "capture", "markdown"],
    "// packages/tests/support/workers.ts": "the e2e harness's isolation loop reads the fold-derived KNOBS list and deletes every declared knob the wrapper could have baked; the mail row's door names travel beside it",
    "packages/tests/support/workers.ts": ["git", "odu", "mail", "mail#knob"],
  }

  /** The word, spelled the way a path identifier or a variable is written. The
   *  SHOUTED casing carries no leading `\b`, and that is the deliberate
   *  widening: a macro or a capital run sits after an underscore
   *  (`OLAI_ODU_BIN`), where a `\b`-anchored pattern sees no boundary. */
  const casings = (name: string): ReadonlyArray<string> => {
    const capital = `${name.charAt(0).toUpperCase()}${name.slice(1)}`
    return [
      `\\b${name}(?![a-z0-9])`,
      ...(capital === name ? [] : [`\\b${capital}(?![a-z0-9])`]),
      `\\b${name.toUpperCase()}(?![A-Z0-9])`,
    ]
  }
  const SPELLING = new Map(PLUGIN_NAMES.map((name) => [name, new RegExp(casings(name).join("|"))]))

  test("the corpus is walked, and it is not the whole tree", () => {
    expect(corpus.length).toBeGreaterThan(10)
    expect(corpus).toContain("packages/bundle/default.nix")
    expect(corpus.some((file) => file.startsWith("scripts/"))).toBe(true)
  })

  test("claim 1: no file outside packages/plugins contains the path itself", () => {
    const PATH_ALLOWED: Record<string, true> = {
      "packages/bundle/default.nix": true,
      "scripts/cordis-graph.ts": true,
    }
    const offenders = corpus.filter((file) => PATH_ALLOWED[file] !== true && stripped(file).includes("packages/plugins/"))
    expect(offenders).toEqual([])
  })

  test("every recorded allowance names a real corpus file and a real plugin word", () => {
    for (const [file, words] of Object.entries(ALLOWED)) {
      if (file.startsWith("//")) continue
      expect([file, corpus.includes(file)]).toEqual([file, true])
      for (const word of words) {
        const base = word.endsWith("#knob") ? word.slice(0, -"#knob".length) : word
        expect([word, PLUGIN_NAMES.includes(base)]).toEqual([word, true])
      }
    }
  })

  test("claim 2: no file outside packages/plugins spells a plugin's word", () => {
    // The equality claim, over every corpus file at once so one moved file
    // cannot mask a second breach. The record holds BARE-WORD spellings; the
    // env-shaped knob `OLAI_<NAME>_*` is tracked SEPARATELY as `"<name>#knob"`
    // because a plugin's knob in a root file is its own defect.
    const HARNESS: Record<string, true> = {
      "packages/tests/support/fake.ts": true,
      "packages/tests/agent/scripted-acp.ts": true,
      "packages/tests/agent/command.ts": true,
      "packages/tests/agent/session-store.ts": true,
      "packages/tests/agent/native-activity.ts": true,
    }
    // The knobs live in the manifests — `olai.knobs`'s keys are the exact
    // `OLAI_*` variables a plugin owns.
    const knobEntries: Array<{ name: string; knobs: RegExp }> = PLUGIN_NAMES.map((name) => {
      const pkgPath = path.join(REPO, "packages/plugins", name, "package.json")
      if (!existsSync(pkgPath)) return { name, knobs: /$^/ }
      const manifest = JSON.parse(readFileSync(pkgPath, "utf8")) as { olai?: { knobs?: Record<string, unknown> } }
      const keys = Object.keys(manifest.olai?.knobs ?? {})
      if (keys.length === 0) return { name, knobs: /$^/ }
      return { name, knobs: new RegExp(`(?:^|[^A-Za-z0-9])(?:${keys.join("|")})(?![A-Z0-9])`) }
    })
    const actual = Object.fromEntries(
      corpus.map((file) => {
        if (HARNESS[file] === true) return [file, []]
        // Bare words live in code: comments are stripped so `# what koluDeps`
        // does not count as a spelling of `kolu`. A knob's exact name keeps the
        // comments too — `OLAI_ODU_BIN` is a token nobody spells without
        // meaning the variable.
        const text = stripped(file)
        const raw = readFileSync(path.join(REPO, file), "utf8")
        const hits = PLUGIN_NAMES.flatMap((name) => {
          const out: string[] = []
          if (SPELLING.get(name)!.test(text)) out.push(name)
          const entry = knobEntries.find((e) => e.name === name)
          if (entry && entry.knobs.test(raw)) out.push(`${name}#knob`)
          return out
        })
        return [file, hits]
      }),
    )
    const expected = Object.fromEntries(
      corpus.map((file) => [
        file,
        [...(typeof ALLOWED[file] === "string" ? [] : (ALLOWED[file] ?? []))],
      ]),
    )
    expect(actual).toEqual(expected)
  })
})

/**
 * THE COLLISION RECORDS ARE THE DOOR'S INPUT, and this is the half the door
 * cannot check: a recorded file must still be a file this build has. The door
 * holds the counts (an equality per file, red when a word grows or goes), so a
 * record naming a file nobody has any more is an exception nobody can retire —
 * and it would forgive the next breach in that package in silence.
 */
describe("every collision record names files that exist", () => {
  test("no record is a note about a file nobody has", () => {
    const missing = Object.entries(DECLARATION.collisions ?? {}).flatMap(([row, files]) =>
      Object.keys(files)
        .filter((file) => !existsSync(path.join(REPO, file)))
        .map((file) => `${row}: ${file}`),
    )
    expect(missing).toEqual([])
  })

  test("every record is a member's own file, and every row is a row", () => {
    for (const member of MEMBERS) {
      const at = RECORD_OF(member)
      if (!existsSync(at)) continue
      const said = JSON.parse(readFileSync(at, "utf8")) as Record<string, unknown>
      for (const [row, files] of Object.entries(said)) {
        if (row.startsWith("//")) continue
        expect([row, PLUGIN_NAMES.includes(row)]).toEqual([row, true])
        for (const file of Object.keys(files as Record<string, number>)) {
          // RELATIVE, and inside the member: a record that could name somebody
          // else's file would be one table again with extra steps.
          expect([file, file.startsWith("/") || file.split("/").includes("..")]).toEqual([file, false])
        }
      }
    }
  })
})
