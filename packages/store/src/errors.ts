import { Data, type PlatformError } from "effect"

export const ROOT_ITSELF = "."

export class PlatformFailure extends Data.TaggedError("PlatformFailure")<{
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `cannot read ${
      this.path === ROOT_ITSELF ? "the served directory" : this.path
    }: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`
  }
}

export class StaleWrite extends Data.TaggedError("StaleWrite")<{
  readonly baseRev: number
  readonly currentRev: number
}> {
  override get message(): string {
    return `the store is at revision ${this.currentRev}, not ${this.baseRev}: re-derive the write and try again`
  }
}

export const vanished = (error: PlatformError.PlatformError): boolean =>
  error.reason._tag === "NotFound"
