import { TESTID } from "olai-plugin-outlines/testids"
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { onMount } from "solid-js"

import type { MenuAction } from "./action.ts"
import { ALARM_PILL, QUIET_PILL } from "@olai/web/client/pill.ts"


export function Confirm(props: {
  readonly action: MenuAction
  readonly onGo: (action: MenuAction) => void | Promise<void>
  readonly onCancel: (action: MenuAction) => void
}) {
  let go: HTMLElement | undefined
  // `onMount` runs while this subtree is still being built into the open panel,
  // so the element the ref handed over is not in the document yet and focusing
  // it does nothing. A microtask later it is attached and the caret lands.
  onMount(() => queueMicrotask(() => go?.focus()))

  return (
    <div class="w-64 px-3 py-1.5" role="group" aria-label={props.action.confirm}>
      <p class="m-0 text-label leading-snug text-ink" data-testid={TESTID.nodeMenuConfirm}>
        {props.action.confirm}
      </p>
      <div class="mt-2 flex gap-2">
        <DropdownMenu.Item
          ref={go}
          class={`${ALARM_PILL} cursor-pointer`}
          data-testid={TESTID.nodeMenuItem}
          data-action={props.action.id}
          onSelect={() => void props.onGo(props.action)}
        >
          {props.action.label}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          class={`${QUIET_PILL} cursor-pointer`}
          data-testid={TESTID.nodeMenuItem}
          data-action="cancel"
          closeOnSelect={false}
          onSelect={() => props.onCancel(props.action)}
        >
          Cancel
        </DropdownMenu.Item>
      </div>
    </div>
  )
}
