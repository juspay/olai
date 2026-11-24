/**
 * What one accepted socket carried, counted as it goes.
 *
 * When a tab's socket ends, the useful questions are how long it lived, how
 * much went each way, how big the largest frame the server sent was, and how
 * long it had been since the tab last answered a ping or sent anything. None of
 * that is in the close event, so this view counts it on the way past: the RPC
 * server is handed {@link measured}'s `view` instead of the raw peer, and every
 * send goes through it.
 *
 * Per frame this does a length, a few additions and one comparison. No frame is
 * kept or copied. The one thing it reads out of a frame is the start of the
 * envelope (`{"_tag":"Chunk","requestId":"41",…`), and only for a frame that is
 * over the cap a tab accepts, so the warning can say which kind of answer and
 * which request it was.
 *
 * The listeners it adds to the peer are removed when the peer closes; the view
 * owns nothing else.
 */
import type { ServableSocket } from "@kolu/surface-app/server"
import { exceedsFrameLimit, RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"
import type { LinkFact, LinkMeasure } from "@olai/plugin-api/transport"

/** The slice of a `ws` peer this needs: what the RPC server drives, and the
 *  pong a heartbeat ping is answered with. */
export interface MeasurablePeer extends ServableSocket {
  on(event: "pong", listener: () => void): unknown
  off(event: "pong", listener: () => void): unknown
}

/** A frame the server sent that a tab will refuse. */
export type OverCap = Omit<Extract<LinkFact, { readonly _tag: "FrameOverCap" }>, "_tag" | "connection">

/** A frame's size as the tab's decoder counts it: UTF-16 code units for text,
 *  bytes otherwise. */
const sizeOf = (data: unknown): number =>
  typeof data === "string" ? data.length : data instanceof Uint8Array || data instanceof ArrayBuffer ? data.byteLength : 0

const ENVELOPE = /^\{"_tag":"(\w{1,32})"(?:,"requestId":"(\d{1,20})")?/

export const measured = (
  peer: MeasurablePeer,
  options: { readonly now: () => number; readonly overCap: (frame: OverCap) => void },
): { readonly view: ServableSocket; readonly measure: () => LinkMeasure } => {
  const { now } = options
  const born = now()
  let inFrames = 0
  let inBytes = 0
  let outFrames = 0
  let outBytes = 0
  let largestOut = 0
  let lastPong: number | undefined
  let lastInbound: number | undefined

  const onMessage = (event: Event): void => {
    inFrames += 1
    inBytes += sizeOf("data" in event ? event.data : undefined)
    lastInbound = now()
  }
  const onPong = (): void => {
    lastPong = now()
  }
  peer.addEventListener("message", onMessage)
  peer.on("pong", onPong)
  peer.addEventListener("close", () => {
    peer.removeEventListener("message", onMessage)
    peer.off("pong", onPong)
  }, { once: true })

  const view: ServableSocket = {
    get readyState() {
      return peer.readyState
    },
    addEventListener: (type, listener, listening) => peer.addEventListener(type, listener, listening),
    removeEventListener: (type, listener) => peer.removeEventListener(type, listener),
    send: (data) => {
      const bytes = sizeOf(data)
      outFrames += 1
      outBytes += bytes
      if (bytes > largestOut) largestOut = bytes
      if (exceedsFrameLimit(bytes)) {
        const envelope = typeof data === "string" ? ENVELOPE.exec(data.slice(0, 96)) : null
        options.overCap({
          bytes,
          cap: RPC_MAX_FRAME_BYTES,
          ...(envelope?.[1] === undefined ? {} : { kind: envelope[1] }),
          ...(envelope?.[2] === undefined ? {} : { request: envelope[2] }),
        })
      }
      peer.send(data)
    },
    close: (code, reason) => peer.close(code, reason),
    terminate: () => peer.terminate?.(),
  }

  return {
    view,
    measure: () => {
      const at = now()
      return {
        lived: at - born,
        inFrames,
        inBytes,
        outFrames,
        outBytes,
        largestOut,
        ...(lastPong === undefined ? {} : { sincePong: at - lastPong }),
        ...(lastInbound === undefined ? {} : { sinceInbound: at - lastInbound }),
      }
    },
  }
}
