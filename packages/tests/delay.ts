import { createServer, connect, type Socket } from "node:net"

const pipe = (from: Socket, to: Socket, delay: number): void => {
  from.on("data", (chunk) => {
    setTimeout(() => {
      if (!to.destroyed) to.write(chunk)
    }, delay)
  })
  from.on("end", () => {
    setTimeout(() => {
      if (!to.destroyed) to.end()
    }, delay)
  })
  from.on("error", () => {
    to.destroy()
  })
}

export const delayed = (
  target: { readonly host: string; readonly port: number },
  delay: number,
  port = 0,
): Promise<{ readonly port: number; readonly close: () => void }> =>
  new Promise((bound) => {
    const server = createServer((inbound) => {
      const outbound = connect(target.port, target.host)
      // BOTH PIPES WIRED AT ONCE, before the far end has connected — a write
      // made on a connecting socket is queued by the runtime, and waiting for
      // `connect` before listening to the inbound one loses the request that
      // was already on it. (Node holds a socket paused until something listens
      // for `data`; Bun does not, so the deferred version dropped the first
      // bytes of every connection and the page never loaded.)
      pipe(inbound, outbound, delay)
      pipe(outbound, inbound, delay)
      outbound.on("error", () => {
        inbound.destroy()
      })
    })
    server.listen(port, "127.0.0.1", () => {
      const address = server.address()
      bound({
        port: typeof address === "object" && address !== null ? address.port : port,
        close: () => {
          server.close()
        },
      })
    })
  })
