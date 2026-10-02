/** Maintained composition fixture, disabled in every normal bundle. It uses
 * only contracts and the navigation outlet: content implementations do not
 * know which layout owns their seat. No sidebar, geometry or app frame. */
import { definePlugin } from "@olai/plugin-api"
import { atFile } from "olai-plugin-navigation/routes"
import { Effect } from "effect"
import { navigation, content } from "olai-plugin-navigation/contract"
import { rendererSlots, root } from "olai-plugin-ui-renderer/contract"
import { name } from "./index.ts"

export default definePlugin({ name, needs: [rendererSlots, navigation], apply: Effect.gen(function*() {
  const slots = yield* rendererSlots
  const nav = yield* navigation
  yield* slots.contribute(root, () => <main aria-label="Alternate layout fixture" class="mx-auto max-w-3xl p-6">
    <header class="mb-6 flex gap-4 border-b border-rule pb-4">
      <strong>Content under another layout</strong>
      <button type="button" onClick={() => nav.go(atFile("house.olai"))}>Open outline fixture</button>
      <button type="button" onClick={() => nav.go(atFile("finishes.md"))}>Open Markdown fixture</button>
    </header>
    {nav.page(0)}
  </main>, { children: [content] })
}) })
