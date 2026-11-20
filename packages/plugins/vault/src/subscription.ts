import { Cause, Effect, Exit, Stream, SubscriptionRef } from "effect"

/** Effect 4's PubSub teardown can append `Fail(Cause.Done)` — the queue's own
 *  end-of-stream signal — to a subscription stream's interrupt exit. */
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
