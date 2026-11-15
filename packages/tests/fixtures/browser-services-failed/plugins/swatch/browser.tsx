import { definePlugin, Slots, serviceTag } from "@olai/plugin-api"
import { Effect } from "effect"

const Palette = serviceTag<{ coat: string }>("palette.colours")

const Swatch = (context: { readonly entry: { readonly value: string } }) => (
  <span
    data-swatch={context.entry.value}
    style={{ background: context.entry.value }}
    class="inline-block h-3 w-3 rounded"
  />
)

export default definePlugin({
  name: "swatch",
  needs: [Slots, Palette],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const palette = yield* Palette
    yield* slots.register("outline.row.chip", "hex", (props) => <span class={palette.coat}><Swatch {...props} /></span>)
  }),
})
