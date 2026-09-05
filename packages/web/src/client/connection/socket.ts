/** Chromium silently drops sends on a closing socket and prints a console
 * error. During a roster reconnect, a departing subscription can still write
 * before the close event reaches Effect's socket latch. Reject that write so
 * Effect turns it into SocketWriteError and the transport's existing failure
 * and reconnection handling runs; never report a dropped payload as sent. */
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
