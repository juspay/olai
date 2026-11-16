/** Vault-defined source, approval, compilation and chunks belong to this
 * provider. The host grants an owned loader; this policy decides what may be
 * loaded. Withdrawing this scope closes its plugins and HTTP integration,
 * while writes already accepted by the vault remain durable. */
import { slotCatalog } from "@olai/plugin-api/slots"
import { ConversationsWatch, definePlugin, FileKinds, HostLoading, Ops, Offers, Surfaces, Vault, BundleModules } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Ops as Gate } from "@olai/ops"
import { buildHalf, WRITABLE_MODULES } from "@olai/plugin-build"
import { Effect } from "effect"
import type { ImplementSurfaceDeps } from "@kolu/surface/server"
/** THIS ROW'S AGENT VERBS ({@link ./tools.ts}), handed to the host beside its
 *  faces. They were hand-written `BespokeTool`s inside `olai-plugin-mcp` until
 *  #546 — one row's vocabulary held by another row — and they leave with this
 *  row now, because this row is what brought them. */
import { tools } from "./tools.ts"
import { surface, faces } from "./surface.ts"
import { NotFoundFailure, UsageFailure, type Reading } from "@olai/format"
import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import type { Snapshot } from "@olai/store"
import {
  PLUGIN_BROWSER_FILE,
  PLUGIN_FOLDER,
  PLUGIN_README_FILE,
  PLUGIN_SERVER_FILE,
} from "@olai/surface"
import { name, chunks, slugOf } from "./index.ts"
import { openDynamic, RESERVED } from "./runtime.ts"
import { pluginChunks } from "./route.ts"
import { claim } from "./claim.ts"
import { GUIDE } from "./guide.ts"
import { APPROVED_KEY, isApproved, ON_KEY, versionOf, WORD } from "./source.ts"
export { name } from "./index.ts"

/** The three files a folder takes, by the argument `vault-plugins_write` is
 *  given. Keyed so an agent's typo is answered with the list rather than with
 *  a path it never asked for. */
const FILES: Readonly<Record<string, true>> = {
  [PLUGIN_README_FILE]: true,
  [PLUGIN_SERVER_FILE]: true,
  [PLUGIN_BROWSER_FILE]: true,
}

/**
 * WHAT THE BUILDER IS TOLD BEFORE IT IS ASKED FOR ANYTHING — the preamble, in
 * the lane chat already teaches its agents in.
 *
 * FIVE SENTENCES, and each of them exists because an agent that was not told
 * it got it wrong on this branch: it wrote the two halves and no README, so the
 * page had nothing to say the plugin DID; it wrote against a memory of olai's
 * services rather than reading the live registry; it put the files somewhere
 * of its own choosing; it stopped without checking, leaving a person to find
 * the compile error; and it tried to approve its own work, which is the one
 * thing it can never do.
 *
 * It rides chat's teaching seam rather than a channel of this row's own,
 * because that seam already answers the two questions a preamble has: WHERE it
 * goes (into the first user message, since ACP has no system prompt) and HOW
 * MANY TIMES (once per session, marked, so a reopened conversation is not
 * lectured again).
 */
const preambleFor = (word: string, title: string): ReadonlyArray<string> => [
  `You are building a plugin for this olai vault. It is called "${title}" and its word is `
    + `\`${word}\`, so everything it is lives in \`${PLUGIN_FOLDER}${word}/\`.`,
  `Call \`vault-plugins_guide\` before you write anything. It is the whole authoring guide, `
    + `shipped inside this binary, and it is the only correct description of what a half may `
    + `import and what it may name. Call \`vault-plugins_inspect\` for the live lists.`,
  `Write all three files with \`vault-plugins_write\`: \`${PLUGIN_README_FILE}\` first and for a `
    + `PERSON — a \`# Title\` line, a blank line, then one sentence saying what it does, then as `
    + `much prose as it deserves — and then \`${PLUGIN_SERVER_FILE}\`, and `
    + `\`${PLUGIN_BROWSER_FILE}\` if it draws anything.`,
  `Finish by calling \`vault-plugins_run\`. If it answers a fault, fix it and run again.`,
  `You cannot turn it on. \`pending\` is not a failure — it is a person being asked, with your `
    + `code in front of them, and only they can press the button. Say when it is ready.`,
]

