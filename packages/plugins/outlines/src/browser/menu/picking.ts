import type { Accessor } from "solid-js"

import type { MenuAction } from "./action.ts"
import type { Said } from "@olai/web/client/saying.ts"
import { createSaying } from "@olai/web/client/saying.ts"

export interface Picking {
  readonly said: Accessor<Said | null>
  readonly pick: (action: MenuAction) => Promise<void>
}

export const createPicking = (): Picking => {
  const saying = createSaying()

  return {
    said: saying.said,
    pick: async (action) => {
      saying.say(null)
      try {
        saying.say(await action.run())
      } catch (cause) {
        saying.say({ tone: "alarm", text: `“${action.label}” didn’t work` })
        console.warn(`olai: "${action.label}" did not happen`, cause)
      }
    },
  }
}
