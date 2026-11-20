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
