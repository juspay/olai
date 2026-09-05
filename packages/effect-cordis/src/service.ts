/**
 * A CORDIS SERVICE KEY, AS AN EFFECT TAG — the first half of the translation,
 * and the one that makes `inject` and the requirement channel the same
 * declaration.
 *
 * ## The two vocabularies this collapses
 *
 * Cordis names a dependency with a STRING: a plugin declares `inject:
 * ["vault"]`, the runtime holds its fiber `PENDING` until something has
 * `provide`d that key, unloads it when the provider leaves, and re-applies it
 * when a new one arrives. Effect names a dependency with a TAG: an effect that
 * yields `Vault` carries `Vault` in its requirement channel `R`, and the
 * compiler refuses to run it until something has provided one.
 *
 * They are the same idea at two different times — one at runtime, one at
 * typecheck — and a plugin that had to say it twice would be a plugin whose two
 * declarations can disagree. {@link serviceTag} is one value carrying both: an
 * Effect tag with the Cordis key on it, so {@link ../plugin.ts}'s
 * `definePlugin` can derive the `inject` array from the same list the compiler
 * derives `R` from.
 *
 * ## Why what is provided is a FUNCTION of the plugin's name
 *
 * Cordis's own answer to "which plugin is calling" is `this.ctx.fiber.name`,
 * read inside a `Service` method off the shadow the runtime binds per calling
 * fiber. That is a lot of machinery to carry across the wall, and every service
 * that wants the stamp has to know about it.
 *
 * So the value behind a key is a {@link Provision}: a function from the
 * plugin's word to that plugin's own view of the service. The facade calls it
 * ONCE, when the plugin activates, with the name it read off the fiber — so the
 * stamp is still the registry binding and never an argument a caller supplied,
 * and a service that does not care about the caller simply ignores the
 * parameter. A plugin holds a value, not a proxy.
 */

import { Context } from "effect"

/**
 * ONE SERVICE, NAMED ONCE.
 *
 * `cordis` is the key the fiber's `inject` declares and the property the host
 * provides it on; the tag half is what an `apply` yields and what the compiler
 * tracks. Both come off this one value, which is the whole point.
 */
export interface ServiceKey<Shape> extends Context.Service<Shape, Shape> {
  /** The Cordis key — what `inject` names and what the host provides. */
  readonly cordis: string
}

/**
 * ONE PLUGIN'S VIEW OF A SERVICE, minted from its name.
 *
 * Called once per activation, by the facade, with `ctx.fiber.name`. A service
 * with no per-plugin fence (a clock, an environment) ignores the argument and
 * hands back the same object every time; one WITH a fence (a doorbell's door, a
 * registry that prefixes by plugin) closes over the word here and can then have
 * no method that takes it as a parameter — which is what makes "a plugin cannot
 * sign another plugin's name to a registration" a shape rather than a rule.
 */
export type Provision<Shape> = (plugin: string) => Shape

/**
 * Mint a key.
 *
 * The tag's own string identity is namespaced, because an Effect context is a
 * flat map keyed by that string and two unrelated services sharing one would
 * occupy one slot. The Cordis key stays exactly as supplied, including any
 * plugin namespace: it is the key the fiber's inject names. Minting this tag
 * names a dependency; it does not install a provision.
 */
export const serviceTag = <Shape>(cordis: string): ServiceKey<Shape> =>
  Object.assign(Context.Service<Shape>(`effect-cordis/${cordis}`), { cordis })

/** ANY SERVICE KEY, whatever it is a key FOR — the constraint `definePlugin`'s
 *  `needs` takes, and the reason it is written as an intersection is that both
 *  halves are load-bearing: the Effect side is what `R` is computed from, and
 *  {@link ServiceKey.cordis} is what `inject` is.
 *
 *  BESIDE THE FAMILY IT DESCRIBES rather than beside the one function that spends
 *  it. Keys are minted here and `ServiceKey` is declared here, so this is the
 *  module that owns the concept; putting it in `./plugin.ts` left that module
 *  with two concerns (turning an Effect into a plugin, AND naming the type family
 *  it takes) and left this one unable to describe its own. */
export type AnyKey = Context.Service.Any & { readonly cordis: string }
