/** The WebSocket standard makes `send()` on a CLOSING or CLOSED socket discard
 * the data silently (browsers only log it), so a departing subscription that
 * writes before the close reaches Effect's socket latch would be reported as
 * sent. Reject the write instead, so Effect raises SocketWriteError and the
 * transport's existing failure and reconnection handling runs. */
export const checkedSocket = (socket: WebSocket): WebSocket => {
  const send = socket.send.bind(socket)
  socket.send = (data) => {
    if (socket.readyState !== 1) {
      throw new DOMException("The socket is not open", "InvalidStateError")
    }
    send(data)
  }
  return socket
}

export const connectSocket = (url: string): WebSocket => checkedSocket(new WebSocket(url))
