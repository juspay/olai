/** Rich property rendering is an optional outline integration into a document-
 * owned location. The document always retains its independent read-only view. */
import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { properties, browserState as markdownState } from "olai-plugin-markdown/contract"
import { browserState } from "../index.ts"
import { PropertyReading } from "./reading.tsx"
import { PropsDrawer } from "./props/PropsDrawer.tsx"
import { customEntries } from "../contracts/property-values.ts"
export const documentProperties = definePlugin({ name: "document-properties", needs: [browserState, markdownState, rendererSlots], apply: Effect.gen(function*() {
  yield* (yield* rendererSlots).contribute(properties, props => <PropertyReading page={props.reading}>
    <PropsDrawer entries={customEntries(props.custom)} from={props.from} />
  </PropertyReading>)
}) })
