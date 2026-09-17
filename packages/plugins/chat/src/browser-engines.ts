/** The engine's inspector face crosses a declared, scoped service.
 *
 * This door describes the face; it neither constructs plugin definitions nor
 * reads chat's wire. Chat owns the standing and the drawing over it. Each
 * engine owns the component that registers that drawing, so its slot claim is
 * stamped with its own identity and withdraws when either owner leaves.
 */
import { serviceTag } from "@olai/plugin-api/contracts"
import type { PluginsRowFace } from "olai-plugin-plugin-inspector/slots"

export interface EnginesService {
  readonly row: (engine: string) => PluginsRowFace
}
export const chatEngines = serviceTag<EnginesService>("chat.engines")
