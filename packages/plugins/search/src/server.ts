import { Ops, Vault, Surfaces, VaultViews } from "@olai/plugin-api/services"
import type { Ops as Gate } from "@olai/ops"
import { inMemoryChannel, type ImplementSurfaceDeps } from "@kolu/surface/server"
import { surface, faces } from "./surface.ts"
import { tools } from "./tools.ts"

import { definePlugin, Offers, Search } from "@olai/plugin-api/services"
import type { KindVocabulary, Reading, SearchRequest } from "@olai/format"
import { Effect } from "effect"

import { name } from "./index.ts"
import { search } from "./matcher.ts"
import { open } from "./table.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Offers],
  apply: Effect.gen(function*() {
    const offers = yield* Offers

    const index = yield* Effect.acquireRelease(
      Effect.sync(open),
      (table) => Effect.sync(table.close),
    )

    /** `@olai/plugin-api` may not import the floor, so the door is spelled
     *  structurally there and with the floor's own types at both ends. */
    yield* offers.offer(Search, () => ({
      nodes: ({ at, query, now, kinds }) =>
        Effect.sync(() =>
          search(
            at as Reading,
            query as SearchRequest,
            now,
            kinds as KindVocabulary,
            index,
          )
        ),
    }))
  }),
})

export const components = { wire: definePlugin({
  name: "wire", needs: [Search, Ops, Vault, Surfaces, VaultViews],
  apply: Effect.gen(function*() {
    const gate = (yield* Ops).gate as Gate
    yield* (yield* VaultViews).search(yield* Search)
    const revisions = inMemoryChannel<void>()
    const vault = yield* Vault
    yield* vault.revision(() => Effect.sync(() => revisions.publish(undefined)))
    yield* vault.unloaded(Effect.sync(() => revisions.publish(undefined)))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      onStreamReadError: (error, { stream }) => {
        Effect.runFork(Effect.logWarning(`search ${stream} read failed: ${String(error)}`))
      },
      streams: {
        searchResults: {
          read: input => Effect.runPromise(gate.search(input)),
          install: (_input, onEvent) => revisions.consume({ onEvent, onError: () => {} }),
          isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
        },
      },
      procedures: { search: { nodes: ({ input }) => gate.search(input) } },
    }
    yield* (yield* Surfaces).register({ surface, faces, tools, deps })
  }),
}) }

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
