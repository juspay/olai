/**
 * THE RAIL'S ICON BUTTON — one box, one target size, one hover, for every
 * door the collapsed directory column offers.
 *
 * IT CARRIES NO TOOLTIP, and that is a fact about this package rather than a
 * shortage of sentences: `@olai/ui-primitives` declares `solid-js` and nothing
 * else, while the app's tip lives in `@olai/web` — which depends on THIS
 * package. A primitive that drew its own tip would have to import the package
 * that imports it. So the rule the rest of the app follows (the component that
 * renders the control renders its tip) lands here on the CALLER: every one of
 * these buttons is drawn by a plugin, every plugin already has `@olai/web`,
 * and each wraps `<RailButton>` in its own `<Tip>`. The root below is this
 * component's first element child, which is the box the tip measures, so the
 * caller's wrapper is about exactly the button it looks like it is about.
 */
import { Dynamic } from "solid-js/web"
import type { JSX } from "solid-js"
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"

export function RailButton(props: {
  readonly testid: string
  /** What it is called, for a reader who cannot see the glyph. The tip the
   *  caller wraps this in says the same thing in the words a pointer gets. */
  readonly label: string
  /** Optional semantic facts owned by the caller, without teaching this shell
   * button any tenant's vocabulary. */
  readonly data?: { readonly [key: `data-${string}`]: string | undefined }
  readonly href?: string
  readonly onClick?: () => void
  /** After navigation followed this anchor (`olai-navigated`), not on presses the browser keeps. */
  readonly onNavigate?: () => void
  readonly children: JSX.Element
}) {
  return (
    <Dynamic component={props.href === undefined ? "button" : "a"}
      href={props.href}
      type={props.href === undefined ? "button" : undefined}
      // `relative`: the agenda's dot is absolute against this box, and the
      // containing block is declared once, here, rather than by whichever child
      // happens to need one.
      class={`${TARGET_BOX} relative inline-flex items-center justify-center rounded-control text-muted hover:bg-ink/5 hover:text-ink md:min-h-8 md:min-w-8`}
      {...props.data}
      data-testid={props.testid}
      aria-label={props.label}
      onClick={() => props.onClick?.()}
      on:olai-navigated={() => props.onNavigate?.()}
    >
      {props.children}
    </Dynamic>
  )
}
