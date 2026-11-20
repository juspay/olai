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

interface HeldHeading {
  readonly release: Effect.Effect<void>
}

const holdHeading = (
  slots: Owner,
  sections: Location<Section>,
  plugin: string,
  of: HeadingOf,
): Effect.Effect<HeldHeading | undefined> => Effect.gen(function*() {
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
    return undefined
  }
  return { release: Scope.close(scope, Exit.void) }
})

export const heldHeadings = (slots: Owner, sections: Location<Section>): HeldHeadings => {
  const held = new Map<string, HeldHeading>()
  return {
    reconcile: (wanted, of) => Effect.gen(function*() {
      for (const [plugin, heading] of [...held]) {
        if (wanted.includes(plugin)) continue
        held.delete(plugin)
        yield* heading.release
      }
      for (const plugin of wanted) {
        if (held.has(plugin)) continue
        const heading = yield* holdHeading(slots, sections, plugin, of)
        if (heading !== undefined) held.set(plugin, heading)
      }
    }),
    close: Effect.suspend(() => Effect.forEach(
      [...held.values()],
      (heading) => heading.release,
      { discard: true },
    )),
  }
}
