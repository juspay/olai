/**
 * THE TAB'S STAMP ON A SOCKET'S URL — `tab` and `dial`, written by the tab
 * when it dials and read back by the server off the upgrade, so the tab's
 * account of a socket and the server's can be joined. One module writes it and
 * reads it, so the two cannot disagree about where it lives in a URL.
 */
import { Schema } from "effect"

const TAB_PARAM = "tab"
const DIAL_PARAM = "dial"

/** A tab's id: sixteen lowercase hex digits, minted once per page load. */
export const Tab = Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/))

/** A dial's ordinal: the tab's 1st, 2nd, … socket. */
const Dial = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000_000_000 }))

const isTab = Schema.is(Tab)
const isDial = Schema.is(Dial)

/** `url` with this tab's stamp on its query. A query already there is kept. */
export const stamped = (url: string, stamp: { readonly tab: string; readonly dial: number }): string => {
  const at = new URL(url)
  at.searchParams.set(TAB_PARAM, stamp.tab)
  at.searchParams.set(DIAL_PARAM, String(stamp.dial))
  return at.toString()
}

/** The `tab` and `dial` a socket URL carries, each only when it has the shape a
 *  tab mints. Anything else is absent rather than echoed: the URL is whatever
 *  the peer sent. */
export const stampOf = (url: URL): { readonly tab?: string; readonly dial?: number } => {
  const tab = url.searchParams.get(TAB_PARAM) ?? undefined
  const dialText = url.searchParams.get(DIAL_PARAM)
  const dial = dialText !== null && /^[0-9]{1,10}$/.test(dialText) ? Number(dialText) : undefined
  return {
    ...(tab !== undefined && isTab(tab) ? { tab } : {}),
    ...(dial !== undefined && isDial(dial) ? { dial } : {}),
  }
}
