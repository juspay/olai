/** Layout owns popover placement, chrome geometry and the desktop reading.
 * This value is published only inside its root integration scope. Factories
 * allocate component resources under their callers' Solid owners. */
import { Show } from "solid-js"
import { Portal } from "solid-js/web"
import type { AppPopover, Bar } from "@olai/plugin-api"
import { styleOf } from "@olai/web/client/anchor.ts"
import { desktop } from "@olai/web/client/layout/media.ts"
import { createPopover } from "@olai/web/client/popover.ts"
import { DOT, PANEL_BOX, DOT_HOLLOW_ALARM, DOT_HOLLOW_WARN, PILL,
  PILL_ALARM_COAT, PILL_WARN_COAT, TEXT_ALARM, TEXT_WARN } from "@olai/web/client/readout.ts"

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
  pill: {
    PILL,
    DOT,
    PILL_WARN_COAT,
    DOT_HOLLOW_WARN,
    TEXT_WARN,
    PILL_ALARM_COAT,
    DOT_HOLLOW_ALARM,
    TEXT_ALARM,
  },
  // `popover` and not `createPopover`: the config field and the member used to
  // be two words for one thing, because a facade class renamed it on the way
  // through. There is no facade — the tag's shape IS this record — so there is
  // one word.
  popover: panelPopover,
}

