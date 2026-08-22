/**
 * The app page's image policy admits a person's picture, by SCHEME.
 *
 * The chip's picture is a remote `<img>`, and #330's three gravatar
 * origins were the whole list only while gravatar was the only rung. It is
 * not any more: a proxy's IdP avatar host, an operator's avatar template
 * and gravatar are three different hosts, and none of them is known when
 * this file is written — `https://github.com/{login}.png` is not even the
 * host the picture finally comes from, since GitHub redirects it to
 * `avatars.githubusercontent.com`, which a per-origin policy would refuse
 * mid-flight.
 *
 * So the policy names `https:` and keeps its shape: this vault, a `blob:`
 * the chat's thumbnails already are, and no wildcard — `http:` and `data:`
 * are still refused, and the `src` can only ever be what the server's own
 * `GET /olai/who` answered. A `default-src` is deliberately absent: the
 * inline theme script in this same file would be the first casualty.
 * Sealed `/media` pages carry a stricter policy on the RESPONSE and do not
 * inherit this.
 */

import { expect, test } from "bun:test"

const shell = (): Promise<string> =>
  Bun.file(new URL("../index.html", import.meta.url)).text()

const policyOf = async (): Promise<string | undefined> =>
  /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(
    await shell(),
  )?.[1]

test("the shell admits https images — the picture's host is the operator's", async () => {
  const policy = await policyOf()
  expect(policy).toBeDefined()
  expect(policy).toContain("img-src")
  expect(policy).toContain("https:")
  expect(policy).toContain("'self'")
  expect(policy).toContain("blob:")
})

test("it is a policy, not a hole — the whole list, in the open", async () => {
  const policy = await policyOf()
  expect((policy ?? "").split(/\s+/)).toEqual([
    "img-src",
    "'self'",
    "blob:",
    "https:",
  ])
})
