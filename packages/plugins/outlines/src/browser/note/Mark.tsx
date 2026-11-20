import { TESTID } from "olai-plugin-outlines/testids"
import { Tip } from "@olai/web/client/Tip.tsx"

export function NoteMark(props: {
  readonly open: boolean
  readonly onToggle: () => void
  readonly ref?: (el: HTMLButtonElement) => void
}) {
  const said = (): string => (props.open ? "Close note" : "Open note")
  return (
    <Tip text={said()}>
      <button
        ref={props.ref}
        type="button"
        class="inline-flex w-3 shrink-0 cursor-pointer select-none justify-center border-0 bg-transparent p-0 align-baseline text-body leading-none transition-colors duration-100 hover:text-accent"
        classList={{
          "text-accent": props.open,
          "text-muted/60": !props.open,
        }}
        data-testid={TESTID.noteMark}
        data-open={props.open ? "true" : "false"}
        aria-expanded={props.open}
        aria-label={said()}
        onClick={(event) => {
          event.stopPropagation()
          props.onToggle()
        }}
      >
        ¶
      </button>
    </Tip>
  )
}
