import { Cause, Effect, Exit, Stream, SubscriptionRef } from "effect"

/** Effect 4 RC PubSub subscription teardown can append Fail(Cause.Done) to
 * an interrupt exit. That sentinel means the queue ended, not that the vault
 * failed. Normalize it only on interruption at this owned subscription
 * boundary; publisher defects and every other failure remain supervised.
 * The explicit inner scope includes unsubscribe finalizers in the observed
 * exit, while the mask lets us inspect it after cancellation. */
export const followSubscription = <A>(
  source: SubscriptionRef.SubscriptionRef<A>,
  publish: (value: A) => void,
): Effect.Effect<void> => Effect.uninterruptibleMask(restore => Effect.flatMap(
  Effect.exit(restore(Effect.scoped(Stream.runForEach(SubscriptionRef.changes(source),
    value => Effect.sync(() => publish(value)))))),
  exit => {
    if (Exit.isSuccess(exit)) return Effect.void
    const reasons = exit.cause.reasons
    const cause = reasons.some(Cause.isInterruptReason)
      ? Cause.fromReasons(reasons.filter(reason => !(Cause.isFailReason(reason) && Cause.isDone(reason.error))))
      : exit.cause
    return Effect.failCause(cause)
  },
))
