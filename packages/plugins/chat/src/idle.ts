import { Schema } from "effect"
import { Config } from "./settings.ts"

/** Legacy environment spelling; policy constraints belong to Config. */
export const idleMillis = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined
  try {
    if (!/^[0-9]+$/.test(value)) throw new Error("not whole milliseconds")
    return Schema.decodeUnknownSync(Config)({ "idle-ms": Number(value) })["idle-ms"]
  } catch {
    throw new Error("OLAI_CHAT_IDLE_MS must be an integer from 1 to 2147483647 milliseconds")
  }
}
