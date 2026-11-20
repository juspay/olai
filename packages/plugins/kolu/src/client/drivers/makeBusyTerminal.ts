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
