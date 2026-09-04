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
 * The third part is OPTIONAL, and the absent arm is not a degenerate row — see
 * {@link Row.hint}. Every preference row has something to say; a plugin row in
 * the ordinary state does not, and the honest drawing of that is a label and a
 * control on one line with nothing under them.
 *
 * A row can also carry a fourth part: a line saying WHERE the choice in force
 * came from. Two sentences rather than one long one, because they answer two
 * different questions and only the second one is unusual; folding the source
 * into the hint would make every reading of every row a search for whether this
 * is one of them.
 *
 * ## THE SOURCE LINE AND THE FREEZE ARE TWO PROPS, and they were one
 *
 * `setBy` used to mean both — its presence drew the line AND stamped
 * `data-pinned`, on the reasoning that a row whose value came from the server
 * was a row a browser could not change. That held while the only rows with a
 * source line were the two git ones.
 *
 * The plugins panel broke it in the honest direction: those rows still owe a
 * reader where the serve started them, and they are now PRESSABLE
 * (`../plugins/Panel.tsx`). Left as one prop, the panel had to choose between
 * dropping a sentence that is still true and stamping a row `data-pinned` that
 * a person is about to press — a lie in the one attribute a scenario asserts
 * frozen-ness from.
 *
 * So {@link Row.frozen} is its own prop and carries the DOM claim. It is not
 * derived from `setBy`, deliberately: a default that read another prop would be
 * the same joint-distribution lie one indirection further in, and the two rows
 * that genuinely are frozen say so in one word.
 *
 * `aria-describedby` stays keyed on the WORDS rather than on the freeze. A
 * reader tabbing onto a live plugin strip is owed *this serve started it with
 * `--plugins=kolu`* exactly as much as a reader tabbing onto a frozen git one
 * is owed who set it; what changed is only whether the control will move.
 */

import { type JSX, Show } from "solid-js"

import { TESTID } from "../testids.ts"

export function Row(props: {
  /** What this preference is called, and the accessible name of the group of
   *  controls beside it — the buttons are a set, and a set with no name is a
   *  screen reader announcing three verbs in a row. */
  readonly label: string
  /**
   * What the choice in force means, in this app's own words. Reactive: it is
   * read again whenever the control moves.
   *
   * OPTIONAL, and the absent arm draws no paragraph at all rather than an empty
   * one. Every preference row has something to say — a theme, a density, a
   * commit policy all mean something beyond the word on the control — but a
   * plugin row in the ordinary state does not: the switch reads On, and a line
   * under it saying the plugin is running is the control announcing itself, on
   * every row of the panel (`../plugins/rows.ts`, which carries the screenshot
   * this came from). A row with nothing to say says nothing.
   */
  readonly hint?: string | null
  /** Which preference this is, for a scenario that has to find one row. */
  readonly pref: string
  /** WHERE the choice in force came from, when it was not this browser: who set
   *  it, or how the serve was started. Absent on every row this browser owns.
   *  Presence draws the sentence under the hint and points the control group's
   *  `aria-describedby` at it — see the header on why it no longer also means
   *  the row is stuck. */
  readonly setBy?: string
  /** WHETHER THE CONTROL WILL MOVE — `data-pinned` for the suite, and nothing
   *  else. The strip's own dimming is `frozen` on `./Segmented.tsx`, passed
   *  separately, because a row can freeze one of two strips (Alert sound) and a
   *  row's controls are the caller's children. */
  readonly frozen?: boolean
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
   *  the sentence below, and it is two elements away in document order. A LIVE
   *  control with a source line points at it too, for the reason the header
   *  gives: where a serve started this row is worth as much to somebody about
   *  to change it. One per row, and there is one panel in the document. */
  const saidId = (): string => `prefs-set-by-${props.pref}`

  return (
    <div
      data-testid={TESTID.prefsRow}
      data-pref={props.pref}
      // The state as an attribute, so a scenario asserts that this row is
      // frozen rather than inferring it from a colour or a sentence. Off a prop
      // of its own rather than off `setBy`, which now also appears on rows that
      // ARE pressable — see the header.
      data-pinned={props.frozen ? "true" : undefined}
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
      {/* Nothing renders nothing, which is the rule `under` below already keeps
          and for the same reason: an empty `<p>` is still a box with a top
          margin, and a panel of rows that each have one is the spacing of a
          panel of paragraphs with the paragraphs taken out. */}
      <Show when={props.hint}>
        {(said) => (
          <p class="mt-1.5 text-xs leading-relaxed text-muted" data-testid={TESTID.prefsHint}>
            {said()}
          </p>
        )}
      </Show>
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
