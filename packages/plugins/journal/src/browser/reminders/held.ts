/** Consumer-owned holds, each cleared by its acquisition token. The controls
 * share this row's preference state; services are acquired by reminders itself. */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Accessor } from "solid-js"
import type { Channel } from "olai-plugin-alerts/contract"
import type { Navigation } from "olai-plugin-navigation/contract"
import type { RemindersState } from "./said.ts"

export const reminderServices = heldService<{
  readonly channel: Channel
  readonly navigation: Navigation
  readonly deployment: { readonly called: Accessor<string | undefined> }
}>()
export const reminderState = heldService<RemindersState>()
