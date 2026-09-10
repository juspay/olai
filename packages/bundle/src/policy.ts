/** Static declarations survive runtime plugin switches. A provider can reserve
 * a key it interprets later without exposing its approval policy to the host. */
export interface WriteReservation { readonly key: string; readonly says: string }
export { WRITE_RESERVATIONS } from "./policy.generated.ts"
