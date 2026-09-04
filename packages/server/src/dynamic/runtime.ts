/**
 * PLUGINS THE VAULT DEFINES, MOUNTED — phase 12's runtime half, and the one
 * place in this tree where a fiber comes from something nobody compiled in.
 *
 * ## What it does, in the order it does it
 *
 * A revision lands. `./source.ts` says what the vault defines. This mounts every
 * definition that is APPROVED at its current version and is not switched off,
 * unmounts everything else, and answers whether anything moved — because what
 * has to happen next (re-compose the siblings, republish the roster, re-judge
 * the vault's vocabulary) is the composition root's and is exactly what a flip
 * of a built row already does.
 *
 * ## A DEFINITION IS NOT A MOUNT, and approval is the whole distance between
 *
 * *Until approved, nothing mounts. This is the paper's §6.3 read honestly: the
 * code runs with the process's authority, so approval by the owner is the
 * boundary, and sandboxing is out of scope* (the plan, §6 phase 12).
 *
 * So a definition with no approval is a ROW and not a fiber: it draws on the
 * panel with its source visible and a verb beside it, and nothing of it has been
 * imported, compiled or run. An approval names a VERSION, so an edit to either
 * half puts the row back in that state — which is what stops "approve once" from
 * meaning "approve whatever this becomes".
 *
 * ## Why `mountPlugin` and not a loader row
 *
 * The plan says *a row appended to the live bundle (`loader.update` from phase
 * 8), so it is a fiber like any other, with the same states and the same
 * containment.* Both halves of what that buys are `mountPlugin`'s already: it
 * makes a fiber in the same registry, with the same five states, and a plugin
 * whose `apply` throws lands `FAILED` having installed nothing, siblings
 * untouched. What a loader ENTRY would add on top is a row in `olai.yml` — a
 * file this phase must not write, by the same ruling that made a flip
 * session-only — and a second identity for a plugin whose identity is a node in
 * a vault. So the fiber is made directly and the ROW is this module's map.
 *
 * ## THE MODULE IS NEVER RESOLVED AGAINST A DISK
 *
 * A built half is text (`@olai/plugin-build`), evaluated from a `data:` URL, and
 * its three imports are bound to this process's own modules through a table on
 * `globalThis`. There is no file, no package tree above it and nothing for a
 * specifier to find — which is the whole reason a vault needs no `node_modules`
 * and cannot be given one.
 */

import { buildHalf, REGISTRY } from "@olai/plugin-build"
import type { Derived } from "@olai/format"
import * as plugins from "@olai/plugin-api/services"
import { type Host, type Mounted, mountPlugin, type Plugin, type RowReport } from "@olai/plugin-api/services"
import type { BuiltPlugin } from "@olai/surface"
import { PLUGIN_CHUNK_PREFIX } from "@olai/surface"
import * as effect from "effect"
import { Effect } from "effect"

import { type Defined, definedIn, isApproved } from "./source.ts"

/**
 * THE HOST'S OWN MODULES, put where a module built at runtime can reach them.
 *
 * `@olai/plugin-api` is bound to the SERVER door, which is the whole of what
 * "olai resolves them itself" means on this side: a plugin writes the bare name
 * in both halves and each half gets the door that half is written against
 * (`@olai/plugin-build`'s `shared.ts`).
 *
 * Written once per process, at module load, because there is exactly one
 * registry and it holds this binary's modules — not a serve's, not a runtime's.
 * A second serve in the same process (the tests compose several) would write the
 * same two namespaces.
 */
;(globalThis as Record<string, unknown>)[REGISTRY] = {
  "@olai/plugin-api": plugins,
  effect,
}

