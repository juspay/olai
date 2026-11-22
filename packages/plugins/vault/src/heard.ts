/**
 * WHAT A DECODE TELLS WHOEVER RUNS THE SERVER, as log lines (`@olai/ops`'s
 * `Heard`):
 *
 *   - a text the Markdown parser threw on — a bug (`@olai/prose`'s
 *     `parse.ts`); the page tells its reader, this tells someone who can fix
 *     it;
 *   - a file whose decode was slow — decode is synchronous, and a text nested
 *     hundreds deep stalls the server while it is read; this names the file.
 *
 * Said through an emitter taken in the plugin's `apply`, so each line carries
 * that fiber's level and annotations although decode is not an Effect.
 */
import { type Heard, SLOW_DECODE_MS } from "@olai/ops"
import { type Emit, prettyCause } from "@olai/log"
import { Effect } from "effect"

export const heardBy = (say: Emit): Heard => ({
  unread: (path, unread) =>
    say(Effect.annotateLogs(
      Effect.logError(unread.refusal.kind === "depth"
        ? "the prose parser ran out of stack reading a text; it is drawn as plain words"
        : "the prose parser failed on a text; it is drawn as plain words"),
      { file: path, text: unread.where, ...(unread.refusal.kind === "failed" ? { cause: prettyCause(unread.refusal.cause) } : {}) },
    )),
  slow: (path, ms) =>
    say(Effect.annotateLogs(
      Effect.logWarning("a file was slow to read; the server answered nobody while it was read"),
      { file: path, ms: Math.round(ms) },
    )),
  slowAfter: SLOW_DECODE_MS,
})
