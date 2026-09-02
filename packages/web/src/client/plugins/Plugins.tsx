/**
 * The way into the plugins: one control in the app header, and the panel it
 * opens.
 *
 * ## Why it is a control of its own and not a section of preferences
 *
 * The rows were at the foot of the preferences panel, and they answered a
 * different question from everything above them. Preferences is HOW THIS
 * BROWSER READS — the theme, the type, how much of a row is drawn — and every
 * row on it is this browser's to change, kept in this browser, different in the
 * next. A plugin's enablement is the INSTANCE's: `--plugins` is CLI/nix only,
 * there is no settings file and no verb a press could call, and the answer is
 * the same in every browser pointed at this server.
 *
 * Mixed together, the frozen rows read as preferences somebody had disabled —
 * a thing that would move if you had permission — where what they are is a fact
 * about the serve, with the same standing as the connection dot. Its own door
 * says that before a reader has read a word.
 *
 * ## What it costs, and why that is affordable here
 *
 * A seat in the bar, which this app does not hand out lightly: the theme pill
 * was RETIRED into the preferences panel on exactly this argument — *a bar that
 * has five things in it at 390pt cannot spend one of them on a second door to a
 * panel that is already there*. This is not that case. It is not a second door
 * to the same panel; it is the only door to a different one.
 *
 * And what is behind it has nowhere else to be asked. This is the argument the
 * preferences panel used to carry for these rows, moved here with them, because
 * it is the reason they are worth a control rather than the reason they were
 * worth a section: the question they answer — *why is the integration the docs
 * describe not on this screen* — cannot be asked anywhere else, because what a
 * plugin that is off leaves behind is NOTHING AT ALL. No chip, no pane, no
 * error. A product that drew only the settings a reader can change would answer
 * that question by staying silent.
 *
 * DESKTOP ONLY, which is how the seat is afforded. On a phone it is a row at
 * the foot of the directory drawer beside preferences, because the phone bar is
 * the wordmark, the burger and search and has no room for a fifth chip. That is
 * the arrangement `../settings/Preferences.tsx` already keeps, and this follows
 * it rather than inventing a second one.
 *
 * WHERE THE PANEL GOES is not the header's to decide: the bar is `sticky` with
 * a z-index, which makes it a stacking context and a 3rem-tall box. So the
 * panel is portalled out of it and positioned against the VIEWPORT
 * (`../anchor.ts`), exactly as the preferences panel beside it is.
 *
 * Dismissal is a pointer outside it, Escape, or the trigger again — and the two
 * a keyboard can reach put focus back on the trigger. That is `../popover.ts`
 * rather than anything of this file's: the preferences panel and the Commit
 * panel are the same object and share the bar's one focus cycle.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { ENTRY_SHAPE, ROW_GAP } from "../layout/entry.ts"
import { createPopover } from "../popover.ts"
import { ICON_BUTTON } from "../readout.ts"
import { TESTID } from "../testids.ts"

import { Panel } from "./Panel.tsx"

export function Plugins(props: {
  /** `closet` is the phone drawer row. Default is the header chip. */
  readonly where?: "header" | "closet"
}) {
  const popover = createPopover()
  const open = popover.open

  const closet = () => props.where === "closet"

  return (
    <>
      <button
        type="button"
        ref={popover.setTrigger}
        class={
          closet()
            ? `${ENTRY_SHAPE} ${ROW_GAP} w-full text-paper/80`
            : `${ICON_BUTTON} border ${
              open() ? "border-accent text-paper" : "border-paper/25"
            }`
        }
        data-testid={TESTID.pluginsTrigger}
        aria-expanded={open()}
        aria-haspopup="true"
        title="plugins: which integrations this server is running, and why"
        onClick={() => popover.toggle()}
      >
        <span aria-hidden="true">⧉</span>
        <span class={closet() ? undefined : "sr-only sm:not-sr-only"}>plugins</span>
      </button>
      {/* Out of the header entirely — see this file's header. */}
      <Show when={open() ? popover.at() : null}>
        {(at) => (
          <Portal>
            <Panel at={at()} inside={popover.setPanel} />
          </Portal>
        )}
      </Show>
    </>
  )
}
