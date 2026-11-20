import { Tip } from "@olai/web/client/Tip.tsx"
import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
export function DropRef(props: {
  readonly testid: TestId
  readonly relation: string
  readonly id: string
  readonly title: string
  readonly onDrop: (id: string) => void
}) {
  const said = (): string => `Remove ${props.title}`
  return (
    <Tip text={said()}>
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 text-label leading-none text-muted hover:text-alarm"
        data-testid={props.testid}
        data-ref={props.id}
        aria-label={said()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          props.onDrop(props.id)
        }}
      >
        ×
      </button>
    </Tip>
  )
}
