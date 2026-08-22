/**
 * The reverse proxy the identity scenarios sit behind: it stamps the
 * headers a real proxy would, including on the websocket upgrade —
 * Playwright cannot. A client-supplied copy of an injected name is
 * dropped, the way `tailscale serve` strips rather than appends.
 */

import { expect, test } from "bun:test"
import * as http from "node:http"
import * as net from "node:net"

import { listenHeaderProxy } from "./support/headerProxy.ts"

const backend = (): Promise<{ url: string; close: () => Promise<void> }> =>
  new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" })
      res.end("ok")
    })
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        reject(new Error("backend bound no port"))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done, fail) =>
            server.close((cause) => (cause ? fail(cause) : done())),
          ),
      })
    })
  })

test("a plain GET through the proxy is still a GET", async () => {
  const up = await backend()
  const proxy = await listenHeaderProxy(up.url, () => ({}))
  try {
    const answer = await fetch(proxy.url)
    expect(answer.status).toBe(200)
    expect(await answer.text()).toBe("ok")
  } finally {
    await proxy.close()
    await up.close()
  }
})

test("an injected header replaces a client copy on HTTP", async () => {
  const seen: string[] = []
  const up = await new Promise<{ url: string; close: () => Promise<void> }>(
    (resolve, reject) => {
      const server = http.createServer((req, res) => {
        const value = req.headers["tailscale-user-login"]
        seen.push(
          Array.isArray(value) ? value.join(",") : (value ?? ""),
        )
        res.writeHead(200)
        res.end()
      })
      server.on("error", reject)
      server.listen(0, "127.0.0.1", () => {
        const address = server.address()
        if (address === null || typeof address === "string") {
          reject(new Error("backend bound no port"))
          return
        }
        resolve({
          url: `http://127.0.0.1:${address.port}`,
          close: () =>
            new Promise<void>((done, fail) =>
              server.close((cause) => (cause ? fail(cause) : done())),
            ),
        })
      })
    },
  )
  const proxy = await listenHeaderProxy(up.url, () => ({
    "Tailscale-User-Login": "ada",
  }))
  try {
    await fetch(proxy.url, {
      headers: { "Tailscale-User-Login": "attacker" },
    })
    expect(seen).toEqual(["ada"])
  } finally {
    await proxy.close()
    await up.close()
  }
})

test("an injected header replaces a client copy on upgrade", async () => {
  const seen = Promise.withResolvers<string[]>()
  const up = await new Promise<{ url: string; close: () => Promise<void> }>(
    (resolve, reject) => {
      const server = net.createServer((socket) => {
        const chunks: Buffer[] = []
        const onData = (chunk: Buffer) => {
          chunks.push(chunk)
          const buf = Buffer.concat(chunks)
          const idx = buf.indexOf("\r\n\r\n")
          if (idx < 0) return
          socket.removeListener("data", onData)
          const values = buf
            .subarray(0, idx)
            .toString("utf8")
            .split("\r\n")
            .filter((line) =>
              line.toLowerCase().startsWith("tailscale-user-login:"),
            )
            .map((line) => line.slice(line.indexOf(":") + 1).trim())
          seen.resolve(values)
          socket.end("HTTP/1.1 101 Switching Protocols\r\n\r\n")
        }
        socket.on("data", onData)
      })
      server.on("error", reject)
      server.listen(0, "127.0.0.1", () => {
        const address = server.address()
        if (address === null || typeof address === "string") {
          reject(new Error("backend bound no port"))
          return
        }
        resolve({
          url: `http://127.0.0.1:${address.port}`,
          close: () =>
            new Promise<void>((done, fail) =>
              server.close((cause) => (cause ? fail(cause) : done())),
            ),
        })
      })
    },
  )
  const proxy = await listenHeaderProxy(up.url, () => ({
    "Tailscale-User-Login": "ada",
  }))
  const client = net.connect(Number(new URL(proxy.url).port), "127.0.0.1")
  try {
    client.write(
      [
        "GET / HTTP/1.1",
        "Host: 127.0.0.1",
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Version: 13",
        "Tailscale-User-Login: attacker",
        "",
        "",
      ].join("\r\n"),
    )
    expect(await seen.promise).toEqual(["ada"])
  } finally {
    client.destroy()
    await proxy.close()
    await up.close()
  }
})
