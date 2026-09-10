import { defineSurface } from "@kolu/surface/define"
import {
  DatedAnswer,
  DatedRequest,
  OpFailure,
  Owed,
  OwedRequest,
  PageRequest,
  PageReading,
} from "@olai/format"
import { Schema } from "effect"

export const name = "journal"

export const DayRequest = Schema.Struct({ date: Schema.String })
export type DayRequest = typeof DayRequest.Type

export type DayPageRequest = Extract<PageRequest, { readonly kind: "day" }>
export const DayPageRequest = PageRequest.check(
  Schema.makeFilter(
    (request: PageRequest) => request.kind === "day",
    { expected: "a journal day page request" },
  ),
) as typeof PageRequest & { readonly Type: DayPageRequest }

export type AgendaPageRequest = Extract<PageRequest, { readonly kind: "agenda" }>
export const AgendaPageRequest = PageRequest.check(
  Schema.makeFilter(
    (request: PageRequest) => request.kind === "agenda",
    { expected: "a journal agenda page request" },
  ),
) as typeof PageRequest & { readonly Type: AgendaPageRequest }

/** The deliberately narrow answer to minting a note. Journal needs the path
 * it derived and nothing from core's general edit protocol. */
export const MintedNote = Schema.Struct({ file: Schema.String })
export type MintedNote = typeof MintedNote.Type

export const surface = defineSurface({
  streams: {
    dated: { inputSchema: DatedRequest, outputSchema: DatedAnswer },
    owed: { inputSchema: OwedRequest, outputSchema: Owed },
    day: { inputSchema: DayPageRequest, outputSchema: PageReading, arrayKey: "key" },
    agenda: { inputSchema: AgendaPageRequest, outputSchema: PageReading, arrayKey: "key" },
  },
  procedures: {
    note: {
      mint: {
        input: DayRequest,
        output: MintedNote,
        error: OpFailure,
      },
    },
  },
})

/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec.
 *
 * THE BROWSER'S, ALL FIVE, and there is no `agent` map at all: `exposeFaces`
 * denies a sibling that writes no map under a face key in full, which is the
 * default-deny this row wants (`@olai/surface/host`'s `hostFaces` argues the
 * grammar).
 *
 * {@link dated} and {@link owed} are the two streams the sidebar grew for
 * `vault-in-browser`'s PR 4 — a month of dots, and a count of what is late —
 * and they are the clearest case of the render/request split in this tree. A
 * month of dots is a paint instruction for a grid somebody is looking at, and
 * two integers about the reader's own today are a badge. An agent asking what
 * is late asks `search_nodes` with a date clause and is answered with the
 * NODES, which is the thing it can act on and the thing neither of these
 * carries.
 *
 * They also take an INPUT, which the `surface://` resource vocabulary has no
 * place to put: an agent could not name a month if it wanted one. {@link day}
 * and {@link agenda} are page readings and are the browser's for the reason
 * every page reading is.
 */
export const faces = {
  browser: {
    dated: "resource",
    owed: "resource",
    day: "resource",
    agenda: "resource",
    "note.mint": "tool",
  },
} as const
