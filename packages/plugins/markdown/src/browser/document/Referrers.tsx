import { usePaneId } from "olai-plugin-navigation/routing"
import type { Claims, PageReading, Reference } from "@olai/format"
import type { Accessor } from "solid-js"
import { TESTID } from "olai-plugin-markdown/testids"
import { createMemo, Show, untrack } from "solid-js"

import { makeReferrerWays, referrerRowOf, ReferrersSection, type ReferrerRow } from "@olai/markdown-ui/ReferrersSection.tsx"
import { only } from "@olai/web/client/narrow.ts"
import { atFile, atNode, type Route } from "olai-plugin-navigation/routes"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

export function Referrers(props: {
  readonly file: string
  readonly reading: Accessor<PageReading | undefined>
  readonly claims: Claims | undefined
  readonly memory: ReferrerMemory | undefined
  readonly href: (route: Route) => string
}) {
  const reading = props.reading
  const found = createMemo(() => {
    const shows = reading()?.shows
    return (shows === undefined ? undefined : only(shows, "document")?.referrers) ?? []
  })
  return (
    <Show when={found().length > 0 ? props.file : undefined} keyed>
      {(file) => <Section file={file} found={found} claims={props.claims} href={props.href} reading={reading} memory={props.memory} />}
    </Show>
  )
}

function Section(props: {
  readonly file: string
  readonly found: () => ReadonlyArray<Reference>
  readonly claims: Claims | undefined
  readonly href: (route: Route) => string
  readonly reading: Accessor<PageReading | undefined>
  readonly memory: ReferrerMemory | undefined
}) {
  const pane = usePaneId()()
  const key = JSON.stringify([pane, `referrers:${props.file}`])
  const stillShown = () => {
    const shows = untrack(props.reading)?.shows
    const doc = shows === undefined ? undefined : only(shows, "document")
    return doc !== undefined && doc.file === props.file && props.found().length > 0
  }
  return (
    <ReferrersSection
      found={props.found()}
      claims={props.claims}
      ways={makeReferrerWays({
        see: TESTID.documentSeeRefs,
        mention: TESTID.documentMentionRefs,
        link: TESTID.documentLinkRefs,
      })}
      row={(one) => referrerRowOf(one, { file: (path) => props.href(atFile(path)), node: (id) => props.href(atNode(id)) })}
      stillShown={stillShown}
      memoryKey={key}
      testid={TESTID.documentReferrers}
      summaryTestid={TESTID.documentReferrersSummary}
      linkTestid={TESTID.documentReferrer}
      memory={props.memory}
    />
  )
}


