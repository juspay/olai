import { Dynamic } from "solid-js/web"
import type { JSX } from "solid-js"
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"

export function RailButton(props: {
  readonly testid: string
  readonly label: string
  readonly data?: { readonly [key: `data-${string}`]: string | undefined }
  readonly href?: string
  readonly onClick?: () => void
  readonly onNavigate?: () => void
  readonly children: JSX.Element
}) {
  return (
    <Dynamic component={props.href === undefined ? "button" : "a"}
      href={props.href}
      type={props.href === undefined ? "button" : undefined}
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
