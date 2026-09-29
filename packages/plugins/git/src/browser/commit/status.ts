/**
 * THE COMMIT READOUT'S STATUS, read for the bar's health dot.
 *
 * The readout itself (`./Commit.tsx`) is drawn only while the health popover
 * is open, but the dot's colour has to be true while it is shut. So this is a
 * second READER of the same two cells the readout reads (`pending` and `git`) —
 * the sibling client shares one subscription per cell, so it is not a second
 * subscription — folded through the same pure words (`./said.ts`), so the dot
 * and the row cannot disagree.
 *
 * Call it inside a Solid owner this plugin's activation holds (`../../browser.tsx`
 * makes one and disposes it with the activation), after the wire is held.
 */
import { GIT_OFF, NOTHING_PENDING } from "@olai/format"
import type { BarStatus } from "olai-plugin-layout/slots"

import { gitWire } from "../wire.ts"
import { faceOf, gitStatusOf } from "./said.ts"

export const createGitStatus = (): (() => BarStatus) => {
  const pending = gitWire().cells.pending.use()
  const git = gitWire().cells.git.use()
  return () => gitStatusOf(
    faceOf(pending.value() ?? NOTHING_PENDING, pending.value() !== undefined, git.value() ?? GIT_OFF),
    pending.value() ?? NOTHING_PENDING,
    git.value() ?? GIT_OFF,
  )
}
