import { serviceTag } from "@olai/plugin-api/contracts"
import type { PluginsRowFace } from "olai-plugin-plugin-inspector/slots"

export interface EnginesService {
  readonly row: (engine: string) => PluginsRowFace
  readonly installed: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}
export const engines = serviceTag<EnginesService>("chat.engines")
