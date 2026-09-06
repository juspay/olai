import { TESTID } from "olai-plugin-plugin-inspector/testids"

/** A binary on/off control. Segmented Off|On is for named alternatives; this
 *  panel has thirty binaries and the two-pill strip is a wall. */
export function Switch(props: {
  readonly on: boolean
  readonly frozen?: boolean
  readonly onPick: (value: "on" | "off") => void
}) {
  const frozen = (): boolean => props.frozen === true
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-disabled={frozen() ? true : undefined}
      data-testid={TESTID.pluginSwitch}
      class={`relative h-[1.15rem] w-[2.05rem] shrink-0 rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-ink)_6%,transparent)] ${
        frozen() ? "opacity-60" : ""
      } ${props.on ? "bg-done" : "bg-rule"}`}
      onClick={() => {
        if (!frozen()) props.onPick(props.on ? "off" : "on")
      }}
    >
      <span
        class={`absolute top-[0.12rem] size-[0.9rem] rounded-full bg-panel shadow-sm ${
          props.on ? "left-[1.02rem]" : "left-[0.12rem]"
        }`}
      />
    </button>
  )
}
