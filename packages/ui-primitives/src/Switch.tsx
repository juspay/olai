import { splitProps } from "solid-js"
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"

export function Switch(props: {
  readonly label: string
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
  readonly testid: AnyTestId
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
      class={`prototype-switch relative h-[1.15rem] w-[2.05rem] shrink-0 rounded-full inset-ring inset-ring-ink/10 after:absolute after:-inset-x-[0.4rem] after:-inset-y-[0.8rem] after:content-[''] [--olai-ring-radius:9999px] md:after:hidden ${
        frozen() ? "opacity-60" : "cursor-pointer"
      } ${props.on ? "bg-done" : "bg-rule"}`}
      onClick={() => {
        if (!frozen()) props.onPick(props.on ? "off" : "on")
      }}
    >
      <span
        class={`absolute left-[0.12rem] top-[0.12rem] size-[0.9rem] rounded-full bg-panel shadow-raised transition-transform duration-150 ${
          props.on ? "translate-x-[0.9rem]" : "translate-x-0"
        }`}
      />
    </button>
  )
}
