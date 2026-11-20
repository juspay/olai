import { buildHalf, REGISTRY } from "@olai/plugin-build"
import { itemKey, UsageFailure, type OpFailure, type WriteRequest, type Reading } from "@olai/format"
import * as plugins from "@olai/plugin-api/services"
import { type OwnedLoader, type Mounted, type Plugin, type RowReport } from "@olai/plugin-api/services"
import type { BuiltPlugin } from "@olai/surface"
import { PLUGIN_CHUNK_PREFIX, PLUGIN_FILES, type PluginState } from "@olai/surface"
import * as effect from "effect"
import { Effect } from "effect"
import { CONFIGURATION_FILE, decodePolicy, policyEdit, type PolicyRow } from "@olai/plugin-api/configuration"

import { readmeItem } from "./index.ts"
import { ALWAYS, APPROVED_KEY, CHECKED_KEY, type Defined, definedIn, isApproved, isBuilding, isOn, ON_KEY } from "./source.ts"

;(globalThis as Record<string, unknown>)[REGISTRY] = {
  "@olai/plugin-api": plugins,
  effect,
}

export interface DynamicRuntime {
  readonly rows: (report: ReadonlyMap<string, RowReport>) => ReadonlyArray<BuiltPlugin>
  readonly names: () => ReadonlyArray<string>
  readonly follow: (reading: Reading | null) => Effect.Effect<void>
  readonly chunk: (path: string) => string | null
  readonly set: (name: string, enabled: boolean) => Effect.Effect<boolean, OpFailure>
  readonly approve: (name: string, forever: boolean) => Effect.Effect<boolean, OpFailure>
  readonly trust: (name: string, trusting: boolean) => Effect.Effect<boolean, OpFailure>
  readonly remove: (name: string) => Effect.Effect<boolean, OpFailure>
  readonly checked: (name: string, version: string) => Effect.Effect<boolean, OpFailure>
  readonly configure: (name: string, key: string, value: string | null) => Effect.Effect<boolean, OpFailure>
  readonly defined: (name: string) => Defined | null
}

interface Live {
  readonly mounted: Mounted
  readonly chunk: string | null
  readonly path: string | null
}

type Started =
  | ({ readonly up: true; readonly version: string; readonly options: string; readonly policy: PolicyRow; readonly declaration: Plugin["config"]; readonly updates: Plugin["configUpdates"] } & Live)
  | { readonly up: false; readonly version: string; readonly options: string; readonly why: string }

