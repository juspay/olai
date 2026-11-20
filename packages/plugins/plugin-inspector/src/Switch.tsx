import { Show } from "solid-js"
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { Switch as Shared } from "@olai/ui-primitives/Switch.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"

export const SESSION_SAID = "Resets when olai restarts"

export function Switch(props: {
  readonly label: string
  readonly session?: boolean
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
}) {
  const session = () => props.session === true
  const shared = () => <Shared label={session() ? `${props.label} — ${SESSION_SAID}` : props.label}
    on={props.on} frozen={props.frozen} onPick={props.onPick} testid={TESTID.pluginSwitch}
    data-session={session() ? "true" : undefined} />
  return <Show when={session()} fallback={shared()}>
    <Tip text={SESSION_SAID}>{shared()}</Tip>
  </Show>
}
