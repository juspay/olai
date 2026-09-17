/**
 * WHAT REFERS TO THIS NODE, under a zoomed node's heading — the one place in
 * this app a reference is read backwards.
 *
 * The section itself is the shared one (`@olai/markdown-ui`'s
 * `ReferrersSection`), which both this page and a document's page draw — the
 * same wire shape, the same collapse, the same rows, and the same open-state
 * memory (`. /memory.ts`, minted by this plugin's activation).
 *
 * What is left HERE is what only this page knows:
 *
 *   - WHICH references to draw, off the node page's own reading —
 *     `@olai/format`'s `referencesOf`, answered by the server as
 *     `shows.node.backlinks` (one entry per source, with the ways it refers);
 *   - the ROWS, shaped per way — a record opens its node page, a body opens
 *     its file, and the two are different routes this plugin knows how to
 *     spell (`olai-plugin-navigation`);
 *   - THIS PLUGIN'S OWN TABLE of ways (`../contracts/referrings.ts`), which
 *     pairs each way with its label ("sees this") and its testid;
 *   - the KEY this section remembers its open state under — (pane, node) —
 *     and the MEMORY itself, read from this plugin's activation
 *     (`. /memory.ts`) rather than threaded: the node page draws one of these
 *     where the plugin's scope owns the answer.
 *
 * DERIVED, and therefore READ-ONLY: there is no `×` here, for `../NodeRefs.tsx`'s
 * own reason — half of these entries are words in somebody else's sentence, and
 * an affordance that could not take those back would be an affordance that did
 * nothing for half the list. What removes a reference is editing the record
 * that makes it, which is one click away on every row.
 *
 * KEYED ON THE NODE, for the reason the shared section's own header gives: the
 * open state is an attribute the browser then owns, so a page reused from
 * `/#a` to `/#b` would carry the reader's answer about the first node onto the
 * second. A different node is a different element by construction — and the
 * signal is reset with it, since it is created inside the keyed block. It is
 * NOT keyed on the count: the section staying open while a reference is added
 * elsewhere is exactly the live update this feature is for.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import { type Reference } from "@olai/format"
import { createMemo, onCleanup, Show, untrack } from "solid-js"
import { only } from "@olai/web/client/narrow.ts"
import type { PageReading } from "@olai/format"

import { ReferrersSection, type ReferrerRow } from "@olai/markdown-ui/ReferrersSection.tsx"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"
import { useReading } from "../reading.tsx"
import { useHere } from "olai-plugin-navigation/routing"
import { atFile, atNode } from "olai-plugin-navigation/routes"
import { hrefOf } from "../routing.ts"
import { servedDirectory } from "../vault.ts"
import { rowsOf, type DocRef } from "./refs.ts"
import { REFERRINGS } from "./way.ts"
import { backlinksMemory } from "./memory.ts"
import type { NodeRef } from "../ref.ts"

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
  // The KEY is (pane, node), not the route object: a remount of the same pane
  // and node — a rebuild, a frame that redraws the block — must find the same
  // key, and the answer that was left under it. Unlike the old WeakMap keyed
  // by the route, this survives a route object being replaced while the same
  // node stays on screen.
  const key = JSON.stringify([pane, `backlinks:${props.id}`])
  const memory = backlinksMemory()
  // WHAT LEAVING THE SECTION MEANS, decided at the moment it leaves. The
  // shared component already REMEMBERS on every toggle, so the only question
  // here is when to FORGET:
  //   - the same node is still zoomed AND it still has references — the
  //     section is being rebuilt in place, and its remembered answer is
  //     still the reader's; keep it;
  //   - anything else — the last reference went (a returning visit starts
  //     collapsed, the answer the reader was never asked again), or the
  //     reader navigated away (a new visit). Both forget.
  // Read UNTRACKED, because this is the leaving moment, not a subscription:
  // a cleanup that re-rendered the pane on every frame would be the section
  // keeping itself alive by what it was closing.
  onCleanup(() => {
    if (memory === undefined) return
    const shows = untrack(props.reading)?.shows
    const page = shows === undefined ? undefined : only(shows, "node")
    const zoomed = page?.zoomed
    if (zoomed === undefined || zoomed.kind !== "node" || zoomed.shows.node.id !== props.id || props.found().length === 0) {
      memory.forget(key)
    }
  })
  return (
    <ReferrersSection
      found={props.found()}
      claims={servedDirectory()?.claims()}
      ways={REFERRINGS}
      rows={(way) => rowsOf(props.found())[way].map(toShared)}
      memoryKey={key}
      testid={TESTID.backlinks}
      summaryTestid={TESTID.backlinksSummary}
      linkTestid={TESTID.nodeRef}
      summary={said}
      memory={memory ?? EMPTY_MEMORY}
    />
  )
}

/** One drawn row: what identifies it, where it opens, what it is called
 *  there, and — for a record — the outline it was written in. */
const toShared = (row: NodeRef | DocRef): ReferrerRow =>
  "id" in row
    ? {
      key: `node:${row.id}`,
      opens: hrefOf(atNode(row.id)),
      calls: row.title,
      callsFrom: row.from,
      where: row.from,
      title: `open ${row.title}`,
      ref: row.id,
    }
    : {
      key: `doc:${row.path}`,
      opens: hrefOf(atFile(row.path)),
      calls: row.title,
      callsFrom: row.path,
      title: `open ${row.path}`,
      ref: row.path,
    }

/** Before the activation installs its memory (this plugin's scope starting to
 *  draw before `apply` finishes), the section draws collapsed and remembers
 *  nothing — a no-op memory, which is the honest reading of "not mounted
 *  yet". */
const EMPTY_MEMORY: ReferrerMemory = {
  opened: undefined,
  remember: () => {},
  forget: () => {},
}

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says and "Referenced by 3" beside a
 *  heading reads as a score. */
const said = (total: number): string =>
  `Referenced by ${total} ${total === 1 ? "thing" : "things"}`