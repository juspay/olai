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
 */
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"

export function Switch(props: {
  /** The accessible name — what is switched. */
  readonly label: string
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
  readonly testid: AnyTestId
  /** A choice that lasts only this session: marked (`data-session`) for the
   *  caller's own styling, and said on hover. */
  readonly session?: boolean
}) {
  const frozen = (): boolean => props.frozen === true
  return (
    <button
      type="button"
      role="switch"
      aria-label={props.label}
      aria-checked={props.on}
      aria-disabled={frozen() ? true : undefined}
      title={props.session ? "session-only" : undefined}
      data-session={props.session ? "true" : undefined}
      data-testid={props.testid}
      class={`prototype-switch relative h-[1.15rem] w-[2.05rem] shrink-0 rounded-full inset-ring inset-ring-ink/10 after:absolute after:-inset-x-[0.4rem] after:-inset-y-[0.8rem] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel md:after:hidden ${
        frozen() ? "opacity-60" : "cursor-pointer"
      } ${props.on ? "bg-done" : "bg-rule"}`}
      onClick={() => {
        if (!frozen()) props.onPick(props.on ? "off" : "on")
      }}
    >
      <span
        class={`absolute top-[0.12rem] size-[0.9rem] rounded-full bg-panel shadow-raised transition-[left] duration-150 ${
          props.on ? "left-[1.02rem]" : "left-[0.12rem]"
        }`}
      />
    </button>
  )
}
