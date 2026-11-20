/**
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
