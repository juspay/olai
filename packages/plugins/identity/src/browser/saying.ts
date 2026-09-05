/**
 * What the chip SAYS about a person: the display name the proxy sent with
 * the login beside it, or the login alone.
 *
 * Both, when there are both. The name is what a person recognises
 * themselves by and the login is which account this actually is — on a
 * shared vault that difference is the whole question, and a tooltip that
 * dropped either half would answer it wrong. On a GitHub-backed tailnet
 * the two are visibly different things ("Sridhar Ratnakumar" and
 * `srid@github`); on a Google one the name is often missing and the login
 * is the address.
 *
 * Its own file rather than a function inside {@link ./Who.tsx}: it is the
 * one thing about the chip that is a RULE rather than a drawing, and a
 * rule is worth a test that does not need a browser.
 */

import type { Who } from "@olai/surface"

export const saying = (person: Who): string =>
  person.name === null || person.name === person.login
    ? person.login
    : `${person.name} (${person.login})`
