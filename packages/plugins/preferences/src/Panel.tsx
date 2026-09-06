/**
 * What this browser is set to, in one place.
 *
 * Nearly everything on it is CLIENT-LOCAL and that is the panel's subject
 * (`docs/architecture.md`): a pick is stored in this browser, carried to the
 * other tabs of it by the `storage` event, and never sent — so two machines
 * reading the same outlines are entitled to disagree, and the served directory
 * neither knows nor cares. That is the deliberate difference from kolu's
 * settings popover, whose shape this adopts: its rows read and write wire
 * singletons, because its preferences are the server's.
 *
 * THERE WAS AN INSTANCE KIND and it left twice: a row per plugin this build
 * has, and the two git-policy rows. The plugin rows are their own control in
 * the bar now (`../plugins/Plugins.tsx`). Git policy travels with the git
 * plugin's commit panel — this package does not import that plugin, and a
 * serve without the row has no policy to draw.
 *
 * WHAT IS ON IT is a narrower question than "every client-local value", and the
 * answer is: the ones that are a CHOICE and have nowhere else to be made. The
 * theme, the typeface, how much of a row is drawn by default, what the page in
 * front of you does with finished work, and whether the agent stopping on a
 * question is announced and whether that makes a sound. The two ALERT rows
 * meet the test the same way the reader's rows do:
 * "tell me when the agent needs me" is a claim about the reader, and the
 * surface it is about is a drawer that is SHUT in exactly the case the setting
 * is for — so a switch on the panel would be a control you can only reach when
 * you do not need it. The DENSITY belongs here because it is a claim about
 * the reader ("I read a tree as a list of titles") rather than about any one
 * outline, so a switch bolted to the outline page would be a per-page control
 * for a per-person fact — and would have to be drawn on the zoomed page and
 * the day page too. The DONE row here says the Default: a page with its own
 * say-so draws its flip beside its filter (../filter/DoneFlip.tsx), and the
 * row a reader comes to change the DEFAULT on is the one door that always
 * holds still. The layout values
 * in `../layout/prefs.ts` are
 * stored the same way and are deliberately NOT here — a sidebar width is set
 * by dragging the sidebar, and a panel being open is set by the control that
 * opens it. Copying them into a settings list would be a second control for
 * something that already has one, which is the redundancy `one-git-indicator`
 * was filed over.
 *
 * Every row is `./Row.tsx`: a label, a control, and a line under it read off
 * the choice in force.
 *
 * The folder is `settings/` and every word on screen is "preferences", and that
 * is deliberate rather than sloppy: `../preference.ts` beside it is the STORE —
 * what this browser remembers and how — and a folder named one letter away from
 * it would be two nearly identical names for two different things, which is
 * worse than two words for one. This is the surface; that is the mechanism.
 */

import type { Contribution } from "@olai/plugin-api"
import type { JSX } from "solid-js"
import { For } from "solid-js"

import { type Anchor, styleOf } from "@olai/web/client/anchor.ts"
import { PANEL_BOX } from "@olai/web/client/readout.ts"

import { TESTID } from "@olai/web/client/testids.ts"

export function Panel(props: {
  readonly sections: () => ReadonlyArray<Contribution<() => JSX.Element>>
  /** Where to sit, in viewport pixels — see `../anchor.ts` for why this is not
   *  a matter of CSS alone. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled and so is
   *  not a descendant of the control that opened it. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  // THE `plugins` CELL IS NOT READ HERE ANY MORE. It was, for the rows that
  // are now their own panel — and it is worth the line, because a panel that
  // still subscribed to a cell it draws nothing from is a frame decoded per
  // publish for nobody. The subscription moved with the rows.
  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-4`}
      style={styleOf(props.at)}
      // Focusable, and never in the tab order: opening puts the caret here so a
      // keyboard is standing IN the panel rather than beside it (`../popover.ts`
      // says why a portal needs that), and Tab from here is the first control.
      // No ring on it, because it is a waypoint rather than a control — what
      // gets one is whatever the first Tab lands on.
      tabindex="-1"
      data-testid={TESTID.prefsPanel}
      aria-label="preferences"
    >
      <For each={props.sections()}>{(entry) => entry.value()}</For>

      {/* One sentence for the whole panel, because it is one fact about every
          row on it and repeating it per row would be three copies of the
          doctrine. It is here at all because "where did this go" is exactly
          what a person wonders about a setting they just changed.

          THE PLUGIN ROWS WERE NAMED HERE TOO, in the same breath, while they
          were on this panel — the same exception rather than a second one. They
          are a panel of their own now and this sentence stops reaching for
          them: a caveat about rows a reader cannot see from here is a caveat
          about nothing, and it would send somebody looking down the panel for a
          section that is not on it. Their panel needs no line of its own —
          `../plugins/Panel.tsx` says why. */}
      <p class="border-t border-rule pt-3 text-xs text-muted" data-testid={TESTID.prefsScope}>
        These are this browser's. They are stored here, reach every tab you have
        olai open in, and are never sent to the server.
      </p>
    </section>
  )
}
