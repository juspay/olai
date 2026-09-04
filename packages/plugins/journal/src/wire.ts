import { defineSurface } from "@kolu/surface/define"
import {
  DatedAnswer,
  DatedRequest,
  OpFailure,
  Owed,
  OwedRequest,
  PageReading,
} from "@olai/format"
import { Schema } from "effect"

export const name = "journal"

export const DayRequest = Schema.Struct({ date: Schema.String })
export type DayRequest = typeof DayRequest.Type

/** The deliberately narrow answer to minting a note. Journal needs the path
 * it derived and nothing from core's general edit protocol. */
export const MintedNote = Schema.Struct({ file: Schema.String })
export type MintedNote = typeof MintedNote.Type

export const surface = defineSurface({
  streams: {
    dated: { inputSchema: DatedRequest, outputSchema: DatedAnswer },
    owed: { inputSchema: OwedRequest, outputSchema: Owed },
    day: { inputSchema: DayRequest, outputSchema: PageReading, arrayKey: "key" },
    agenda: { inputSchema: OwedRequest, outputSchema: PageReading, arrayKey: "key" },
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

export const faces = {
  browser: {
    dated: "resource",
    owed: "resource",
    day: "resource",
    agenda: "resource",
    "note.mint": "tool",
  },
} as const
