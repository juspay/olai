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
