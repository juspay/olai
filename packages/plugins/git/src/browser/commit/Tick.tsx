import { TESTID } from "../../testids.ts"

export function Tick(props: {
  readonly path: string
  readonly ticked: boolean
  readonly toggle: () => void
  readonly label: string
}) {
  return (
    <input
      type="checkbox"
      class="mt-0.5 size-3 shrink-0 cursor-pointer accent-ink"
      data-testid={TESTID.commitTick}
      data-path={props.path}
      checked={props.ticked}
      aria-label={props.label}
      onChange={() => props.toggle()}
    />
  )
}
