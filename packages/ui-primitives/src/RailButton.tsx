import { Dynamic } from "solid-js/web"
import type { JSX } from "solid-js"
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"

export function RailButton(props: {
  readonly testid: string
  readonly label: string
  readonly title: string
  /** Optional semantic facts owned by the caller, without teaching this shell
   * button any tenant's vocabulary. */
  readonly data?: { readonly [key: `data-${string}`]: string | undefined }
  readonly href?: string
  readonly onClick?: () => void
  readonly children: JSX.Element
}) {
  return (
    <Dynamic component={props.href === undefined ? "button" : "a"}
      href={props.href}
      type={props.href === undefined ? "button" : undefined}
      // `relative`: the agenda's dot is absolute against this box, and the
      // containing block is declared once, here, rather than by whichever child
      // happens to need one.
      class={`${TARGET_BOX} relative inline-flex items-center justify-center rounded-control text-paper/60 hover:bg-paper/10 hover:text-paper md:min-h-9 md:min-w-9`}
      {...props.data}
      data-testid={props.testid}
      aria-label={props.label}
      title={props.title}
      onClick={() => props.onClick?.()}
    >
      {props.children}
    </Dynamic>
  )
}
