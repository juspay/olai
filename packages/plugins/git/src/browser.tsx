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
import { shell as layoutShell } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { Show } from "solid-js"

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

    yield* slots.register("app.header", { place: "cluster", body: () => <Commit /> })
    // The phone's news belongs below the header, before the page content.
    yield* slots.register("app.banner", () => (
      <Show when={!desktop()}>
        <Commit />
      </Show>
    ))
  }),
})

/** The shell's breakpoint, DECLARED — a component of its own, so the pill and
 *  the panel keep working under another layout (`./browser/shell.ts`). */
export const components = {
  shell: definePlugin({ name: "shell", needs: [layoutShell], apply: Effect.gen(function*() {
    const geometry = yield* layoutShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
}
