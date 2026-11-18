/** Rich property rendering is an optional outline integration into a document-
 * owned location. The document always retains its independent read-only view. */
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

/**
 * A DOCUMENT'S FRONT MATTER, DRAWN THE WAY A ROW'S PROPERTIES ARE — including
 * the one rule that decides which of them are drawn at all.
 *
 * A contributed kind may say it is NOT a chip (`outline.row.placement`'s
 * `inRows: false`): the plugin that taught the word draws that fact better
 * somewhere else, so the run leaves it out rather than spelling the machinery
 * beside the prose. A row has obeyed that since the slot existed; a `.md`'s
 * `---` block did not, so a note with a chat read `chat-agent-session
 * claude:sess-…` under its title, directly below the line that already says
 * there is a chat.
 *
 * ONE REASON IT IS THE SAME TABLE AND NOT A SECOND ONE: properties are
 * properties, and which kind a value carries is the page's own answer
 * ({@link useLicences}, which the reading already computes for a document's
 * props). Nothing here names a plugin or a key.
 *
 * A COMPONENT RATHER THAN THE CONTRIBUTION ITSELF, because the licences are
 * read from the reading's context, which is the provider below.
 */
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
