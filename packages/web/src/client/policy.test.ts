/**
 * The app page's image policy admits a person's picture, by SCHEME.
 *
 * IT STAYS IN THE SHELL though the chip left it: `index.html` is this
 * package's file, and a policy is a claim about the PAGE rather than about
 * whoever draws into it. What the identity row owns is the ladder that
 * decides which host a `src` comes from (`packages/plugins/identity/`);
 * what this file holds is that the page will fetch one at all — and it has
 * to go on holding it for a serve that composes no identity row today and
 * one tomorrow, since a policy is baked into the shell at build time and a
 * roster is not.
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
 * are still refused, and the `src` can only ever be what the server
 * answered (`who.get` on the upgrade, `GET /olai/who` for a door with no
 * websocket). A `default-src` is deliberately absent: the
 * inline theme script in this same file would be the first casualty.
 * Sealed `/media` pages carry a stricter policy on the RESPONSE and do not
 * inherit this.
 *
 * What a DOCUMENT may draw is not this line's business and did not move:
 * `markdown/rewrite.ts` resolves every picture through `@olai/format`'s
 * `pictureOf` and draws nothing at all for a remote `src` — a note cannot
 * tell a third party what someone is reading whatever `img-src` says — and
 * `markdown/render.test.ts` holds that.
 */

import { expect, test } from "bun:test"

const shell = (): Promise<string> =>
  Bun.file(new URL("./index.html", import.meta.url)).text()

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
