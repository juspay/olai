import { TESTID } from "olai-plugin-outlines/testids"
import { Show } from "solid-js"
import { Tip } from "@olai/web/client/Tip.tsx"


export function Handle(props: { readonly label: string; readonly onOpen?: () => void }) {
  return (
    <Show
      when={props.onOpen}
      fallback={
        <span class="shrink-0 font-mono text-caption text-muted">{props.label}</span>
      }
    >
      {(open) => (
        <Tip text={`Change ${props.label}`}>
          <button
            type="button"
            class="shrink-0 cursor-pointer font-mono text-caption text-muted hover:text-accent"
            data-testid={TESTID.propKey}
            onClick={(event) => {
              event.stopPropagation()
              open()()
            }}
          >
            {props.label}
          </button>
        </Tip>
      )}
    </Show>
  )
}
