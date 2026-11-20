/**
 * A page served over http from any name but `localhost`/`127.0.0.1` is not a
 * secure context, so the browser withholds `crypto.randomUUID` and
 * `navigator.clipboard`. Chromium resolves {@link LAN_HOST} to the loopback
 * address itself — no `/etc/hosts`, no DNS — so the server sees an ordinary
 * 127.0.0.1 connection while the page sees a non-secure origin. `.test` is
 * reserved (RFC 6761), so the name can never be real.
 */

export const LAN_HOST = "olai-lan.test"

export const LAN_RESOLVER_ARG = `--host-resolver-rules=MAP ${LAN_HOST} 127.0.0.1`

export const onLan = (baseUrl: string): string => {
  const url = new URL(baseUrl)
  url.hostname = LAN_HOST
  return url.href.replace(/\/$/, "")
}
