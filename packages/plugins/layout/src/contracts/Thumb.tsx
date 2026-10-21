/**
 * ONE DOOR IN THE PHONE'S THUMB BAR (`../index.ts`'s `thumbs`): an icon over
 * a word, a finger's height, lit in the accent while it is the page.
 *
 * The shape is the bar's so four plugins' doors read as one row; what each
 * door IS — where it goes, what it counts — is the plugin's. A door that
 * navigates is a link (`href`), so it is a real address a long-press can copy;
 * one that opens something in place is a button. A `badge` is the one fact a
 * door may carry beside its icon: a count of what needs a person.
 */
import { type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

export function Thumb(props: {
  readonly label: string
  readonly testid: string
  readonly href?: string
  readonly onClick?: () => void
  /** After navigation followed this door (`olai-navigated`), not on presses the
   *  browser keeps. */
  readonly onNavigate?: () => void
  readonly current?: boolean
  /** A short count or mark, drawn at the icon's shoulder. */
  readonly badge?: JSX.Element
  readonly data?: { readonly [key: `data-${string}`]: string | undefined }
  readonly children: JSX.Element
}) {
  return (
    <Dynamic component={props.href === undefined ? "button" : "a"}
      href={props.href}
      type={props.href === undefined ? "button" : undefined}
      class="relative flex min-h-[var(--height-thumbs)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-caption font-medium text-muted no-underline outline-none active:bg-ink/5 aria-[current=page]:text-accent"
      {...props.data}
      data-testid={props.testid}
      aria-label={props.label}
      aria-current={props.current === true ? "page" : undefined}
      onClick={() => props.onClick?.()}
      on:olai-navigated={() => props.onNavigate?.()}
    >
      <span class="relative inline-flex size-6 items-center justify-center" aria-hidden="true">
        {props.children}
        <Show when={props.badge}>
          {(badge) => (
            <span class="absolute -right-2 -top-1 min-w-4 rounded-full bg-alarm px-1 text-center text-[0.625rem] font-semibold leading-4 text-paper">
              {badge()}
            </span>
          )}
        </Show>
      </span>
      <span class="max-w-full truncate leading-none">{props.label}</span>
    </Dynamic>
  )
}
