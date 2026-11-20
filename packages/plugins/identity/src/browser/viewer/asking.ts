import type { Who } from "@olai/surface"
import { type Accessor, createResource } from "solid-js"

import { runAsync } from "@olai/web/client/run.ts"
import { olai, connectionEpoch } from "@olai/web/client/wire.ts"
import { fromAsk } from "./fromAsk.ts"

export type { Who }
export { fromAsk }

export interface Asking {
  readonly who: Accessor<Who | null | undefined>
  readonly heard: Accessor<boolean>
  readonly failed: Accessor<boolean>
}

export const createWho = (): Asking => {
  const [who] = createResource(() => connectionEpoch() || false, async (): Promise<Who | null> =>
    fromAsk(await runAsync(olai.procedures.who.get())),
  )
  return {
    // `createResource()` rethrows on error; the chip must not. A failed
    // door is `failed`, not a thrown render (which is a fault card).
    who: () => (who.error != null ? undefined : who.latest),
    heard: () => connectionEpoch() > 0 && who.state !== "unresolved" && who.state !== "pending",
    failed: () => who.error != null,
  }
}
