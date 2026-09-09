import type { ChatEntry } from "./wire/members.ts"

/** Diagnostic classification only. This is the title the pinned Codex adapter
 * emits; it must never control turn lifetime or transcript delivery. No text,
 * tool arguments or output is retained or logged. Each owner keeps one cursor. */
export interface CompactionObservation {
  readonly compaction: string
  readonly row: string
  readonly phase: "started" | "completed" | "continued"
}

export const compactionTrace = (report: (event: CompactionObservation) => void) => {
  let held: { id: string; seq: number; completed: boolean; continued: boolean } | undefined
  return {
    reset: () => { held = undefined },
    row: (row: ChatEntry) => {
      if (row.kind === "tool" && row.text === "Compact conversation") {
        if (held !== undefined && row.seq < held.seq) return
        if (held?.id !== row.id) {
          held = { id: row.id, seq: row.seq, completed: false, continued: false }
          report({ compaction: row.id, row: row.id, phase: "started" })
        }
        if (row.status === "completed" && !held.completed) {
          held.completed = true
          report({ compaction: row.id, row: row.id, phase: "completed" })
        }
      } else if (held !== undefined && !held.continued && row.seq > held.seq
        && (row.kind === "agent" || row.kind === "tool")) {
        held.continued = true
        report({ compaction: held.id, row: row.id, phase: "continued" })
      }
    },
  }
}
