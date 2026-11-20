import { usePaneId } from "olai-plugin-navigation/routing"
import { TESTID } from "olai-plugin-outlines/testids"
import { type Reference } from "@olai/format"
import { createMemo, Show, untrack } from "solid-js"
import { only } from "@olai/web/client/narrow.ts"
import type { PageReading } from "@olai/format"

import {
  makeReferrerWays,
  referrerRowOf,
  ReferrersSection,
  type ReferrerRow,
} from "@olai/markdown-ui/ReferrersSection.tsx"
import { backlinksMemory } from "./memory.ts"
import { useReading } from "../reading.tsx"
import { useHere } from "olai-plugin-navigation/routing"
import { atFile, atNode } from "olai-plugin-navigation/routes"
import { hrefOf } from "../routing.ts"
import { servedDirectory } from "../vault.ts"

export function Backlinks(props: {
  readonly id: string
}) {
  const reading = useReading()
  const found = createMemo(() => {
    const shows = reading()?.shows
    return (shows === undefined ? undefined : only(shows, "node")?.backlinks) ?? []
  })

  return (
    <Show when={found().length > 0 ? props.id : undefined} keyed>
      {(id) => <Section id={id} found={found} reading={reading} />}
    </Show>
  )
}

function Section(props: {
  readonly id: string
  readonly found: () => ReadonlyArray<Reference>
  readonly reading: () => PageReading | undefined
}) {
  const pane = usePaneId()()
  const key = JSON.stringify([pane, `backlinks:${props.id}`])
  const memory = backlinksMemory.read()
  const stillShown = () => {
    const shows = untrack(props.reading)?.shows
    const page = shows === undefined ? undefined : only(shows, "node")
    const zoomed = page?.zoomed
    return zoomed !== undefined && zoomed.kind === "node" && zoomed.shows.node.id === props.id && props.found().length > 0
  }
  return (
    <ReferrersSection
      found={props.found()}
      claims={servedDirectory()?.claims()}
      ways={makeReferrerWays({
        see: TESTID.backlinkSeeRefs,
        mention: TESTID.backlinkMentionRefs,
        link: TESTID.backlinkLinkRefs,
      })}
      row={(one) => referrerRowOf(one, { file: (path) => hrefOf(atFile(path)), node: (id) => hrefOf(atNode(id)) })}
      stillShown={stillShown}
      memoryKey={key}
      testid={TESTID.backlinks}
      summaryTestid={TESTID.backlinksSummary}
      linkTestid={TESTID.nodeRef}
      memory={memory}
    />
  )
}
