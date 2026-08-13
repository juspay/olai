/**
 * The way into the preferences: one control in the app header, and the panel it
 * opens.
 *
 * It is in the HEADER because the header carries what is about the APP and the
 * sidebar what is about the DIRECTORY (`../AppHeader.tsx`), and how this
 * browser reads is a fact about the app in every directory it is pointed at.
 *
 * It REPLACED the theme pill rather than joining it. The pill was a preference
 * with a control of its own outside the place preferences are set, and a bar
 * that has five things in it at 390pt cannot spend one of them on a second door
 * to a panel that is already there — the same argument `one-git-indicator`
 * settled for the two git chips. What the pill promised (it NAMED the theme in
 * force) is kept: the theme row's hint names it, one gesture further in, and
 * the page itself is painted in it — which is the difference from the
 * connection and the commit pill, whose facts are invisible unless a control
 * says them and which therefore may never be a gesture away.
 *
 * WHERE THE PANEL GOES is not the header's to decide: the bar is `sticky` with
 * a z-index, which makes it a stacking context and a 3rem-tall box. So the
 * panel is portalled out of it and positioned against the VIEWPORT
 * (`../anchor.ts`), exactly as the Commit panel beside it is, and it opens
 * downward because that is the side with the room.
 *
 * Dismissal is a pointer outside it, Escape, or the trigger again — and the two
 * that a keyboard can reach put focus back on the trigger, because somebody who
 * opened this, tabbed into it and pressed Escape would otherwise land on
 * `<body>`. That behaviour came with the theme popover this replaced; it is
 * kept here rather than lost with it, and it is `../popover.ts` rather than
 * anything of this file's, because the Commit panel two pills along is the
 * same object and had its own half of it.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { ICON_BUTTON } from "../readout.ts"
import { Panel } from "./Panel.tsx"
import { createPopover } from "../popover.ts"
import { TESTID } from "../testids.ts"

export function Preferences() {
  // Whether it is up, where it goes, and the three ways it shuts —
  // `../popover.ts`, shared with the Commit panel beside this in the bar.
  const popover = createPopover()
  const open = popover.open

  return (
    <>
      <button
        type="button"
        ref={popover.setTrigger}
        // The bar's icon-button shape (`../readout.ts`), which the agent toggle
        // beside it wears too — including the 44px a finger needs. The RING is
        // this button's own: it says whether the panel is up. An inset ring
        // rather than the border it used to be, for the depth pass's reason —
        // the resting state is a card and a hairline round a card is the thing
        // elevation replaced — and inset so the box does not move when it lights.
        class={`${ICON_BUTTON} ${
          open() ? "inset-ring-2 inset-ring-accent text-ink" : "text-muted"
        }`}
        data-testid={TESTID.prefsTrigger}
        aria-expanded={open()}
        aria-haspopup="true"
        title="preferences: theme, and what a page does with finished work"
        onClick={() => popover.toggle()}
      >
        {/* The word is `sr-only` below 40rem, exactly as the agent toggle's is:
            the glyph is already an icon, the accessible name is unchanged, and
            what a bar this size gives up is pixels rather than meaning. */}
        <span aria-hidden="true">⚙</span>
        <span class="sr-only sm:not-sr-only">prefs</span>
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
