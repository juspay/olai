/**
 * A RANDOM UUID THAT ANY PAGE CAN MINT — including the page most readers have.
 *
 * `crypto.randomUUID` is gated on a secure context: https, or a page served
 * from `localhost`. olai is ordinarily read from ANOTHER machine over plain
 * http (a LAN address, a `tailscale serve` port), and there the method is
 * simply absent — calling it throws `crypto.randomUUID is not a function`. When
 * navigation's pane state minted its keys with it (#642), that throw happened
 * while the plugin's browser half was starting, and the whole page came up as
 * "Some plugins couldn't start: navigation".
 *
 * `crypto.getRandomValues` is NOT gated, so this is the same version-4 UUID
 * built from it: sixteen random bytes with the version and variant bits set
 * (RFC 9562 §5.4). A browser module that wants an id reaches for this rather
 * than `crypto.randomUUID`; a server module keeps `node:crypto`'s, which has no
 * such gate.
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
