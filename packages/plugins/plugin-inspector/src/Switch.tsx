/** The plugins panel's switch is the shared one (`@olai/ui-primitives/Switch.tsx`),
 *  so the preferences panel draws the same control for its binaries. This file
 *  keeps the panel's import, names the testid this package owns, and says what
 *  a session-only switch is: marked (`data-session`, the dashed ring in
 *  `./all.css`) and said on hover. */
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { Switch as Shared } from "@olai/ui-primitives/Switch.tsx"

export function Switch(props: {
  readonly label: string
  readonly session?: boolean
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
}) {
  return <Shared label={props.label} on={props.on} frozen={props.frozen} onPick={props.onPick} testid={TESTID.pluginSwitch}
    title={props.session ? "Resets when olai restarts" : undefined} data-session={props.session ? "true" : undefined} />
}
