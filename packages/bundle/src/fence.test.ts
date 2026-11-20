import { existsSync, readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import { CLAIMS, fence } from "@olai/effect-cordis/fence"

import { DECLARATION, RECORD_OF, RUNTIMES } from "./fence.testlib.ts"
import { BUNDLE_NAMES as PLUGIN_NAMES, ROWS } from "./rows.ts"
import {
  codeIn,
  cssImportsOf,
  dependencyNames,
  doorsOf,
  edgesOf,
  graphFrom,
  manifestOf,
  MEMBER_OF_PACKAGE,
  mainOf,
  MEMBERS,
  memberOf,
  type Named,
  packageOf,
  PACKAGES,
  REPO,
  ROOT_DECLARED,
  specifiersOf,
  TREE,
  transpilers,
  type TreeGraph,
  walkFrom,
} from "./tree.testlib.ts"

const perRun = <T>(read: (key: string) => T): ((key: string) => T) => {
  const held = new Map<string, T>()
  return (key) => {
    if (held.has(key)) return held.get(key)!
    const found = read(key)
    held.set(key, found)
    return found
  }
}
const graphAt = perRun(graphFrom)
const sourceAt = perRun((file) => readFileSync(path.join(PACKAGES, file), "utf8"))
const transpiledAt = perRun((file) =>
  transpilers[file.endsWith(".tsx") ? "tsx" : "ts"].transformSync(sourceAt(file)),
)
const runtimeImportsAt = perRun((file) => edgesOf(file, sourceAt(file)).map((one) => one.spec))

const REGISTRY = MEMBER_OF_PACKAGE.get("@olai/bundle") ??
  (() => {
    throw new Error("fence: `@olai/bundle` is not a workspace member, so there is no registry to fence")
  })()

const INTERFACE = MEMBER_OF_PACKAGE.get("@olai/plugin-api") ??
  (() => {
    throw new Error("fence: `@olai/plugin-api` is not a workspace member, so there is no interface to fence")
  })()

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

const staticDoors = (pkg: string): ReadonlyArray<string> => {
  const member = MEMBER_OF_PACKAGE.get(pkg)
  if (member === undefined) return []
  const manifest = manifestOf(member) as { readonly olai?: { readonly contracts?: readonly string[] } } | undefined
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
  const manifest = manifestOf(member)
  return staticDoors(pkg).flatMap((door) => {
    const target = manifest === undefined ? undefined : doorsOf(manifest)[door]
    return target ? [path.resolve(PACKAGES, member, target)] : []
  })
}

const CONTAINER = "plugins"

const namesAPlugin = (spec: string): boolean => PLUGIN_PACKAGES.includes(packageOf(spec))

interface Read extends Named {
  readonly plugins: ReadonlyArray<string>
}

const tree: ReadonlyMap<string, ReadonlyArray<Read>> = new Map(
  MEMBERS.map((member) => [
    member,
    TREE.sources
      .filter((source) => TREE.memberOf(source.file) === `packages/${member}`)
      .map((source): Read => {
        const specs = TREE.specifiersOf(source.file)
        return {
          file: path.relative(PACKAGES, path.join(REPO, source.file)),
          grammar: source.grammar,
          specs,
          plugins: specs.filter(namesAPlugin),
        }
      }),
  ]),
)

const declaredBy = (pkg: string): ReadonlyArray<string> => dependencyNames(manifestOf(pkg)).filter(namesAPlugin)

const packages = [...tree.keys()].sort()

const componentsOn = (door: { files: ReadonlyArray<string> }): ReadonlyArray<string> =>
  door.files.filter((file) => file.endsWith(".tsx"))

const BROWSER_DOOR = graphFrom(path.join(PACKAGES, REGISTRY, "src", "rows.ts"))

const BROWSER_TENANTS = TENANTS_OF.flatMap((tenant) => {
  const manifest = manifestOf(tenant.dir)
  const target = manifest === undefined ? undefined : doorsOf(manifest)["./browser"]
  return target === undefined ? [] : [{ ...tenant, target }]
})
const BROWSER_DOORS: ReadonlyArray<{ readonly name: string; readonly door: Door }> = BROWSER_TENANTS.map(
  (tenant) => ({ name: tenant.name, door: graphFrom(path.join(PACKAGES, tenant.dir, tenant.target)) }),
)

type Door = TreeGraph

const NOT_IN_A_TAB = [
  /^node:/,
  /^@odu\//,
  /^@kolu\/padi-client(\/|$)/,
  /^@olai\/surface\/projection$/,
] as const

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

const FORBIDDEN = [
  /^solid-js(\/|$)/,
  /^@olai\/format(\/|$)/,
  /^node:/,
  /^@kolu\/(padi-client|terminal-vocab|solid-dockrow|solid-statepip|detect)(\/|$)/,
  /^@xterm\//,
  /^@odu\//,
] as const

const NOT_ON_A_SERVER = RUNTIMES

const DOOR = fence(DECLARATION)

describe("the fence's five generic claims", () => {
  for (const claim of CLAIMS) {
    test(`${claim}`, () => {
      expect(DOOR.red(claim)).toEqual([])
    })
  }

  test("the declaration is not a reading of nothing", () => {
    const reading = DOOR.reading
    expect(reading.rows).toBe(PLUGIN_NAMES.length)
    expect(Object.keys(DECLARATION.rows).sort()).toEqual([...PLUGIN_NAMES].sort())
    expect(DECLARATION.roots.length).toBe(2)
    expect(reading.members).toBeGreaterThan(15)
    expect(reading.production).toBeGreaterThan(300)
    expect(reading.compiled).toBeGreaterThan(300)
    expect(reading.doors).toBeGreaterThan(200)
    expect(reading.onARootWalk).toBeGreaterThan(100)
    expect(reading.registry).toBe(path.join("packages", REGISTRY))
  })

  test("no product source opens the door", () => {
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

describe("the browser's door names every browser export and imports none", () => {
  const reached = BROWSER_DOOR.reached

  test("it spells exactly the browser exports, in specifiers a bundler can split on", () => {
    const named = new Set(reached.filter((one) => namesAPlugin(one.spec)).map((one) => one.spec))
    expect([...named].sort()).toEqual(BROWSER_TENANTS.map((tenant) => `${tenant.pkg}/browser`).sort())
  })

  test("...and the walk did NOT cross into any of them", () => {
    const files = new Set(reached.map((one) => one.file))
    const crossed = [...files].filter((file) => PLUGIN_DIRS.some((dir) => file.startsWith(`${dir}${path.sep}`)))
    expect(crossed.sort()).toEqual([])
  })

  test("the walk resolved every edge it followed", () => {
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

describe("a plugin's browser chunk stays a browser chunk", () => {
  test("the walk crossed into every tenant's faces, and resolved every edge", () => {
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
    expect(SERVER_DOOR.files.length).toBeGreaterThan(10)
    const tenant = TENANTS_OF[0]
    if (tenant === undefined) throw new Error("fence: this build has no plugins")
    const faces = graphFrom(path.join(PACKAGES, tenant.dir, "src", "browser.tsx"))
    expect(faces.unresolved).toEqual([])
    expect(componentsOn(faces).length).toBeGreaterThan(0)
  })

  test("it DOES reach each appliance's client, which is the point of the door", () => {
    const specs = new Set(reached.map((one) => one.spec))
    expect(specs.has("olai-plugin-kolu/appliance")).toBe(true)
    expect(specs.has("olai-plugin-odu/appliance")).toBe(true)
  })
})

describe("packages/plugins is the tenant container, and holds nothing else", () => {
  test("every plugin the registry names lives in it, and nothing else does", () => {
    const inside = readdirSync(path.join(PACKAGES, CONTAINER), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(CONTAINER, entry.name))
      .sort()
    expect(inside).toEqual([...PLUGIN_DIRS].sort())
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
      const declared = dependencyNames(manifestOf(pkg)).filter((spec) => packageOf(spec) === "@olai/state")
      expect(reached, pkg).toEqual([])
      expect(declared, pkg).toEqual([])
    }
  })
})

describe("only the registry knows a plugin's name", () => {
  test("the sweep is actually reading the repository", () => {
    const files = [...tree.values()].flat().length
    expect(packages.length).toBeGreaterThan(15)
    expect(files).toBeGreaterThan(400)
  })

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
      "server/src/vault-policy-lifetime.test.ts: olai-plugin-vault/testlib",
      "server/src/who.test.ts: olai-plugin-identity/who",
    ],
  }
  const TESTLIB_DECLARED: Readonly<Record<string, ReadonlyArray<string>>> = {
    tests: ["olai-plugin-chat", "olai-plugin-kolu", "olai-plugin-mail", "olai-plugin-odu", "olai-plugin-outlines"],
    server: ["olai-plugin-git", "olai-plugin-identity", "olai-plugin-mcp", "olai-plugin-vault", "olai-plugin-web-app"],
  }

  test("plugins consume other plugins only through static contract doors", () => {
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
        const manifest = manifestOf(provider!)
        const target = manifest === undefined ? undefined : doorsOf(manifest)[`.${spec.slice(packageOf(spec).length)}`]
        expect(target, spec).toBeDefined()
        const graph = graphAt(path.join(PACKAGES, provider!, target!))
        expect(graph.unresolved, spec).toEqual([])
        const bad = graph.files.filter((file) => {
          const absolute = path.resolve(PACKAGES, file)
          const member = memberOf(file)
          if (!member || !PLUGIN_DIRS.includes(member)) return false
          const pkg = manifestOf(member)?.name
          if (typeof pkg !== "string") return true
          const targets = staticTargets(pkg)
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
  }, { timeout: 60_000 })

  test("general production packages name no plugins; test readers use explicit static doors", () => {
    for (const pkg of packages) {
      if (pkg === REGISTRY) continue
      if (PLUGIN_DIRS.includes(pkg)) continue
      const reached = tree.get(pkg)?.flatMap((s) =>
        s.plugins
          .filter((p) => !/\.(?:test|browsertest|testlib)\.tsx?$/.test(s.file) || !staticDoor(p))
          .map((p) => `${s.file}: ${p}`),
      ) ?? []
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
              (name) => name !== manifestOf(pkg)?.name,
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

describe("the root door is opened by packages that render nothing", () => {
  const RENDERER = "web"

  test("more than the renderer opens `@olai/bundle`, and that is the point", () => {
    const openers = packages.filter(
      (pkg) => pkg !== REGISTRY && (tree.get(pkg) ?? []).some((s) => s.specs.includes("@olai/bundle")),
    )
    expect(openers.length).toBeGreaterThan(0)
    const headless = openers.filter((pkg) => pkg !== RENDERER)
    expect(headless.length, openers.join(", ")).toBeGreaterThan(0)
  })

  test("the services door pulls no browser face", () => {
    const door = graphFrom(path.join(PACKAGES, INTERFACE, "src", "services.ts"))
    expect(door.unresolved).toEqual([])
    const bad = door.reached
      .filter((one) => NOT_ON_A_SERVER.some((rule) => rule.test(one.spec)))
      .map((one) => `${one.file}: ${one.spec}`)
    expect([...new Set(bad)].sort()).toEqual([])
    expect(componentsOn(door)).toEqual([])
    expect(door.files.length).toBeGreaterThan(1)
  })
})

describe("a plugin is a sibling, and core computes none of its addresses", () => {
  test("a plugin's name is a legal tag segment, because it becomes one", () => {
    for (const name of PLUGIN_NAMES) {
      expect([name, /^[a-z][a-z0-9-]*$/.test(name)]).toEqual([name, true])
    }
    expect(new Set(PLUGIN_NAMES).size, PLUGIN_NAMES.join(", ")).toBe(PLUGIN_NAMES.length)
  })
})

const FRAMEWORK = /^@kolu\/(acp(-claude|-client|-harness)?|child|surface(-[a-z]+)*)(\/|$)/

const BRIDGE = "effect-cordis"
const ENGINE = /^(?:cordis|@cordisjs\/plugin-[a-z]+)(\/|$)/

const isHydrated = (pkg: string, spec: string, own: ReadonlySet<string>): boolean => {
  if (spec.startsWith(".") || spec.startsWith("/")) return false
  if (spec.startsWith("node:") || spec.startsWith("bun:") || spec === "bun") return false
  if (spec.startsWith("@olai/")) return false
  if (FRAMEWORK.test(spec)) return false
  if (pkg === BRIDGE && ENGINE.test(spec)) return false
  const name = packageOf(spec)
  if (ROOT_DECLARED.has(name) || own.has(name)) return false
  return existsSync(path.join(REPO, "node_modules", name))
}

const hydratedIn = (pkg: string): ReadonlyArray<string> => {
  const own = new Set(dependencyNames(manifestOf(pkg)))
  return (tree.get(pkg) ?? [])
    .flatMap((source) =>
      [...new Set(source.specs)].filter((spec) => isHydrated(pkg, spec, own)).map((spec) => `${source.file}: ${spec}`),
    )
    .sort()
}

const codeDoorsOf = (dir: string): ReadonlyArray<string> => {
  const manifest = manifestOf(dir)
  if (manifest === undefined) return []
  const targets = [...Object.values(doorsOf(manifest)), mainOf(manifest) ?? ""]
  return [...new Set(targets)].filter((t) => /\.tsx?$/.test(t)).map((t) => path.join(dir, t))
}

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

const GENERAL_REACH: ReadonlySet<string> = new Set(
  packages
    .filter((pkg) => pkg !== REGISTRY && !PLUGIN_DIRS.includes(pkg))
    .flatMap((pkg) => [...reachedBy(codeDoorsOf(path.join(PACKAGES, pkg)))])
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

const TIERS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  [...TENANTS].map(([name, members]) => [
    name,
    new Set([...members].flatMap((pkg) => hydratedIn(pkg).map((line) => packageOf(line.split(": ")[1] ?? "")))),
  ]),
)

const TENANT_MEMBERS: ReadonlySet<string> = new Set([...TENANTS.values()].flatMap((m) => [...m]))

const DEBT: Readonly<Record<string, ReadonlyArray<string>>> = {}

describe("an appliance's product tier stays inside its tenant", () => {
  test("the tenants are exactly what is written down here", () => {
    expect(Object.fromEntries([...TENANTS].map(([name, members]) => [name, [...members].sort()]))).toEqual(
      Object.fromEntries(TENANTS_OF.map(({ name, dir }) => [name, [dir]])),
    )
    expect(
      Object.fromEntries([...TENANTS_OF].map(({ name }) => [name, (TIERS.get(name) ?? new Set()).size > 0])),
    ).toEqual(Object.fromEntries(TENANTS_OF.map(({ name }) => [name, ["kolu", "odu"].includes(name)])))
  })

  test("Cordis is an engine nobody outside one package sees", () => {
    const naming = packages.filter((pkg) => (tree.get(pkg) ?? []).some((source) => source.specs.some((spec) => ENGINE.test(spec))))
    expect(naming).toEqual([BRIDGE])
    expect(packages).toContain(BRIDGE)
    for (const pkg of packages) {
      expect(dependencyNames(manifestOf(pkg)).filter((one) => ENGINE.test(one)), pkg).toEqual([])
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
    const tiers = new Set([...TIERS.values()].flatMap((t) => [...t]))
    for (const pkg of packages) {
      if (TENANT_MEMBERS.has(pkg)) continue
      expect(dependencyNames(manifestOf(pkg)).filter((d) => tiers.has(d)), pkg).toEqual([])
    }
  })

  test("no tenant names another appliance's tier", () => {
    for (const [name, tier] of TIERS) {
      for (const [other, theirs] of TIERS) {
        if (other === name) continue
        expect([...tier].filter((one) => theirs.has(one)).sort(), `${name} vs ${other}`).toEqual([])
      }
    }
  })

  test("the composed doors reach every tenant door named `./wire`", () => {
    const reached = new Set(SERVER_DOOR.files)
    const wireDoors = [...TENANT_MEMBERS]
      .flatMap((pkg) => {
        const manifest = manifestOf(pkg)
        if (manifest === undefined) return []
        const doors = doorsOf(manifest)
        return (["./wire", "./appliance/wire"] as const)
          .filter((door) => doors[door] !== undefined)
          .map((door) => path.join(pkg, doors[door]!))
      })
      .sort()
    const applianceWires = [...TENANT_MEMBERS].filter((pkg) => {
      const manifest = manifestOf(pkg)
      return manifest !== undefined && doorsOf(manifest)["./appliance/wire"] !== undefined
    })
    expect(wireDoors.length).toBeGreaterThan(applianceWires.length)
    expect(applianceWires.length).toBeGreaterThan(1)
    expect(wireDoors.filter((file) => !reached.has(file))).toEqual([])
  })
})

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
    const manifest = manifestOf(tenant.dir)
    return manifest !== undefined && doorsOf(manifest)["./all.css"] !== undefined ? [`${tenant.pkg}/all.css`] : []
  })
  const actual = cssImportsOf(readFileSync(path.join(PACKAGES, "bundle/src/all.generated.css"), "utf8"))
  expect([...actual].sort()).toEqual(expected.sort())
  expect(BROWSER_TENANTS.length).toBeGreaterThan(0)
  expect(BROWSER_TENANTS.length).toBeLessThan(TENANTS_OF.length)
})

test("permanent host entry closures contain no Olai feature implementation", () => {
  const policyTargets = new Set(
    TENANTS_OF.flatMap((tenant) => {
      const target = doorsOf(manifestOf(tenant.dir)!)["./policy"]
      return target ? [path.relative(PACKAGES, path.resolve(PACKAGES, tenant.dir, target))] : []
    }),
  )
  const contractTargets = new Set(PLUGIN_PACKAGES.flatMap((pkg) => staticTargets(pkg).map((file) => path.relative(PACKAGES, file))))
  const entries = ["web/src/client/main.tsx", "server/src/serve.ts"]
  const violations = entries.flatMap((entry) => {
    const graph = graphFrom(path.join(PACKAGES, entry))
    expect(graph.unresolved, entry).toEqual([])
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
      doorsOf(manifestOf(tenant.dir)!)[door] ? [`${tenant.pkg}/${door.slice(2)}`] : [],
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

describe("a plugin stays in its directory, outside the source graph too", () => {
  const corpus = ((): ReadonlyArray<string> => {
    const out: string[] = []
    const norm = (p: string): string => p.split("\\").join("/")
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
          file === "scripts/prove-fence.sh" ||
          file === "bun.nix" ||
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

  const codeOf = (file: string): string => codeIn(file, readFileSync(path.join(REPO, file), "utf8"))

  const ALLOWED: Record<string, ReadonlyArray<string>> = {
    "nix/kolu.nix": ["claude", "kolu", "mcp"],
    justfile: ["git", "kolu", "odu", "files", "pins"],
    "default.nix": ["kolu", "pins"],
    "flake.nix": ["kolu", "mcp"],
    "packages/bundle/default.nix": ["kolu", "pins"],
    "packages/bundle/nix/fold-check.nix": ["pins"],
    "nix/home/check.nix": ["settings", "outlines"],
    "nix/home/module.nix": ["opencode", "outlines"],
    "scripts/check-hydrated-deps.sh": ["pins"],
    "scripts/cordis-graph.ts": ["ui-renderer", "layout"],
    "scripts/test-shard.sh": ["git", "odu", "files"],
    "shell.nix": ["kolu", "pins"],
    "packages/tests/support/hooks.ts": ["alerts", "git", "search", "kolu", "odu", "mail", "files", "capture", "markdown"],
    "packages/tests/support/workers.ts": ["git", "odu", "mail"],
  }

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
      "default.nix": true,
      "scripts/cordis-graph.ts": true,
    }
    const offenders = corpus.filter((file) => PATH_ALLOWED[file] !== true && codeOf(file).includes("packages/plugins/"))
    expect(offenders).toEqual([])
  })

  test("every recorded allowance names a real corpus file and a real plugin word", () => {
    for (const [file, words] of Object.entries(ALLOWED)) {
      expect([file, corpus.includes(file)]).toEqual([file, true])
      for (const word of words) {
        const base = word.endsWith("#knob") ? word.slice(0, -"#knob".length) : word
        expect([word, PLUGIN_NAMES.includes(base)]).toEqual([word, true])
      }
    }
  })

  test("claim 2: no file outside packages/plugins spells a plugin's word", () => {
    const HARNESS: Record<string, true> = {
      "packages/tests/support/fake.ts": true,
      "packages/tests/agent/scripted-acp.ts": true,
      "packages/tests/agent/command.ts": true,
      "packages/tests/agent/session-store.ts": true,
      "packages/tests/agent/native-activity.ts": true,
    }
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
        const code = codeOf(file)
        const hits = PLUGIN_NAMES.flatMap((name) => {
          const out: string[] = []
          if (SPELLING.get(name)!.test(code)) out.push(name)
          const entry = knobEntries.find((e) => e.name === name)
          if (entry && entry.knobs.test(code)) out.push(`${name}#knob`)
          return out
        })
        return [file, hits]
      }),
    )
    const expected = Object.fromEntries(corpus.map((file) => [file, [...(ALLOWED[file] ?? [])]]))
    expect(actual).toEqual(expected)
  })
})

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
          expect([file, file.startsWith("/") || file.split("/").includes("..")]).toEqual([file, false])
        }
      }
    }
  })
})
