/**
 * The reverse proxy the identity scenarios sit behind: it stamps the
 * headers a real proxy would, including on the websocket upgrade —
 * Playwright cannot.
 */

import { expect, test } from "bun:test"
import * as http from "node:http"

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
