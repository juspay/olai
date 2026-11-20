import type { Location, LocationOwner } from "@olai/plugin-api/contracts"
import type { PluginHeading, Section } from "olai-plugin-preferences/contract"
import type { JSX } from "solid-js"
import { Effect, Exit, Scope } from "effect"

export interface HeadingOf {
  readonly heading: (plugin: string) => PluginHeading
  readonly body: (plugin: string) => () => JSX.Element
}

export interface HeldHeadings {
  readonly reconcile: (wanted: ReadonlyArray<string>, of: HeadingOf) => Effect.Effect<void>
  readonly close: Effect.Effect<void>
}

type Owner = Pick<LocationOwner, "contribute">

export const heldHeadings = (slots: Owner, sections: Location<Section>): HeldHeadings => {
  const held = new Map<string, Scope.Closeable>()
  /** A claim that failed may not keep its scope (nothing would ever close it) and
   *  may not enter `held` (the plugin would never be retried). */
  const claim = (plugin: string, of: HeadingOf): Effect.Effect<void> => Effect.gen(function*() {
    const scope = yield* Scope.make()
    const claimed = yield* Scope.provide(
      slots.contribute(sections, {
        heading: of.heading(plugin),
        order: 0,
        scope: "shared",
        body: of.body(plugin),
      }, { key: plugin }),
      scope,
    ).pipe(Effect.exit)
    if (Exit.isFailure(claimed)) {
      yield* Scope.close(scope, claimed)
      yield* Effect.logError(`olai: the heading for "${plugin}" could not be claimed; the next frame tries it again`, claimed.cause)
      return
    }
    held.set(plugin, scope)
  })
  return {
    reconcile: (wanted, of) => Effect.gen(function*() {
      for (const [plugin, scope] of [...held]) {
        if (wanted.includes(plugin)) continue
        held.delete(plugin)
        yield* Scope.close(scope, Exit.void)
      }
      for (const plugin of wanted) {
        if (held.has(plugin)) continue
        yield* claim(plugin, of)
      }
    }),
    close: Effect.suspend(() => Effect.forEach(
      [...held].map(([, scope]) => scope),
      (scope) => Scope.close(scope, Exit.void),
      { discard: true },
    )),
  }
}
