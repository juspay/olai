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

import { asDataUrl, buildPlugin, REGISTRY } from "@olai/plugin-build"
import { itemKey, UsageFailure, type OpFailure, type WriteRequest, type Reading } from "@olai/format"
import * as plugins from "@olai/plugin-api/services"
import { type OwnedLoader, type Mounted, type Plugin, type RowReport } from "@olai/plugin-api/services"
import type { BuiltPlugin } from "@olai/surface"
import { PLUGIN_BROWSER_FILE, PLUGIN_CHUNK_PREFIX, PLUGIN_SERVER_FILE, pluginFileOrder, type PluginState } from "@olai/surface"
import * as effect from "effect"
import { Effect } from "effect"
import { CONFIGURATION_FILE, decodePolicy, policyEdit, type PolicyRow } from "@olai/plugin-api/configuration"

import { readmeItem } from "./index.ts"
import { ALWAYS, APPROVED_KEY, CHECKED_KEY, type Defined, definedIn, isApproved, isBuilding, isOn, ON_KEY } from "./source.ts"

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
  /** Bring the mounted set into line with a revision ({@link follow}). It
   *  answers nothing: the caller republishes either way, because a revision
   *  that moved no plugin still moved the file it landed in. */
  readonly follow: (reading: Reading | null) => Effect.Effect<void>
  /** The text of a built browser file, by the path the roster published it
   *  under or the path its entry imports it by. `null` for anything else,
   *  which is a stale tab asking for a version that has been replaced. */
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
  /**
   * ...AND THE STANDING DECISION ON ITS OWN, which is a different gesture from
   * the one above and used to be the same one.
   *
   * *Always trust changes* is about CODE — every later version of this plugin
   * may run without being read again — and says nothing about whether the
   * plugin is running now. Spelled as {@link approve}`(name, true)` it also
   * wrote `on: yes`, so choosing it from the menu of a plugin somebody had
   * switched OFF turned it back on: a second decision, made silently, out of a
   * menu item whose words are about reading.
   *
   * `trusting: false` is the way back out, and the honest spelling of it is
   * this version rather than none: taking the standing approval away from a
   * plugin that is running must not stop it, because the person has read this
   * version — they are only saying they want to read the next one.
   */
  readonly trust: (name: string, trusting: boolean) => Effect.Effect<boolean, OpFailure>
  /**
   * REMOVE A PLUGIN — the folder's files and the decision about them.
   *
   * The halves are deliberately not in the sidebar's file tree, so no delete
   * verb anywhere else in the app reaches them: a person who asked for a
   * plugin in one sentence could not get rid of it in anything less than a
   * terminal. This is that gesture, and it is the page's because the page is
   * the only place the folder is a thing you can see.
   *
   * THE CONSENT GOES WITH IT, which is the one difference from deleting the
   * folder by hand. A folder somebody removed in Finder leaves its node where
   * it was — the decision is left where it was made, and putting the folder
   * back finds it again — but a person pressing **Delete** here is ending the
   * plugin, and a settings file that collected the consent of every plugin
   * anybody ever deleted would be a file nobody could read.
   *
   * FILES FIRST, NODE LAST, and they are separate writes because `delete` is
   * not a batchable op: a refusal halfway leaves code with its decision rather
   * than a decision with no code, which is the safer of the two halves to be
   * left holding.
   */
  readonly remove: (name: string) => Effect.Effect<boolean, OpFailure>
  /**
   * THE BUILDER SAYS IT IS DONE — `vault-plugins_run` at this version, which
   * the guide already requires as the last act of a build.
   *
   * WRITTEN AND NOT REMEMBERED (`./source.ts`'s `CHECKED_KEY` argues the
   * reboot). It is the only word on that node an agent's own call puts there,
   * and it is still not an agent's to write by hand: `configure` refuses it
   * with the other three, so the signal exists exactly where a build finished
   * cleanly and nowhere else.
   *
   * ONLY A CLEAN RUN COUNTS, which is the caller's half of the contract: the
   * preamble tells an agent to fix and run again, so the faulted runs in
   * between are the middle of a build, not the end of one.
   */
  readonly checked: (name: string, version: string) => Effect.Effect<boolean, OpFailure>
  readonly configure: (name: string, key: string, value: string | null) => Effect.Effect<boolean, OpFailure>
  /** One plugin as the vault holds it, for the verbs that answer about one.
   *  `null` for a word this vault does not define. */
  readonly defined: (name: string) => Defined | null
}

