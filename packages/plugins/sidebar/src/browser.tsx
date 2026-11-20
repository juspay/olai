import { slotContracts } from "./slots.ts"
import { definePlugin, Faces } from "@olai/plugin-api"
import { holdFaces } from "./faces.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { holdShell } from "./shell.ts"
import { Effect } from "effect"
import { sidebar } from "olai-plugin-layout/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { Rail } from "./Rail.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { railEntries,regions } from "./contract.ts"
import { name } from "./index.ts"

export default definePlugin({
  name, needs: [rendererSlots, Faces], apply: Effect.gen(function*() {
    yield* holdFaces(yield* Faces)
    const slots = yield* rendererSlots
    yield* slots.contribute(sidebar, { Sidebar: (props) => <Sidebar {...props} slots={slots} />, Rail: (props) => <Rail {...props} slots={slots} /> }, {
      children: [regions, railEntries, slotContracts["sidebar.entry"], slotContracts["sidebar.section"]],
    })
  }),
})

export const components = {
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
}
