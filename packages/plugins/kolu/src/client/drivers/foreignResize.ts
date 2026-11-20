import { connectPadi } from "@kolu/padi-client/dial"
import { Effect, Stream } from "effect"

const [, , socket, id, cols, rows, seconds] = process.argv
if (socket === undefined || id === undefined) {
  throw new Error("foreignResize.ts <socket> <terminal-id> <cols> <rows> <seconds>")
}

await Effect.runPromise(
  Effect.scoped(Effect.gen(function* () {
    const connection = yield* connectPadi(socket)
    const attach = connection.client.padi.surface.terminalAttach.get
    const held = Effect.runFork(
      Stream.runForEach(
        attach({ id, resizeTo: { cols: Number(cols), rows: Number(rows) } }),
        () => Effect.void,
      ),
    )
    yield* Effect.sleep(`${Number(seconds ?? 8)} seconds`)
    void held
  })),
)
console.log(`held ${id} at ${cols}x${rows}`)
process.exit(0)
