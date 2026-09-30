/** The fresh-start question, shared by conversation replacement gestures.
 * The mounted question owns dismissal; the caller owns the pending request. */
import { ALARM_PILL, QUIET_PILL } from "@olai/web/client/pill.ts"
import { dismissOn } from "@olai/web/client/dismiss.ts"

export function ConfirmReplacement(props: {
  readonly label: string
  readonly question: string
  readonly action: string
  readonly trigger: () => HTMLElement | undefined
  readonly confirm: () => void
  readonly cancel: () => void
}) {
  let root: HTMLSpanElement | undefined
  dismissOn({ open: () => true, root: () => root, trigger: props.trigger, dismiss: props.cancel })
  const cancel = () => { props.cancel(); props.trigger()?.focus() }
  return <span ref={root} role="group" aria-label={props.label} class="block max-w-sm whitespace-normal text-label">
    <span>{props.question}</span>
    <span class="mt-2 flex gap-2">
      <button type="button" class={`${ALARM_PILL} [@media(pointer:coarse)]:min-h-11`} onClick={props.confirm}>{props.action}</button>
      <button type="button" class={`${QUIET_PILL} [@media(pointer:coarse)]:min-h-11`}
        ref={element => queueMicrotask(() => { if (element.isConnected) element.focus() })}
        onClick={cancel}>Cancel</button>
    </span>
  </span>
}
