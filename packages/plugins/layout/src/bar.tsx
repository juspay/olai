/** Layout owns popover placement, chrome geometry and the desktop reading.
 * This value is published in its renderer-dependent plugin scope. Factories
 * allocate component resources under their callers' Solid owners. */
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

/** THE BAR — its breakpoint, its geometry and the panel that hangs off it, as
 *  `Bar` carries them. */
export const bar: Bar = {
  desktop,
  pill: { PILL, DOT },
  // `popover` and not `createPopover`: the config field and the member used to
  // be two words for one thing, because a facade class renamed it on the way
  // through. There is no facade — the tag's shape IS this record — so there is
  // one word.
  popover: panelPopover,
}

