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
 * makes a fiber in the same registry, with the same seven states, and a plugin
 * whose `apply` throws lands `FAILED` having installed nothing, siblings
 * untouched. What a loader ENTRY would add on top is a row in `olai.yml` — a
 * build declaration this runtime never writes — and a second identity for a plugin whose identity is a node in
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
import { UsageFailure, type OpFailure, type WriteRequest, type Reading } from "@olai/format"
import * as plugins from "@olai/plugin-api/services"
import { type OwnedLoader, type Mounted, type Plugin, type RowReport } from "@olai/plugin-api/services"
import type { BuiltPlugin } from "@olai/surface"
import { PLUGIN_CHUNK_PREFIX, type PluginState } from "@olai/surface"
import * as effect from "effect"
import { Effect } from "effect"
import { CONFIGURATION_FILE, decodePolicy, policyEdit, type PolicyRow } from "@olai/plugin-api/configuration"

import { APPROVED_KEY, BUILDER_KEY, type Defined, definedIn, isApproved, ON_KEY } from "./source.ts"

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
  /**
   * Every plugin the vault defines, as roster rows — running or not, faulted or
   * not, pending or not. In corpus order, which is the order the outliner draws
   * them in.
   *
   * ## THE REPORT IS HANDED IN, and it is the same one the built rows read
   *
   * A dynamic row's fiber is on the same host under its own word, so
   * `rowReport` answers for it exactly as it answers for a row of the bundle —
   * and the composition root re-reads ONE map covering both at every moment
   * anything can have moved (`@olai/server`'s `serve.ts`).
   *
   * It used to be taken at MOUNT and stored, which was a second clock and wrong
   * in both directions the moment a fiber moved afterwards: a definition that
   * `needs` a door nobody was behind mounted `waiting`, the provider was
   * switched on later, the fiber went ACTIVE in the registry, and the row went
   * on saying `waiting` with `running: false` — so the tab never loaded its
   * chunk. A plugin that died after mounting said `running` for ever.
   *
   * A row this map has nothing to say about is one whose fiber is not in the
   * registry, which is `off` — the same absence {@link rowReport} answers for a
   * bundle row that never loaded.
   */
  readonly rows: (report: ReadonlyMap<string, RowReport>) => ReadonlyArray<BuiltPlugin>
  /** Every word this vault defines right now — what the composition root adds to
   *  the bundle's own list when it re-reads the report above. */
  readonly names: () => ReadonlyArray<string>
  /** Bring the mounted set into line with a revision. Answers whether anything
   *  moved, so a caller can re-compose exactly when there is something to
   *  re-compose. */
  readonly follow: (reading: Reading | null) => Effect.Effect<boolean>
  /** ...and the same act against the reading this runtime last saw — what an
   *  approval and a switch need, since neither moves a file. */
  readonly again: Effect.Effect<boolean>
  /** The text of a built browser half, by the path the roster published it
   *  under. `null` for anything else, which is a stale tab asking for a version
   *  that has been replaced. */
  readonly chunk: (path: string) => string | null
  /**
   * Turn one vault plugin off or on — the panel's switch, the page's, and the
   * agent's `plugins.stop`. Answers whether there was such a row.
   *
   * IT WRITES, and that is the change the folder shape brought: this used to
   * be a word added to a set in this process's memory, so a plugin somebody
   * turned off came back on at the next boot. `on` is a property on the
   * plugin's node in the settings file, like a built row's, and the answer to
   * a restart is the file.
   */
  readonly set: (name: string, enabled: boolean) => Effect.Effect<boolean, OpFailure>
  /** Say yes to a version, and turn it on — one write, because a press cannot
   *  land half of itself. `forever` writes `always`. */
  readonly approve: (name: string, forever: boolean) => Effect.Effect<boolean, OpFailure>
  /** Bind a conversation to a plugin, so its page can dock the one that is
   *  building it. */
  readonly bind: (name: string, conversation: string) => Effect.Effect<boolean, OpFailure>
  readonly configure: (name: string, key: string, value: string | null) => Effect.Effect<boolean, OpFailure>
  /** One plugin as the vault holds it, for the verbs that answer about one.
   *  `null` for a word this vault does not define. */
  readonly defined: (name: string) => Defined | null
}

