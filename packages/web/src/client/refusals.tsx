import type { Refusal } from "@olai/format"
import { createMemo, Index } from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"

const said = (refusal: Refusal): string =>
  `${refusal.token} — ${refusal.reason}`

const sameLines = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean => a.length === b.length && a.every((line, at) => line === b[at])

export function Refusals(props: {
  readonly of: ReadonlyArray<Refusal>
  readonly class: string
  readonly testid: TestId
}) {
  const lines = createMemo(() => props.of.map(said), undefined, { equals: sameLines })
  return (
    <Index each={lines()}>
      {(line) => (
        <SaidLine
          said={{ tone: "alarm", text: line() }}
          class={props.class}
          testid={props.testid}
        />
      )}
    </Index>
  )
}
