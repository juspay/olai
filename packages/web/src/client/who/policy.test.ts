/**
 * The app page's image policy admits gravatar, and only that origin.
 *
 * The chip's picture is a remote `<img>`. The shell states `img-src` for
 * that origin (plus this vault, and a `blob:` the chat's thumbnails already
 * are). A `default-src` is deliberately absent: the inline theme script
 * in this same file would be the first casualty. Sealed `/media` pages
 * carry a stricter policy on the RESPONSE and do not inherit this.
 */

import { expect, test } from "bun:test"

const shell = (): Promise<string> =>
  Bun.file(new URL("../index.html", import.meta.url)).text()

test("the shell admits gravatar images, and only that origin", async () => {
  const html = await shell()
  const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(
    html,
  )?.[1]
  expect(policy).toBeDefined()
  expect(policy).toContain("img-src")
  expect(policy).toContain("https://www.gravatar.com")
  expect(policy).toContain("'self'")
  expect(policy).toContain("blob:")
  expect(policy).not.toContain("img-src *")
  expect(policy).not.toContain("default-src")
})
