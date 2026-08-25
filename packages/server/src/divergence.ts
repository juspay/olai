/**
 * WHERE THE VALIDATOR SHADOW SHOUTS — the file an orchestrator reads, and the
 * log line a person sees.
 *
 * `@olai/format` runs the incremental validator beside the full one on every
 * write and compares the two ({@link ../../format/src/shadow.ts}, which owns
 * WHY and says when the flip may happen). It cannot write the entry itself and
 * it should not be able to: it is the bottom of the layering, it is bundled
 * into a browser, and it has no logger and no disk. What it has is a WITNESS,
 * and this is the one this process installs.
 *
 * ## The path
 *
 *     $XDG_STATE_HOME/olai/validate-shadow.ndjson
 *     (~/.local/state/olai/validate-shadow.ndjson by default)
 *
 * ONE FILE PER USER rather than one per served directory, and the entries carry
 * the vault they are about ({@link Entry.cwd}). The reader is a script that
 * runs at nine in the morning and asks one question — "did anything diverge
 * last night?" — and a file per directory named by a digest makes that question
 * a directory walk with a decode in it. `@olai/state` owns the home and the
 * rule that nothing olai keeps for itself goes in the vault; this is a
 * different SHAPE of record from the ones it has verbs for (an append-only log,
 * not one JSON object read back whole), so it names the home and writes its own
 * line.
 *
 * One object per line, appended, one line per divergence. An empty or absent
 * file is the answer the flip is gated on.
 *
 * `.ndjson` AND NOT THE OTHER SPELLING of the same thing, which is a rule this
 * repository sweeps for rather than a preference: the extension olai's own
 * outlines used to carry is a RECORD OF THE PAST, and
 * `packages/tests/extension.test.ts` fails on any file that still writes it —
 * so that somebody who meets one on disk knows it is a vault nobody has
 * renamed, and never something olai wrote yesterday.
 *
 * ## What it must not do
 *
 * Fail a write. The witness is called from inside `validate`, which is called
 * from inside the write gate, so everything here is best-effort and synchronous
 * failures are swallowed after being said out loud once. A log that cannot be
 * written is a log line on stderr and a server that goes on serving — the
 * divergence has already reached the logger by then, which is the half that
 * matters.
 *
 * APPENDED SYNCHRONOUSLY, which is the one place this file spends something. A
 * divergence is supposed to be impossible; if they become common enough for an
 * `appendFileSync` per write to matter, the flip is off anyway and the shadow
 * comes out.
 */

import { type Emit, emitter } from "@olai/log"
import { canonical, stateHome } from "@olai/state"
import type { Divergence, Witness } from "@olai/format"
import { DIVERGENCE_LOG, witnessing } from "@olai/format"
import { Effect, type Scope } from "effect"
import * as fs from "node:fs"
import { dirname, join } from "node:path"

/** One line of the log: what diverged, and which directory it was about. */
export interface Entry extends Divergence {
  /** The served directory, canonically — the same spelling `@olai/state` keys
   *  everything else about a vault by. */
  readonly cwd: string
}

/** The one path, named once. Read at call time rather than at import, so a test
 *  can point `XDG_STATE_HOME` somewhere of its own — which is exactly what the
 *  e2e harness does per worker. */
export const divergenceLog = (): string => join(stateHome(), DIVERGENCE_LOG)

/**
 * Install this process's witness, for the life of the enclosing scope.
 *
 * It is a SCOPED effect and takes itself off on the way out, because the
 * witness is a module-level slot in `@olai/format` and two serves in one
 * process — which is what the test harness does — would otherwise leave the
 * first one's writer installed under the second one's.
 *
 * The emitter is taken here, inside a fiber, so the line this writes carries
 * the level the operator asked for and the annotations this serve set
 * (`@olai/log`'s `emit.ts` argues why a `runFork` would not).
 */
export const watchValidator = (root: string): Effect.Effect<void, never, Scope.Scope> =>
  Effect.flatMap(emitter, (say) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        witnessing(witnessOf(canonical(root), say))
      }),
      () => Effect.sync(() => witnessing(null)),
    ))

/**
 * The witness itself, as a value — what {@link watchValidator} installs.
 *
 * Its own function so that `./divergence.test.ts` can hold it to the two things
 * this layer promises (where the entry lands, and that a disk which will not
 * take it does not take the write with it) without having to make the
 * incremental validator wrong on purpose. There is one witness slot in
 * `@olai/format` and installing a recorder would replace the thing under test.
 */
export const witnessOf = (cwd: string, say: Emit): Witness => (seen) => {
  const found = seen.divergence
  if (found === undefined) return
  say(
    Effect.logError("olai: the incremental validator diverged from the full one", {
      why: found.why,
      touched: found.touched.join(", "),
      missing: found.missing,
      invented: found.invented,
      log: divergenceLog(),
    }),
  )
  append({ ...found, cwd }, say)
}

const append = (entry: Entry, say: Emit): void => {
  const at = divergenceLog()
  try {
    fs.mkdirSync(dirname(at), { recursive: true, mode: 0o700 })
    fs.appendFileSync(at, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
  } catch (cause) {
    // Said once and then let go. The divergence itself is already in the log
    // above; what is lost is the machine-readable copy, and a write refused
    // because a state directory moved is not a reason to refuse somebody's
    // edit.
    say(
      Effect.logError("olai: the validator divergence log could not be written", {
        at,
        said: String(cause),
      }),
    )
  }
}
