import { TESTID } from "olai-plugin-outlines/testids"
import { MENU_CELL, MENU_REVEAL } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"


export const DOTS =
  `${MENU_CELL} ${MENU_REVEAL} cursor-pointer border-0 bg-transparent p-0 ` +
  "text-caption leading-none tracking-[0.05em] text-muted hover:text-ink"

export function Dots(props: { readonly onArm: () => void }) {
  const arm = (event: Event): void => {
    event.stopPropagation()
    props.onArm()
  }

  return (
    <Tip text="More">
      <button
        type="button"
        class={DOTS}
        data-testid={TESTID.nodeMenu}
        aria-haspopup="true"
        aria-expanded={false}
        aria-label="More"
        onPointerDown={arm}
        onKeyDown={(event) => {
          if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) return
          event.preventDefault()
          arm(event)
        }}
        onClick={(event) => event.stopPropagation()}
      >
        •••
      </button>
    </Tip>
  )
}
