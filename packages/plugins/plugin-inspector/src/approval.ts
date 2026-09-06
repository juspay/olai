/** The inspector survives a missing definition provider. Resolve that optional
 * capability when the call executes, and clear pending UI on every exit. */
import { NotFoundFailure } from "@olai/format"
import { runAsync } from "@olai/web/client/run.ts"
import { Effect, Result } from "effect"
import { maybeClient } from "olai-plugin-vault-plugins/client"

export async function approveDefinition(
  request: { readonly name: string; readonly version: string; readonly forever: boolean },
  pending: (name: string | null) => void,
  refused: (message: string | null) => void,
): Promise<void> {
  pending(request.name)
  refused(null)
  try {
    const result = await runAsync(Effect.suspend(() => {
      const client = maybeClient()
      return client === undefined
        ? Effect.fail(new NotFoundFailure({ reason: "the vault plugin approval capability is not active" }))
        : client.procedures.plugins.approve(request)
    }))
    if (Result.isFailure(result)) refused(result.failure.message)
  } finally {
    pending(null)
  }
}
