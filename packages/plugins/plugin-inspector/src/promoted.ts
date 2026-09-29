/**
 * THE HEADINGS THE PROMOTED ROWS ARE DRAWN UNDER, held one scope at a time.
 *
 * A heading is a registration in `preferences.sections`, and a registration is
 * a RESOURCE: it must be released when the plugin that owns it stops, or the
 * next enable of that plugin claims a key somebody still holds. This module is
 * that holding, and nothing else — the roster, the words and the body are the
 * caller's.
 *
 * ## Why each heading gets a scope of its own
 *
 * `contribute` attaches its release to the scope in ITS context, and
 * `Effect.forkScoped` does not open one — a forked fiber inherits the scope it
 * was forked from. So a registration made inside a forked fiber is released
 * when the COMPONENT closes, not when the fiber finishes, and interrupting a
 * fiber that has already completed releases nothing. Where a claim must be
 * given back at a moment of our choosing, the scope has to be ours: one
 * `Scope.make` per heading, closed in `reconcile` when that plugin leaves, and
 * every remaining one closed by the caller's finalizer.
 *
 * ## Why refusing a claim is not silent
 *
 * `contribute` DIES when a key is already held (`locations.ts`), which is a
 * defect rather than a refusal — and a defect inside a forked fiber, in a
 * stream nobody awaits, is a claim that failed while the panel went on drawing
 * the previous set. The caller therefore observes the fiber's cause and reports
 * it; `Effect.logError` is the browser's console, which is where a bug belongs.
 */
import type { Location, LocationOwner } from "@olai/plugin-api/contracts"
import type { PluginHeading, Section } from "olai-plugin-preferences/contract"
import type { JSX } from "solid-js"
import { Effect, Exit, Scope } from "effect"

/** ONE HEADING'S WORDS AND ROWS, as the caller knows them. Both are functions
 *  of the plugin so a live roster is read at draw time rather than frozen at
 *  registration. */
export interface HeadingOf {
  readonly heading: (plugin: string) => PluginHeading
  readonly body: (plugin: string) => () => JSX.Element
}

export interface HeldHeadings {
  /** MAKE THE HELD SET EXACTLY `wanted`: release the headings whose plugins
   *  have gone, then claim the ones that arrived. A plugin already held is
   *  left alone, so a roster frame that changed nothing does nothing. */
  readonly reconcile: (wanted: ReadonlyArray<string>, of: HeadingOf) => Effect.Effect<void>
  /** RELEASE EVERY HEADING STILL HELD — the caller's finalizer, so a component
   *  that closes while headings are up gives them all back. */
  readonly close: Effect.Effect<void>
}

/** The scope a heading must be held in, as the shape `contribute` takes. */
type Owner = Pick<LocationOwner, "contribute">

export const heldHeadings = (slots: Owner, sections: Location<Section>): HeldHeadings => {
  const held = new Map<string, Scope.Closeable>()
  return {
    reconcile: (wanted, of) => Effect.gen(function*() {
      for (const [plugin, scope] of [...held]) {
        if (wanted.includes(plugin)) continue
        held.delete(plugin)
        yield* Scope.close(scope, Exit.void)
      }
      for (const plugin of wanted) {
        if (held.has(plugin)) continue
        const scope = yield* Scope.make()
        held.set(plugin, scope)
        yield* Scope.provide(
          slots.contribute(sections, {
            heading: of.heading(plugin),
            order: 0,
            scope: "shared",
            body: of.body(plugin),
          }, { key: plugin }),
          scope,
        )
      }
    }),
    close: Effect.suspend(() => Effect.forEach(
      [...held].map(([, scope]) => scope),
      (scope) => Scope.close(scope, Exit.void),
      { discard: true },
    )),
  }
}
