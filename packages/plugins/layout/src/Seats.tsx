import type {} from "./slots.ts"
import { createMemo, Show } from "solid-js"

import { only } from "./faces.ts"

export function PluginViewer() {
  const taken = createMemo(() => only("app.viewer"))
  return (
    <Show when={taken()} keyed>
      {(seat) => {
        const Face = seat.face
        return <Face />
      }}
    </Show>
  )
}
