import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { Thumb } from "olai-plugin-layout/thumb"
import { thumbs } from "olai-plugin-layout/contract"
import { paletteControl } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"

import { TESTID } from "./testids.ts"

const PREFIX = "+ "

export const captureThumb = definePlugin({
  name: "thumb",
  needs: [rendererSlots, paletteControl],
  apply: Effect.gen(function*() {
    const palette = yield* paletteControl
    yield* (yield* rendererSlots).contribute(thumbs, {
      order: 40,
      body: () => (
        <Thumb label="Capture" testid={TESTID.thumbCapture} onClick={() => palette.showAt([], PREFIX)}>
          <svg viewBox="0 0 16 16" class="size-5" aria-hidden="true" fill="currentColor">
            <path d="M8 2.25a.75.75 0 0 1 .75.75v4.25H13a.75.75 0 0 1 0 1.5H8.75V13a.75.75 0 0 1-1.5 0V8.75H3a.75.75 0 0 1 0-1.5h4.25V3A.75.75 0 0 1 8 2.25z" />
          </svg>
        </Thumb>
      ),
    })
  }),
})