export const openDynamic = (
  host: OwnedLoader,
  built: ReadonlyArray<string>,
  write: (request: WriteRequest) => Effect.Effect<void, OpFailure> = () => Effect.fail(new UsageFailure({ reason: "The directory’s write door is unavailable." })),
  conversations: () => plugins.Conversations | undefined = () => undefined,
): DynamicRuntime => {
  const started = new Map<string, Started>()
  const retired = new Map<string, { readonly path: string; readonly chunk: string }>()
  const warnings: string[] = []
  const warned = new Set<string>()
  const warn = (line: string) => { if (!warned.has(line)) { warned.add(line); warnings.push(line) } }
  let seen: ReadonlyArray<Defined> = []
  const approvedSource = new Map<string, { readonly server: string; readonly browser: string | null }>()
  const checkedBuilds = new Map<string, { readonly version: string; readonly why: string | null }>()

  let chats: ReadonlySet<string> = new Set()

  const follow = (defined: ReadonlyArray<Defined>): Effect.Effect<void> =>
    Effect.gen(function*() {
      seen = defined
      const held = new Set(defined.map((one) => one.name))
      const forget = (memory: Map<string, unknown>) => {
        for (const name of [...memory.keys()]) if (!held.has(name)) memory.delete(name)
      }
      for (const one of defined) {
        if (isApproved(one)) approvedSource.set(one.name, { server: one.server, browser: one.browser })
      }
      forget(approvedSource)
      for (const one of defined) {
        if (one.fault !== null || isApproved(one) || one.server.trim() === "") { checkedBuilds.delete(one.name); continue }
        if (checkedBuilds.get(one.name)?.version === one.version) continue
        checkedBuilds.set(one.name, { version: one.version, why: yield* compiles(one) })
      }
      forget(checkedBuilds)
      const door = conversations()
      chats = door === undefined
        ? new Set()
        : yield* door.here({ about: defined.map((one) => readmeItem(one.name)) })
      const wanted = new Map(
        defined
          .filter((one) => one.fault === null && isApproved(one) && isOn(one))
          .map((one) => [one.name, one] as const),
      )
      for (const [name, one] of [...started]) {
        const next = wanted.get(name)
        if (next?.version === one.version) {
          if (!one.up && one.options === optionsKey(next)) continue
          if (one.up) {
            const policy = policyFor(one.declaration, next, warn)
            if (one.updates === "live" || JSON.stringify(policy.config) === JSON.stringify(one.policy.config)) {
              started.set(name, { ...one, policy, options: optionsKey(next) })
              continue
            }
          }
        }
        if (one.up && one.path !== null && one.chunk !== null) retired.set(name, { path: one.path, chunk: one.chunk })
        started.delete(name)
        if (!one.up) continue
        yield* one.mounted.dispose
      }
      for (const [name, one] of wanted) {
        if (started.has(name)) continue
        started.set(name, yield* start(host, one, warn))
      }
      for (const line of warnings.splice(0)) yield* Effect.logWarning(line)
    })

  const consent = (one: Defined, props: Readonly<Record<string, string | null>>): WriteRequest | null => {
    const said: Readonly<Record<string, string | null>> = {
      [APPROVED_KEY]: one.approved,
      [ON_KEY]: one.on,
      [CHECKED_KEY]: one.checked,
    }
    const moving = Object.entries(props).filter(([key, value]) => (said[key] ?? null) !== value)
    if (moving.length === 0) return null
    const node = one.consent.node
    if (node !== undefined) {
      const ops = moving.map(([key, value]) => ({ op: "prop" as const, id: node.node.id, key, value }))
      return ops.length === 1 ? ops[0]! : { op: "apply", ops }
    }
    const written = Object.fromEntries(moving.filter(([, value]) => value !== null)) as Record<string, string>
    return one.consent.file === undefined
      ? { op: "create", file: CONFIGURATION_FILE, seed: { title: one.name, props: written } }
      : { op: "add", file: one.consent.file, title: one.name, props: written }
  }

  return {
    rows: (report) => {
      const asking = conversations() !== undefined
      return seen.map((one) =>
        rowOf(one, started.get(one.name), report.get(one.name), approvedSource.get(one.name), checkedBuilds.get(one.name), chats.has(itemKey(readmeItem(one.name))), asking))
    },
    names: () => seen.map((one) => one.name),
    follow: (reading) => follow(reading === null ? [] : definedIn(reading, built)),
    chunk: (path) => {
      for (const one of started.values()) if (one.up && one.path === path) return one.chunk
      for (const one of retired.values()) if (one.path === path) return one.chunk
      return null
    },

    set: (name, enabled) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      const request = consent(one, { [ON_KEY]: enabled ? "yes" : "no" })
      if (request !== null) yield* write(request)
      return true
    }),
    approve: (name, forever) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      const request = consent(one, { [APPROVED_KEY]: forever ? "always" : one.version, [ON_KEY]: "yes" })
      if (request !== null) yield* write(request)
      return true
    }),
    trust: (name, trusting) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      const request = consent(one, { [APPROVED_KEY]: trusting ? ALWAYS : one.version })
      if (request !== null) yield* write(request)
      return true
    }),
    remove: (name) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      for (const file of PLUGIN_FILES) {
        if (!one.holds.includes(file)) continue
        yield* write({ op: "delete", file: `${one.folder}${file}` })
      }
      const node = one.consent.node
      if (node !== undefined) yield* write({ op: "trash", id: node.node.id })
      return true
    }),
    checked: (name, version) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      const request = consent(one, { [CHECKED_KEY]: version })
      if (request !== null) yield* write(request)
      return true
    }),
    configure: (name, key, value) => Effect.gen(function*() {
      const one = seen.find(one => one.name === name)
      if (one === undefined) return false
      if (key.split(".").some(part => RESERVED.includes(part))) {
        return yield* Effect.fail(new UsageFailure({
          reason: `${key} ${RESERVED_SAID}`,
        }))
      }
      const mounted = started.get(name)
      const declaration = mounted?.up === true ? mounted.declaration : undefined
      const request = yield* Effect.try({
        try: () => policyEdit(declaration, one.consent.nodes, one.consent.node, one.consent.file, name, key, value),
        catch: error => error as UsageFailure,
      })
      if (request !== undefined) yield* write(request)
      return true
    }),
    defined: (name) => seen.find((one) => one.name === name) ?? null,
  }
}

