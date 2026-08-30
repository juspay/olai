/**
 * THE FENCE — that core does not know a plugin's name, held as claims a test
 * can be red about.
 *
 * ## Why a test and not a shell script
 *
 * The two fences this joins (`scripts/check-kolu-deps.sh`,
 * `scripts/check-odu-deps.sh`) end in `rg … 2>/dev/null || true` over
 * `packages/<name>/src`, and both halves of that are hazards this file declines to
 * inherit. `ripgrep` is not in the dev shell's package list, so on a machine
 * without an ambient one the redirect turns "command not found" into an empty
 * result and a GREEN fence — a fence that passes by failing to run is worse
 * than none. And `packages/<name>/src` misses `packages/tests` entirely, which is
 * the only member with no `src/`, which is how four product-tier `@kolu/*`
 * imports have been sitting in its geometry harness with `just check` green.
 *
 * A test runs under the pinned bun, walks the PACKAGE rather than its `src`,
 * and reads an import two ways — the shape `@olai/acp`'s manifest test already
 * is, and this file is that test one boundary over.
 *
 * ## What it claims
 *
 *   1. **Only `@olai/plugins` names a plugin.** Held as an EQUALITY per
 *      package — `[]` for every general one — and never as a filtered list
 *      asserted empty: a pattern that rotted would report nothing found and
 *      pass, which is the failure mode the sweeps in `@olai/tests` were
 *      written after two days of exactly it.
 *   2. **No plugin imports another plugin**, and none imports `@olai/plugins`.
 *      The second is what keeps the direction a DAG the manifests express: the
 *      registry imports every plugin, so a plugin that imported back would be
 *      a cycle, and the manifests are where that is refused rather than here.
 *      This holds the SOURCES to the same answer the manifests give.
 *   3. **A plugin is a SIBLING, and core computes none of its addresses.**
 *      Each plugin composes under its own name, no two share one, and a name
 *      is a legal tag segment because it becomes one. The framework would
 *      catch a collision at boot with a duplicate-tag throw; here it is a test,
 *      in a process that has not started yet.
 *   4. **The wire door stays a wire door.** What a composition root reaches
 *      through `@olai/plugins/wire` may not pull a UI runtime onto the
 *      server's graph or an appliance's client onto the browser's — the same
 *      claim `check-kolu-deps.sh`'s fifth assertion makes about the slice one
 *      floor down, made here about the door that composes them.
 *   5. **...and the server door stays a server door.** What `@olai/server`
 *      reaches through `@olai/plugins/server` MAY pull an appliance's client,
 *      the vault's format and a `node:` builtin — that is what a runtime half
 *      is made of — and may not pull a browser face onto the graph of a
 *      process that renders nothing. It is the complement of claim 4 rather
 *      than a repetition of it, and the two together are why there are three
 *      doors.
 *
 * ## What it deliberately does NOT claim
 *
 * That no file anywhere SPELLS the word. Prose that names a package is not a
 * dependency, and a fence that failed on a comment is a fence people learn to
 * work around — which is `check-kolu-deps.sh`'s own ruling and is kept. The
 * companion sweep over what a general package spells in CODE lives in
 * `@olai/tests`, which is the only package above all the others; a sweep here
 * reading the browser would be the floor reading the roof.
 */

import { readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import { PLUGIN_NAMES, WIRES } from "./surfaces.ts"

const PACKAGES = path.join(import.meta.dirname, "..", "..")

/** This package, and the plugins it is allowed to name. Spelled as directory
 *  names because that is what the walk below has; the manifest names are
 *  derived from them so one rename moves both. */
const REGISTRY = "plugins"
const PLUGIN_DIRS = PLUGIN_NAMES.map((name) => `plugin-${name}`)

/** Every import specifier, by POSITION rather than by statement, so a braced
 *  list broken across lines — this tree's dominant style — is seen. Prose
 *  spelling one of those forms is seen too, which is the right direction to be
 *  wrong in: an extra specifier fails a boundary claim rather than passing
 *  one. `@olai/acp`'s manifest test argues this at length and this is its
 *  reading, unchanged. */
const specifiersOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*|\brequire\(\s*)["']([^"'\n]+)["']/gm)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

/** ...and a stylesheet's own door, which the two TypeScript readings are blind
 *  to. It is not hypothetical: `@olai/web`'s `styles.css` reaches
 *  `@olai/kolu-ui/all.css` today, and a plugin's sheet is exactly how a face
 *  gets its layout (`all.css`'s header says what a missed `@source` costs —
 *  the components render with no layout at all and nothing errors). */
const cssImportsOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/^\s*@import\s+["']([^"']+)["']/gm)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

/** Every source under one package, skipping `node_modules` BEFORE descending.
 *
 *  Refusing the DIRECTORY rather than its files, which is `@olai/acp`'s fix
 *  for its own `ELOOP`: a workspace `node_modules` is full of symlinks back to
 *  sibling packages, each with a `node_modules` of its own, so a walk that
 *  filters the results has already gone in. */
