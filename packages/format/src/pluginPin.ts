/**
 * WHAT THE OPERATOR PINNED about plugins — the git pin's sibling, on the floor
 * because it TRAVELS.
 *
 * Three flags at the edge; one pin inward. Exact set and delta cannot coexist,
 * so that exclusion is the sum, not a throw sitting on three nullables. Extra
 * and without compose inside `delta` the way commit and push compose inside
 * {@link ./committing.ts}'s `GitPin`.
 *
 * HERE rather than in the composition root or the wire spec, for the reason
 * `GitPin` is: the serve produces it, the surface carries it, the browser
 * draws it, and a type that lived in `@olai/bundle` could not reach a tab.
 */

import { Schema } from "effect"

export const PluginPin = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("omitted") }),
  Schema.Struct({
    kind: Schema.Literal("exact"),
    names: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("delta"),
    extra: Schema.NullOr(Schema.Array(Schema.String)),
    without: Schema.NullOr(Schema.Array(Schema.String)),
  }),
])
export type PluginPin = typeof PluginPin.Type

/**
 * THE PIN A ROSTER PUBLISHED, or the exact-arm projection an older serve still
 * sends as `pinned`.
 *
 * A new serve writes {@link PluginPin} itself. An older one wrote only the
 * exact-set half (`null` for omitted, a list for `--plugins`). `optionalKey`
 * on the roster is what lets both decode; this is what lets a reader hold one
 * sum either way.
 */
export const pluginPinOf = (published: {
  readonly pin?: PluginPin
  readonly pinned: ReadonlyArray<string> | null
}): PluginPin =>
  published.pin ?? (published.pinned === null
    ? { kind: "omitted" }
    : { kind: "exact", names: published.pinned })
