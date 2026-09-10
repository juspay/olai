import type {} from "olai-plugin-layout/slots"
/**
 * GIT'S BROWSER HALF — the pill, the phone banner, and the commit panel.
 *
 * They used to be imported by `@olai/web`'s `AppHeader.tsx`. They are slot
 * registrations now. A serve that does not name this row never fetches this
 * chunk, and the tab draws no pill.
 */

import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import { desktop, holdShell } from "./browser/shell.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { createSignal, Show } from "solid-js"

import { Commit } from "./browser/commit/Commit.tsx"
import { type GitClient, holdGitWire } from "./browser/wire.ts"

export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

export default definePlugin({
  name,
  needs: [Slots, Wired],
  apply: Effect.gen(function*() {
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

    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <Show when={live()}><Commit /></Show>,
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