export default definePlugin({
  name, needs: [HostLoading, Ops, Offers, Surfaces, Vault, BundleModules, FileKinds, ConversationsWatch],
  apply: Effect.gen(function*() {
    const moduleCatalog = yield* (yield* BundleModules).read
    const describedSlots = slotCatalog(moduleCatalog.map(module => module.exports))
    const loading = yield* HostLoading
    const gate = (yield* Ops).gate as Gate
    // THE CONVERSATION DOOR, READ PER CALL rather than held: the broker is
    // core's and is always there, and what stands behind it comes and goes
    // with the chat row.
    //
    // A BROKER AND NOT A COMPONENT, which this branch learned the hard way: a
    // row's report FOLDS its components, so a component waiting for a chat
    // somebody switched off made this whole row read `waiting` — out of the
    // roster, the tab's chunk never loaded, and the plugin's page, the
    // sidebar's section and the palette's row gone with it. A page about a
    // folder has nothing to do with chat and must not leave when chat does
    // (`@olai/plugin-api`'s `ConversationsWatch` states the rule).
    const builders = yield* ConversationsWatch
    // THE CLAIM FIRST, because nothing below can see a plugin until `.ts` under
    // `plugins/` is a kind of file this serve holds. It leaves with this row:
    // switch vault-plugins off and the halves stop being in the set, which is
    // the honest state — there is nothing here to read them.
    yield* (yield* FileKinds).register(claim)
    const dynamic = openDynamic(yield* loading.acquire, loading.reserved, request => Effect.gen(function*() {
      yield* gate.run(request, "web")
      yield* followed(yield* gate.read)
    }), () => builders.current() !== undefined)
    const settling = <T, E>(run: Effect.Effect<T, E>) => Effect.ensuring(run, Effect.sync(loading.changed))
    const followed = (read: Reading | null) => Effect.asVoid(settling(dynamic.follow(read)))
    yield* Effect.addFinalizer(() => Effect.asVoid(dynamic.follow(null)))
    yield* loading.describe({ names: dynamic.names, rows: dynamic.rows, set: (name, enabled) => settling(dynamic.set(name, enabled)), configure: dynamic.configure })
    yield* (yield* Vault).revision<Snapshot<Reading>>(snapshot => followed(snapshot.value))
    yield* (yield* Vault).unloaded(followed(null))

    /** The plugin this verb is about, re-read first so the answer is about the
     *  revision that is on disk rather than the one this runtime last followed. */
    const lookingAt = (word: string) => Effect.gen(function*() {
      yield* followed(yield* Effect.catch(gate.read, () => Effect.succeed(null)))
      const one = dynamic.defined(word)
      if (one !== null) return one
      return yield* Effect.fail(new NotFoundFailure({
        reason: `this vault defines no plugin called "${word}". A plugin is the folder `
          + `\`${PLUGIN_FOLDER}${word}/\`, holding \`${PLUGIN_SERVER_FILE}\` and a `
          + `\`${PLUGIN_README_FILE}\` saying what it does.`,
        named: word,
      }))
    })

    const deps: ImplementSurfaceDeps<typeof surface.spec> = { procedures: { plugins: {
      approve: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          if (one.version !== input.version) {
            return yield* Effect.fail(new NotFoundFailure({
              reason:
                `"${input.name}" has been edited since this page drew it, so approving `
                + `it now would approve source nobody has read. Look again, read what `
                + `it says, and approve that.`,
              named: input.name,
            }))
          }
          if (one.fault !== null) {
            return yield* Effect.fail(new UsageFailure({
              reason: `"${input.name}" cannot run as it stands: ${one.fault}`,
            }))
          }
          yield* dynamic.approve(input.name, input.forever)
          return {}
        }),

      trust: ({ input }) =>
        Effect.gen(function*() {
          yield* lookingAt(input.name)
          yield* dynamic.trust(input.name, input.trusting)
          return {}
        }),

      remove: ({ input }) =>
        Effect.gen(function*() {
          yield* lookingAt(input.name)
          yield* settling(dynamic.remove(input.name))
          return {}
        }),

      mint: ({ input }) =>
        Effect.gen(function*() {
          const title = input.title.trim()
          const word = slugOf(title)
          if (title === "" || !WORD.test(word)) {
            return yield* Effect.fail(new UsageFailure({
              reason: `"${input.title}" does not make a plugin word. A word is lowercase letters, `
                + `digits and hyphens, starting with a letter — give it a name with a letter in it.`,
            }))
          }
          yield* followed(yield* Effect.catch(gate.read, () => Effect.succeed(null)))
          if (loading.reserved.includes(word) || dynamic.names().includes(word)) {
            return yield* Effect.fail(new UsageFailure({
              reason: `"${word}" is already taken — ${loading.reserved.includes(word)
                ? "this build ships a plugin by that name"
                : "this vault already has a plugin in that folder"}. Call it something else.`,
            }))
          }
          // THE FOLDER IS THE PLUGIN, so the README is what creates it — and it
          // carries the person's own sentence, verbatim, because that sentence
          // is the best description of the thing that will ever exist and
          // nobody should have to wait for an agent to paraphrase it.
          const sentence = input.sentence.trim()
          yield* gate.run({
            op: "create-doc",
            file: `${PLUGIN_FOLDER}${word}/${PLUGIN_README_FILE}`,
            text: `# ${title}\n\n${sentence === "" ? `A plugin called ${title}.` : sentence}\n`,
          }, "web")
          yield* followed(yield* Effect.catch(gate.read, () => Effect.succeed(null)))
          const address = `/plugins/${word}`
          const chat = builders.current()
          if (chat === undefined) {
            return { name: word, address, builder: null,
              refusal: "No agent is available on this serve, so nobody is building it. The folder is "
                + "there and you can write the files yourself." }
          }
          const engine = input.engine.trim() === ""
            ? chat.engines()[0]?.id ?? ""
            : input.engine.trim()
          if (engine === "") {
            return { name: word, address, builder: null,
              refusal: "No agent is set up on this machine, so nobody is building it. The folder is "
                + "there and you can write the files yourself." }
          }
          // ...AND EVERY WAY THE BUILDER CAN FAIL TO START IS A REFUSAL BESIDE
          // THE ADDRESS, never a failed call. The folder is already on disk by
          // the time chat is asked for anything, so a call that failed whole —
          // no Inbox with capture off, a settings write the gate refused —
          // left the person looking at an error, with the folder made, and the
          // same name refused as taken when they tried again. The two absent
          // arms above answer that way for *there is no chat at all*; this
          // answers the same way for *chat would not take it*, because what a
          // person can do about either is identical: go to the page, read what
          // happened, write the files or ask again.
          //
          // The sentence is the gate's own: core's door answers `{ _tag }`
          // because `@olai/plugin-api` may not import the format, and this row
          // does — so a failure chat produced already carries the prose.
          const started = yield* Effect.catch(
            chat.open({
              parent: null,
              title,
              engine,
              say: sentence === "" ? `Build a plugin called ${title}.` : sentence,
              teach: preambleFor(word, title),
            }),
            (refusal) => Effect.succeed({ node: null, refusal: (refusal as UsageFailure).message }),
          )
          if (started.node === null) return { name: word, address, builder: null, refusal: started.refusal }
          // The binding is a settings write and can be refused on its own. The
          // conversation exists either way and the page can still reach it.
          const bound = yield* Effect.result(dynamic.bind(word, started.node))
          return {
            name: word,
            address,
            builder: started.node,
            refusal: bound._tag === "Failure"
              ? `The conversation was started, but olai could not write it down: ${bound.failure.message}`
              : started.refusal,
          }
        }),

      ask: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          const chat = builders.current()
          if (chat === undefined || one.builder === null) return { builder: null }
          const row = dynamic.rows(yield* loading.reports).find(row => row.name === input.name)
          const fault = one.fault ?? row?.fault ?? null
          // WHAT THE PLUGIN IS ACTUALLY DOING, where the caller said nothing.
          // It used to read "is running" whatever state the row was in, so an
          // agent asked for a change to a plugin that was waiting for a key,
          // switched off or sitting unapproved was told something false in the
          // first sentence it read.
          const said = input.said.trim() !== ""
            ? input.said
            : fault !== null
              // THE FAULT VERBATIM, because the serve already knows it and an
              // agent told "it broke" has to go and find out what.
              ? `The plugin \`${one.name}\` will not start. olai says: ${fault}\n\n`
                + `Its files are in \`${one.folder}\`. Please fix it and call \`vault-plugins_run\` again.`
              : `The plugin \`${one.name}\` is ${row?.state ?? "off"} (its files are in `
                + `\`${one.folder}\`). I have not said what I want changed yet.`
          const went = yield* chat.say({ node: one.builder, text: said })
          return { builder: went ? one.builder : null }
        }),

      run: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          const row = dynamic.rows(yield* loading.reports).find((one) => one.name === input.name)
          // THE CALL IS THE DONE SIGNAL, and remembering it here is what keeps
          // *Ready for you* from ringing at a folder whose face is still being
          // written: the guide requires this call as the last act of a build,
          // so an agent that has made it has said the folder is finished at
          // this version (`./runtime.ts`'s `checked`).
          dynamic.checked(one.name, one.version)
          // ...and the roster is republished for it: nothing on disk moved, so
          // the follow above found nothing, and the page, the sidebar's mark
          // and the alert all read this fact off the roster.
          yield* Effect.sync(loading.changed)
          return {
            name: one.name,
            version: one.version,
            state: row?.state ?? "off",
            approved: isApproved(one),
            configurationValues: row?.configurationValues ?? [],
            ...(row?.fault === undefined ? {} : { fault: row.fault }),
          }
        }),

      stop: ({ input }) =>
        Effect.gen(function*() {
          yield* lookingAt(input.name)
          yield* settling(dynamic.set(input.name, false))
          return {}
        }),

      guide: () =>
        Effect.succeed({
          text: GUIDE,
          files: { readme: PLUGIN_README_FILE, server: PLUGIN_SERVER_FILE, browser: PLUGIN_BROWSER_FILE },
          folder: PLUGIN_FOLDER,
        }),

      write: ({ input }) =>
        Effect.gen(function*() {
          const word = input.name.trim()
          if (!WORD.test(word)) {
            return yield* Effect.fail(new UsageFailure({
              reason: `"${input.name}" is not a plugin word. A word is lowercase letters, digits `
                + `and hyphens, starting with a letter — it names the folder this file goes in.`,
            }))
          }
          if (FILES[input.file] !== true) {
            return yield* Effect.fail(new UsageFailure({
              reason: `a plugin holds three files and "${input.file}" is none of them: `
                + `\`${PLUGIN_README_FILE}\`, \`${PLUGIN_SERVER_FILE}\` and \`${PLUGIN_BROWSER_FILE}\`. `
                + `Anything else belongs in your own notes.`,
            }))
          }
          if (loading.reserved.includes(word)) {
            return yield* Effect.fail(new UsageFailure({
              reason: `this build already has a plugin called "${word}", so a folder in the vault `
                + `cannot take that word. Call it something else.`,
            }))
          }
          const path = `${PLUGIN_FOLDER}${word}/${input.file}`
          const before = yield* Effect.catch(gate.read, () => Effect.succeed(null))
          const held = before?.set.documents.some(document => document.path === path) ?? false
          // WRITE OR CREATE, told apart by what the set holds — the same split
          // `markdown_write` and `markdown_create` keep, so a typo in the word
          // cannot quietly mint a second folder when the author meant an edit.
          yield* gate.run(held ? { op: "doc", file: path, text: input.text } : { op: "create-doc", file: path, text: input.text }, "mcp")
          yield* followed(yield* Effect.catch(gate.read, () => Effect.succeed(null)))
          const one = dynamic.defined(word)
          const version = one?.version ?? versionOf(input.file === PLUGIN_SERVER_FILE ? input.text : "", null)
          if (input.file === PLUGIN_README_FILE) return { path, version }
          // ...AND THE COMPILE RESULT IN THE SAME REPLY, which is the whole of
          // why this verb exists rather than `markdown_write` with a path: the
          // author's loop is write, learn, fix, and a write that answered only
          // "written" would make every one of those two calls.
          const half = input.file === PLUGIN_SERVER_FILE ? "server" as const : "browser" as const
          const built = yield* Effect.promise(() => buildHalf(half, input.text))
          return { path, version, compiles: built.ok, ...(built.ok ? {} : { why: built.why }) }
        }),

      inspect: () =>
        Effect.sync(() => ({
          modules: WRITABLE_MODULES,
          services: [
            ...loading.services().map((key) => ({
              key, half: "server" as const,
              availability: key.includes(".") ? "provided" as const : "core" as const,
            })),
            ...loading.browserServices().map((key) => ({
              key, half: "browser" as const, availability: "declared" as const,
            })),
          ],
          slots: describedSlots,
          layout: {
            folder: PLUGIN_FOLDER,
            readme: PLUGIN_README_FILE,
            server: PLUGIN_SERVER_FILE,
            browser: PLUGIN_BROWSER_FILE,
            settings: {
              file: CONFIGURATION_FILE,
              schema: "Config",
              properties: `a node titled after the plugin's word in ${CONFIGURATION_FILE}; `
                + `its properties are the Config leaves and child nodes hold schema sections`,
              reserved: RESERVED,
            },
          },
          taken: [...loading.reserved, ...dynamic.names()],
        })),
    } } }
    yield* (yield* Surfaces).register({ surface, deps, faces, tools })
    yield* (yield* Offers).own("chunks", () => ({ chunk: dynamic.chunk }))
  }),
})

export const components = {
  http: definePlugin({ name: "http", needs: [chunks, TransportSurface], apply: Effect.gen(function*() {
    yield* (yield* TransportSurface).register({ passive: true, routes: pluginChunks(yield* chunks) })
  }) }),
}

/** Static sibling metadata matches the browser-owned client. Agent grants
 * belong to the standalone aliases registered by this activation, so copying
 * them here would advertise a second set of namespaced agent tools. */
import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
export { APPROVED_KEY, ON_KEY }