export const RESERVED: ReadonlyArray<string> = [APPROVED_KEY, ON_KEY, CHECKED_KEY]

export const RESERVED_SAID =
  "is reserved for the plugin's approval, its switch and the signal that its"
  + " builder has finished"

const optionsKey = (one: Defined): string => {
  const root = one.consent.node
  if (root === undefined) return "null"
  const ids = new Set([root.node.id])
  for (let grew = true; grew;) {
    grew = false
    for (const item of one.consent.nodes) {
      const parent = "parent" in item.node ? item.node.parent : undefined
      if (parent !== undefined && ids.has(parent) && !ids.has(item.node.id)) { ids.add(item.node.id); grew = true }
    }
  }
  return JSON.stringify(one.consent.nodes.filter(item => ids.has(item.node.id)).map(item => ({
    id: item.node.id,
    ...("parent" in item.node ? { parent: item.node.parent } : {}),
    ...("title" in item.node ? { title: item.node.title } : {}),
    custom: "custom" in item.node
      ? Object.fromEntries(Object.entries(item.node.custom ?? {}).filter(([key]) => !RESERVED.includes(key)))
      : {},
  })))
}

const compiles = (one: Defined): Effect.Effect<string | null> =>
  Effect.gen(function*() {
    const server = yield* Effect.promise(() => buildHalf("server", one.server))
    if (!server.ok) return server.why
    if (one.browser === null) return null
    const browser = yield* Effect.promise(() => buildHalf("browser", one.browser ?? ""))
    return browser.ok ? null : browser.why
  })

const policyFor = (schema: Plugin["config"], one: Defined, warn: (line: string) => void): PolicyRow => {
  if (schema === undefined) return { config: {}, values: [] }
  if (schema.ast._tag === "Objects") for (const field of schema.ast.propertySignatures) {
    if (RESERVED.includes(String(field.name))) {
      throw new Error(`${String(field.name)} ${RESERVED_SAID}`)
    }
  }
  return decodePolicy(schema, one.consent.nodes, one.consent.node,
    (key, value, reason) => warn(`${one.consent.file ?? CONFIGURATION_FILE}: ${one.name}.${key}: ${JSON.stringify(value)} uses its default — ${reason}`))
}

