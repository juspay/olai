/**
 * ONE DECIDER FOR A DEAD STANDARD LINK.
 *
 * What an agent is told a record's dead links are (`@olai/format`'s
 * `deadLinksIn`) and what the page draws a dead link as (`./links.ts`) are the
 * same question asked of one rule, `standardLanding`. So the two are held to
 * each other here over a house and a garden: the same text, the same files
 * served, and the links the page marks dead must be the links the reading
 * reports, as written.
 */
import { deadLinksIn, namesOf } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { read } from "@olai/prose/read.ts"
import { expect, test } from "bun:test"

import { installPipeline } from "../chunk.ts"
import * as pipeline from "../pipeline.ts"
import { renderMarkdown } from "../render.ts"

installPipeline(pipeline)

/** The garden's note, which is where every link below is written. */
const FROM = "garden/beds.md"

/** A directory holding the house, the beds and a photograph of the shed. */
const NAMES = namesOf(TEST_CLAIMS, ["house.md", "garden/beds.md", "garden/shed.png"])

/** Two links that find nothing, and five that are not dead for five different
 *  reasons: a file that is served, one with a fragment, a picture, a row of
 *  the writer's own outline, and the web. */
const SOURCE = [
  "[the house](../house.md)",
  "[the rows](beds.md#rows)",
  "![the shed](shed.png)",
  "[the pond](pond.md)",
  "[the gate](../garden%20gate.md)",
  "[this row](#olai-row-1)",
  "[a catalogue](https://example.com/pond.md)",
].join("\n\n")

/** Each link the page drew dead, by the href it was written with. */
const drawnDead = (html: string): ReadonlyArray<string> =>
  [...html.matchAll(/<a\b[^>]*>/g)]
    .filter((tag) => tag[0].includes('data-dead="true"'))
    .map((tag) => /data-link-written="([^"]*)"/.exec(tag[0])?.[1] ?? "")
    .sort()

test("a link is drawn dead exactly when the reading calls it dead", () => {
  const drawn = drawnDead(renderMarkdown(TEST_CLAIMS, SOURCE, FROM, NAMES))
  const held = deadLinksIn(NAMES, FROM, [read(SOURCE)]).map((link) => link.written).sort()
  expect(drawn).toEqual(["../garden%20gate.md", "pond.md"])
  expect(drawn).toEqual([...held])
})

test("a directory nobody has yet judges nothing", () => {
  expect(drawnDead(renderMarkdown(TEST_CLAIMS, SOURCE, FROM))).toEqual([])
  expect(drawnDead(renderMarkdown(undefined, SOURCE, FROM, NAMES))).toEqual([])
})

test("every link heals when the files it looks for arrive", () => {
  const whole = namesOf(TEST_CLAIMS, [...NAMES.served, "garden/pond.md", "garden gate.md"])
  expect(drawnDead(renderMarkdown(TEST_CLAIMS, SOURCE, FROM, whole))).toEqual([])
  expect(deadLinksIn(whole, FROM, [read(SOURCE)])).toEqual([])
})
