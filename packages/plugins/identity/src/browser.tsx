import type {} from "olai-plugin-layout/slots"
import { definePlugin, Offers, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { openViewer } from "./browser/viewer/index.ts"
import { viewerService } from "./index.ts"
import { Who } from "./browser/Who.tsx"
import { name } from "./index.ts"

export { name }

export default definePlugin({
  name,
  needs: [Slots, Offers],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const viewer = yield* openViewer
    yield* (yield* Offers).own(viewerService, () => viewer)
    yield* slots.register("app.viewer", () => <Who viewer={viewer} />)
  }),
})
