/**
 * `crypto.randomUUID` is secure-context only (https or localhost) and olai is
 * ordinarily read over plain http on a LAN address, where the method is simply
 * absent. `crypto.getRandomValues` carries no such gate, so this is a
 * version-4 UUID built from it (RFC 9562 §5.4).
 */
const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"))

export const randomUuid = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => HEX[byte]!)
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${
    hex.slice(8, 10).join("")
  }-${hex.slice(10).join("")}`
}