/** ONE PLUGIN THAT IS UP — what was mounted, with the chunk its face is served
 *  from and every other browser file that face imports, by the path each is
 *  served at. NOTHING ABOUT ITS STATE: that is the registry's and is read
 *  afresh (see {@link DynamicRuntime.rows}). */
interface Live {
  readonly mounted: Mounted
  readonly chunk: string | null
  readonly path: string | null
  readonly modules: ReadonlyMap<string, string>
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
 *
 * ## ...AND THE KNOBS IT WAS MADE AGAINST, for the same reason again
 *
 * `options` is the fingerprint of the plugin's settings at the moment of the
 * attempt — the second half of *what this attempt was made from*, since a
 * failed `apply` may have failed on a value somebody has since corrected. It
 * lived in a second map keyed by the same word, set beside every `started.set`
 * and deleted beside every `started.delete`: the exact shape the paragraph
 * above says was a bug waiting, written again one declaration below the
 * warning about it.
 */
type Started =
  | ({ readonly up: true; readonly version: string; readonly options: string; readonly policy: PolicyRow; readonly declaration: Plugin["config"]; readonly updates: Plugin["configUpdates"] } & Live)
  | { readonly up: false; readonly version: string; readonly options: string; readonly why: string }

/**
 * OPEN THE DYNAMIC HALF over a host.
 *
 * `built` is every word this build already has, so a definition cannot take one
 * (`./source.ts` argues why that is a fault and not an override).
 */
export const openDynamic = (
  host: OwnedLoader,
  built: ReadonlyArray<string>,
  write: (request: WriteRequest) => Effect.Effect<void, OpFailure> = () => Effect.fail(new UsageFailure({ reason: "The directory’s write door is unavailable." })),
  /**
   * THE CONVERSATION DOOR ON THIS SERVE right now, or `undefined` while
   * nobody stands behind it — read per call rather than held, because the chat
   * row comes and goes under this runtime (core's `ConversationsWatch` is the
   * broker the caller reads it through).
   *
   * Two facts come off it and both are per-revision. WHETHER ANYTHING CAN BE
   * ASKED at all, which is what the page's *ask* verbs are offered on
   * (`@olai/surface`'s `source.asking`); and WHICH PLUGINS HAVE A CHAT at
   * their page's address, asked of `here` inside {@link follow} and kept for
   * that revision ({@link chats}). A runtime composed without a door is a
   * serve where nothing can be asked and no plugin is being built, which is
   * the honest default.
   */
  conversations: () => plugins.Conversations | undefined = () => undefined,
): DynamicRuntime => {
  /** WHAT CAME OF THE LAST ATTEMPT AT EACH WORD — see {@link Started}. */
  const started = new Map<string, Started>()
  /** THE LAST FACE EACH WORD SERVED, kept after it stops — its entry and every
   *  file the entry imports. A tab imports a chunk named by the roster it is
   *  holding, and a row that leaves — switched off, edited, or its folder
   *  deleted — would otherwise 404 that import. One set per plugin, replaced
   *  when it starts again. */
  const retired = new Map<string, { readonly path: string; readonly chunk: string; readonly modules: ReadonlyMap<string, string> }>()
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
  const approvedSource = new Map<string, ReadonlyMap<string, string>>()
  /**
   * WHETHER A VERSION NOBODY HAS APPROVED WOULD EVEN COMPILE — kept per word,
   * at the version it was asked about, exactly as {@link Started} is.
   *
   * ## Compiling is not running, and the page used to be unable to say so
   *
   * Only an approved, switched-on plugin is mounted, so a half with a syntax
   * error or a forbidden import sat at `pending` — *Ready for you* — and the
   * only way to find out it was broken was to approve it. That is the worst
   * possible ordering of those two acts: the one gesture in this product where
   * a person is trusting code was also the way to discover the code is not
   * code. The mockup's *Mend* screen is exactly this state, and it is reachable
   * only if the fault is known before the decision.
   *
   * `buildPlugin` is a TRANSFORM — esbuild over text, no evaluation of any kind —
   * which is what makes this safe to do to source nobody has said yes to. The
   * module is still never imported until {@link start}, and {@link start} is
   * still only reached through an approval.
   *
   * Keyed by version so it is paid once per edit rather than once per revision:
   * a keystroke anywhere in the vault republishes, and a vault with ten
   * unapproved plugins would otherwise re-run ten esbuild passes for it.
   */
  const checkedBuilds = new Map<string, { readonly version: string; readonly why: string | null }>()

  /**
   * THE ITEM KEYS A CHAT IS ON, as of the revision this runtime last followed
   * — asked of chat by ITEM, so a row reads its own back through
   * `pluginReadme` ({@link rows}).
   *
   * ASKED PER REVISION AND KEPT, because the question is an EFFECT and a row
   * is a value: `Conversations.here` reads the vault as it stands when it
   * runs, and {@link rows} is called by a composition root that has a report
   * in hand and no place to wait. So the ask happens where there is already a
   * revision being followed, and what a row draws is this reading of it.
   *
   * Chat switched off is an empty set rather than a stale one: with no door
   * there is no chat anywhere, which is what a serve with chat off honestly
   * has.
   */
  let chats: ReadonlySet<string> = new Set()

  /**
   * BRING THE MOUNTED SET INTO LINE WITH A READING.
   *
   * IT ANSWERS NOTHING, and used to answer *whether anything moved* off a
   * string built out of every field `rowOf` reads. Nobody wanted the answer:
   * the one caller republishes the roster either way, because a revision that
   * moved no plugin still moved the file it landed in. What the fingerprint
   * did instead was rot — `checked` joined the row and never joined the
   * string, so had anybody ever gated on it, a build saying it was finished
   * would have reached no open tab. A comparison nothing reads is a comparison
   * nothing keeps honest.
   */
  const follow = (defined: ReadonlyArray<Defined>): Effect.Effect<void> =>
    Effect.gen(function*() {
      seen = defined
      /** The words this reading holds — what the per-word memories below are
       *  pruned against, read once rather than scanned per entry. */
      const held = new Set(defined.map((one) => one.name))
      const forget = (memory: Map<string, unknown>) => {
        for (const name of [...memory.keys()]) if (!held.has(name)) memory.delete(name)
      }
      // THE COPY FOR THE DIFF, taken while the version on disk is the version
      // that was approved — which is the only moment the bytes behind the hash
      // are in hand. A word this reading no longer holds takes its copy with
      // it, so a folder that was deleted and written again is not diffed
      // against a predecessor nobody approved.
      for (const one of defined) {
        if (isApproved(one)) approvedSource.set(one.name, one.code)
      }
      forget(approvedSource)
      // ...AND THE COMPILE OF WHAT NOBODY HAS APPROVED, for the same reason
      // one line up and at the other end of the decision: a person cannot be
      // asked to say yes to code before being told the code will not build
      // ({@link checkedBuilds}). Transform only; nothing here is imported.
      for (const one of defined) {
        if (one.fault !== null || isApproved(one) || one.server.trim() === "") { checkedBuilds.delete(one.name); continue }
        if (checkedBuilds.get(one.name)?.version === one.version) continue
        checkedBuilds.set(one.name, { version: one.version, why: yield* compiles(one) })
      }
      forget(checkedBuilds)
      // ...AND WHICH OF THEM A CHAT IS ABOUT, asked of chat rather than read
      // off the folder: the chat is a row in the vault titled with this
      // plugin's address, and nothing on the plugin's own node records it
      // ({@link chats}). ONE question per revision, over every page this
      // reading defines, so the answers are one reading of the vault rather
      // than one per plugin; and none at all on a serve with chat off, which
      // is the empty set.
      const door = conversations()
      chats = door === undefined
        ? new Set()
        : yield* door.here({ about: defined.map((one) => readmeItem(one.name)) })
      // WANTED IS APPROVED **AND** ON, and the two are different facts: a
      // plugin a person approved and then switched off is approved and not
      // running, and a plugin somebody switched on and then edited is on and
      // paused. Both are written down, both survive a restart, and the row
      // below says which is which.
      const wanted = new Map(
        defined
          .filter((one) => one.fault === null && isApproved(one) && isOn(one))
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
          if (!one.up && one.options === optionsKey(next)) continue
          if (one.up) {
            const policy = policyFor(one.declaration, next, warn)
            if (one.updates === "live" || JSON.stringify(policy.config) === JSON.stringify(one.policy.config)) {
              started.set(name, { ...one, policy, options: optionsKey(next) })
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
        if (one.up && one.path !== null && one.chunk !== null) retired.set(name, { path: one.path, chunk: one.chunk, modules: one.modules })
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
   *
   * ...COMPARED AGAINST WHAT THE NODE SAYS, verbatim, which is the second half
   * of the same lesson. `on` folded to a boolean cannot tell `no` from a word
   * that is not there, so switching OFF a plugin that was already off asked to
   * write `no` over `no` and was refused in the same way — and that is the one
   * press somebody repeats, because an agent kept writing and they pressed
   * Stop again ({@link ../source.ts}'s verbatim `on`).
   */
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
      // ASKING IS THE DOOR BEING THERE and nothing more; which plugin has a
      // chat is the answer {@link follow} already took for this revision.
      const asking = conversations() !== undefined
      return seen.map((one) =>
        rowOf(one, started.get(one.name), report.get(one.name), approvedSource.get(one.name), checkedBuilds.get(one.name), chats.has(itemKey(readmeItem(one.name))), asking))
    },
    names: () => seen.map((one) => one.name),
    follow: (reading) => follow(reading === null ? [] : definedIn(reading, built)),
    chunk: (path) => {
      for (const one of started.values()) {
        if (!one.up) continue
        if (one.path === path) return one.chunk
        // A FILE THE FACE IMPORTS is served at a path under the entry's own,
        // and found by the same equality: there is still no path to traverse.
        const module = one.modules.get(path)
        if (module !== undefined) return module
      }
      // ...and a face that has just left is still served for whoever is
      // already fetching it (the `retired` note above). The version is in the
      // path, so this can only answer with the bytes that path named.
      for (const one of retired.values()) {
        if (one.path === path) return one.chunk
        const module = one.modules.get(path)
        if (module !== undefined) return module
      }
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
    trust: (name, trusting) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      // THE SWITCH IS NOT TOUCHED, which is the whole of what separates this
      // from `approve` one line up: a standing decision about CODE says
      // nothing about whether the plugin is wanted running right now.
      const request = consent(one, { [APPROVED_KEY]: trusting ? ALWAYS : one.version })
      if (request !== null) yield* write(request)
      return true
    }),
    remove: (name) => Effect.gen(function*() {
      const one = seen.find((one) => one.name === name)
      if (one === undefined) return false
      // THE FOLDER'S OWN ORDER rather than the set's, so the writes a ledger
      // records read the way the page lists the files: prose, server, face,
      // then every other code file by path.
      for (const file of one.holds) yield* write({ op: "delete", file: `${one.folder}${file}` })
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

/**
 * THE THREE WORDS NOTHING MAY DECLARE AS A KNOB — the plugin's approval, its
 * switch and its builder's done signal.
 *
 * They sit on the same node a plugin's knobs do, which is the whole of why
 * they have to be refused by name: a `Config` field called `on` would be a
 * plugin whose settings quietly decide whether it runs, one called `approved`
 * would be a plugin that can say yes to itself, and one called `checked` would
 * be a plugin that declares itself finished — ringing *Ready for you* at a
 * folder its author is halfway through.
 *
 * `builder` WAS A FOURTH and is not reserved any more. The conversation
 * building a plugin is the chat at its page's address now, so nothing writes
 * that word and nothing reads it: one left over on a node somewhere is an
 * ordinary custom property, which a plugin that does not declare it ignores
 * exactly as it ignores any other.
 */
export const RESERVED: ReadonlyArray<string> = [APPROVED_KEY, ON_KEY, CHECKED_KEY]

/** ...AND THE SENTENCE A PERSON OR AN AGENT IS GIVEN FOR ONE, once. A schema
 *  that declares a reserved word faults the row and `plugins.configure` refuses
 *  to write one; both used to spell this out, and both drifted the morning the
 *  list changed. */
export const RESERVED_SAID =
  "is reserved for the plugin's approval, its switch and the signal that its"
  + " builder has finished"

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

/**
 * BOTH ENTRIES OF ONE DEFINITION, BUILT with every file each imports — or the
 * builder's sentence for the first that will not build.
 *
 * The server's files are linked as `data:` modules, because that is how the
 * serve evaluates them; the browser's at paths under the entry's own chunk,
 * which is where the tab fetches them ({@link DynamicRuntime.chunk}). What is
 * built is `one.code`, the files of the reading whose hash is `one.version`.
 */
const builtFrom = (one: Defined) =>
  Effect.gen(function*() {
    const server = yield* Effect.promise(() =>
      buildPlugin("server", PLUGIN_SERVER_FILE, one.code, (_path, text) => asDataUrl(text)))
    if (!server.ok) return { ok: false as const, why: server.why }
    if (one.browser === null) return { ok: true as const, server, browser: null }
    const base = chunkBaseOf(one)
    const browser = yield* Effect.promise(() =>
      buildPlugin("browser", PLUGIN_BROWSER_FILE, one.code, (path) => `${base}/${path}.js`))
    if (!browser.ok) return { ok: false as const, why: browser.why }
    return { ok: true as const, server, browser }
  })

/** Where a version's face is served from: the entry at `<base>.js`, and each
 *  file it imports at `<base>/<path>.js`. The version is in it, so an approved
 *  edit is a different address and no cache can hand back older code. */
const chunkBaseOf = (one: Defined): string => `${PLUGIN_CHUNK_PREFIX}${one.name}-${one.version}`

/**
 * WOULD THIS SOURCE BUILD — asked of a version nobody has approved, answered
 * with the builder's own sentence or `null`.
 *
 * {@link builtFrom} is the same transform {@link start} runs and
 * `vault-plugins_write` answers with; what is NOT here is {@link loaded},
 * which is the import. A plugin nobody has said yes to is never evaluated, and
 * this is the line that says so in code: a syntax error, a forbidden import, an
 * import of a file the folder does not hold and a file that names a module olai
 * does not bind are all decided over text.
 */
export const compiles = (one: Defined): Effect.Effect<string | null> =>
  Effect.map(builtFrom(one), (built) => (built.ok ? null : built.why))

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
    const built = yield* builtFrom(one)
    if (!built.ok) return faulted(built.why)
    const { server, browser } = built
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
      options,
      policy,
      declaration: plugin.config,
      updates: plugin.configUpdates,
      version: one.version,
      mounted,
      chunk: browser === null ? null : browser.text,
      path: browser === null ? null : `${chunkBaseOf(one)}.js`,
      modules: new Map(browser === null ? [] : browser.modules.map((module) => [`${chunkBaseOf(one)}/${module.path}.js`, module.text] as const)),
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
  const url = asDataUrl(text)
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
  approvedSource: ReadonlyMap<string, string> | undefined,
  /** What the transform made of a version nobody has approved, where there is
   *  one to report ({@link checkedBuilds}). */
  pending: { readonly version: string; readonly why: string | null } | undefined,
  /** Whether a chat is at this plugin's page address — what makes it a plugin
   *  an agent is building, and what the page opens beside it ({@link chats}). */
  chat: boolean,
  /** Whether this serve can speak into a conversation at all. */
  asking: boolean,
): BuiltPlugin => {
  const up = started?.up === true ? started : null
  // THE APPROVED FILES ONLY WHERE THEY DIFFER, which is exactly the paused
  // row and exactly where a diff is drawn ({@link filesOf}). A row whose code
  // nobody has touched would otherwise carry its own source twice on every roster.
  const was = approvedSource === undefined || isApproved(one) ? undefined : approvedSource
  const source = {
    folder: one.folder,
    title: one.title,
    description: one.description,
    ...(one.readme === null ? {} : { readme: one.readme }),
    version: one.version,
    approved: isApproved(one),
    // AN APPROVAL EXISTS, for some version — what tells a plugin nobody has
    // read from one that was read and has since changed.
    ...(one.approved === null ? {} : { decided: true }),
    ...(one.approved === ALWAYS ? { trusting: true } : {}),
    // WHETHER AN AGENT IS STILL WRITING IT, decided here rather than sent as
    // the version the builder last ran: the protocol — which call means done,
    // which file order a build follows — is this serve's, and a page that
    // compared two hashes for itself held half a contract it could not read
    // (`./source.ts`'s `isBuilding`).
    ...(isBuilding(one, chat) ? { building: true } : {}),
    on: isOn(one),
    server: one.server,
    ...(one.browser === null ? {} : { browser: one.browser }),
    files: filesOf(one.code, was),
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
  // THE FOLDER'S OWN FAULT FIRST, then what a mount made of it, then what the
  // transform made of a version nobody has approved — three sources for one
  // sentence, in the order of how early the trouble was known. The third is
  // what puts a broken unapproved plugin on the *could not start* screen
  // instead of asking somebody to approve it to find out ({@link checkedBuilds}).
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

/**
 * EVERY CODE FILE AS THE ROW CARRIES IT, in the page's order — and, on a
 * paused row, the approved text of each file that differs: `""` for a file
 * added since the approval, and no `text` for one removed since.
 */
const filesOf = (
  code: ReadonlyMap<string, string>,
  was: ReadonlyMap<string, string> | undefined,
): ReadonlyArray<{ readonly path: string; readonly text?: string; readonly approved?: string }> =>
  pluginFileOrder([...code.keys(), ...(was?.keys() ?? [])]).map((path) => {
    const text = code.get(path)
    const approved = was === undefined ? text : was.get(path) ?? ""
    return {
      path,
      ...(text === undefined ? {} : { text }),
      ...(approved === text ? {} : { approved }),
    }
  })
