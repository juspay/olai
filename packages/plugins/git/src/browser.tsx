import { prepareForRepository } from "./browser/commit/preparation.ts"
/**
 * GIT'S BROWSER HALF — the pill, the phone banner, and the commit panel.
 *
 * They used to be imported by `@olai/web`'s `AppHeader.tsx`. They are slot
 * registrations now. A serve that does not name this row never fetches this
 * chunk, and the tab draws no pill.
 */
import { fileAccess } from "olai-plugin-vault/contract"
import { holdServed } from "./browser/vault.ts"
import type {} from "olai-plugin-layout/slots"
import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import { desktop, holdShell } from "./browser/shell.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { createRoot, createSignal, createEffect, onCleanup, Show } from "solid-js"

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

    /**
     * WHILE THIS ACTIVATION STANDS — the gate both faces draw inside.
     *
     * TWO HOLDERS FEED ONE FACE, and they do not stop together: the sibling
     * client is held on THIS fiber (`./browser/wire.ts`) and the shell's
     * geometry on the `shell` COMPONENT beside it (`./browser/shell.ts`).
     * Each clears when its own activation stops, and the banner below is a
     * `<Show>` whose condition is the second one — so in the frame after this
     * row's wire had gone and before the page had let go of the face, the
     * shell's hold cleared, `desktop()` answered its absent `false`, and the
     * `<Show>` MOUNTED a fresh `<Commit/>` out of a wire that was no longer
     * there. `./browser/wire.ts` throws about exactly that, and the throw took
     * the tab to the fault screen: switching the vault off (which takes this
     * row with it) or this row off left a serve with no plugins panel at all.
     *
     * The signal is not the wire and not the geometry: it is whether THIS
     * ACTIVATION is still standing, which is the one thing both of them are
     * about. Acquired LAST so it is released FIRST — before either
     * registration is withdrawn and before any holder clears — so a face
     * unmounts rather than re-rendering into a half-torn-down row.
     */
    const [live, setLive] = createSignal(true)
    const [prepared, setPrepared] = createSignal(false)
    yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const identity = gitWire().cells.repository.use()
      createEffect(() => {
        const repository = identity.value()
        if (repository == null) return
        const release = prepareForRepository(repository)
        setPrepared(true)
        onCleanup(() => { setPrepared(false); release() })
      })
      return dispose
    })), dispose => Effect.sync(dispose))

    // THE READOUT'S STATUS for the bar's health dot, read while the popover
    // that draws the row is shut (`./browser/commit/status.ts`). Its own root,
    // acquired after the wire is held and BEFORE the registration, so the
    // registration is withdrawn first and the root is disposed after — the
    // bar never reads a status whose owner has gone.
    const status = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot(dispose => ({ dispose, read: createGitStatus() }))),
      owned => Effect.sync(owned.dispose),
    )

    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <Show when={live() && prepared()}><Commit /></Show>,
      status: status.read,
    })
    // The phone's news belongs below the header, before the page content.
    yield* slots.register("app.banner", () => (
      <Show when={live() && !desktop()}>
        <Commit />
      </Show>
    ))
    yield* Effect.acquireRelease(Effect.void, () => Effect.sync(() => setLive(false)))
  }),
})

/** The shell's breakpoint, DECLARED — a component of its own, so the pill and
 *  the panel keep working under another layout (`./browser/shell.ts`). */
export const components = {
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
}
