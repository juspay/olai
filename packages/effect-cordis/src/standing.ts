/**
 * A SCOPE THAT OUTLIVES ITS CALLER, and the one way to run against it from code
 * that is not an Effect.
 *
 * ## What it is for
 *
 * Everything this package hands back is `Effect<_, never, Scope>`: a host, a
 * service, a bus, a mounted plugin. Every one of those is opened by something
 * that is NOT an Effect and that owns the runtime for its own lifetime — a tab's
 * module scope, a bench's case, a composition root's boot. That crossing was
 * written out seven times in one commit, byte for byte, and a seam re-invented
 * per caller is a seam nobody can change.
 *
 * ## The other direction is {@link ./plugin.ts}'s `detached`
 *
 * ...and the pair is the whole of this package's traffic with code that is not
 * Effect. `standing` starts a runtime from the outside and hands work IN;
 * `detached` starts work from a callback the appliance owns and reports OUT.
 * Two functions, both named, and no third spelling anywhere in the tree.
 *
 * ## Why it is its own module
 *
 * It lived in `./host.ts`, whose subject is the Cordis context — and it takes no
 * host, hands back no host, and mentions none. Nothing about starting a runtime
 * from the outside is Cordis's; it is what every one of this package's doors is
 * opened THROUGH, which is a file of its own rather than a paragraph inside one
 * of them.
 *
 * ## The scope is never closed, and that is the shape rather than a leak
 *
 * A standing runtime lives as long as the thing that opened it: a page until it
 * navigates away, a case until it ends, a serve until the process does. What the
 * scope is FOR is that every registration a plugin makes hangs off ITS OWN
 * scope, inside this one, and unwinds when that plugin is dropped. A caller that
 * genuinely wants to close the whole runtime holds an `Effect.scoped` instead
 * and never reaches for this.
 */

import { Effect, Scope } from "effect"

/** Open one, and take back the way in. */
export const standing = (): <A>(work: Effect.Effect<A, never, Scope.Scope>) => Promise<A> => {
  const scope = Scope.makeUnsafe()
  return (work) => Effect.runPromise(Scope.provide(work, scope))
}
