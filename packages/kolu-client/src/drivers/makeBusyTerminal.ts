/**
 * A BUSY TERMINAL, on a padi of our own — the far end of the recovery clip.
 *
 * `bun makeBusyTerminal.ts <socket> <intent>` creates a terminal and starts
 * something that keeps printing, so the recording has a stream to show rather
 * than a still screen. A one-off driver; never pointed at a production padi.
 */
import { connectPadi } from "@kolu/padi-client/dial"
import { Effect } from "effect"

const [, , socket, intent] = process.argv
if (socket === undefined) throw new Error("makeBusyTerminal.ts <socket> [intent]")

const id = await Effect.runPromise(
  Effect.scoped(Effect.gen(function* () {
    const c = yield* connectPadi(socket)
    const padi = c.client.padi.surface
    const made = yield* padi.lifecycle.create({
      placement: { kind: "toplevel" },
      intent: intent ?? "the recovery clip",
    })
    const terminal = (made as { id: string }).id
    // Something that keeps the screen moving and WRAPS — a resize is only
    // visible in output that has to re-flow.
    yield* padi.lifecycle.sendInput({
      id: terminal,
      data:
        "while true; do date '+%T'; seq 1 12 | tr '\\n' ' '; echo ' — the quick brown fox jumps over the lazy dog, again and again, so this line is wider than a narrow pane'; sleep 1; done\n",
    })
    return terminal
  })),
)
console.log(id)
process.exit(0)
