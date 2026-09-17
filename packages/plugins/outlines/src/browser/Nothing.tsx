/** A missing claimed path keeps its kind's noun. An unclaimed path can name
 * only the suffix: no absent-row roster is kept by the browser. */

import { unclaimedFileMessage } from "@olai/format"
import { servedDirectory } from "./vault.ts"
import { TESTID } from "@olai/ui-primitives/testids.ts"
import { Empty } from "@olai/web/client/Empty.tsx"
export function Nothing(props: {
  readonly sought: string
  readonly requested: string | null
}) {
  const line = () => {
    const path = props.requested
    if (path === null) return "No outlines under the served directory."
    const directory = servedDirectory()
    const kind = directory?.kindOf(path)
    const claim = kind == null ? undefined : directory?.claims().byKind.get(kind)
    return claim === undefined
      ? unclaimedFileMessage(path)
      : `No ${claim.noun} named ${path} under the served directory.`
  }
  return <Empty testid={TESTID.nothing} line={line()} />
}