/** WHAT A COMPOSITION ROOT HOLDS of the dynamic half. */
export interface DynamicRuntime {
  /** Every plugin the vault defines, as roster rows — running or not, faulted
   *  or not, pending or not. In corpus order, which is the order the outliner
   *  draws them in. */
  readonly rows: () => ReadonlyArray<BuiltPlugin>
  /** Bring the mounted set into line with a revision. Answers whether anything
   *  moved, so a caller can re-compose exactly when there is something to
   *  re-compose. */
  readonly follow: (derived: Derived) => Effect.Effect<boolean>
  /** ...and the same act against the reading this runtime last saw — what an
   *  approval and a switch need, since neither moves a file. */
  readonly again: Effect.Effect<boolean>
  /** The text of a built browser half, by the path the roster published it
   *  under. `null` for anything else, which is a stale tab asking for a version
   *  that has been replaced. */
  readonly chunk: (path: string) => string | null
  /** Turn one dynamic row off or on for as long as this process runs — the
   *  panel's switch, and the agent's `plugins.stop`. Answers whether there was
   *  such a row. */
  readonly set: (name: string, enabled: boolean) => Effect.Effect<boolean>
  /** One definition as the vault holds it, for the two agent-facing verbs.
   *  `null` for a word this vault does not define. */
  readonly defined: (name: string) => Defined | null
}

/** ONE PLUGIN THAT IS UP — what was mounted, at which version, with the chunk
 *  its face is served from. */
interface Live {
  readonly version: string
  readonly mounted: Mounted
  readonly report: RowReport
  readonly chunk: string | null
  readonly path: string | null
}

/**
 * OPEN THE DYNAMIC HALF over a host.
 *
 * `built` is every word this build already has, so a definition cannot take one
 * (`./source.ts` argues why that is a fault and not an override).
 */
export const openDynamic = (host: Host, built: ReadonlyArray<string>): DynamicRuntime => {
  const live = new Map<string, Live>()
  /** Definitions as the last revision left them — what {@link rows} draws and
   *  what {@link again} re-follows. */
  let seen: ReadonlyArray<Defined> = []
  /** WHY A DEFINITION IS NOT UP, where the reason is this module's rather than
   *  the vault's: a half that would not compile, a module with no plugin in it,
   *  an `apply` that threw. Keyed by word and cleared when that word is next
   *  mounted. */
  const faults = new Map<string, string>()
  /** ...and the rows a person switched off here. Per PROCESS, exactly like a
   *  built row's flip: nothing is written, and a restart comes back to what the
   *  vault says. */
  const stopped = new Set<string>()

  const follow = (defined: ReadonlyArray<Defined>): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      seen = defined
      let moved = false
      const wanted = new Map(
        defined
          .filter((one) => one.fault === null && isApproved(one) && !stopped.has(one.name))
          .map((one) => [one.name, one] as const),
      )
      // OUT FIRST, so a version that is being replaced has unwound every
      // registration it made before its successor claims the same kind word,
      // the same sibling key and the same held record. The browser runtime
      // keeps the same order one process over and for the same reason.
      for (const [name, one] of [...live]) {
        if (wanted.get(name)?.version === one.version) continue
        live.delete(name)
        yield* one.mounted.dispose
        moved = true
      }
      for (const [name, one] of wanted) {
        if (live.has(name)) continue
        faults.delete(name)
        const up = yield* start(host, one, faults)
        if (up === null) {
          moved = moved || faults.has(name)
          continue
        }
        live.set(name, up)
        moved = true
      }
      return moved
    })

  return {
    rows: () => seen.map((one) => rowOf(one, live.get(one.name), faults.get(one.name), stopped)),
    follow: (derived) => follow(definedIn(derived, built)),
    again: Effect.suspend(() => follow(seen)),
    chunk: (path) => {
      for (const one of live.values()) if (one.path === path) return one.chunk
      return null
    },
    set: (name, enabled) =>
      Effect.suspend(() => {
        if (!seen.some((one) => one.name === name)) return Effect.succeed(false)
        if (enabled) stopped.delete(name)
        else stopped.add(name)
        return Effect.as(follow(seen), true)
      }),
    defined: (name) => seen.find((one) => one.name === name) ?? null,
  }
}

/**
 * BUILD AND MOUNT ONE DEFINITION, or record why not.
 *
 * `null` with a fault recorded is every way this can go wrong short of the
 * plugin's own `apply`, which is the runtime's to contain and does NOT come back
 * here: a fiber that failed is mounted, in `FAILED`, having installed nothing,
 * and its report is what the row draws.
 */
