/** Preferences owns presentation and its extension location, not settings.
 * Registering requires the renderer, while activation waits for layout.tools.
 * Binding sections to this entry prevents feature controls from acquiring UI
 * resources when there is nowhere to render them. Removing preferences closes
 * those integrations without withdrawing their independent state providers;
 * theme's storage observers and selected values therefore remain effective.
 * The same entry supplies desktop and drawer presentations with explicit order.
 * Remaining notebook controls must become feature-owned section contributions. */
import { definePlugin } from "@olai/plugin-api"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { tools } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { Preferences } from "./Preferences.tsx"
import { name, sections } from "./index.ts"

export default definePlugin({
  name, needs: [rendererSlots], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    yield* slots.contribute(tools, {
      body: (props) => <Preferences where={props.where} sections={() => slots.read(sections)} />,
      headerOrder: 20, closetOrder: 10, mobileWithoutSidebar: true,
    }, { children: [sections] })
  }),
})
