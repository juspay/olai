/**
 * One preference: what it is called, the control that sets it, and what the
 * choice in force MEANS.
 *
 * The third part is the one worth arguing for. A row of switches with tidy
 * labels is a quiz — "Done: Hidden" says what the control is set to and nothing
 * about what the app will now do — so every row carries a line under it that is
 * read off the CURRENT choice rather than describing the switch in general.
 * That is the shape kolu's settings popover uses, and it is adopted here for
 * the reason it works there: the sentence changes when you press the control,
 * so the panel answers "what did I just do" in the same gesture.
 *
 * The label is the hero and the hint recedes, because attention belongs on the
 * control. Nothing here is hover-only and nothing is a colour alone.
 *
 * A row can also be PINNED, which is a fourth part and not a fifth state of the
 * hint: the hint still says what the choice in force means — that sentence is
 * true however the choice got there — and a line under it says WHO set it and
 * that this browser cannot. Two sentences rather than one long one, because
 * they answer two different questions and only the second one is unusual;
 * folding the source into the hint would make every reading of every row a
 * search for whether this is one of the pinned ones.
 */

import { type JSX, Show } from "solid-js"

import { TESTID } from "../testids.ts"

export function Row(props: {
  /** What this preference is called, and the accessible name of the group of
   *  controls beside it — the buttons are a set, and a set with no name is a
   *  screen reader announcing three verbs in a row. */
  readonly label: string
  /** What the choice in force means, in this app's own words. Reactive: it is
   *  read again whenever the control moves. */
  readonly hint: string
  /** Which preference this is, for a scenario that has to find one row. */
  readonly pref: string
  /** WHO set this row, when it was not this browser. Absent on every row this
   *  browser owns. Presence draws the sentence under the hint (and
   *  `data-pinned` for the suite); the control's read-only is `frozen` on the
   *  strip, passed separately. */
  readonly setBy?: string
  /**
   * Anything this row needs UNDER its sentences — today the one thing: Resume,
   * which starts a stopped Auto-commit again on a row the server has frozen.
   *
   * A slot rather than a sibling in the panel, because a control that belongs
   * to a row and is only associated with it by adjacency is a control the next
   * row inserted above will silently steal.
   *
   * It is rendered BARE, and the caller owns its own spacing. A wrapper here
   * would be a box this row draws whenever the prop is passed — and the prop is
   * passed unconditionally, since what decides whether Resume is on screen is a
   * `Show` INSIDE it. So every Git commit row whose Resume is not showing grew
   * an empty div its neighbour did not have. Nothing renders nothing.
   */
  readonly under?: JSX.Element
  readonly children: JSX.Element
}) {
  /** So the CONTROLS carry the reason, not only the page. A frozen segment is
   *  `aria-disabled` and keeps its focus (`./Segmented.tsx` says why), and a
   *  reader who tabs onto one has to be told why it will not move — which is
   *  the sentence below, and it is two elements away in document order. One per
   *  row, and there is one panel in the document. */
  const saidId = (): string => `prefs-set-by-${props.pref}`

  return (
    <div
      data-testid={TESTID.prefsRow}
      data-pref={props.pref}
      // The state as an attribute, so a scenario asserts that this row is
      // frozen rather than inferring it from a colour or a sentence.
      data-pinned={props.setBy ? "true" : undefined}
    >
      {/* Wraps rather than clips: the theme row's control is a strip of chips, and
          a panel narrow enough to be a phone's has to put them under the label
          instead of off the edge. */}
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span class="text-sm text-ink">{props.label}</span>
        <div
          class="flex min-w-0 flex-wrap items-center gap-1"
          role="group"
          aria-label={props.label}
          // The controls carry the reason too — see {@link saidId}. Absent on
          // every row this browser owns, because a `describedby` pointing at
          // nothing is a promise the page does not keep.
          aria-describedby={props.setBy ? saidId() : undefined}
        >
          {props.children}
        </div>
      </div>
      <p class="mt-1.5 text-xs leading-relaxed text-muted" data-testid={TESTID.prefsHint}>
        {props.hint}
      </p>
      {/* WHO set it, when it is not this browser — the WORDS and nothing else.
          What says so at a glance is the control beside it, drawn dim and
          inert; a glyph would be a second claim to keep true, and the only
          lock in this font's reach is an emoji, which is the one thing the
          chrome here has none of. */}
      <Show when={props.setBy}>
        {(said) => (
          <p
            id={saidId()}
            class="mt-1 text-xs leading-relaxed text-muted"
            data-testid={TESTID.prefsSetBy}
          >
            {said()}
          </p>
        )}
      </Show>
      {props.under}
    </div>
  )
}
