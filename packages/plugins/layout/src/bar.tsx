import type { AppPopover,Bar } from "@olai/plugin-api"
import { styleOf } from "@olai/web/client/anchor.ts"
import { createPopover } from "@olai/web/client/popover.ts"
import { DOT, PANEL_BOX, PILL } from "@olai/web/client/readout.ts"
import { desktop } from "./layout/live.ts"
import { Show } from "solid-js"
import { Portal } from "solid-js/web"

const panelPopover = (): AppPopover => {
  const popover = createPopover()
  return {
    open: popover.open,
    toggle: popover.toggle,
    close: popover.close,
    setTrigger: popover.setTrigger,
    Panel: (props) => (
      <Show when={popover.open() ? popover.at() : null}>
        {(at) => (
          <Portal>
            <section
              ref={popover.setPanel}
              class={`${PANEL_BOX} gap-2`}
              style={styleOf(at())}
              tabindex="-1"
              data-testid={props.testid}
              aria-label={props.label}
            >
              {props.children}
            </section>
          </Portal>
        )}
      </Show>
    ),
  }
}

export const bar: Bar = {
  desktop,
  pill: { PILL, DOT },
  popover: panelPopover,
}

