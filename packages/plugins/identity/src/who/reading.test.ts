import { expect, test } from "bun:test"

import { DEFAULT_IDENTITY_CONFIG, type IdentityConfig } from "./config.ts"
import { gravatarOf } from "./gravatar.ts"
import { shown, whoOf } from "./reading.ts"

const ADA = "ada@example.com"
const GITHUB = "https://github.com/{login}.png"

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
