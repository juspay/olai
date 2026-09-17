/** Static contract and inert component factory. Live readings and rendering
 * arrive through chat's scoped service, never through a private UI import. */
import type { Accessor, JSX } from "solid-js"
import { serviceTag } from "@olai/plugin-api/contracts"
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import type {} from "olai-plugin-plugin-inspector/slots"
import type { AgentChoice } from "./wire.ts"

export interface EnginesService {
  readonly standing: (engine: string) => Accessor<AgentChoice | null>
  readonly missing: (engine: string) => JSX.Element
}
export const chatEngines = serviceTag<EnginesService>("chat.engines")

/** The loader binds this component and its registration to the calling engine. */
export const engineRow = (engine: string) => definePlugin({
  name: "row",
  needs: [chatEngines, Slots],
  apply: Effect.gen(function*() {
    const engines = yield* chatEngines
    const slots = yield* Slots
    const standing = engines.standing(engine)
    yield* slots.register("plugins.row", {
      needs: () => standing()?.standing === "not-here",
      body: () => engines.missing(engine),
    })
  }),
})
