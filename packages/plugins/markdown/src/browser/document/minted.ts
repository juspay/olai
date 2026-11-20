import type { Edit } from "@olai/surface"
import { Result } from "effect"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Router } from "olai-plugin-navigation/routing"
import { applied } from "../writes.ts"
import { atFile } from "olai-plugin-navigation/routes"
import { mintEditing } from "./documents.tsx"

export const mintAndOpen = async (
  edit: Extract<Edit, { verb: "docNew" }>,
  record: Undo["record"],
  router: Router,
): Promise<string | null> => {
  const started = router.workspace()
  const outcome = await applied(edit, record)
  if (Result.isFailure(outcome)) return outcome.failure.message
  if (router.workspace() !== started) return null
  openCreated(outcome.success.id, router)
  return null
}

export const openCreated = (file: string, router: Router): void => {
  mintEditing(file)
  router.go(atFile(file))
}
