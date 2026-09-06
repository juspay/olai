/** A write follows the capability that currently owns its discriminator.
 * History can contain inverses from several providers, so a surviving editor
 * must not send every inverse through its own sibling. Registration is scoped
 * by each provider; this module declares no default writers or plugin names. */
import { Effect } from "effect"
import { NotFoundFailure } from "@olai/format"
import type { Applied, Edit } from "@olai/surface"
// A provider's call can fail at the transport as well as with its declared
// operation refusal. Preserve both for the caller's existing execution edge.
export type EditWriter = (edit: Edit) => Effect.Effect<Applied, unknown>
const writers = new Map<Edit["verb"], EditWriter>()
export function registerWriter(verbs: ReadonlyArray<Edit["verb"]>, write: EditWriter): () => void {
  for (const verb of verbs) if (writers.has(verb)) throw new Error(`edit writer already registered: ${verb}`)
  for (const verb of verbs) writers.set(verb, write)
  return () => { for (const verb of verbs) if (writers.get(verb) === write) writers.delete(verb) }
}
export const writeEdit: EditWriter = edit => Effect.suspend(() => {
  const write = writers.get(edit.verb)
  return write === undefined
    ? Effect.fail(new NotFoundFailure({ reason: `the capability for ${edit.verb} is not active` }))
    : write(edit)
})
