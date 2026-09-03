/**
 * A BROADCAST — the fire-and-forget half of a plugin bus, and the other
 * dispatch mode beside {@link ./waterfall.ts}'s.
 *
 * ## What this is the translation OF, and why it arrived late
 *
 * Cordis has five dispatch modes. A WATERFALL threads the payload through each
 * listener with a `next`, so a link may transform what the ones after it see or
 * decline to call through; an EMIT does not — every listener is told, none can
 * change what the next one hears, and the caller waits for all of them.
 *
 * This package shipped the waterfall and declined the emit, on the stated
 * grounds that olai had no fire-and-forget plugin event left to translate. That
 * was wrong in the way a survey is wrong: `@olai/plugin-api` had three of them —
 * a vault revision, the store going quiet, a conversation event — and each was
 * hand-rolled beside the others, so the count came out at zero because nobody
 * had a name to count. The registration half, the containment half and the
 * dispatch half were each written three times.
 *
 * ## The containment is the whole reason it is not a `Set` of callbacks
 *
 * Cordis's own `emit` is a bare loop of `Reflect.apply` with no `try` in it, so
 * a listener that threw took every listener after it down and the caller with
 * them — which on a revision meant one plugin's bad walk silenced every later
 * plugin's reading of that revision and failed the owned fiber that published
 * it. Every handler here is wrapped ONCE, at registration, with the registering
 * plugin's own word on the line; containment is a property of the bus rather
 * than a discipline each subscriber is asked to keep.
 *
 * ## ...and the caller AWAITS, which is what a `Stream` could not do
 *
 * {@link Bus.tell} runs every handler in subscription order and answers when the
 * last of them has. That is load-bearing for the vault: the composition root
 * rings a revision from inside the directory binding's own connector, and the
 * statements after that line write the collections, the heads and the roster
 * over a world every plugin has already re-derived. A `Stream` subscriber is a
 * fiber of its own, so a publisher could only offer and walk on.
 */

import { type Cause, Effect, Scope } from "effect"

/** WHAT A PLUGIN'S HALF OF A BUS IS — one verb, and it is a registration rather
 *  than a subscription: what comes back is nothing, and what holds it is the
 *  calling plugin's scope. */
export type Listen<A> = (handler: (value: A) => Effect.Effect<void>) => Effect.Effect<
  void,
  never,
  Scope.Scope
>

/** ...AND THE HOST'S. */
export interface Bus<A> {
  /** One plugin's half, minted from its own word — hand this out of a
   *  {@link ./service.ts}'s `Provision`. */
  readonly listen: (plugin: string) => Listen<A>
  /** ...and the other end: one value to every handler, in subscription order,
   *  answered when the last of them has. */
  readonly tell: (value: A) => Effect.Effect<void>
}

/**
 * Open one.
 *
 * `what` is the phrase a contained failure is reported with — *"`kolu` failed on
 * a vault revision"* — so the sentence names the occasion as well as the plugin.
 * It is a parameter rather than a field on the handler because it is a fact
 * about the BUS: every failure on one is a failure on the same occasion.
 */
export const broadcast = <A>(what: string): Bus<A> => {
  /** A `Map` keyed by a fresh symbol rather than a `Set`, so two plugins
   *  registering the same handler VALUE are two registrations and dropping one
   *  leaves the other. */
  const handlers = new Map<symbol, (value: A) => Effect.Effect<void>>()
  return {
    listen: (plugin) => (handler) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const at = Symbol()
          handlers.set(at, (value) => contained(plugin, what, handler(value)))
          return at
        }),
        (at) => Effect.sync(() => void handlers.delete(at)),
      ).pipe(Effect.asVoid),
    // SUSPENDED, because the list is read at the moment the bus is rung rather
    // than at the moment it was opened: every subscriber arrives afterwards.
    tell: (value) =>
      Effect.suspend(() =>
        Effect.forEach([...handlers.values()], (handler) => handler(value), { discard: true })
      ),
  }
}

/**
 * WHAT A CONTAINED FAILURE IS SAID WITH — one line for every plugin bus in the
 * tree, including {@link ./waterfall.ts}'s.
 *
 * The plugin's word is on it because a line about a misbehaving handler has to
 * say whose it was, and no caller can sign another plugin's name to one.
 *
 * THE SENTENCE IS SHARED AND THE RECOVERY IS NOT, which is the honest split
 * rather than a half-done one: a broadcast has nothing to hand back and a
 * waterfall carries on with the value its link was handed, so each mode catches
 * for itself and both say the same thing.
 */
export const failed = (
  plugin: string,
  what: string,
  cause: Cause.Cause<never>,
): Effect.Effect<void> =>
  Effect.logWarning(`plugins: "${plugin}" failed on ${what}`, cause)

/** ...and the broadcast's own recovery: nothing to hand back. */
const contained = (
  plugin: string,
  what: string,
  work: Effect.Effect<void>,
): Effect.Effect<void> => Effect.catchCause(work, (cause) => failed(plugin, what, cause))
