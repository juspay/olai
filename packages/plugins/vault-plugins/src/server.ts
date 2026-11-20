import { slotCatalog } from "@olai/plugin-api/slots"
import { ConversationsWatch, definePlugin, FileKinds, HostLoading, Ops, Offers, Surfaces, Vault, BundleModules } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Ops as Gate } from "@olai/ops"
import { buildHalf, WRITABLE_MODULES } from "@olai/plugin-build"
import { Effect } from "effect"
import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { tools } from "./tools.ts"
import { surface, faces } from "./surface.ts"
import { NotFoundFailure, UsageFailure, type Reading } from "@olai/format"
import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
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
    const builders = yield* ConversationsWatch
    yield* (yield* FileKinds).register(claim)
    const dynamic = openDynamic(yield* loading.acquire, loading.reserved, request => Effect.gen(function*() {
      yield* gate.run(request, "web")
      yield* followed(yield* gate.read)
    }), () => builders.current())
    const settling = <T, E>(run: Effect.Effect<T, E>) => Effect.ensuring(run, Effect.sync(loading.changed))
    const followed = (read: Reading | null) => Effect.asVoid(settling(dynamic.follow(read)))
    yield* Effect.addFinalizer(() => Effect.asVoid(dynamic.follow(null)))
    yield* loading.describe({ names: dynamic.names, rows: dynamic.rows, set: (name, enabled) => settling(dynamic.set(name, enabled)), configure: dynamic.configure })
    yield* (yield* Vault).revision(snapshot => followed(snapshot.value))
    yield* (yield* Vault).unloaded(followed(null))
    const abreast = Effect.suspend(() => Effect.andThen(
      Effect.catch(gate.read, () => Effect.succeed(null)),
      (read) => followed(read),
    ))

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
          const sentence = input.sentence.trim()
          yield* gate.run({
            op: "create-doc",
            file: pluginReadme(word),
            text: `# ${title}\n\n${sentence === "" ? `A plugin called ${title}.` : sentence}\n`,
          }, "web")
          yield* abreast
          const chat = builders.current()
          if (chat === undefined) return { name: word }
          const engine = input.engine.trim() === ""
            ? chat.engines()[0]?.id ?? ""
            : input.engine.trim()
          if (engine === "") return { name: word }
          yield* Effect.result(chat.open({
            about: readmeItem(word),
            engine,
            say: sentence === "" ? `Build a plugin called ${title}.` : sentence,
            teach: preambleFor(word, title),
          }))
          yield* abreast
          return { name: word }
        }),

      ask: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          const chat = builders.current()
          if (chat === undefined) return { sent: false }
          const row = dynamic.rows(yield* loading.reports).find(row => row.name === input.name)
          const fault = row?.fault ?? null
          const said = input.said.trim() !== ""
            ? input.said
            : fault !== null
              ? `The plugin \`${one.name}\` will not start. olai says: ${fault}\n\n`
                + `Its files are in \`${one.folder}\`. Please fix it and call \`vault-plugins_run\` again.`
              : `The plugin \`${one.name}\` is ${row?.state ?? "off"} (its files are in `
                + `\`${one.folder}\`). I have not said what I want changed yet.`
          return { sent: yield* chat.say({ about: readmeItem(input.name), text: said }) }
        }),

      run: ({ input }) =>
        Effect.gen(function*() {
          const one = yield* lookingAt(input.name)
          const row = dynamic.rows(yield* loading.reports).find((one) => one.name === input.name)
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
          yield* gate.run(held ? { op: "doc", file: path, text: input.text } : { op: "create-doc", file: path, text: input.text }, "mcp")
          yield* abreast
          const one = dynamic.defined(word)
          const version = one?.version ?? versionOf(input.file === PLUGIN_SERVER_FILE ? input.text : "", null)
          if (input.file === PLUGIN_README_FILE) return { path, version }
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

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
export { APPROVED_KEY, ON_KEY }
