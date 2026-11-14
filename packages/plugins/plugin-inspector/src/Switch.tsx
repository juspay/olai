/** The plugins panel's switch is the shared one (`@olai/ui-primitives/Switch.tsx`),
 *  so the preferences panel draws the same control for its binaries. This file
 *  keeps the panel's import, names the testid this package owns, and says what
 *  a session-only switch is: marked (`data-session`, the dashed ring in
 *  `./all.css`) and said in a tip.
 *
 *  THE SENTENCE IS SAID TWICE, on purpose. The tip is for a pointer; the
 *  primitive cannot draw it (it declares `solid-js` alone), and the tip's own
 *  node is `role="presentation"`, so a reader who never hovers would otherwise
 *  never hear it. So the same words ride the switch's accessible NAME, after
 *  the name of what is switched — which is also where the panel's scenarios
 *  read it. The row's detail still says it in full prose, once. */
import { Show } from "solid-js"
import { TESTID } from "olai-plugin-plugin-inspector/testids"
import { Switch as Shared } from "@olai/ui-primitives/Switch.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"

/** What a session-only switch is, in the words both carriers use. */
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
