import { Cause } from "effect"

export const prettyCause = (cause: unknown): string =>
  Cause.isCause(cause)
    ? Cause.pretty(cause)
    : cause instanceof Error
    ? cause.stack ?? cause.message
    : String(cause)

export const reasonOf = (cause: unknown): string =>
  Cause.isCause(cause)
    ? reasonOf(Cause.squash(cause))
    : cause instanceof Error
    ? cause.message
    : String(cause)

export const codeOf = (cause: unknown): string | undefined => {
  const failure = Cause.isCause(cause) ? Cause.squash(cause) : cause
  return typeof failure === "object" && failure !== null && "code" in failure
    ? String((failure as { readonly code: unknown }).code)
    : undefined
}
