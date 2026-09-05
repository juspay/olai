/**
 * GIT'S BROWSER HALF — the pill, the phone banner, and the commit panel.
 *
 * They used to be imported by `@olai/web`'s `AppHeader.tsx`. They are slot
 * registrations now. A serve that does not name this row never fetches this
 * chunk, and the tab draws no pill.
 */

import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import { desktop } from "@olai/web/client/layout/media.ts"
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
    holdGitWire(() => wired.client() as GitClient)

    yield* slots.register("app.header", () => <Commit />)
    // The phone's news belongs below the header, before the page content.
    yield* slots.register("app.banner", () => (
      <Show when={!desktop()}>
        <Commit />
      </Show>
    ))
  }),
})