const start = (
  host: Host,
  one: Defined,
  faults: Map<string, string>,
): Effect.Effect<Live | null> =>
  Effect.gen(function*() {
    const faulted = (why: string): Effect.Effect<null> =>
      Effect.sync(() => {
        faults.set(one.name, why)
        return null
      })
    const server = yield* Effect.promise(() => buildHalf("server", one.server))
    if (!server.ok) return yield* faulted(server.why)
    const browser = one.browser === null
      ? null
      : yield* Effect.promise(() => buildHalf("browser", one.browser ?? ""))
    if (browser !== null && !browser.ok) return yield* faulted(browser.why)
    const plugin = yield* Effect.promise(() => loaded(server.text))
    if (typeof plugin === "string") return yield* faulted(plugin)
    // THE WORD IS THE VAULT'S, and a half that named itself something else would
    // be a fiber bound under a word no row draws — its kinds prefixed wrongly,
    // its sibling composed under a key the roster does not carry, its held
    // record written where nothing reads it. The stamp is the registry binding
    // everywhere else in this tree, and a definition is where this one is
    // decided, so the half does not get to disagree with it.
    if (plugin.name !== one.name) {
      return yield* faulted(
        `this plugin's server half calls itself "${plugin.name}", but the node that defines it `
          + `says "${one.name}". The node's \`plugin\` property is the name; make the half agree with it.`,
      )
    }
    const mounted = yield* mountPlugin(host, plugin)
    return {
      version: one.version,
      mounted,
      report: yield* mounted.report,
      chunk: browser === null ? null : browser.text,
      path: browser === null ? null : `${PLUGIN_CHUNK_PREFIX}${one.name}-${one.version}.js`,
    }
  })

/**
 * THE MODULE, EVALUATED — or a sentence saying what it turned out to be.
 *
 * A `data:` URL rather than a file, because there is no file: the source is a
 * note on a node, the built text is a value, and a temporary file would be a
 * path this process has to own, clean up and keep out of the vault it is
 * serving. Bun imports a `data:` module, and the module's own imports were bound
 * before it ever got here (`@olai/plugin-build`'s `bind.ts`), so there is
 * nothing left in it for a resolver to fail on.
 *
 * A VERSION IS A NEW URL, which is what makes a re-definition a fresh
 * evaluation: the module cache is keyed by the URL, and the URL carries the
 * bytes.
 */
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

/**
 * ONE DEFINITION AS A ROSTER ROW.
 *
 * The word a row wears is decided here rather than by the fiber, because four of
 * the five ways a dynamic row can be absent are not fiber states at all: a
 * definition nobody approved, a definition with a fault in its shape, one whose
 * source would not compile, and one a person switched off. Only the fifth —
 * a plugin that mounted and then failed, or that is waiting on a door — is the
 * registry's answer, and that one is read off the fiber like any other row's.
 */
const rowOf = (
  one: Defined,
  live: Live | undefined,
  fault: string | undefined,
  stopped: ReadonlySet<string>,
): BuiltPlugin => {
  const source = {
    node: one.node,
    file: one.file,
    version: one.version,
    approved: isApproved(one),
    server: one.server,
    ...(one.browser === null ? {} : { browser: one.browser }),
    ...(live?.path == null ? {} : { chunk: live.path }),
  }
  const said = one.fault ?? fault
  if (said !== undefined) return { name: one.name, running: false, state: "failed", fault: said, source }
  if (!isApproved(one)) return { name: one.name, running: false, state: "pending", source }
  if (stopped.has(one.name)) return { name: one.name, running: false, state: "switched", source }
  if (live === undefined) return { name: one.name, running: false, state: "off", source }
  const report = live.report
  return {
    name: one.name,
    running: report.state === "running",
    state: report.state,
    ...(report.state === "failed" && report.fault !== undefined ? { fault: report.fault } : {}),
    ...(report.state === "waiting" && report.missing !== undefined ? { missing: report.missing } : {}),
    source,
  }
}
