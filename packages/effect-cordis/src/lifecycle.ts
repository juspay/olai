/** Activation ownership at the Cordis / Effect boundary. */
import type { Context as CordisContext, Fiber as CordisFiber } from "cordis"
import { Context, Effect } from "effect"
import type { Provision, ServiceKey } from "./service.ts"

export interface Activation {
  readonly ctx: CordisContext
  readonly revokes: Array<() => Promise<void>>
  readonly dependencies: ReadonlySet<CordisFiber>
  readonly drained: Promise<void>
  closing: boolean
  interrupt: () => void
}

const activations = new Map<CordisFiber, Activation>()
export const Offering = Context.Reference<Activation | undefined>("effect-cordis/Offering", {
  defaultValue: () => undefined,
})

export const track = (activation: Activation): void => {
  activations.set(activation.ctx.fiber, activation)
}
export const untrack = (activation: Activation): void => {
  if (activations.get(activation.ctx.fiber) === activation) activations.delete(activation.ctx.fiber)
}
/** Join the old activations even when Cordis already removed their fibers
 * from the registry (notably when the entire host closes at once). */
export const drainDependents = async (activation: Activation): Promise<void> => {
  await Promise.all([...activations.values()]
    .filter((other) => other.dependencies.has(activation.ctx.fiber))
    .map((other) => other.drained))
}
/** Include activations whose disposal already removed their registry entry. */
export const hostActivations = (ctx: CordisContext): ReadonlyArray<Activation> =>
  [...activations.values()].filter((activation) => activation.ctx.root.fiber === ctx.root.fiber)

export const interrupt = (fiber: CordisFiber): void => activations.get(fiber)?.interrupt()

/** Provide on the calling fiber, withholding the value until it is ACTIVE.
 * Revocation belongs to the activation, before ANY of its scope finalizers.
 * Pin coupling: detach the provide disposer from `_disposables`. Cordis runs
 * that set concurrently and its guarded disposer cannot be joined twice.
 * Keeping exactly one caller here lets dependent cleanup finish first.
 */
export const offer = <Shape>(key: ServiceKey<Shape>, provision: Provision<Shape>): Effect.Effect<void> =>
  Effect.flatMap(Offering, (activation) => Effect.sync(() => {
    if (activation === undefined || activation.closing) {
      throw new Error("effect-cordis: offer requires an open plugin activation")
    }
    const revoke = activation.ctx.provide(key.cordis, provision)
    activation.ctx.fiber._disposables.delete(revoke)
    activation.revokes.push(async () => { await revoke() })
  }))
