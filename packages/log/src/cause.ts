/**
 * What a failure actually says — in the two lengths anything ever wants it.
 *
 * Everything in olai that reports a failure it did not catch reaches it as an
 * `unknown`: a promise the surface runtime rejected, a `catch` on a serving
 * site, a spawn that threw, an `onError` handed the fiber's `Cause`. There are
 * three shapes worth telling apart, and the interesting one is the first —
 * an Effect `Cause` renders through neither `.message` nor anything a template
 * literal reaches for, so the failures a server actually stops for were the
 * ones nobody could read.
 *
 * The two lengths are a real distinction rather than a preference, which is why
 * both are here and neither is the default:
 *
 *   - {@link prettyCause} is for a LOG. It keeps the stack and every reason in
 *     the cause, because the reader is looking for what went wrong and the line
 *     is already `key=value` — a newline in a value is escaped, not wrapped.
 *   - {@link reasonOf} is for a SENTENCE a person reads: a tagged error's
 *     `message`, a notice in the chat panel. One line, no stack. Interpolating
 *     `prettyCause` into "cannot listen on 127.0.0.1:7714: …" would answer a
 *     question nobody asked with a trace of our own call site.
 *
 * They live together and not beside any one caller: the same rendering was a
 * private helper in `serve.ts` while `listener.ts`, one file away, hand-rolled
 * the short one — and `olai-plugin-chat` had a third copy under a fourth name. That
 * is the whole argument for a receptacle, in six lines.
 */

import { Cause } from "effect"

/** A failure, rendered in full for a log. `Cause.pretty` for Effect's own, the
 *  stack for an ordinary `Error` (it carries the message), and `String` for
 *  whatever else a `reject` was handed — `throw 3` is legal JavaScript. */
export const prettyCause = (cause: unknown): string =>
  Cause.isCause(cause)
    ? Cause.pretty(cause)
    : cause instanceof Error
    ? cause.stack ?? cause.message
    : String(cause)

/** A failure in one line, for a sentence somebody reads. `Cause.squash` is
 *  what picks the one failure out of a cause that may carry several — and it
 *  answers with a value, which is why this then renders that. */
export const reasonOf = (cause: unknown): string =>
  Cause.isCause(cause)
    ? reasonOf(Cause.squash(cause))
    : cause instanceof Error
    ? cause.message
    : String(cause)

/**
 * The `errno` a failure carries, if it carries one — `EADDRINUSE`,
 * `ECONNREFUSED`, `ENOENT`.
 *
 * The third question anything asks of an `unknown` failure, and the one whose
 * answer is a DECISION rather than a sentence: a busy port is a reason to retry
 * elsewhere, an `ECONNREFUSED` on a rendezvous socket is the answer "nobody is
 * home". Here for the reason the two above are: the same cast had grown a
 * private copy in `@olai/server`'s listener, another in its socket, and a third
 * in `olai-plugin-chat` — and a hand-rolled one that reads `.code` off a `Cause`
 * rather than off the error inside it answers `undefined` to every question,
 * silently, which is the failure mode that makes this a receptacle rather than
 * a convenience.
 */
export const codeOf = (cause: unknown): string | undefined => {
  const failure = Cause.isCause(cause) ? Cause.squash(cause) : cause
  return typeof failure === "object" && failure !== null && "code" in failure
    ? String((failure as { readonly code: unknown }).code)
    : undefined
}
