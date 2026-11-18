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
  PLUGIN_FILES,
  PLUGIN_FOLDER,
  PLUGIN_README_FILE,
  PLUGIN_SERVER_FILE,
  WORD,
} from "@olai/surface"
import { name, chunks, pluginReadme, readmeItem, slugOf } from "./index.ts"
import { openDynamic, RESERVED } from "./runtime.ts"
import { pluginChunks } from "./route.ts"
import { claim } from "./claim.ts"
import { GUIDE } from "./guide.ts"
import { APPROVED_KEY, type Decides, isApproved, ON_KEY, refusalFor, versionOf } from "./source.ts"
export { name } from "./index.ts"

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
 * WHAT IS NOT HERE is the `---` block: chat's own note contract already tells
 * every note's agent to leave the front matter at the top of the file exactly
 * as it is (`olai-plugin-chat`'s `teaching.ts`), and a builder's chat is a
 * note's chat — the README's. The two arrive in the same first message, so a
 * sentence of this row's own was the same instruction twice, two lines apart.
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
    }), () => builders.current())
    const settling = <T, E>(run: Effect.Effect<T, E>) => Effect.ensuring(run, Effect.sync(loading.changed))
    const followed = (read: Reading | null) => Effect.asVoid(settling(dynamic.follow(read)))
    yield* Effect.addFinalizer(() => Effect.asVoid(dynamic.follow(null)))
    yield* loading.describe({ names: dynamic.names, rows: dynamic.rows, set: (name, enabled) => settling(dynamic.set(name, enabled)), configure: dynamic.configure })
    yield* (yield* Vault).revision<Snapshot<Reading>>(snapshot => followed(snapshot.value))
    yield* (yield* Vault).unloaded(followed(null))
    /** LEVEL WITH WHAT IS ON DISK — every verb that answers about a plugin
     *  starts here, because the revision this runtime last followed and the
     *  revision a press arrived after are two different things. A read that
     *  fails is an unopened vault and follows nothing, which is the same
     *  answer as a vault with no plugins in it. */
    const abreast = Effect.suspend(() => Effect.andThen(
      Effect.catch(gate.read, () => Effect.succeed(null)),
      (read) => followed(read),
    ))

    /** The plugin this verb is about, re-read first so the answer is about the
     *  revision that is on disk rather than the one this runtime last followed. */
    const lookingAt = (word: string) => Effect.gen(function*() {
      yield* abreast
      const one = dynamic.defined(word)
      if (one !== null) return one
      return yield* Effect.fail(new NotFoundFailure({
        reason: `this vault defines no plugin called "${word}". A plugin is the folder `
          + `\`${PLUGIN_FOLDER}${word}/\`, holding \`${PLUGIN_SERVER_FILE}\` and a `
          + `\`${PLUGIN_README_FILE}\` saying what it does.`,
        named: word,
      }))
    })

    /**
     * ...AND THE SAME PLUGIN, WITH THE DECISION ABOUT ITS CODE ALREADY
     * JUDGED — every verb that moves `approved` through this door.
     *
     * The reading is `./source.ts`'s ({@link refusalFor}) so that one place
     * says what may be written and three verbs obey it. A door that let each
     * of them ask on its own is how *Always trust changes* came to be an
     * approval with no version in it, written out of a menu over source
     * nobody had read.
     */
    const decided = (word: string, decides: Decides, version: string) => Effect.gen(function*() {
      const one = yield* lookingAt(word)
      const refusal = refusalFor(one, decides, version)
      if (refusal === null) return one
      return yield* Effect.fail(refusal.kind === "moved"
        ? new NotFoundFailure({ reason: refusal.reason, named: word })
        : new UsageFailure({ reason: refusal.reason }))
    })

    const deps: ImplementSurfaceDeps<typeof surface.spec> = { procedures: { plugins: {
      approve: ({ input }) =>
        Effect.gen(function*() {
          yield* decided(input.name, "approve", input.version)
          yield* dynamic.approve(input.name, input.forever)
          return {}
        }),

      trust: ({ input }) =>
        Effect.gen(function*() {
          yield* decided(input.name, input.trusting ? "trust" : "untrust", input.version)
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
          yield* abreast
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
            file: pluginReadme(word),
            text: `# ${title}\n\n${sentence === "" ? `A plugin called ${title}.` : sentence}\n`,
          }, "web")
          yield* abreast
          // ...AND THE FOLDER IS THE WHOLE ANSWER. The word goes back and
          // nothing else does: the palette navigates through the page's own
          // route module, which is the one author of `/plugins/<word>`, and
          // everything a person needs to know about the build — whether an
          // agent took it, what it is doing, what went wrong — is on the page,
          // off the roster, which is where they are looking a moment later.
          //
          // NO WAY THE BUILDER CAN FAIL TO START FAILS THIS CALL, which is the
          // guarantee this arrangement exists for and the reason for the catch
          // below. The folder is already on disk by the time chat is asked for
          // anything, so a call that failed whole — no Inbox with capture off,
          // a settings write the gate refused — left the person looking at an
          // error, with the folder made, and the same name refused as taken
          // when they tried again.
          const chat = builders.current()
          if (chat === undefined) return { name: word }
          const engine = input.engine.trim() === ""
            ? chat.engines()[0]?.id ?? ""
            : input.engine.trim()
          if (engine === "") return { name: word }
          // THE CHAT IS THE README'S, and that is the whole of the binding:
          // the file this mint has just written IS the plugin's note, so the
          // tie goes in its own front matter and nothing has to be kept in
          // step with the folder's name.
          yield* Effect.result(chat.open({
            about: readmeItem(word),
            engine,
            say: sentence === "" ? `Build a plugin called ${title}.` : sentence,
            teach: preambleFor(word, title),
          }))
          // ...AND THE ROSTER IS READ AGAIN, because the row that just arrived
          // is what makes this plugin *being built*: the runtime asks chat
          // which plugins have one while it follows a revision, and the
          // revision this call is level with was read before the chat existed.
          yield* abreast
          return { name: word }
        }),

      ask: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          const chat = builders.current()
          if (chat === undefined) return { sent: false }
          const row = dynamic.rows(yield* loading.reports).find(row => row.name === input.name)
          // THE ROW'S OWN SENTENCE, whichever of the three sources produced it:
          // `rowOf` owns that precedence (folder, failed mount, failed pending
          // compile) and a second spelling here would be a shorter rule that
          // drifts the day a fourth source arrives.
          const fault = row?.fault ?? null
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
          // THE README AND NOT A NODE: chat looks up the conversation tied to
          // this plugin's own note, so a README somebody deleted or a chat
          // they closed is `false` here rather than words sent nowhere.
          return { sent: yield* chat.say({ about: readmeItem(input.name), text: said }) }
        }),

      run: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          const row = dynamic.rows(yield* loading.reports).find((one) => one.name === input.name)
          // A CLEAN RUN IS THE DONE SIGNAL, and that is two conditions, not
          // one: the guide requires this call as the last act of a build, AND
          // the preamble tells an agent that answered a fault to fix it and
          // call again. So the faulted runs in between are the middle of the
          // build — counting them rang *couldn't start* at a folder the agent
          // was still writing, and the next file it saved put the row back to
          // *Being built*, which is a notification that was never true and a
          // sidebar that flickered between two wrong states.
          //
          // WRITTEN, not remembered: it goes on the plugin's settings node, so
          // a build that finished before a reboot is still finished after one
          // (`./source.ts`'s `CHECKED_KEY`). The write publishes a revision,
          // and the page, the sidebar's mark and the alert all read the fact
          // off the roster that revision rebuilds.
          // THE ROW'S OWN SENTENCE, whichever of the three sources produced it:
          // `rowOf` owns that precedence (folder, failed mount, failed pending
          // compile) and a second spelling here would be a shorter rule that
          // drifts the day a fourth source arrives.
          const fault = row?.fault ?? null
          if (fault === null) yield* settling(dynamic.checked(one.name, one.version))
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
          // THE FOLDER'S OWN THREE NAMES (`@olai/surface`'s `PLUGIN_FILES`): this
          // was a membership table of its own, which is the same list the page's
          // address, the folder reader and **Delete…** each kept a copy of.
          if (!PLUGIN_FILES.some((held) => held === input.file)) {
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
          yield* abreast
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
