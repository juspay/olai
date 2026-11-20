export * from "./kolu.ts"
export { type Resolved, resolveTerminal, whoOf } from "./terminals.ts"


import { Schema } from "effect"
import {
  FleetTerminal,
  KOLU_UNDIALED,
  KOLU_UNPULSED,
  KoluEvent,
  KoluLink,
  sameKolu,
  Snapshot,
  SnapshotRefused,
  SnapshotRequest,
  TerminalAttach,
  TerminalFrame,
  WatchPulse,
} from "./kolu.ts"

export const koluMembers = {
  cells: {
    link: {
      schema: KoluLink,
      default: KOLU_UNDIALED,
      verbs: ["get"],
      equals: sameKolu,
    },
    pulse: {
      schema: Schema.NullOr(WatchPulse),
      default: KOLU_UNPULSED,
      verbs: ["get"],
    },
  },
  collections: {
    fleet: {
      keySchema: Schema.String,
      schema: FleetTerminal,
      verbs: ["keys", "get", "deltas"],
    },
    events: {
      keySchema: Schema.String,
      schema: KoluEvent,
      verbs: ["keys", "get", "deltas"],
    },
  },
  streams: {
    terminal: {
      inputSchema: TerminalAttach,
      outputSchema: TerminalFrame,
    },
  },
  procedures: {
    screen: {
      text: {
        input: SnapshotRequest,
        output: Snapshot,
        error: SnapshotRefused,
      },
    },
  },
} as const
