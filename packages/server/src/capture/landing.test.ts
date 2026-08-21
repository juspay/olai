/**
 * Where a capture lands, as a value.
 *
 * The CONVENTION itself — which outline the inbox is, and what happens when
 * there is none — is held at the door that has been sending captures the
 * longest (`../edit.test.ts`'s palette section), because that is where a
 * reader looks for it and because those tests are about a gesture rather than
 * about this function's signature.
 *
 * What is held HERE is the half only the HTTP door exercises: a capture is a
 * whole {@link Capturing} rather than a line, and everything on it has to
 * reach the file through BOTH arms — the `add` into an inbox that exists and
 * the `create` that mints one. A field that survived one arm and not the other
 * would be a capture whose note vanished depending on whether the directory
 * had ever captured before, which is the least findable bug this door could
 * have.
 */

import { INBOX, mintedInto, type OutlineSet, type Reading } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { type Capturing, captureInto } from "./landing.ts"

const HOUSE = `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`

const reading = (set: OutlineSet): Reading => readingOf(set)

/** Everything a capture may carry, so neither assertion below is vacuous. */
const WHOLE: Capturing = {
  title: "the thread about cabinets",
  desc: "worth a reply\n\n<message://%3Cabc@mail%3E>",
  date: "2026-08-21T09:15:00-04:00",
  props: { from: "joinery@example.com", "message-id": "<abc@mail>" },
}

test("every field reaches the `add`, when the directory already has an inbox", () => {
  expect(captureInto(reading(setOf({ "house.olai": HOUSE, [INBOX]: "" })), WHOLE))
    .toEqual({ op: "add", file: INBOX, ...WHOLE })
})

test("…and the identical fields reach the seed of the inbox it mints", () => {
  // The same value, so the two arms cannot drift: a `create`'s seed IS an
  // `add`'s capture (`@olai/format`'s `writing.ts`), which is what makes one
  // resolution serve both.
  expect(captureInto(reading(setOf({ "house.olai": HOUSE })), WHOLE))
    .toEqual({ op: "create", file: mintedInto(INBOX), seed: WHOLE })
})

test("a bare line is still a bare line — nothing is filled in on the way", () => {
  // The palette sends exactly this, and a default invented here (a date, a
  // mark) would be a fact in somebody's file that no door asked for.
  expect(captureInto(reading(setOf({ "house.olai": HOUSE, [INBOX]: "" })), { title: "buy milk" }))
    .toEqual({ op: "add", file: INBOX, title: "buy milk" })
})
