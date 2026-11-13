/**
 * A binary on/off control — the one the app uses for every yes-or-no choice.
 *
 * Segmented (`./Segmented.tsx`) is for NAMED alternatives: Compact, Cozy,
 * Open. A two-pill `Off | On` strip for a binary is a wall of words where a
 * switch says the same thing at a glance, and two shapes for one kind of
 * choice is one too many. So the plugins panel and the preferences panel draw
 * this one, from here — a static component, carrying no state of its own.
 *
 * The track is small on a pointer and the TARGET is not on a phone: the
 * `after:` box grows the hit area to 44px below 48rem (`./touch.ts`) without
 * moving the drawing, so a row of these keeps its rhythm on a laptop.
 *
 * FROZEN is dimmed and `aria-disabled` rather than `disabled`, for Segmented's
 * reason: a disabled button takes no focus, and a keyboard reader who tabs
 * onto it is owed the reason it will not move.
 *
 * NO HOVER SENTENCE OF ITS OWN. This package declares `solid-js` and nothing
 * else, so it cannot reach `@olai/web`'s `<Tip>` — and the `title` it used to
 * take was the browser's tooltip, placed off the window edge and hidden from
 * anyone not holding a pointer. A caller that owes a sentence wraps this
 * control in `<Tip>` and says the same words in {@link label}, which is the
 * copy a screen reader gets (`plugin-inspector/src/Switch.tsx`).
 */
import { splitProps } from "solid-js"
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"

export function Switch(props: {
  /** The accessible name — what is switched, and any sentence a caller's tip
   *  also says, since the tip itself exposes nothing to assistive tech. */
  readonly label: string
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
  readonly testid: AnyTestId
  /** The caller's own markings, passed through for its own styling. */
  readonly [data: `data-${string}`]: string | undefined
}) {
  const [, data] = splitProps(props, ["label", "on", "frozen", "onPick", "testid"])
  const frozen = (): boolean => props.frozen === true
  return (
    <button
      {...data}
      type="button"
      role="switch"
      aria-label={props.label}
      aria-checked={props.on}
      aria-disabled={frozen() ? true : undefined}
      data-testid={props.testid}
      // `[--olai-ring-radius:9999px]` and nothing else about focus. The app's
      // one ring is an `outline` drawn from `@olai/appearance/chrome.css`
      // (which is unlayered, so no `outline-none` here could ever have stood
      // it down — this control used to spell one, along with a `ring-2` of its
      // own, and wore BOTH rings as a result). What the sheet cannot know is
      // that this control is a pill rather than a `--radius-control` box, so
      // the shape is the one thing handed back to it. The `ring-2` that was
      // here is gone for the reason the sheet argues: a Tailwind ring is a
      // `box-shadow`, and forced colours deletes box-shadows.
      //
      // ON AND OFF ARE A BACKGROUND APART, which is the other thing forced
      // colours takes — both tracks flatten to `Canvas` and so does the knob.
      // `../all.css` repaints all three from the system palette there; the
      // knob's travel is geometry and needs no help.
      class={`prototype-switch relative h-[1.15rem] w-[2.05rem] shrink-0 rounded-full inset-ring inset-ring-ink/10 after:absolute after:-inset-x-[0.4rem] after:-inset-y-[0.8rem] after:content-[''] [--olai-ring-radius:9999px] md:after:hidden ${
        frozen() ? "opacity-60" : "cursor-pointer"
      } ${props.on ? "bg-done" : "bg-rule"}`}
      onClick={() => {
        if (!frozen()) props.onPick(props.on ? "off" : "on")
      }}
    >
      {/* THE KNOB TRAVELS ON `translate`, not on `left`. Both draw the same
          two positions, and only one of them stays off the layout and paint
          work a moving `left` costs every frame — the platform's own advice,
          and it costs this file one utility. Under `prefers-reduced-motion`
          the knob lands at the end rather than sliding to it, which the app
          says once rather than here (`@olai/appearance/chrome.css`): the
          transition survives for colours, the travel does not. */}
      <span
        class={`absolute left-[0.12rem] top-[0.12rem] size-[0.9rem] rounded-full bg-panel shadow-raised transition-transform duration-150 ${
          props.on ? "translate-x-[0.9rem]" : "translate-x-0"
        }`}
      />
    </button>
  )
}
