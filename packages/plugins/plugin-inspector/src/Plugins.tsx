import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { BarDoor } from "olai-plugin-layout/bar-door"
import type { ToolWhere } from "olai-plugin-layout/contract"


import type { InspectorState } from "./state.ts"
import type { BrowserManagement } from "@olai/surface/management"
import type { PluginsRowFace } from "./slots.ts"
import { Panel } from "./Panel.tsx"

export function Plugins(props: {
  readonly state: InspectorState
  readonly management: BrowserManagement
  readonly rows: () => ReadonlyMap<string, PluginsRowFace>
  readonly where?: ToolWhere
}) {
  return (
    <BarDoor
      where={props.where}
      glyph="⧉"
      name="Plugins"
      testid={TESTID.pluginsTrigger}
      held={props.state.door}
      panel={(_at, inside) => <Panel inside={inside} state={props.state} management={props.management} rows={props.rows} />}
    />
  )
}
