import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { properties, browserState as markdownState } from "olai-plugin-markdown/contract"
import type { Custom } from "@olai/format"
import { browserState } from "../index.ts"
import { PropertyReading, useLicences } from "./reading.tsx"
import { PropsDrawer } from "./props/PropsDrawer.tsx"
import { customEntries } from "../contracts/property-values.ts"
import { dressed } from "./faces.ts"

function DocumentProperties(props: { readonly custom: Custom; readonly from: string }) {
  const licences = useLicences()
  return <PropsDrawer
    entries={customEntries(props.custom, {
      kind: (key, value) => licences()(props.from, key, value),
      at: kind => dressed("outline.row.placement").get(kind),
    })}
    from={props.from}
  />
}

export const documentProperties = definePlugin({ name: "document-properties", needs: [browserState, markdownState, rendererSlots], apply: Effect.gen(function*() {
  yield* (yield* rendererSlots).contribute(properties, props => <PropertyReading page={props.reading}>
    <DocumentProperties custom={props.custom} from={props.from} />
  </PropertyReading>)
}) })
