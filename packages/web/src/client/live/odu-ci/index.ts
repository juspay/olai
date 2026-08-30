/**
 * THE CI FACE, registered — the live-properties seam's second tenant.
 *
 * A `worktree` property whose checkout has an odu run in it wears a quiet chip
 * beside the path (`./CiChip.tsx`), and that chip's press opens the run matrix
 * (`./RunMatrix.tsx`). Everything either one needs is in this folder: the
 * words and their ink (`./words.ts`), the per-node colour (`./hue.ts`), and
 * the one subscription a tab holds however many chips draw (`./runs.tsx`).
 *
 * ## Why it wears the CHIP + PANE faces
 *
 * A `worktree` is a path on a row and is worth nothing until something is
 * happening in it, so its face is an ADDITION to the line that appears only
 * while there is a run — where the terminal door next door owns a row always.
 * The matrix is a grid and a chip is an inline box in a wrapping line, so what
 * the press opens hangs under the run as the seam's `Pane`.
 *
 * ## Nothing here imports odu
 *
 * Which is why this is a folder rather than a package. `@olai/kolu-ui` is a
 * package because it reaches for kolu's product tier; this reads
 * `@olai/surface`'s own `CiRun` and nothing else, so a wall around it would
 * confine nothing (`docs/architecture.md`'s `web` row). The folds that DID
 * need odu — the status table, the phase — ran server-side in
 * `@olai/odu-client` and what arrived was their answers.
 */

import { registerLive, WORKTREE_KEY } from "../seam.ts"
import { CiChip } from "./CiChip.tsx"
import { RunMatrix } from "./RunMatrix.tsx"

// Against `WORKTREE_KEY` for `TERMINAL_KEY`'s reason one folder over: the key
// is the wire's, and the server probes by the same constant.
registerLive(WORKTREE_KEY, { Chip: CiChip, Pane: RunMatrix })

export { RunsProvider } from "./runs.tsx"
