import { TESTID } from "olai-plugin-plugin-inspector/testids"
/** Inspector trigger; visibility survives shell remounts within this activation. */
import { BarDoor } from "olai-plugin-layout/bar-door"


import type { InspectorState } from "./state.ts"
import type { BrowserManagement } from "@olai/surface/management"
import { Panel } from "./Panel.tsx"

export function Plugins(props: {
  readonly state: InspectorState
  readonly management: BrowserManagement
  /** `closet` is the phone drawer row. Default is the header chip. */
  readonly where?: "header" | "closet"
}) {
  return (
    <BarDoor
      where={props.where}
      glyph="⧉"
      header="plugins"
      closet="plugins"
      testid={TESTID.pluginsTrigger}
      title="plugins: which integrations this server is running, and why"
      // Keep this door open when its switch removes a plugin provider.
      held={props.state.door}
      panel={(at, inside) => <Panel at={at} inside={inside} state={props.state} management={props.management} />}
    />
  )
}
