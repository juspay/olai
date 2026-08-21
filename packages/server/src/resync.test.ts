/**
 * `POST /olai/resync` on a real listener. The store-side claim (same-length
 * rewrite, refresh misses, resync publishes) is `@olai/store`'s; this file
 * is the door: loopback POST returns 204, and a GET is not that door.
 */

import { expect, test } from "bun:test"

import { served, withServing } from "./serve.testlib.ts"
import { RESYNC_PATH } from "./resync.ts"

const BOUND_MS = 10_000

test("POST /olai/resync returns 204, and a GET is not that answer", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const posted = await fetch(`${url}${RESYNC_PATH}`, { method: "POST" })
    expect(posted.status).toBe(204)
    const got = await fetch(`${url}${RESYNC_PATH}`)
    expect(got.status).not.toBe(204)
  })
}, BOUND_MS)
