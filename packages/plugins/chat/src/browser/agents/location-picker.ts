/**
 * THE PICKER'S VOLATILE DECISIONS — what to ask the server for a shortlist,
 * how the shortlist is shaped, and what a keystroke or a row means. The face
 * (`../agents/NewChatPage.tsx`) draws it and owns the DOM; nothing here knows
 * about elements, so the policy can change without touching the drawing.
 */
import { createEffect, createMemo, createSignal, type Accessor } from "solid-js"
import { listKey } from "@olai/web/client/keys.ts"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import { createSearch } from "../search.ts"
import { createLocationQuery, recentLocationIds } from "./location-query.ts"
import { locationRows } from "./location-rows.ts"
import type { Row } from "./roster.ts"
import type { ChatLocation } from "./new-chat.ts"

export const createLocationPicker = (input: {
  readonly rows: Accessor<readonly Row[]>
  readonly here: Accessor<string | null>
  readonly draft: Accessor<string>
  readonly hasAgent: (node: string) => boolean
  readonly choose: (value: ChatLocation) => void
}) => {
  const [filter, setFilter] = createSignal("")
  const suggestions = createSearch(() => input.draft().trim() || null, "node")
  const recent = recentLocationIds(input.rows)
  const { nodes, defaultParent, failure, fail, ready } = createLocationQuery(() => {
    const here = input.here()
    const recentIds = recent()
    return {
      filter: filter(), limit: 20,
      ids: [...(here === null ? [] : [here]), ...suggestions.hits().slice(0, 5).map(hit => hit.id), ...recentIds],
      parents: recentIds,
    }
  }, query => runAsync(chatWire().procedures.conversation.locations(query)))
  const rows = createMemo(() => locationRows({
    nodes: nodes(), here: input.here(), filter: filter(), defaultParent: defaultParent(),
    // Late search answers must not suggest destinations for replaced words.
    suggested: suggestions.answering() === input.draft().trim() ? suggestions.hits().map(hit => hit.id) : [],
    recent: recent(),
  }))
  const cursor = createCursor(() => rows().length)
  createEffect(() => { filter(); cursor.top() })
  const take = (index: number, on = false) => {
    const row = rows()[index]
    if (row === undefined) return
    if (row.node === undefined) input.choose({ kind: "default" })
    else if (on && input.hasAgent(row.node.id)) fail("This node already has an agent. Press Enter to start under it.")
    else input.choose({ kind: on ? "on" : "under", node: row.node })
  }
  /** Typing asks a new question, so a refusal about the last one is retired. */
  const typed = (value: string) => { setFilter(value); fail(undefined) }
  /** What one keystroke means while this list is up; `false` leaves it to the
   *  page, which is what the chords a list does not claim depend on. */
  const press = (event: KeyboardEvent): boolean => {
    const action = event.key === "Enter" && event.altKey ? "take" : listKey(event)
    if (action === null || action === "dismiss") return false
    if (action === "next") cursor.step(1)
    if (action === "prev") cursor.step(-1)
    if (action === "take") take(cursor.at(), event.altKey)
    return true
  }
  return { filter, typed, failure, ready, rows, selected: cursor.at, take, press, hasAgent: input.hasAgent }
}
