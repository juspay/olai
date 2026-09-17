/**
 * WHAT REFERS TO THIS NODE, under a zoomed node's heading — the one place in
 * this app a reference is read backwards.
 *
 * Every reference points one way on disk: a node writes `see: ["herbs"]`, or
 * writes `@herbs` in its title or its note, and the herb bed's own record says
 * nothing about either. The forward halves are drawn (the `see` row under a
 * note, the `@` tag in a title); this is the reverse, and until it existed the
 * only way to find what talked about a node was to search for its id by hand.
 *
 * DERIVED, and therefore READ-ONLY: there is no `×` here, for `../NodeRefs.tsx`'s
 * own reason — half of these entries are words in somebody else's sentence, and
 * an affordance that could not take those back would be an affordance that did
 * nothing for half the list. What removes a reference is editing the record
 * that makes it, which is one click away on every row.
 *
 * COLLAPSED, and the collapse is the browser's — a `<details>`, the shape
 * `../document/Toc.tsx` already uses, so it works before this app's JavaScript
 * has an opinion about it and is announced without an `aria-expanded` to keep
 * in step. The default is shut because a reference is context rather than
 * content: what the node IS is its title, its note and what hangs under it, and
 * a vault where everything points at one hub node would otherwise open that
 * node with a wall of links above its own children.
 *
 * ...AND THE ROWS ARE NOT BUILT WHILE IT IS SHUT, which the `<details>` alone
 * does not give: that element renders its children whether or not it is open,
 * so on the hub node this feature is for — a curated list several hundred
 * records point at — every frame the store published was minting several
 * hundred refs and diffing several hundred anchors nobody could see. The
 * element's own `toggle` drives a signal, and the rows live behind it; the
 * SUMMARY needs only the count, which is a length.
 *
 * KEYED ON THE NODE, for the reason the contents is: `open` is an attribute the
 * browser then owns, so a page reused from `/#a` to `/#b` would carry the
 * reader's answer about the first node onto the second. A different node is a
 * different element by construction — and the signal is reset with it, since it
 * is created inside the keyed block. It is NOT keyed on the count: the section
 * staying open while a reference is added elsewhere is exactly the live update
 * this feature is for.
 *
 * A ROW PER WAY, because there are two ways to refer and they are not the
 * same claim: a `see` is an edge somebody wrote with a verb, and a mention is
 * a word in a sentence — and a LINK written in a body or a note is a third.
 * Each row is the same shape the `see` and `blocked by` rows have, and a
 * record that does several appears in several, which is what it is doing. A
 * reference whose source is a DOCUMENT (a body's prose) draws as the file
 * link it is — the shape the markdown plugin's referrers give it.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import { type Reference, printAddress } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { only } from "@olai/web/client/narrow.ts"

import { type NodeRef } from "../ref.ts"
import { NodeTitle } from "../NodeTitle.tsx"
import { NodeRefLink } from "../NodeRefs.tsx"
import { useReading } from "../reading.tsx"

import { useHere, useRouter, Link } from "olai-plugin-navigation/routing"
import { atFile, type Route } from "olai-plugin-navigation/routes"
import { panesOf } from "olai-plugin-navigation/workspace"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { rowsOf, type DocRef } from "./refs.ts"
import { REFERRINGS } from "./way.ts"

let opened = new WeakMap<Route, Map<string, boolean>>()

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
    // reader's answer about the first node. Two nested `Show`s said the same
    // thing in two places and left the second free to stop keying.
    <Show when={found().length > 0 ? props.id : undefined} keyed>
      <Section id={props.id} found={found} />
    </Show>
  )
}

/**
 * The section itself, its own component so that the open state is MINTED WITH
 * IT: a signal declared one level up would outlive the keyed block and carry
 * one node's answer onto the next, which is the very thing the key is for.
 */
function Section(props: {
  readonly id: string
  readonly found: () => ReadonlyArray<Reference>
}) {
  const router = useRouter()
  const pane = useHere()()
  const route = panesOf(router.workspace())[pane]?.route
  const key = JSON.stringify([pane, props.id])
  const saved = route === undefined ? undefined : opened.get(route)
  const initiallyOpen = saved?.get(key) ?? false
  saved?.delete(key)
  const [open, setOpen] = createSignal(initiallyOpen)
  onCleanup(() => {
    const now = panesOf(router.workspace())[pane]?.route
    if (route?.kind !== "at" || now?.kind !== "at" || props.found().length === 0) return
    if ((route.address === null ? null : printAddress(route.address))
      !== (now.address === null ? null : printAddress(now.address))) return
    const states = opened.get(now) ?? new Map<string, boolean>()
    states.set(key, open())
    opened.set(now, states)
  })
  return (
    <details
      ref={(element) => { element.open = initiallyOpen }}
      class="mt-3 border-t border-rule pt-2"
      data-testid={TESTID.backlinks}
      data-count={props.found().length}
      // The element's own state, read back rather than commanded: `<details>`
      // opens itself on a press, on a keyboard activation and on a browser's
      // find-in-page, and a component that set `open` from a signal would be
      // fighting all three.
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        class="cursor-pointer text-sm text-muted select-none"
        data-testid={TESTID.backlinksSummary}
      >
        {said(props.found().length)}
      </summary>
      <Show when={open()}>
        {/* A row per WAY, out of the one table that says what each is called
            (./way.ts) — never a label written here beside a testid picked by
            hand, which is the fragmentation ../edges/EdgeRefs.tsx exists to
            have stopped one direction over. An empty row draws nothing, which
            is `NodeRefs`' own rule rather than a guard per way. */}
        <Rows found={props.found()} />
      </Show>
    </details>
  )
}

function Rows(props: {
  readonly found: ReadonlyArray<Reference>
}) {
  const rows = createMemo(() => rowsOf(props.found))
  return (
    <For each={REFERRINGS}>
      {(referring) => (
        <Show when={rows()[referring.way].length > 0}>
          <div
            class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
            data-testid={referring.refs}
          >
            <span class="text-muted">{referring.label}</span>
            <Key each={rows()[referring.way]} by={keyOf}>
              {(row) => (
                <Show when={"id" in row()} fallback={docLink(row() as DocRef)}>
                  <NodeRefLink to={row() as NodeRef} class={REF} testid={TESTID.nodeRef}>
                    <NodeTitle title={(row() as NodeRef).title} from={(row() as NodeRef).from} links={false} />
                  </NodeRefLink>
                </Show>
              )}
            </Key>
          </div>
        </Show>
      )}
    </For>
  )
}

/** ONE LINK TO A DOCUMENT: a body's prose wrote the reference, so the row is
 *  the file it lives in — the same shape the markdown plugin's referrers draw
 *  a document arm (`../document/Referrers.tsx`). */
function docLink(row: DocRef) {
  return (
    <Link
      route={atFile(row.path)}
      class={REF}
      testid={TESTID.nodeRef}
      title={`open ${row.path}`}
    >
      <span data-ref={row.path}>{row.path}</span>
    </Link>
  )
}

const keyOf = (row: NodeRef | DocRef): string => ("id" in row ? `node:${row.id}` : `doc:${row.path}`)

const REF =
  `inline-flex ${TARGET} items-center text-accent no-underline hover:underline md:min-h-0`

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says and "Referenced by 3" beside a
 *  heading reads as a score. */
const said = (total: number): string =>
  `Referenced by ${total} ${total === 1 ? "node" : "nodes"}`

export const clearBacklinks = (): void => { opened = new WeakMap() }
