/**
 * The ways IN to the drawing: where each goes, and what each is called.
 *
 * There are three surfaces a door is drawn on — a row's `•••`
 * (`outline.row.action`), under a zoomed node's property run
 * (`outline.row.door`), and at the foot of the directory column
 * (`sidebar.vault`) — and two of them open the same page. What a door is
 * CALLED is a fact about where it goes, so one file says the words and the
 * routes, and the three surfaces spell neither again.
 */
import type { NodeId } from "@olai/format"

import { graphAround, wholeGraph } from "./routes.ts"

/** What the door onto ONE vertex's neighbourhood is called, on either
 *  surface that offers it. */
export const REFERENCE_GRAPH = "Reference graph"

/** ...and what the door onto the whole of it is called, where the directory
 *  is listed — one word, because the column's entries are one word each. */
export const WHOLE_GRAPH = "Graph"

/** The whole reading, at the default horizon. */
export const wholeGraphRoute = wholeGraph

/** One NODE's neighbourhood — a row verb hands the id as plain text (any
 *  non-empty text is an id, `address.ts`'s `NodeId` says so), so the cast
 *  happens here at the door rather than once per surface. */
export const graphAroundNode = (id: string): ReturnType<typeof graphAround> =>
  graphAround({ kind: "node", id: id as NodeId })
