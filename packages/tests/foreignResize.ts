/**
 * A SECOND VIEWER, for the video's sake — attach to a terminal at a different
 * size and hold it, which is exactly what another kolu window does.
 *
 * `bun foreignResize.ts <socket> <terminal-id> <cols> <rows> <seconds>`
 *
 * A one-off driver, not part of any suite. It exists so the resize-recovery
 * clip is driven by the REAL mechanism — last-attach-wins on a shared pty —
 * rather than by a fixture pretending to be one.
 */
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
