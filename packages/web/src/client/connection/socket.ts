import { frameSize, stamped } from "@olai/log/link"
import type { Dial, Diary } from "./diary.ts"

/** Chromium silently drops sends on a closing socket and prints a console
 * error. During a roster reconnect, a departing subscription can still write
 * before the close event reaches Effect's socket latch. Reject that write so
 * Effect turns it into SocketWriteError and the transport's existing failure
 * and reconnection handling runs; never report a dropped payload as sent.
 * Every send and every refusal is counted on the dial. */
export const checkedSocket = (socket: WebSocket, counted: Pick<Dial, "sent" | "refused">): WebSocket => {
  const send = socket.send.bind(socket)
  socket.send = (data) => {
    if (socket.readyState !== 1) {
      counted.refused()
      throw new DOMException("The socket is not open", "InvalidStateError")
    }
    counted.sent(frameSize(data))
    send(data)
  }
  return socket
}

/**
 * Watch one socket for its dial: when it opens, the size of each frame that
 * arrives, how it closes, and whether the page closed it first. Lengths only;
 * no frame is kept. The listeners go with the socket.
 */
export const tappedSocket = (socket: WebSocket, dial: Dial): WebSocket => {
  socket.addEventListener("open", () => dial.opened(), { once: true })
  socket.addEventListener("message", (event) => dial.inbound(frameSize(event.data)))
  socket.addEventListener(
    "close",
    (event) => dial.closed({ code: event.code, reason: event.reason, clean: event.wasClean }),
    { once: true },
  )
  const close = socket.close.bind(socket)
  socket.close = (code, reason) => {
    dial.closing()
    close(code, reason)
  }
  return checkedSocket(socket, dial)
}

/** kolu's `connect`: each socket is a new dial of this tab, and carries the
 *  tab and the dial on its URL so the server's lines about it can be joined
 *  to this tab's own. */
export const connectSocket = (diary: Diary) => (url: string): WebSocket => {
  const dial = diary.dialled()
  return tappedSocket(new WebSocket(stamped(url, { tab: diary.tab, dial: dial.n })), dial)
}
