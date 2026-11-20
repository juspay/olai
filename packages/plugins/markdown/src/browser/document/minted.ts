import type { Edit } from "@olai/surface"
import type { OpFailure } from "@olai/format"
import { Result } from "effect"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Router } from "olai-plugin-navigation/routing"
import { applied } from "../writes.ts"
import { atFile } from "olai-plugin-navigation/routes"

/** A plain variable, deliberately not a signal: nothing reacts to it — it is
 * read exactly once, at mount, by the page it names — and a reactive value
 * here would imply a subscriber that must not exist. */
let minted: string | null = null

const mintedDocument = (file: string): void => {
  minted = file
}

export const consumeMinted = (file: string): boolean => {
  const was = minted === file
  minted = null
  return was
}

/**
 * The note above has to be set before the navigation, or the page mounts,
 * finds nothing minted, and opens reading.
 */
export const mintAndOpen = async (
  edit: Extract<Edit, { verb: "docNew" }>,
  record: Undo["record"],
  router: Router,
): Promise<string | null> => {
  const started = router.workspace()
  const outcome = await applied(edit, record)
  if (Result.isFailure(outcome)) return outcome.failure.message
  if (router.workspace() !== started) return null
  const file = outcome.success.id
  mintedDocument(file)
  router.go(atFile(file))
  return null
}

export const openMintedFile = async (
  asked: Promise<Result.Result<{ readonly file: string }, OpFailure>>,
  router: Router,
): Promise<string | null> => {
  const started = router.workspace()
  const outcome = await asked
  if (Result.isFailure(outcome)) return outcome.failure.message
  if (router.workspace() !== started) return null
  mintedDocument(outcome.success.file)
  router.go(atFile(outcome.success.file))
  return null
}

export const openCreated = (file: string, router: Router): void => { mintedDocument(file); router.go(atFile(file)) }
export const clearMinted = (): void => { minted = null }
