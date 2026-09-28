/** The plugins panel's switch is the shared one (`@olai/ui-primitives/Switch.tsx`),
 *  so the preferences panel draws the same control for its binaries. This file
 *  keeps the panel's import and names the testid this package owns. */
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { Switch as Shared } from "@olai/ui-primitives/Switch.tsx"

export function Switch(props: {
  readonly label: string
  readonly session?: boolean
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
}) {
  return <Shared {...props} testid={TESTID.pluginSwitch} />
}
