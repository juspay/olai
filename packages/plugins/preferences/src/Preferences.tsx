import { TESTID } from "olai-plugin-preferences/testids"
import { BarDoor } from "olai-plugin-layout/bar-door"
import type { ToolWhere } from "olai-plugin-layout/contract"
import type { HeldOpen } from "@olai/web/client/popover.ts"
import { Panel } from "./Panel.tsx"


import type { Contribution } from "@olai/plugin-api"
import type { Section } from "./index.ts"
export function Preferences(props: {
  readonly sections: () => ReadonlyArray<Contribution<Section>>
  readonly door: HeldOpen
  readonly where?: ToolWhere
}) {
  return (
    <BarDoor
      where={props.where}
      held={props.door}
      glyph="⚙"
      name="Preferences"
      testid={TESTID.prefsTrigger}
      panel={(at, inside) => <Panel at={at} inside={inside} sections={props.sections} />}
    />
  )
}
