import { slotCatalog } from "@olai/plugin-api/slots"
/** Vault-defined source, approval, compilation and chunks belong to this
 * provider. The host grants an owned loader; this policy decides what may be
 * loaded. Withdrawing this scope closes its definitions and HTTP integration,
 * while writes already accepted by the vault remain durable. */
import { definePlugin, HostLoading, Ops, Offers, Surfaces, Vault, BundleModules } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Ops as Gate } from "@olai/ops"
import { WRITABLE_MODULES } from "@olai/plugin-build"
import { Effect } from "effect"
import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { surface, faces } from "./surface.ts"
import { NotFoundFailure, isPutAway, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { name, chunks } from "./index.ts"
import { openDynamic } from "./runtime.ts"
import { pluginChunks } from "./route.ts"
import { ALWAYS, APPROVED_KEY, BROWSER_NODE, isApproved, PLUGIN_KEY, SERVER_NODE } from "./source.ts"
export { name } from "./index.ts"
export default definePlugin({
  name, needs: [HostLoading, Ops, Offers, Surfaces, Vault, BundleModules],
  apply: Effect.gen(function*() {
    const moduleCatalog = yield* (yield* BundleModules).read
    const describedSlots = slotCatalog(moduleCatalog.map(module => module.exports))
    const loading = yield* HostLoading
    const gate = (yield* Ops).gate as Gate
    const dynamic = openDynamic(yield* loading.acquire, loading.reserved)
    const settling = <T>(run: Effect.Effect<T>) => Effect.ensuring(run, Effect.sync(loading.changed))
    const followed = (read: Reading | null) => Effect.asVoid(settling(dynamic.follow(read?.derived ?? null)))
    yield* Effect.addFinalizer(() => Effect.asVoid(dynamic.follow(null)))
    yield* loading.describe({ names: dynamic.names, rows: dynamic.rows, set: (name, enabled) => settling(dynamic.set(name, enabled)) })
    yield* (yield* Vault).revision<Snapshot<Reading>>(snapshot => followed(snapshot.value))
    yield* (yield* Vault).unloaded(followed(null))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = { procedures: { plugins: {
approve: ({ input }) =>
            Effect.gen(function*() {
              const one = dynamic?.defined(input.name) ?? null
              if (one === null) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason: `this vault defines no plugin called "${input.name}"`,
                    named: input.name,
                  }),
                )
              }
              const current = yield* Effect.catch(gate.read, () => Effect.succeed(null))
              const at = current?.derived.byId.get(one.node)
              if (isPutAway(one.file) || (at !== undefined && isPutAway(at.file))) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason:
                      `"${input.name}" was put away, so approving it now would approve `
                      + `code nobody means to keep.`,
                    named: input.name,
                  }),
                )
              }
              if (one.version !== input.version) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason:
                      `"${input.name}" has been edited since this page drew it, so approving `
                      + `it now would approve source nobody has read. Look again, read what `
                      + `it says, and approve that.`,
                    named: input.name,
                  }),
                )
              }
              yield* Effect.asVoid(gate.run(
                {
                  op: "prop",
                  id: one.node,
                  key: APPROVED_KEY,
                  value: input.forever ? ALWAYS : one.version,
                },
                "web",
              ))
              return {}
            }),
run: ({ input }) =>
            Effect.gen(function*() {
              yield* followed(
                yield* Effect.catch(gate.read, () => Effect.succeed(null)),
              )
              const one = dynamic?.defined(input.name) ?? null
              if (one === null) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason: `this vault defines no plugin called "${input.name}". A definition `
                      + `is a node with a \`${PLUGIN_KEY}\` property naming the word, and a child `
                      + `titled \`${SERVER_NODE}\` whose note is the half.`,
                    named: input.name,
                  }),
                )
              }
              const row = dynamic.rows(yield* loading.reports).find((one) => one.name === input.name)
              return {
                name: one.name,
                version: one.version,
                state: row?.state ?? "off",
                approved: isApproved(one),
                ...(row?.fault === undefined ? {} : { fault: row.fault }),
              }
            }),
stop: ({ input }) =>
            Effect.gen(function*() {
              const stopped = dynamic === null
                ? false
                : yield* settling(dynamic.set(input.name, false))
              if (!stopped) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason: `this vault defines no plugin called "${input.name}", and a plugin `
                      + `this build compiled in is not an agent's to stop`,
                    named: input.name,
                  }),
                )
              }
              return {}
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
                property: PLUGIN_KEY,
                approved: APPROVED_KEY,
                server: SERVER_NODE,
                browser: BROWSER_NODE,
              },
              taken: [...loading.reserved, ...dynamic.names()],
            }))
    } } }
    yield* (yield* Surfaces).register({ surface, deps, root: true, faces, scopedFaces: { browser: faces.browser } })
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
