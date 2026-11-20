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
