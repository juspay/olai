import { TESTID } from "olai-plugin-navigation/testids"
import { Tip } from "@olai/web/client/Tip.tsx"
import { Show } from "solid-js"

import type { AddressTarget } from "./address.ts"
import { useRouter } from "olai-plugin-navigation/routing"


export function Face(props: {
  readonly target: AddressTarget
  readonly name: string
  readonly pressable?: boolean
  readonly wrap?: boolean
}) {
  const labelClass = () => props.wrap ? "whitespace-normal [overflow-wrap:anywhere]" : "truncate"
  const router = useRouter()
  const routes = router.routes
  const href = () => {
    const target = props.target
    return target.kind === "page" ? routes.href(target.route) : routes.layoutHref(target.workspace)
  }
  const filter = () => {
    const target = props.target
    return target.kind === "page" ? routes.filterOf(target.route) : ""
  }
  return (
    <>
      <Show when={props.target.kind === "layout"} fallback={<PinMark />}>
        <svg data-layout-mark class="size-3.5 shrink-0" aria-hidden="true"
          viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <rect x="1" y="2" width="6" height="12" rx="1" />
          <rect x="9" y="2" width="6" height="12" rx="1" />
        </svg>
      </Show>
      <Show
        when={props.pressable === true}
        fallback={
          <span class={`min-w-0 flex-1 ${labelClass()}`} data-testid={TESTID.addressName}>
            {props.name}
          </span>
        }
      >
        <a
          href={href()}
          class={`min-w-0 flex-1 ${labelClass()} underline decoration-rule underline-offset-2 hover:decoration-accent`}
          data-testid={TESTID.addressName}
        >
          {props.name}
        </a>
      </Show>
      <Show when={filter() !== ""}>
        <Tip text={filter()}>
          <span
            class={`min-w-0 max-w-[55%] ${labelClass()} rounded-control bg-current/10 px-1 font-mono text-caption`}
            data-testid={TESTID.addressFilter}
          >
            {filter()}
          </span>
        </Tip>
      </Show>
    </>
  )
}

export function PinMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      class="size-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.53 1.47a.75.75 0 0 0-1.28.53v.94L4.9 6.16a2.75 2.75 0 0 0-2.2.78.75.75 0 0 0 0 1.06l2.3 2.3-3.28 3.28a.75.75 0 1 0 1.06 1.06l3.28-3.28 2.3 2.3a.75.75 0 0 0 1.06 0 2.75 2.75 0 0 0 .78-2.2l3.22-3.35h.94a.75.75 0 0 0 .53-1.28l-5.46-5.46z" />
    </svg>
  )
}
