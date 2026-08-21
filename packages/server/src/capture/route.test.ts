/**
 * `POST /capture` on a real listener.
 *
 * The DOOR, end to end: a request goes over a socket to a server serving a real
 * directory, and what is asserted is the file on disk afterwards. That is
 * deliberately the whole shape — the resolution is `./landing.test.ts`'s, what
 * an `add` does to records is `@olai/ops`' own suite, and neither is worth a
 * second opinion here. What only this file can say is that a capture arriving
 * over HTTP lands, dated and attributed, in the inbox the directory has or the
 * one this write mints — and that every way of refusing one refuses without
 * writing a byte.
 */

import { datedOn, fileKind, INBOX, mintedInto } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import { CAPTURE_PATH, CAPTURED_BY, IDENTITY_HEADER } from "./route.ts"
import { served, withServing } from "../serve.testlib.ts"

const BOUND_MS = 10_000

const LOGIN = "srid@example.com"

/** A capture, as a client sends one. The header is what makes it one; a call
 *  passing `identity: null` is the request that has not got it. */
const capturing = (
  url: string,
  body: unknown,
  options: { readonly identity?: string | null; readonly raw?: string } = {},
): Promise<Response> => {
  const identity = options.identity === undefined ? LOGIN : options.identity
  return fetch(`${url}${CAPTURE_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(identity === null ? {} : { [IDENTITY_HEADER]: identity }),
    },
    body: options.raw ?? JSON.stringify(body),
  })
}

/** Every outline the served directory holds now, as text. Read off the DISK
 *  rather than asked of the server, because "the write landed" is a claim
 *  about the files — and through `fileKind` rather than a suffix spelled here,
 *  which is the registry's own rule and which `@olai/tests`' sweep enforces. */
const outlinesIn = (root: string): Record<string, string> => {
  const found: Record<string, string> = {}
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (fileKind(entry.name) === "outline") {
        found[path.relative(root, full)] = fs.readFileSync(full, "utf8")
      }
    }
  }
  walk(root)
  return found
}

/** The one record a capture wrote, whichever file it went into. */
const captured = (root: string): Record<string, unknown> => {
  const lines = Object.values(outlinesIn(root))
    .flatMap((text) => text.split("\n"))
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((node) => node["id"] !== "a")
  expect(lines).toHaveLength(1)
  return lines[0] as Record<string, unknown>
}

test("a capture lands in a minted inbox, dated and attributed", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const answered = await capturing(url, {
      title: "the thread about cabinets",
      text: "worth a reply",
      url: "message://%3Cabc123@mail.example%3E",
      props: { from: "joinery@example.com", "message-id": "<abc123@mail.example>" },
    })
    expect(answered.status).toBe(201)

    const reply = await answered.json() as Record<string, unknown>
    // The directory had never captured, so this write MINTED the inbox — the
    // convention's own answer, not a path this door spells.
    expect(reply["file"]).toBe(mintedInto(INBOX))
    expect(reply["title"]).toBe("the thread about cabinets")
    expect(typeof reply["id"]).toBe("string")

    const node = captured(root)
    expect(node["id"]).toBe(reply["id"])
    expect(node["title"]).toBe("the thread about cabinets")
    // The comment, then the pointer, as its own paragraph — a markdown
    // autolink, because GFM would not have linked this scheme by itself.
    expect(node["desc"]).toBe("worth a reply\n\n<message://%3Cabc123@mail.example%3E>")
    // The client's facts, plus the one the header supplies and no client may.
    expect(node["custom"]).toEqual({
      [CAPTURED_BY]: LOGIN,
      from: "joinery@example.com",
      "message-id": "<abc123@mail.example>",
    })

    // DATED, and that is the half a share sheet needs: what arrived while
    // nobody was looking is on the day's journal page as well as in the inbox.
    // Asserted through the derivation the page itself reads, rather than by
    // matching the string this door wrote.
    const day = String(node["date"]).slice(0, 10)
    const set = setOf(outlinesIn(root))
    expect(
      datedOn(readingOf(set).derived, day)
        .flatMap((group) => group.nodes.map((entry) => entry.shows.node.id)),
    ).toContain(reply["id"] as string)
  })
}, BOUND_MS)

test("…and into the inbox the directory already keeps, wherever that is", async () => {
  const root = served()
  fs.mkdirSync(path.join(root, "notes"), { recursive: true })
  fs.writeFileSync(path.join(root, "notes/inbox.olai"), "")
  await withServing({ root }, async (url) => {
    const answered = await capturing(url, { title: "buy milk" })
    expect(answered.status).toBe(201)
    expect((await answered.json() as Record<string, unknown>)["file"]).toBe("notes/inbox.olai")
    // Nothing was minted beside it.
    expect(Object.keys(outlinesIn(root)).sort()).toEqual(["a.olai", "notes/inbox.olai"])
  })
}, BOUND_MS)

test("a capture with only a title is a bare line — no note at all", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    expect((await capturing(url, { title: "buy milk" })).status).toBe(201)
    const node = captured(root)
    expect(node["desc"]).toBeUndefined()
    // A `url` and no text is the share sheet's other shape, and the note is
    // then the link alone rather than a blank line above it.
  })
}, BOUND_MS)

test("a URL with no comment is a note that is just the link", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    expect((await capturing(url, { title: "a page", url: "https://example.com/a" })).status)
      .toBe(201)
    expect(captured(root)["desc"]).toBe("<https://example.com/a>")
  })
}, BOUND_MS)

// ── the refusals ───────────────────────────────────────────────────────

/**
 * ONE SHAPE for every way of saying no.
 *
 * A client should not have to work out which check produced an answer: a
 * missing header, a body that is not JSON, a field this door does not declare
 * and a title the ops layer would not take are all "this did not become a
 * node". So each is `{error, kind}` under the status that says what to do
 * about it, and this helper is what every refusal below reads through — a
 * refusal that came back as `text/plain` would fail at the `json()`.
 */
const refusal = async (answered: Response): Promise<{ error: string; kind: string }> => {
  const said = await answered.json() as Record<string, unknown>
  expect([typeof said["error"], typeof said["kind"]]).toEqual(["string", "string"])
  return { error: String(said["error"]), kind: String(said["kind"]) }
}

test("a request with no identity header is refused, and writes nothing", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const answered = await capturing(url, { title: "buy milk" }, { identity: null })
    expect(answered.status).toBe(401)
    expect((await refusal(answered)).error).toContain(IDENTITY_HEADER)
    // A blank one is the same refusal: a header set to nothing is a header
    // that attributes nothing.
    expect((await capturing(url, { title: "buy milk" }, { identity: "   " })).status).toBe(401)
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  })
}, BOUND_MS)

test("an empty capture is refused in the ops layer's own words", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const answered = await capturing(url, { title: "   " })
    expect(answered.status).toBe(400)
    const said = await refusal(answered)
    expect(said.kind).toBe("usage")
    // Not a sentence this door invented: it is what an agent's `add_node` is
    // told, which is what keeps one refusal from having two wordings.
    expect(said.error).toContain("title")
    // …and the inbox this capture would have minted was not left behind.
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  })
}, BOUND_MS)

test("a body that is not JSON, and a field this door does not take", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const torn = await capturing(url, null, { raw: "not json" })
    expect(torn.status).toBe(400)
    expect((await refusal(torn)).error).toContain("JSON")
    // A client that sends `body` for `text` is TOLD, rather than having half
    // its capture silently dropped by a struct that ignores what it does not
    // declare.
    const excess = await capturing(url, { title: "x", body: "the note" })
    expect(excess.status).toBe(400)
    expect((await refusal(excess)).error).toContain("body")
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  })
}, BOUND_MS)

test("a client may not say who captured this", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    // Refused rather than quietly overruled: a capture answered `201` after
    // its attribution was rewritten is a client told it was recorded as sent.
    const answered = await capturing(url, {
      title: "x",
      props: { [CAPTURED_BY]: "someone@else" },
    })
    expect(answered.status).toBe(400)
    const said = await refusal(answered)
    expect(said.kind).toBe("usage")
    expect(said.error).toContain(CAPTURED_BY)
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  })
}, BOUND_MS)

test("a GET is answered as the wrong method, not as the app", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const answered = await fetch(`${url}${CAPTURE_PATH}`)
    expect(answered.status).toBe(405)
    // The point of the arm: the shell's `GET /*` would have handed a person
    // reaching for `curl` a page of HTML and no explanation — and it is the
    // same shape as every other refusal, not a third thing to parse.
    expect((await refusal(answered)).error).toContain(IDENTITY_HEADER)
  })
}, BOUND_MS)
