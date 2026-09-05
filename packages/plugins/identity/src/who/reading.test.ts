/**
 * The whole reading, as a function: headers and a deployment in, a person
 * or nobody out.
 *
 * The two folds under it are pinned on their own ({@link ./identity.test.ts}
 * is the parse, {@link ./picture.test.ts} the ladder); what this file is
 * about is the JOIN — that what the door hands over is the picture the
 * ladder RESOLVED rather than a rule for resolving one, because everything
 * downstream of it (a chip in a browser, `GET /olai/who`, a capture's
 * attribution) is a reader that must not be able to answer differently.
 *
 * It was `@olai/server`'s, next to the HTTP doors, while core held the
 * mapping. It is here because the mapping is this row's.
 */

import { expect, test } from "bun:test"

import { DEFAULT_IDENTITY_CONFIG, type IdentityConfig } from "./config.ts"
import { gravatarOf } from "./gravatar.ts"
import { shown, whoOf } from "./reading.ts"

const ADA = "ada@example.com"
const GITHUB = "https://github.com/{login}.png"

/** An Authelia-shaped serve, which sends no picture of its own. */
const authelia: IdentityConfig = {
  headers: {
    login: "Remote-User",
    email: "Remote-Email",
    name: "Remote-Name",
    picture: null,
  },
  avatarTemplate: null,
}

test("the door hands over the picture the ladder resolved, not a rule", () => {
  const srid = { login: "srid@github", email: "srid@github", name: null }
  expect(shown({ ...srid, picture: null }, null)).toEqual({
    login: "srid@github",
    name: null,
    // The motivating case: a GitHub-backed tailnet's login is not an
    // address, so there is no gravatar to hash and no picture to draw.
    picture: null,
  })
  expect(shown({ ...srid, picture: null }, GITHUB).picture).toBe(
    "https://github.com/srid%40github.png",
  )
  expect(
    shown({ ...srid, picture: "https://avatars.example/srid.png" }, GITHUB)
      .picture,
  ).toBe("https://avatars.example/srid.png")
  expect(
    shown({ login: ADA, email: ADA, name: "Ada", picture: null }, null),
  ).toEqual({ login: ADA, name: "Ada", picture: gravatarOf(ADA) })
})

test("a request with no login is nobody, whatever else it carried", () => {
  expect(whoOf({}, DEFAULT_IDENTITY_CONFIG)).toBeNull()
  // A name and a picture without a login are claims about nobody: the login
  // is what makes somebody present, and nothing here invents one.
  expect(
    whoOf(
      {
        "tailscale-user-name": "Ada Lovelace",
        "tailscale-user-profile-pic": "https://avatars.example/ada.png",
      },
      DEFAULT_IDENTITY_CONFIG,
    ),
  ).toBeNull()
})

test("the headers a deployment trusts are the ones it reads", () => {
  // The same request, read by two deployments: the one configured for these
  // names finds a person, and the Tailscale-shaped one finds nobody. That is
  // the whole of what an operator's config decides.
  const request = {
    "remote-user": "ada",
    "remote-email": ADA,
    "remote-name": "Ada Lovelace",
  }
  expect(whoOf(request, authelia)).toEqual({
    login: "ada",
    name: "Ada Lovelace",
    picture: gravatarOf(ADA),
  })
  expect(whoOf(request, DEFAULT_IDENTITY_CONFIG)).toBeNull()
})