const start = (host: OwnedLoader, one: Defined, warn: (line: string) => void): Effect.Effect<Started> =>
  Effect.gen(function*() {
    const options = optionsKey(one)
    const faulted = (why: string): Started => ({ up: false, version: one.version, options, why })
    const server = yield* Effect.promise(() => buildHalf("server", one.server))
    if (!server.ok) return faulted(server.why)
    const browser = one.browser === null
      ? null
      : yield* Effect.promise(() => buildHalf("browser", one.browser ?? ""))
    if (browser !== null && !browser.ok) return faulted(browser.why)
    const plugin = yield* Effect.promise(() => loaded(server.text))
    if (typeof plugin === "string") return faulted(plugin)
    if (plugin.name !== one.name) {
      return faulted(
        `this plugin's server half calls itself "${plugin.name}", but its folder is `
          + `\`${one.folder}\`, so the word is "${one.name}". The folder's name is the name; `
          + `make the half agree with it, or rename the folder.`,
      )
    }
    let policy: PolicyRow
    try { policy = policyFor(plugin.config, one, warn) }
    catch (error) { return faulted(`Invalid Config declaration: ${String(error)}`) }
    const mounted = yield* host.mount(plugin, policy.config)
    return {
      up: true,
      options,
      policy,
      declaration: plugin.config,
      updates: plugin.configUpdates,
      version: one.version,
      mounted,
      chunk: browser === null ? null : browser.text,
      path: browser === null ? null : `${PLUGIN_CHUNK_PREFIX}${one.name}-${one.version}.js`,
    }
  })

const loaded = async (text: string): Promise<Plugin | string> => {
  const url = `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
  let module: { readonly default?: unknown }
  try {
    module = await import(url) as { readonly default?: unknown }
  } catch (thrown) {
    return thrown instanceof Error ? thrown.message : String(thrown)
  }
  const plugin = module.default
  if (plugin === null || typeof plugin !== "object" || !("name" in plugin)) {
    return `this plugin's server half exports no plugin. End the file with `
      + `\`export default definePlugin({ name, needs, apply })\`.`
  }
  return plugin as Plugin
}

const rowOf = (
  one: Defined,
  started: Started | undefined,
  report: RowReport | undefined,
  approvedSource: { readonly server: string; readonly browser: string | null } | undefined,
  pending: { readonly version: string; readonly why: string | null } | undefined,
  chat: boolean,
  asking: boolean,
): BuiltPlugin => {
  const up = started?.up === true ? started : null
  const was = approvedSource === undefined || isApproved(one) ? undefined : approvedSource
  const source = {
    folder: one.folder,
    title: one.title,
    description: one.description,
    ...(one.readme === null ? {} : { readme: one.readme }),
    version: one.version,
    approved: isApproved(one),
    ...(one.approved === null ? {} : { decided: true }),
    ...(one.approved === ALWAYS ? { trusting: true } : {}),
    ...(isBuilding(one, chat) ? { building: true } : {}),
    on: isOn(one),
    server: one.server,
    ...(one.browser === null ? {} : { browser: one.browser }),
    ...(was === undefined || was.server === one.server ? {} : { approvedServer: was.server }),
    ...(was === undefined || was.browser === one.browser || was.browser === null ? {} : { approvedBrowser: was.browser }),
    ...(one.uses.length === 0 ? {} : { uses: one.uses }),
    ...(chat ? { chat: true } : {}),
    ...(asking ? { asking: true } : {}),
    ...(up?.path == null ? {} : { chunk: up.path }),
  }
  const at = (state: PluginState, more: Partial<BuiltPlugin> = {}): BuiltPlugin => ({
    name: one.name,
    running: state === "running",
    state,
    switchPersistence: "file",
    desiredOn: isOn(one),
    ...more,
    source,
    ...(up === null ? {} : {
      configurationValues: up.policy.values,
      ...(one.consent.node === undefined || one.consent.file === undefined
        ? {}
        : { configurationNode: { file: one.consent.file, id: one.consent.node.node.id } }),
    }),
  })
  const said = one.fault
    ?? (started?.up === false ? started.why : undefined)
    ?? (pending?.version === one.version ? pending.why ?? undefined : undefined)
  if (said !== undefined) return at("failed", { fault: said })
  if (!isApproved(one)) return at("pending")
  if (!isOn(one)) return at("switched")
  if (up === null || report === undefined) return at("off")
  return at(report.state, {
    ...(report.state === "failed" && report.fault !== undefined ? { fault: report.fault } : {}),
    ...(report.state === "waiting" && report.missing !== undefined ? { missing: report.missing } : {}),
  })
}
