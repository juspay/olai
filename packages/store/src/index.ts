export type { Codec, Since, StopCheck } from "./codec.ts"
export { PlatformFailure, ROOT_ITSELF, StaleWrite, vanished } from "./errors.ts"
export {
  type Aged,
  type Change,
  make,
  type Options,
  type Rev,
  type Snapshot,
  type Store,
  type Write,
} from "./store.ts"
export {
  type Confirmed,
  type Diverged,
  type Freshness,
  type Held,
  isStale,
  type Proof,
  type Unchecked,
  type Vintage,
} from "./vintage.ts"
