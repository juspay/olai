/**
 * WHAT REFERS TO THIS NODE, under a zoomed node's heading — the one place in
 * this app a reference is read backwards.
 *
 * The section itself is the shared one (`@olai/markdown-ui`'s
 * `ReferrersSection`), which both this page and a document's page draw — the
 * same wire shape, the same collapse, the same labels, the same rows, and the
 * same open-state memory: ONE store, minted by the MARKDOWN plugin's
 * activation, offered behind `markdown.referrer-memory`, and read here
 * through this package's own copy of it (`./memory.ts`), installed by
 * `../browser.tsx`'s `backlinks` component — which sits `waiting` while that
 * row is off, so an outline with no markdown row draws the section without
 * its memory rather than this page turning off with it.
 *
 * What is left HERE is what only this page knows:
 *
 *   - WHICH references to draw, off the node page's own reading —
 *     `@olai/format`'s `referencesOf`, answered by the server as
 *     `shows.node.backlinks` (one entry per source, with the ways it refers);
 *   - the ROWS, shaped per way — a record opens its node page, a body opens
 *     its file, and the two are different routes this plugin knows how to
 *     spell (`olai-plugin-navigation`);
 *   - the testids each row answers to (`../contracts/referrings.ts` is gone —
 *     the labels are the shared section's, and only the testids are this
 *     page's);
 *   - the KEY this section remembers its open state under — (pane, node) —
 *     and the "still shown" answer that decides the forget.
 *
 * DERIVED, and therefore READ-ONLY: there is no `×` here, for `../NodeRefs.tsx`'s
 * own reason — half of these entries are words in somebody else's sentence, and
 * an affordance that could not take those back would be an affordance that did
 * nothing for half the list. What removes a reference is editing the record
 * that makes it, which is one click away on every row.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import { type Reference } from "@olai/format"
import { createMemo, Show, untrack } from "solid-js"
import { only } from "@olai/web/client/narrow.ts"
import type { PageReading } from "@olai/format"

import {
  makeReferrerWays,
  ReferrersSection,
  type ReferrerRow,
} from "@olai/markdown-ui/ReferrersSection.tsx"
import { backlinksMemory } from "./memory.ts"
import { useReading } from "../reading.tsx"
import { useHere } from "olai-plugin-navigation/routing"
import { atFile, atNode } from "olai-plugin-navigation/routes"
import { hrefOf } from "../routing.ts"
import { servedDirectory } from "../vault.ts"
import { refOf, type NodeRef } from "../ref.ts"

export function Backlinks(props: {
  /** The node the page is about — canonical, since a zoom resolves a mirror's
   *  chain before it draws anything (`@olai/format`'s `zoom`). Read for the
   *  KEY below rather than for the lookup: what refers to it rides on this
   *  page's own reading, which is a reading OF that node. */
  readonly id: string
}) {
  const reading = useReading()
  const found = createMemo(() => {
    const shows = reading()?.shows
    return (shows === undefined ? undefined : only(shows, "node")?.backlinks) ?? []
  })

  return (
    // ONE `<Show>`, keyed on the node while there is anything to say about it.
    // It carries both rules at once: a node nobody refers to draws NOTHING (the
    // absence is the answer, as it is for every relation row on this page), and
    // a page reused from `/#a` to `/#b` gets a NEW element rather than the
    // reader's answer about the first node.
    <Show when={found().length > 0 ? props.id : undefined} keyed>
      {(id) => <Section id={id} found={found} reading={reading} />}
    </Show>
  )
}

/** The section, its own component so that the open state is MINTED WITH IT:
 *  a signal declared one level up would outlive the keyed block and carry
 *  one node's answer onto the next, which is the very thing the key is for. */
function Section(props: {
  readonly id: string
  readonly found: () => ReadonlyArray<Reference>
  readonly reading: () => PageReading | undefined
}) {
  const pane = useHere()()
  // The KEY is (pane, node) — the pane INDEX, which revs on the layout clock
  // when a pane is reordered or closed (the shared section's header says why
  // that is what there is): a remount of the same pane and node — a rebuild —
  // must find the same key, and the answer that was left under it.
  const key = JSON.stringify([pane, `backlinks:${props.id}`])
  const memory = backlinksMemory.read()
  // The "still shown" answer the shared section's own forget rule reads at the
  // leaving moment, untracked: the same node is still zoomed AND it still has
  // references (a rebuild in place keeps the reader's answer), or the answer
  // goes.
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
      row={rowOf}
      stillShown={stillShown}
      memoryKey={key}
      testid={TESTID.backlinks}
      summaryTestid={TESTID.backlinksSummary}
      linkTestid={TESTID.nodeRef}
      memory={memory}
    />
  )
}
/** ONE row per reference — the record as the node it is, the body as the file
 *  it is; the per-way split is the shared section's. */
const rowOf = (one: Reference): ReferrerRow => {
  if ("path" in one.source) {
    return {
      key: `doc:${one.source.path}`,
      opens: hrefOf(atFile(one.source.path)),
      calls: one.source.title,
      callsFrom: one.source.path,
      title: `open ${one.source.path}`,
      ref: one.source.path,
    }
  }
  const record = refOf(one.source)
  return {
    key: `node:${record.id}`,
    opens: hrefOf(atNode(record.id)),
    calls: record.title,
    callsFrom: record.from,
    where: record.from,
    title: `open ${record.title}`,
    ref: record.id,
  }
}