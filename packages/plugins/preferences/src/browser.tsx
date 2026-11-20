import { definePlugin, Offers } from "@olai/plugin-api"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { tools } from "olai-plugin-layout/contract"
import { createSignal } from "solid-js"
import { Effect } from "effect"
import { Preferences } from "./Preferences.tsx"
import { name, sections } from "./index.ts"

export default definePlugin({
  name, needs: [Offers, rendererSlots], apply: Effect.gen(function*() {
    const offers = yield* Offers
    const slots = yield* rendererSlots
    const [open, setOpen] = yield* Effect.acquireRelease(
      Effect.sync(() => createSignal(false)),
      ([, setOpen]) => Effect.sync(() => setOpen(false)),
    )
    yield* offers.own("open", () => ({ open: () => setOpen(true) }))
    yield* slots.contribute(tools, {
      body: (props) => <Preferences where={props.where} sections={() => slots.read(sections)} door={{ open, setOpen }} />,
      headerOrder: 20, closetOrder: 10, mobileWithoutSidebar: true,
    }, { children: [sections] })
  }),
})
