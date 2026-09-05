/** The sidebar entry owns its extension seats and its Solid subtree. Removing
 * this row leaves the content pane and independent plugin providers mounted. */
import { definePlugin, slotLocation } from "@olai/plugin-api"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { sidebar } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { Sidebar } from "./Sidebar.tsx"
import { Rail } from "./Rail.tsx"
import { name } from "./index.ts"

export default definePlugin({
  name, needs: [rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(sidebar, { Sidebar, Rail }, {
      children: [slotLocation("sidebar.entry"), slotLocation("sidebar.section")],
    })
  }),
})
