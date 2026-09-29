/** Preferences owns presentation and its extension location, not settings.
 * Registering requires the renderer, while activation waits for layout.tools.
 * Binding sections to this entry prevents feature controls from acquiring UI
 * resources when there is nowhere to render them. Removing preferences closes
 * those integrations without withdrawing their independent state providers;
 * theme's storage observers and selected values therefore remain effective.
 * The same entry supplies desktop and drawer presentations with explicit order.
 *
 * It ALSO OFFERS THE ONE DOOR onto the panel — `preferences.open` — so a link
 * elsewhere (`olai-plugin-plugin-inspector`'s promoted rows and its plugins-panel
 * "Set in Preferences") can land somebody here without importing this package's
 * panel or its state. The open bit lives HERE, in this activation, because the
 * door's panel can be asked to open from outside the shell that draws it, and a
 * rebuilt shell must draw the door again with the same answer.
 *
 * AND IT IS ACQUIRED LIKE ANY OTHER RESOURCE OF THIS ACTIVATION, with a
 * release: disabling Preferences SHUTS its panel (the bit is set back to shut
 * when the activation closes), and re-enabling starts shut rather than
 * reopening a panel a person did not ask for. */
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