const sourcesUnder = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : sourcesUnder(path.join(dir, entry.name))
    }
    return entry.isFile() && /\.(tsx?|css)$/.test(entry.name)
      ? [path.join(dir, entry.name)]
      : []
  })

interface Named {
  /** Root-relative, so a failure reads as a path somebody can open. */
  readonly file: string
  /** Every plugin specifier this file reaches for, by any of the three doors. */
  readonly plugins: ReadonlyArray<string>
}

/** Does this specifier name a plugin package — the bare name or a subpath
 *  under it. A claim that matched only the bare name would be green under
 *  `@olai/plugin-kolu/wire`, which is the door every consumer would actually
 *  use. */
const namesAPlugin = (spec: string): boolean =>
  PLUGIN_NAMES.some((name) =>
    spec === `@olai/plugin-${name}` || spec.startsWith(`@olai/plugin-${name}/`)
  )

/** Every package's sources, read once, each with what it reaches for. */
const tree: ReadonlyMap<string, ReadonlyArray<Named>> = new Map(
  readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((pkg) => [
      pkg.name,
      sourcesUnder(path.join(PACKAGES, pkg.name)).map((file): Named => {
        // A scripted agent opens with a shebang; the line holds no import.
        const text = readFileSync(file, "utf8").replace(/^#![^\n]*\n/, "")
        const found = file.endsWith(".css") ? cssImportsOf(text) : specifiersOf(text)
        return {
          file: path.relative(PACKAGES, file),
          plugins: found.filter(namesAPlugin),
        }
      }),
    ]),
)

/** ...and every package's MANIFEST, which is the fourth door and the one no
 *  reading of a source can see: `workspace:*` is how a dependency is really
 *  declared, and a package that dropped the import but kept the line is a
 *  package still standing on the wrong side of the wall. */
const declaredBy = (pkg: string): ReadonlyArray<string> => {
  const manifest = path.join(PACKAGES, pkg, "package.json")
  let text: string
  try {
    text = readFileSync(manifest, "utf8")
  } catch {
    return []
  }
  const json = JSON.parse(text) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }
  return Object.keys({
    ...json.dependencies,
    ...json.devDependencies,
    ...json.peerDependencies,
  }).filter(namesAPlugin)
}

const packages = [...tree.keys()].sort()

// ── the wire door's closure ────────────────────────────────────────────
//
// A WALK, not one file's text, and it has to be: `./wire.ts` is one ESM
// module, so what a listener evaluates when it reads the surface is its whole
// closure — and the incident `@olai/tests`' import fence exists to not have
// re-learned is exactly that a single re-export one module in is invisible to
// a reading of the door itself.
//
// It crosses PACKAGE boundaries, which that fence deliberately does not
// ("another package's discipline is another package's fence"). Here the
// crossing is the point: the graph this door opens runs `@olai/plugins/wire`
// → each plugin's `./wire` → each appliance client's `./wire`, and what the
// claim is about is where it STOPS.

/** What a workspace specifier resolves to, read off the named package's own
 *  `exports` map rather than guessed — a subpath is a door a manifest opened,
 *  and resolving it by string arithmetic would be this test inventing a second
 *  module resolver. `undefined` for anything that is not a workspace sibling,
 *  which is where the walk stops. */
const resolveWorkspace = (spec: string): string | undefined => {
  const match = /^@olai\/([^/]+)(?:\/(.+))?$/.exec(spec)
  if (match === null || match[1] === undefined) return undefined
  const dir = path.join(PACKAGES, match[1])
  let manifest: { exports?: Record<string, string>; main?: string }
  try {
    manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as typeof manifest
  } catch {
    return undefined
  }
  const door = match[2] === undefined ? "." : `./${match[2]}`
  const target = manifest.exports?.[door] ?? (door === "." ? manifest.main : undefined)
  return target === undefined ? undefined : path.join(dir, target)
}

/** One transpiler per grammar — the `ts` loader refuses JSX. The walk reads
 *  imports the RUNTIME's way (`scanImports`) rather than by position, and
 *  that is the difference between this reading and the one above it: a
 *  positional match over-includes, which fails CLOSED for "does anything
 *  reach for X" and fails OPEN for a WALK — an `@olai/surface` spelled inside
 *  a comment in `@olai/kolu-client/wire` sent the first draft of this walk
 *  straight into a package the door does not reach. `scanImports` sees no
 *  comments and elides type-only imports, which is the right instrument for a
 *  claim about what a listener actually EVALUATES. */
const transpilers = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
} as const
const runtimeImportsOf = (file: string, text: string): ReadonlyArray<string> =>
  transpilers[file.endsWith(".tsx") ? "tsx" : "ts"]
    .scanImports(text)
    .map((found) => found.path)

