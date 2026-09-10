/**
 * ONE NAMESPACE GRAMMAR, TWO INDEPENDENT HOSTS.
 *
 * A plugin owns a prefix, not an arbitrary string key. The composition root
 * supplies its owner name; the plugin supplies only the local word. Rejecting
 * dots and path separators in either segment prevents a local word from naming
 * somebody else's service or replacing a core key.
 *
 * That rule belongs to neither process. A server declaration and a browser
 * publication must compose the same spelling, even though resolving that key
 * in one host grants no access to the other host. Two validators would let
 * discovery advertise a word the browser could never publish.
 *
 * Key construction is separate from publication: a declaration needs the
 * checked name but has no service implementation. The small adapter below
 * adds a typed tag and provision only for callers that actually publish one.
 * Lifecycle, conflict handling and discovery stay with their respective doors.
 */
import { type Provision, type ServiceKey, serviceTag } from "@olai/effect-cordis"
import { Effect, type Scope } from "effect"

export interface OwnServices {
  /** Publish `<this plugin>.<word>` until this provider's scope closes.
   * Consumers declare serviceTag<Shape>("provider.word") in needs. */
  readonly own: <Shape>(word: string, door: Provision<Shape>) => Effect.Effect<void, never, Scope.Scope>
}

export const ownService = (
  plugin: string,
  stand: <Shape>(key: ServiceKey<Shape>, door: Provision<Shape>) => Effect.Effect<void, never, Scope.Scope>,
): OwnServices["own"] => (word, door) =>
  Effect.flatMap(ownedKey(plugin, word), (key) => stand(serviceTag(key), door))

export const ownedKey = (plugin: string, word: string): Effect.Effect<string> => Effect.suspend(() => {
  if (![plugin, word].every((part) => /^[a-z][a-z0-9-]*$/.test(part))) {
    return Effect.die(new Error(
      `plugins: "${plugin}" cannot offer local service word "${word}"; `
        + "each segment must start with a lowercase letter and contain only lowercase letters, digits or hyphens.",
    ))
  }
  return Effect.succeed(`${plugin}.${word}`)
})
