/** Optional service reads through the active browser host. This bridge holds
 * only its scoped reader, never a plugin implementation or fallback provider. */
import type { ServiceKey } from "@olai/effect-cordis"
import { createSignal } from "solid-js"
type Reader = <T>(key: ServiceKey<T>) => T | undefined
const [reader, setReader] = createSignal<Reader>()
export const readService: Reader = key => reader()?.(key)
export const holdServices = (value: Reader): (() => void) => {
  setReader(() => value)
  return () => { if (reader() === value) setReader(undefined) }
}