/** Every module the door reaches, and every specifier each of them evaluates. */
const walkFrom = (entry: string): ReadonlyArray<{ file: string; spec: string }> => {
  const seen = new Set<string>()
  const reached: Array<{ file: string; spec: string }> = []
  const visit = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)
    let text: string
    try {
      text = readFileSync(file, "utf8")
    } catch {
      return
    }
    for (const spec of runtimeImportsOf(file, text)) {
      const rel = path.relative(PACKAGES, file)
      reached.push({ file: rel, spec })
      const next = spec.startsWith(".")
        ? path.normalize(path.join(path.dirname(file), spec))
        : resolveWorkspace(spec)
      if (next !== undefined) visit(next)
    }
  }
  visit(entry)
  return reached
}

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

describe("the wire door stays a wire door", () => {
  const reached = walkFrom(path.join(PACKAGES, "plugins", "src", "wire.ts"))

  test("the walk actually crossed into both plugins", () => {
    // Not vacuous: a resolver that answered `undefined` for every workspace
    // specifier would walk one file and pass every claim below.
    const files = new Set(reached.map((one) => one.file))
    for (const name of PLUGIN_NAMES) {
      expect([...files].some((f) => f.startsWith(`plugin-${name}${path.sep}`)), name).toBe(true)
    }
  })

  test("nothing on it is a UI runtime, an appliance's client, or the format", () => {
    const bad = reached
      .filter((one) => FORBIDDEN.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
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
  /^@olai\/kolu-ui(\/|$)/,
] as const

describe("the server door pulls no browser face", () => {
  const reached = walkFrom(path.join(PACKAGES, "plugins", "src", "server.ts"))

  test("the walk actually crossed into both plugins' server halves", () => {
    // Not vacuous, for the wire door's reason: a resolver that answered
    // `undefined` for every workspace specifier would walk one file and pass.
    const files = new Set(reached.map((one) => one.file))
    for (const name of PLUGIN_NAMES) {
      expect([...files].some((f) => f === path.join(`plugin-${name}`, "src", "server.ts")), name)
        .toBe(true)
    }
  })

  test("nothing on it is a UI runtime or a component library", () => {
    const bad = reached
      .filter((one) => NOT_ON_A_SERVER.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
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

  test("no package outside packages/plugins imports a plugin", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      const reached = tree.get(pkg)?.flatMap((s) => s.plugins.map((p) => `${s.file}: ${p}`)) ?? []
      // An EQUALITY against the empty list, never a length on a filter: a
      // pattern that rotted would report nothing and pass.
      expect(reached, pkg).toEqual([])
    }
  })

  test("no package outside packages/plugins declares a plugin in its manifest", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      expect(declaredBy(pkg), pkg).toEqual([])
    }
  })

  test("the registry declares every plugin it imports, and no other", () => {
    const reached = new Set(tree.get(REGISTRY)?.flatMap((s) => s.plugins) ?? [])
    for (const spec of reached) expect(namesAPlugin(spec), spec).toBe(true)
    expect([...declaredBy(REGISTRY)].sort()).toEqual(
      [...PLUGIN_NAMES].map((name) => `@olai/plugin-${name}`).sort(),
    )
  })

  test("a plugin imports neither another plugin nor the registry", () => {
    for (const dir of PLUGIN_DIRS) {
      const own = `@olai/${dir}`
      const foreign = tree.get(dir)?.flatMap((s) =>
        s.plugins.filter((p) => p !== own && !p.startsWith(`${own}/`)).map((p) => `${s.file}: ${p}`)
      ) ?? []
      expect(foreign, dir).toEqual([])
      // The registry imports every plugin, so a plugin importing it back is
      // the cycle the manifests decline to express. Held over the sources too,
      // because a type-only import is a cycle a bundler forgives and a reader
      // does not.
      const back = tree.get(dir)?.flatMap((s) => {
        const text = readFileSync(path.join(PACKAGES, s.file), "utf8")
        return specifiersOf(text)
          .filter((spec) => spec === "@olai/plugins" || spec.startsWith("@olai/plugins/"))
          .map((spec) => `${s.file}: ${spec}`)
      }) ?? []
      expect(back, dir).toEqual([])
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

  test("no package but the browser imports `@olai/plugins` itself", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY || pkg === RENDERER) continue
      const reached = tree.get(pkg)?.flatMap((s) => {
        const text = readFileSync(path.join(PACKAGES, s.file), "utf8")
        const found = s.file.endsWith(".css") ? cssImportsOf(text) : specifiersOf(text)
        // The BARE specifier alone. A subpath is the supported reach and is
        // deliberately not matched — a claim that caught `@olai/plugins/wire`
        // would forbid the door this whole split exists to offer.
        return found.filter((spec) => spec === "@olai/plugins").map(() => s.file)
      }) ?? []
      expect(reached, pkg).toEqual([])
    }
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
