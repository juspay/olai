/** Inspector trigger; visibility survives shell remounts within this activation. */
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
  /** What each row's own plugin hung on it, read at draw time
   *  (`./browser.tsx`'s `tools` holds the table; `./Panel.tsx` asks it). */
  readonly rows: () => ReadonlyMap<string, PluginsRowFace>
  /** `closet` is the phone drawer row, `health` a row of the desktop health
   *  popover. Default is the header chip. */
  readonly where?: ToolWhere
}) {
  return (
    <BarDoor
      where={props.where}
      glyph="⧉"
      name="Plugins"
      testid={TESTID.pluginsTrigger}
      title="Plugins"
      // Keep this door open when its switch removes a plugin provider.
      held={props.state.door}
      panel={(_at, inside) => <Panel inside={inside} state={props.state} management={props.management} rows={props.rows} />}
    />
  )
}
