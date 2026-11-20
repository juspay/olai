import { prepareForRepository } from "./browser/commit/preparation.ts"
import { fileAccess } from "olai-plugin-vault/contract"
import { holdServed } from "./browser/vault.ts"
import type {} from "olai-plugin-layout/slots"
import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import { desktop, holdShell } from "./browser/shell.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { createRoot, createSignal, createMemo, createComputed, on, onCleanup, Show } from "solid-js"

import { Commit } from "./browser/commit/Commit.tsx"
import { createGitStatus } from "./browser/commit/status.ts"
import { type GitClient, holdGitWire, gitWire } from "./browser/wire.ts"

export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

export default definePlugin({
  name,
  needs: [Slots, Wired, fileAccess],
  apply: Effect.gen(function*() {
    const files = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(files)), stop => Effect.sync(stop))
    const slots = yield* Slots
    const wired = yield* Wired
    yield* holdGitWire(() => wired.client() as GitClient)

    const [live, setLive] = createSignal(true)
    const preparation = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const identity = gitWire().cells.repository.use()
      const repository = createMemo<string | undefined>(previous => identity.value() ?? previous)
      createComputed(on(repository, current => {
        if (current !== undefined) onCleanup(prepareForRepository(current))
      }))
      const ready = createMemo(() => repository() !== undefined)
      return { dispose, ready }
    })), owned => Effect.sync(owned.dispose))

    const status = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot(dispose => ({ dispose, read: createGitStatus() }))),
      owned => Effect.sync(owned.dispose),
    )

    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <Show when={live() && preparation.ready()}><Commit /></Show>,
      status: status.read,
    })
    yield* slots.register("app.banner", () => (
      <Show when={live() && preparation.ready() && !desktop()}>
        <Commit />
      </Show>
    ))
    yield* Effect.acquireRelease(Effect.void, () => Effect.sync(() => setLive(false)))
  }),
})

export const components = {
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
}
