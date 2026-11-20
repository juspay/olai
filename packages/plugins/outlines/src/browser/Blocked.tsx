import { TESTID } from "olai-plugin-outlines/testids"
import type { InTheWay } from "@olai/format"

import { NodeRefs } from "./NodeRefs.tsx"
import { refOf } from "./ref.ts"


export function Blocked(props: {
  readonly blocked: ReadonlyArray<InTheWay>
}) {
  return (
    <NodeRefs
      label="Blocked by"
      refs={props.blocked.map((one) => refOf(one.at))}
      testid={TESTID.blocked}
    />
  )
}
