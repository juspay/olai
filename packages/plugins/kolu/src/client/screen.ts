import { type Snapshot, SnapshotRefused } from "./wire/index.ts"
import { tailLines } from "@kolu/padi-client/screenTail"

export { tailLines }
import { Effect } from "effect"

export const DEFAULT_LINES = 120

export type TailOnlyScreenReader =
  | null
  | ((input: { id: string }) => Effect.Effect<string, unknown>)

export const screenText = (
  read: TailOnlyScreenReader,
  terminal: string,
  lines: number | undefined,
  now: () => string,
): Effect.Effect<Snapshot, SnapshotRefused> => {
  if (read === null) {
    return Effect.fail(
      new SnapshotRefused({
        reason: "no-padi",
        says: "olai is not connected to a padi, so there is no screen to read.",
      }),
    )
  }
  return read({ id: terminal }).pipe(
    Effect.map((text): Snapshot => ({
      text: tailLines(text, lines ?? DEFAULT_LINES),
      at: now(),
    })),
    Effect.catchCause(() =>
      Effect.fail(
        new SnapshotRefused({
          reason: "no-terminal",
          says: "padi has no live screen for this terminal — it has been closed, or it is asleep.",
        }),
      )
    ),
  )
}
