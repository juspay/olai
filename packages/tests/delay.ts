/**
 * A LINK WITH DISTANCE IN IT — a TCP relay that holds every byte for a while.
 *
 * The instrument the second half of `transcript-stream-quadratic` needs. That
 * defect is not about bytes at all: a subscription whose transport ACKs each
 * frame sends the next one only after the ack comes back, so the cost of a
 * streamed answer is CHUNKS × ROUND TRIP and does not move when the link gets
 * fatter. Nothing about it is visible on a loopback socket, where a round trip
 * is a hundred microseconds — which is exactly why it shipped.
 *
 * So: a proxy in front of the server, with `DELAY` milliseconds added to every
 * byte in each direction. A round trip through it costs `2 × DELAY`, and the
 * numbers a driver reads on the other side are the numbers a reader in another
 * country gets. It is deliberately the crudest thing that is honest — a full
 * duplex pipe with a timer on each write, no bandwidth cap and no jitter,
 * because the finding is that bandwidth is not what is being spent.
 *
 * `wire.sh` stands one up when `DELAY` is set, and the driver is pointed at it
 * instead of at the server. Nothing else changes, which is the point: the same
 * session, the same counters, one property of the link.
 */
import { createServer, connect, type Socket } from "node:net"

/** One direction of one connection, with the delay applied per chunk.
 *
 *  Per CHUNK rather than per byte, and the difference matters for what this
 *  measures: a link's latency is paid once by a packet, not once by each byte
 *  in it, so delaying a 40-byte frame and a 40,000-byte frame by the same
 *  amount is the right model of a wire and the wrong model of a bandwidth cap.
 *  This measures the first. */
const pipe = (from: Socket, to: Socket, delay: number): void => {
  from.on("data", (chunk) => {
    setTimeout(() => {
      if (!to.destroyed) to.write(chunk)
    }, delay)
  })
  // The CLOSE is delayed too, or a stream still in flight is cut off by its own
  // socket ending ahead of the bytes it was carrying.
  from.on("end", () => {
    setTimeout(() => {
      if (!to.destroyed) to.end()
    }, delay)
  })
  from.on("error", () => {
    to.destroy()
  })
}

/** Listen on `port` and relay to `target`, adding `delay` ms each way.
 *  Answers with the port actually bound, so a caller may ask for 0. */
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
