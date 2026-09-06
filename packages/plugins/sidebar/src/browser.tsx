import { slotContracts } from "./slots.ts"
/** The sidebar occupies a layout-owned location; it does not provide layout.
 * Only the renderer service is required to register: an absent layout leaves
 * this entry waiting while the plugin stays independent. The column and rail
 * are two presentations of one entry, sharing its child locations. Those child
 * declarations are available only while this entry is active, so withdrawal
 * drains dependent integrations before removing their container. Solid owns
 * subscriptions made while rendering; the renderer owns the integration scope.
 * The content pane is a sibling and keeps its identity when this row leaves.
 * Notebook readings inside Sidebar remain an explicit Phase 18 extraction. */
import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { sidebar } from "olai-plugin-layout/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { Rail } from "./Rail.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { railEntries,regions,vaultEntries } from "./contract.ts"
import { name } from "./index.ts"

export default definePlugin({
  name, needs: [rendererSlots], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    yield* slots.contribute(sidebar, { Sidebar: (props) => <Sidebar {...props} slots={slots} />, Rail: (props) => <Rail {...props} slots={slots} /> }, {
      children: [regions, vaultEntries, railEntries, slotContracts["sidebar.entry"], slotContracts["sidebar.section"]],
    })
  }),
})