/** ONE PLUGIN THAT IS UP — what was mounted, with the chunk its face is served
 *  from. NOTHING ABOUT ITS STATE: that is the registry's and is read afresh
 *  (see {@link DynamicRuntime.rows}). */
interface Live {
  readonly mounted: Mounted
  readonly chunk: string | null
  readonly path: string | null
}

/**
 * WHAT CAME OF TRYING TO START ONE DEFINITION — ONE value, and the last time it
 * was two it was a bug waiting.
 *
 * There were two maps: `live`, keyed by word, and `faults`, keyed by word, with
 * `faults.delete(name)` before every attempt and `faults.has(name)` after one to
 * find out whether anything had moved. That is one fact — *what happened when we
 * last tried this word* — spread across two containers whose three reachable
 * combinations mean three different things, kept in step by hand at four call
 * sites. A name that ended up in both, or in neither by accident, was a row
 * drawn from a state nothing could name.
 *
 * ## BOTH ARMS CARRY THE VERSION, and the failed one did not
 *
 * The version is what says *this is the attempt for that source*, and an attempt
 * that FAILED is as much an attempt as one that mounted. Without it, {@link
 * follow} had nothing to compare a broken definition against, so it built it
 * again on every revision — the Solid transform re-run on every keystroke
 * anywhere in the vault, for as long as somebody's `browser.tsx` had a syntax
 * error in it. With it, a failure is remembered exactly as a mount is: tried at
 * this version, and not tried again until the version moves.
 */
type Started =
  | ({ readonly up: true; readonly version: string; readonly policy: PolicyRow; readonly declaration: Plugin["config"]; readonly updates: Plugin["configUpdates"] } & Live)
  | { readonly up: false; readonly version: string; readonly why: string }

/**
 * OPEN THE DYNAMIC HALF over a host.
 *
 * `built` is every word this build already has, so a definition cannot take one
 * (`./source.ts` argues why that is a fault and not an override).
 */
