/**
 * THE APP READ FROM ANOTHER MACHINE, over plain http — the way most people read
 * olai (a LAN address, a `tailscale serve` port), and the one way this suite
 * never did.
 *
 * Every server the suite starts listens on `127.0.0.1`, and a browser counts
 * that as a SECURE CONTEXT. A page read from any other name over http is not
 * one, and on such a page the browser withholds whole APIs: there is no
 * `crypto.randomUUID` and no `navigator.clipboard`. #642 minted pane ids with
 * the first, and every page read from another machine came up as "Some plugins
 * couldn't start: navigation" while the whole suite stayed green.
 *
 * So Chromium is launched with one more name for the loopback address,
 * {@link LAN_HOST}, which it resolves itself — no `/etc/hosts`, no DNS, no
 * second interface. The server sees an ordinary connection to 127.0.0.1; the
 * page sees an origin that is not `localhost`, and is held to what such a page
 * is held to. `.test` is reserved (RFC 6761), so the name can never be real.
 */

export const LAN_HOST = "olai-lan.test"

/** The Chromium flag that makes {@link LAN_HOST} reach this machine. */
export const LAN_RESOLVER_ARG = `--host-resolver-rules=MAP ${LAN_HOST} 127.0.0.1`

/** The same server, addressed as another machine would address it. */
export const onLan = (baseUrl: string): string => {
  const url = new URL(baseUrl)
  url.hostname = LAN_HOST
  return url.href.replace(/\/$/, "")
}
