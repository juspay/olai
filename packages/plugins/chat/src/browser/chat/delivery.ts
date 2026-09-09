import { untrack } from "solid-js"
import { compactionTrace, type CompactionObservation } from "../../compaction.ts"
import type { ChatObservation, ViewportObservation } from "../../observation.ts"
import type { ChatEntry } from "../../wire/members.ts"
import { diagnostic } from "./diagnostics.ts"

/** One mounted panel's observations. The caller supplies the live context and
 * owns transport execution through its held plugin client. Neither receipt
 * formatting nor compaction classification needs to know that client or folds. */
export const deliveryDiagnostics = (
  context: () => Pick<ChatObservation, "session" | "visibility">,
  send: (input: ChatObservation) => Promise<boolean>,
) => {
  // Correlation only; works on plain HTTP where randomUUID is unavailable.
  const view = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const report = diagnostic((event: Omit<ChatObservation, "view" | "session" | "visibility">) => untrack(() => {
    const input = { ...event, view, ...context() }
    console.info("chat compaction delivery", input)
    // The send itself can throw synchronously when the plugin is withdrawn.
    void send(input).then(diagnostic((accepted) => {
      if (!accepted) console.warn("chat compaction receipt refused", input)
    })).catch(diagnostic((cause) => {
      console.warn("chat compaction receipt failed", { view, stage: input.stage, phase: input.phase, cause: String(cause) })
    }))
  }))
  let source: "snapshot" | "delta" = "snapshot"
  const applied = compactionTrace(event => report({ ...event, stage: "applied", source }))
  return {
    applied: (entries: ReadonlyArray<readonly [string, ChatEntry]>, snapshot: boolean) => {
      source = snapshot ? "snapshot" : "delta"
      if (snapshot) applied.reset()
      const ordered = snapshot ? [...entries].sort((a, b) => a[1].seq - b[1].seq) : entries
      for (const [, row] of ordered) applied.row(row)
    },
    rendered: (event: CompactionObservation & ViewportObservation) =>
      report({ ...event, stage: "rendered", source: "dom" }),
    failed: (stage: "transcript" | "saying" | "order" | "tail", phase: "fold_failed" | "stream_failed") =>
      () => report({ stage, phase, source: "stream", compaction: null, row: null }),
  }
}