export const openDynamic = (host: OwnedLoader, built: ReadonlyArray<string>, write: (request: WriteRequest) => Effect.Effect<void, OpFailure> = () => Effect.fail(new UsageFailure({ reason: "The directory’s write door is unavailable." }))): DynamicRuntime => {
  /** WHAT CAME OF THE LAST ATTEMPT AT EACH WORD — see {@link Started}. */
  const started = new Map<string, Started>()
  const optionsKeys = new Map<string, string>()
  /** THE LAST FACE EACH WORD SERVED, kept after it stops. A tab imports a
   *  chunk named by the roster it is holding, and a row that leaves — switched
   *  off, edited, or its folder deleted — would otherwise 404 that import.
   *  One entry per plugin, replaced when it starts again. */
  const retired = new Map<string, { readonly path: string; readonly chunk: string }>()
  const warnings: string[] = []
  const warned = new Set<string>()
  const warn = (line: string) => { if (!warned.has(line)) { warned.add(line); warnings.push(line) } }
  /** Definitions as the last revision left them — what {@link rows} draws and
   *  what {@link again} re-follows. */
  let seen: ReadonlyArray<Defined> = []
  /**
   * THE HALVES AT THE VERSION A PERSON APPROVED, for the plugin that is now
   * paused by an edit — which is the only thing a diff can be drawn against.
   *
   * Remembered here rather than fetched, because there is nowhere to fetch it
   * from: the approved version is a HASH in the settings file, and the bytes
   * it names are whatever the folder held at the time. So this takes a copy
   * every time a reading arrives with its current version approved, and hands
   * it back the moment the next reading is not.
   *
   * IT IS THIS PROCESS'S MEMORY, and the one case it cannot answer is honest
   * and said on the page: a serve that was down while somebody edited an
   * approved plugin comes back with the new source, the old hash, and no copy
   * of what the hash named — so the page shows the code it has rather than a
   * diff, and asks for the same decision either way.
   */
  const approvedSource = new Map<string, { readonly server: string; readonly browser: string | null }>()

  const follow = (defined: ReadonlyArray<Defined>): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      // WHAT THE ROWS SAID BEFORE, so that a definition ARRIVING is a movement
      // even though no fiber moved. This answer gates the re-compose, and a
      // re-compose is what republishes the roster — so without it the first
      // thing that happens in this whole phase, an agent writing a definition
      // nobody has approved, reached the panel of an open tab never.
      const said = wordsOf(seen)
      seen = defined
      let moved = wordsOf(defined) !== said
      // THE COPY FOR THE DIFF, taken while the version on disk is the version
      // that was approved — which is the only moment the bytes behind the hash
      // are in hand. A word this reading no longer holds takes its copy with
      // it, so a folder that was deleted and written again is not diffed
      // against a predecessor nobody approved.
      for (const one of defined) {
        if (isApproved(one)) approvedSource.set(one.name, { server: one.server, browser: one.browser })
      }
      for (const name of [...approvedSource.keys()]) {
        if (!defined.some((one) => one.name === name)) approvedSource.delete(name)
      }
      // WANTED IS APPROVED **AND** ON, and the two are different facts: a
      // plugin a person approved and then switched off is approved and not
      // running, and a plugin somebody switched on and then edited is on and
      // paused. Both are written down, both survive a restart, and the row
      // below says which is which.
      const wanted = new Map(
        defined
          .filter((one) => one.fault === null && isApproved(one) && one.on)
          .map((one) => [one.name, one] as const),
      )
      // OUT FIRST, so a version that is being replaced has unwound every
      // registration it made before its successor claims the same kind word,
      // the same sibling key and the same held record. The browser runtime
      // keeps the same order one process over and for the same reason.
      //
      // A FAILED ATTEMPT IS AN ATTEMPT, and leaves on the same comparison: its
      // version is the source it was made against, so an unchanged broken
      // definition is skipped by the loop below rather than compiled again.
      for (const [name, one] of [...started]) {
        const next = wanted.get(name)
        if (next?.version === one.version) {
          if (!one.up && optionsKeys.get(name) === optionsKey(next)) continue
          if (one.up) {
            const policy = policyFor(one.declaration, next, warn)
            if (one.updates === "live" || JSON.stringify(policy.config) === JSON.stringify(one.policy.config)) {
              started.set(name, { ...one, policy })
              optionsKeys.set(name, optionsKey(next))
              continue
            }
          }
        }
        // WHAT IT WAS SERVING STAYS SERVABLE for the moment after it leaves.
        // A tab holds a roster until the next one reaches it, and the import
        // it already started names this path: letting the file's deletion
        // 404 that fetch turns an ordinary withdrawal into an error in
        // somebody's console. One path per plugin, replaced the next time it
        // starts, so the memory is the roster's own size.
        if (one.up && one.path !== null && one.chunk !== null) retired.set(name, { path: one.path, chunk: one.chunk })
        started.delete(name)
        optionsKeys.delete(name)
        if (!one.up) continue
        yield* one.mounted.dispose
        moved = true
      }
      for (const [name, one] of wanted) {
        if (started.has(name)) continue
        started.set(name, yield* start(host, one, warn))
        optionsKeys.set(name, optionsKey(one))
        // EITHER WAY: a word that was not up is now mounted or is now failed
        // with a sentence, and both are rows that say something they did not.
        moved = true
      }
      for (const line of warnings.splice(0)) yield* Effect.logWarning(line)
      return moved
    })

  /**
   * ONE CONSENT WRITE, wherever the settings file has got to.
   *
   * Three arms, and they are the three states a vault can be in rather than
   * three code paths: the plugin already has a node in the settings file, so
   * this is properties on it; the file exists and the plugin has no node yet,
   * so this adds one; or there is no settings file at all, so this creates it
   * holding exactly this row. `policyEdit` makes the same three decisions for
   * a knob and this makes them for the two words beside the knobs.
   *
   * SEVERAL KEYS AT ONCE, because **Turn on** is two facts — *I have read this*
   * and *I want it running* — and a press that landed one of them would leave
   * a plugin approved and off, or on and unapproved, with nothing to say which
   * half failed.
   *
   * ...AND ONLY THE WORDS THAT WOULD MOVE, which is not tidiness: the gate
   * refuses a property write that would change nothing, and a batch is ALL OR
   * NOTHING — so **Turn on this version** on a plugin whose switch was already
   * up asked for `approved` beside an `on: yes` that was already `yes`, and
   * the whole batch came back refused with the approval unwritten. The row
   * stayed paused, the press looked like it had done nothing, and the sentence
   * a person would have had to read to find out was about the OTHER key.
   */
  const consent = (one: Defined, props: Readonly<Record<string, string | null>>): WriteRequest | null => {
    const said: Readonly<Record<string, string | null>> = {
      [APPROVED_KEY]: one.approved,
      [ON_KEY]: one.on ? "yes" : null,
      [BUILDER_KEY]: one.builder,
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
    rows: (report) =>
      seen.map((one) => rowOf(one, started.get(one.name), report.get(one.name), approvedSource.get(one.name))),
    names: () => seen.map((one) => one.name),
    follow: (reading) => follow(reading === null ? [] : definedIn(reading, built)),
    again: Effect.suspend(() => follow(seen)),
    chunk: (path) => {
      for (const one of started.values()) if (one.up && one.path === path) return one.chunk
      // ...and a face that has just left is still served for whoever is
      // already fetching it (the `retired` note above). The version is in the
      // path, so this can only answer with the bytes that path named.
      for (const one of retired.values()) if (one.path === path) return one.chunk
      return null
    },

    set: (name, enabled) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      // THE WRITE IS THE WHOLE ACT, and nothing here follows it: the write
      // publishes a revision, the revision is followed by the caller that
      // watches them, and the row moves because the file moved. A `follow` on
      // this side would be a second clock, answering off a reading the store
      // has not published yet.
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
    bind: (name, conversation) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      const request = consent(one, { [BUILDER_KEY]: conversation })
      if (request !== null) yield* write(request)
      return true
    }),
    configure: (name, key, value) => Effect.gen(function*() {
      const one = seen.find(one => one.name === name)
      if (one === undefined) return false
      if (key.split(".").some(part => RESERVED.includes(part))) {
        return yield* Effect.fail(new UsageFailure({
          reason: `${key} is reserved for the plugin's approval, its switch and the conversation building it`,
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

/**
 * THE THREE WORDS NOTHING MAY DECLARE AS A KNOB — the plugin's approval, its
 * switch and the conversation building it.
 *
 * They sit on the same node a plugin's knobs do, which is the whole of why
 * they have to be refused by name: a `Config` field called `on` would be a
 * plugin whose settings quietly decide whether it runs, and one called
 * `approved` would be a plugin that can say yes to itself.
 */
export const RESERVED: ReadonlyArray<string> = [APPROVED_KEY, ON_KEY, BUILDER_KEY]

/**
 * WHAT THE ROWS THIS RUNTIME DRAWS SAY, as one string — the comparison that
 * decides whether a revision moved anything.
 *
 * EVERY FIELD {@link rowOf} READS off a plugin, and nothing else: the word, the
 * folder, the version, the consent, the prose and the shape fault. `version` is
 * a content hash of both halves, so the SOURCE is in here without the source
 * being in here — and the README is in here as itself, because the page draws
 * it and an edit to it must reach an open tab even though it moves no version.
 *
 * A comparison rather than a diff, because the answer is one boolean: the
 * caller re-composes or it does not.
 */
const optionsKey = (one: Defined): string => {
  const root = one.consent.node
  if (root === undefined) return "null"
  // THE WHOLE SUBTREE, because a schema section is a child node and a section
  // inside one is a grandchild: `decodePolicy` recurses, so a fingerprint that
  // stopped at the first level would miss a nested knob moving.
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

/** Metadata fingerprint: field boundaries must survive text containing line breaks. */
export const wordsOf = (defined: ReadonlyArray<Defined>): string =>
  defined
    .map((one) => [
      one.name, one.folder, one.version, one.approved, String(one.on), one.builder,
      one.title, one.description, one.readme, one.fault, optionsKey(one),
    ].join("\0"))
    .join("\n")

/**
 * BUILD AND MOUNT ONE DEFINITION — and the answer is what came of it, either
 * way.
 *
 * It used to answer `null` and write the sentence into a map its caller also
 * held, which is the arrangement {@link Started} records being rid of: a
 * function whose real answer is in a parameter is a function two readers have to
 * agree about.
 *
 * A FAILING `apply` DOES NOT COME BACK HERE. That is the runtime's to contain: a
 * fiber whose Effect died is mounted, in `FAILED`, having installed nothing, and
 * what a row draws for it is the REPORT rather than anything this function knows.
 * Every arm below is a way the definition never became a fiber at all.
 */
const policyFor = (schema: Plugin["config"], one: Defined, warn: (line: string) => void): PolicyRow => {
  if (schema === undefined) return { config: {}, values: [] }
  if (schema.ast._tag === "Objects") for (const field of schema.ast.propertySignatures) {
    if (RESERVED.includes(String(field.name))) {
      throw new Error(`${String(field.name)} is reserved for the plugin's approval, its switch and the conversation building it`)
    }
  }
  return decodePolicy(schema, one.consent.nodes, one.consent.node,
    (key, value, reason) => warn(`${one.consent.file ?? CONFIGURATION_FILE}: ${one.name}.${key}: ${JSON.stringify(value)} uses its default — ${reason}`))
}

const start = (host: OwnedLoader, one: Defined, warn: (line: string) => void): Effect.Effect<Started> =>
  Effect.gen(function*() {
    const faulted = (why: string): Started => ({ up: false, version: one.version, why })
    const server = yield* Effect.promise(() => buildHalf("server", one.server))
    if (!server.ok) return faulted(server.why)
    const browser = one.browser === null
      ? null
      : yield* Effect.promise(() => buildHalf("browser", one.browser ?? ""))
    if (browser !== null && !browser.ok) return faulted(browser.why)
    const plugin = yield* Effect.promise(() => loaded(server.text))
    if (typeof plugin === "string") return faulted(plugin)
    // THE WORD IS THE VAULT'S, and a half that named itself something else would
    // be a fiber bound under a word no row draws — its kinds prefixed wrongly,
    // its sibling composed under a key the roster does not carry, its held
    // record written where nothing reads it. The stamp is the registry binding
    // everywhere else in this tree, and a definition is where this one is
    // decided, so the half does not get to disagree with it.
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
      policy,
      declaration: plugin.config,
      updates: plugin.configUpdates,
      version: one.version,
      mounted,
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
 * ONE PLUGIN AS A ROSTER ROW — and as the whole of its own page.
 *
 * The folder decides pending approval, invalid shape, compilation failure and
 * a switch somebody turned down. A mounted plugin's running, waiting or failed
 * state comes from its live registry report, just like a built row.
 *
 * `switched` IS THE PERSON'S `on` now, read off the settings file rather than
 * off a set in this process. The two unapproved arms are told apart the way
 * they always were: a version nobody said yes to is `pending` whatever the
 * switch says, because the switch is not the question being asked.
 */
const rowOf = (
  one: Defined,
  started: Started | undefined,
  report: RowReport | undefined,
  approvedSource: { readonly server: string; readonly browser: string | null } | undefined,
): BuiltPlugin => {
  const up = started?.up === true ? started : null
  // THE APPROVED HALVES ONLY WHERE THEY DIFFER, which is exactly the paused
  // row and exactly where a diff is drawn. A row whose code nobody has touched
  // would otherwise carry its own source twice on every roster.
  const was = approvedSource === undefined || isApproved(one) ? undefined : approvedSource
  const source = {
    folder: one.folder,
    title: one.title,
    description: one.description,
    ...(one.readme === null ? {} : { readme: one.readme }),
    version: one.version,
    approved: isApproved(one),
    on: one.on,
    server: one.server,
    ...(one.browser === null ? {} : { browser: one.browser }),
    ...(was === undefined || was.server === one.server ? {} : { approvedServer: was.server }),
    ...(was === undefined || was.browser === one.browser || was.browser === null ? {} : { approvedBrowser: was.browser }),
    ...(one.uses.length === 0 ? {} : { uses: one.uses }),
    ...(one.builder === null ? {} : { builder: one.builder }),
    ...(up?.path == null ? {} : { chunk: up.path }),
  }
  const at = (state: PluginState, more: Partial<BuiltPlugin> = {}): BuiltPlugin => ({
    name: one.name,
    running: state === "running",
    state,
    switchPersistence: "file",
    desiredOn: one.on,
    ...more,
    source,
    ...(up === null ? {} : {
      configurationValues: up.policy.values,
      ...(one.consent.node === undefined || one.consent.file === undefined
        ? {}
        : { configurationNode: { file: one.consent.file, id: one.consent.node.node.id } }),
    }),
  })
  const said = one.fault ?? (started?.up === false ? started.why : undefined)
  if (said !== undefined) return at("failed", { fault: said })
  if (!isApproved(one)) return at("pending")
  if (!one.on) return at("switched")
  if (up === null || report === undefined) return at("off")
  return at(report.state, {
    ...(report.state === "failed" && report.fault !== undefined ? { fault: report.fault } : {}),
    ...(report.state === "waiting" && report.missing !== undefined ? { missing: report.missing } : {}),
  })
}
