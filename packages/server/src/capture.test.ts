/**
 * `POST /capture` on a real listener.
 *
 * The DOOR, end to end: a request goes over a socket to a server serving a real
 * directory, and what is asserted is the file on disk afterwards. That is
 * deliberately the whole shape — which file a capture lands in is
 * `@olai/format`'s `inbox.test.ts` and `./edit.test.ts`, what an `add` does to
 * records is `@olai/ops`' own suite, and neither is worth a second opinion here.
 * What only this file can say is that a capture arriving over HTTP lands, dated
 * and attributed, in the inbox the directory has or the one this write mints —
 * and that every way of refusing one refuses without writing a byte.
 */

import { customOf, fileKind, INBOX, datedOn, mintedInto } from "@olai/format"
import { readingOf, recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import { CAPTURE_PATH, CAPTURED_BY, IDENTITY_HEADER } from "./capture.ts"
import { served, withServing } from "./serve.testlib.ts"

const BOUND_MS = 10_000

const LOGIN = "srid@example.com"

/**
 * A server over a fresh directory, for the length of one test — the three lines
 * every case below opened with.
 *
 * `serve.testlib.ts` deliberately stops short of the DEADLINE (each test owns
 * how long it will wait), so that stays on the `test` call; what is folded here
 * is only the frame: a directory, a server, and the two things a body of this
 * file's tests always wants — where to POST, and where to read the files back.
 */
const inServed = (
  body: (url: string, root: string) => Promise<void>,
) =>
async () => {
  const root = served()
  await withServing({ root }, (url) => body(url, root))
}

/** A capture, as a client sends one. The header is what makes it one; a call
 *  passing `identity: null` is the request that has not got it, and `headers`
 *  is what the CSRF cases below replace or take away. */
const capturing = (
  url: string,
  body: unknown,
  options: {
    readonly identity?: string | null
    readonly raw?: string
    /** Merged over the defaults; a key set to `null` is REMOVED, which is how
     *  "no content type at all" is spelled. */
    readonly headers?: Readonly<Record<string, string | null>>
  } = {},
): Promise<Response> => {
  const identity = options.identity === undefined ? LOGIN : options.identity
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(identity === null ? {} : { [IDENTITY_HEADER]: identity }),
  }
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (value === null) delete headers[name]
    else headers[name] = value
  }
  return fetch(`${url}${CAPTURE_PATH}`, {
    method: "POST",
    headers,
    body: options.raw ?? JSON.stringify(body),
  })
}

/** Every outline the served directory holds now, as text. Read off the DISK
 *  rather than asked of the server, because "the write landed" is a claim about
 *  the files — and through `fileKind` rather than a suffix spelled here, which
 *  is the registry's own rule and which `@olai/tests`' sweep enforces. */
const outlinesIn = (root: string): Record<string, string> =>
  Object.fromEntries(
    fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && fileKind(entry.name) === "outline")
      .map((entry) => {
        const full = path.join(entry.parentPath, entry.name)
        return [path.relative(root, full), fs.readFileSync(full, "utf8")]
      }),
  )

/** The one record a capture wrote, whichever file it went into — parsed through
 *  the format's own reader (`setOf` → `recordsOf`) rather than a second JSONL
 *  path, so a line this door wrote badly is a fixture diagnostic and not a raw
 *  `JSON.parse` throw. `a` is the fixture's own node (`served()`). */
const captured = (root: string) => {
  const records = recordsOf(setOf(outlinesIn(root))).filter((one) => one.node.id !== "a")
  expect(records).toHaveLength(1)
  const only = records[0]
  if (only === undefined || "mirror" in only.node) {
    throw new Error("a capture wrote a placement, which no arm of this door can do")
  }
  return only.node
}

test(
  "a capture lands in a minted inbox, dated and attributed",
  inServed(async (url, root) => {
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
    expect(node.id).toBe(String(reply["id"]))
    expect(node.title).toBe("the thread about cabinets")
    // The comment, then the pointer, as its own paragraph — a markdown
    // autolink, because GFM would not have linked this scheme by itself.
    expect(node.desc ?? "").toBe("worth a reply\n\n<message://%3Cabc123@mail.example%3E>")
    // The client's facts, plus the one the header supplies and no client may.
    expect(customOf(node)).toEqual({
      [CAPTURED_BY]: LOGIN,
      from: "joinery@example.com",
      "message-id": "<abc123@mail.example>",
    })

    // DATED, and that is the half a share sheet needs: what arrived while
    // nobody was looking is on the day's journal page as well as in the inbox.
    // Asserted through the derivation the page itself reads, rather than by
    // matching the string this door wrote.
    const day = String(node.date).slice(0, 10)
    expect(
      datedOn(readingOf(setOf(outlinesIn(root))).derived, day)
        .flatMap((group) => group.nodes.map((entry) => entry.shows.node.id)),
    ).toContain(reply["id"] as string)
  }),
  BOUND_MS,
)

test(
  "…and into the inbox the directory already keeps, wherever that is",
  inServed(async (url, root) => {
    fs.mkdirSync(path.join(root, "notes"), { recursive: true })
    fs.writeFileSync(path.join(root, "notes/inbox.olai"), "")
    // The server has to see the file before the write is judged against it.
    await Bun.sleep(300)

    const answered = await capturing(url, { title: "buy milk" })
    expect(answered.status).toBe(201)
    expect((await answered.json() as Record<string, unknown>)["file"]).toBe("notes/inbox.olai")
    // Nothing was minted beside it.
    expect(Object.keys(outlinesIn(root)).sort()).toEqual(["a.olai", "notes/inbox.olai"])
  }),
  BOUND_MS,
)

test(
  "the note is the text, the link, or both — and nothing when neither",
  inServed(async (url, root) => {
    // The three shapes `noteOf` has, on one server: a `url` and no comment is
    // the share sheet's own case, and a bare line is the palette's.
    for (
      const [posted, note] of [
        [{ title: "a page", url: "https://example.com/a" }, "<https://example.com/a>"],
        [{ title: "a thought", text: "just this" }, "just this"],
        [{ title: "buy milk" }, undefined],
      ] as const
    ) {
      expect((await capturing(url, posted)).status).toBe(201)
      const written = recordsOf(setOf(outlinesIn(root)))
        .map((one) => one.node)
        .find((one) => !("mirror" in one) && one.title === posted.title)
      const desc = written === undefined || "mirror" in written ? undefined : written.desc
      expect([posted.title, desc]).toEqual([posted.title, note])
    }
  }),
  BOUND_MS,
)

/**
 * THE ADDRESS SURVIVES BEING PUT IN A LINK — the review finding, as the case
 * that produced it.
 *
 * A `Message-Id` is conventionally written in angle brackets, and the Mail
 * recipe's own prose says `message://<Message-Id>`. Those are the characters a
 * markdown autolink is DELIMITED by, so the pointer used to close the link at
 * its first `<` — and what reached the page was not a broken link but a wrong
 * one: the remains parsed as a GFM email autolink and drew
 * `mailto:abc@mail.example`, a live link composing a new message to an address
 * nobody has.
 */
test(
  "an address a URI may not carry is encoded, and one already encoded is not",
  inServed(async (url, root) => {
    for (
      const [sent, held] of [
        // The spelling the docs use, and the bug.
        ["message://<abc@mail.example>", "message://%3Cabc@mail.example%3E"],
        // …and the spelling a careful client already writes, NOT encoded a
        // second time: `%` is deliberately left alone.
        ["message://%3Cabc@mail.example%3E", "message://%3Cabc@mail.example%3E"],
        // A space is illegal in a URI too, and truncated the link before.
        ["https://example.com/a b", "https://example.com/a%20b"],
        // Everything legal survives byte for byte, so a client can compare what
        // it sent with what came back.
        ["https://example.com/a?x=1&y=2#z", "https://example.com/a?x=1&y=2#z"],
      ] as const
    ) {
      expect((await capturing(url, { title: sent, url: sent })).status).toBe(201)
      const written = recordsOf(setOf(outlinesIn(root)))
        .map((one) => one.node)
        .find((one) => !("mirror" in one) && one.title === sent)
      const desc = written === undefined || "mirror" in written ? undefined : written.desc
      expect([sent, desc]).toEqual([sent, `<${held}>`])
    }
  }),
  BOUND_MS,
)

/**
 * CONCURRENT FIRST CAPTURES all land — the second review finding, as the case
 * that produced it.
 *
 * `captureInto` picks `create` for a directory with no inbox, and the ops layer
 * re-plans the request it was handed rather than re-making that choice. So
 * before the door resolved a second time, three simultaneous captures into a
 * fresh directory answered 201, 400, 400 — and the two refusals told a `curl`
 * client to use `add_node`, a tool it has no way to reach.
 *
 * SIX rather than two, because one loser proves less than a handful: the arm
 * this exercises is the one taken by every request that read the set before the
 * winner published.
 */
test(
  "several captures at once into a directory with no inbox all land",
  inServed(async (url, root) => {
    const many = [1, 2, 3, 4, 5, 6]
    const answered = await Promise.all(
      many.map((n) => capturing(url, { title: `race ${n}` })),
    )
    expect(answered.map((one) => one.status)).toEqual(many.map(() => 201))
    // …in ONE inbox, which is the other half: the file is minted once and every
    // later capture is an `add` into it.
    expect(Object.keys(outlinesIn(root)).sort()).toEqual(["_olai/Inbox.olai", "a.olai"])
    expect(
      recordsOf(setOf(outlinesIn(root)))
        .map((one) => one.node)
        .filter((one) => !("mirror" in one) && one.title.startsWith("race ")),
    ).toHaveLength(many.length)
  }),
  BOUND_MS,
)

// ── the refusals ───────────────────────────────────────────────────────

/**
 * ONE SHAPE for every way of saying no.
 *
 * A client should not have to work out which check produced an answer: a
 * missing header, a body that is not JSON, a field this door does not declare
 * and a title the ops layer would not take are all "this did not become a
 * node". So each is `{error, kind}` under the status that says what to do about
 * it, and this helper is what every refusal below reads through — a refusal
 * that came back as `text/plain` would fail at the `json()`.
 */
const refusal = async (answered: Response): Promise<{ error: string; kind: string }> => {
  const said = await answered.json() as Record<string, unknown>
  expect([typeof said["error"], typeof said["kind"]]).toEqual(["string", "string"])
  return { error: String(said["error"]), kind: String(said["kind"]) }
}

/**
 * A BROWSER CANNOT BE CONSCRIPTED INTO CAPTURING — the blocking review finding,
 * as the deployment it is actually about.
 *
 * The identity header is NOT a CSRF gate behind `tailscale serve`: the proxy
 * strips a client's copy and injects its own, so a page on another origin does
 * not need to name it. Every request below therefore CARRIES a valid identity,
 * exactly as the proxy would have supplied it — which is what makes this a test
 * of the door rather than of the header, and what the original loopback
 * evidence could not see.
 *
 * What refuses them is the CONTENT TYPE. `application/json` is not
 * CORS-safelisted, so a cross-origin `fetch` that sends it must preflight, and
 * the preflight is answered 404 with no `Access-Control-Allow-*`. The three
 * types a browser WILL send without one — and the absence of the header
 * entirely — are refused before the body is read.
 */
test(
  "a request a browser could make without a preflight writes nothing",
  inServed(async (url, root) => {
    for (
      const said of [
        // The exploit, verbatim: `fetch` with a JSON body and a safelisted type.
        "text/plain;charset=UTF-8",
        "text/plain",
        // The two a `<form>` can post.
        "application/x-www-form-urlencoded",
        "multipart/form-data; boundary=x",
        // Close enough to look right, and not the type this door reads.
        "application/json-patch+json",
        "text/json",
      ]
    ) {
      const answered = await capturing(url, { title: "pwned from evil.example" }, {
        headers: { "content-type": said },
      })
      expect([said, answered.status]).toEqual([said, 415])
      expect([said, (await refusal(answered)).kind]).toEqual([said, "usage"])
    }
    // …and no content type at all is not a promise of JSON either.
    const bare = await capturing(url, { title: "pwned" }, {
      headers: { "content-type": null },
    })
    expect(bare.status).toBe(415)

    // Nothing was written by any of them: no inbox was even minted.
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  }),
  BOUND_MS,
)

/**
 * …and the belt beside that brace. `Sec-Fetch-Site` is a forbidden header name,
 * so a page cannot forge it; a browser stamps it on every request and a script
 * sends none at all. So its ABSENCE may never refuse — the `curl` in a cron job
 * is the reference client — while a browser owning up to another site is turned
 * away whatever identity the tailnet put on the request.
 */
test(
  "a browser that says the request came from another site is refused",
  inServed(async (url, root) => {
    for (const said of ["cross-site", "same-site", "none"]) {
      const answered = await capturing(url, { title: "pwned" }, {
        headers: { "sec-fetch-site": said },
      })
      expect([said, answered.status]).toEqual([said, 403])
    }
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])

    // A bookmarklet running ON an olai page is a client somebody may write.
    expect(
      (await capturing(url, { title: "from the page" }, {
        headers: { "sec-fetch-site": "same-origin" },
      })).status,
    ).toBe(201)
  }),
  BOUND_MS,
)

/** A charset parameter is the sender's business — several HTTP clients add one
 *  unasked, and refusing them would be refusing correct requests to no end. */
test(
  "the content type is read by its type, not by its parameters",
  inServed(async (url) => {
    for (const said of ["application/json", "application/json; charset=utf-8", "APPLICATION/JSON"]) {
      const answered = await capturing(url, { title: `sent as ${said}` }, {
        headers: { "content-type": said },
      })
      expect([said, answered.status]).toEqual([said, 201])
    }
  }),
  BOUND_MS,
)

test(
  "a request with no identity header is refused, and writes nothing",
  inServed(async (url, root) => {
    const answered = await capturing(url, { title: "buy milk" }, { identity: null })
    expect(answered.status).toBe(401)
    expect((await refusal(answered)).error).toContain(IDENTITY_HEADER)
    // A blank one is the same refusal: a header set to nothing is a header
    // that attributes nothing.
    expect((await capturing(url, { title: "buy milk" }, { identity: "   " })).status).toBe(401)
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  }),
  BOUND_MS,
)

test(
  "an empty capture is refused in the ops layer's own words",
  inServed(async (url, root) => {
    const answered = await capturing(url, { title: "   " })
    expect(answered.status).toBe(400)
    const said = await refusal(answered)
    expect(said.kind).toBe("usage")
    // Not a sentence this door invented: it is what an agent's `add_node` is
    // told, which is what keeps one refusal from having two wordings.
    expect(said.error).toContain("title")
    // …and the inbox this capture would have minted was not left behind.
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  }),
  BOUND_MS,
)

test(
  "a body that is not JSON, and a field this door does not take",
  inServed(async (url, root) => {
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
  }),
  BOUND_MS,
)

test(
  "a client may not say who captured this",
  inServed(async (url, root) => {
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

    // …and a key that is only the same key AFTER the planner trims it is the
    // same refusal, which is the review finding: an exact comparison answered
    // `201` here and then dropped the client's value on the merge, which is
    // "recorded exactly as sent" for a capture that was not.
    const padded = await capturing(url, {
      title: "x",
      props: { [`${CAPTURED_BY} `]: "someone@else" },
    })
    expect(padded.status).toBe(400)
    expect((await refusal(padded)).error).toContain(CAPTURED_BY)
    expect(Object.keys(outlinesIn(root))).toEqual(["a.olai"])
  }),
  BOUND_MS,
)

test(
  "a GET is answered as the wrong method, not as the app",
  inServed(async (url) => {
    const answered = await fetch(`${url}${CAPTURE_PATH}`)
    expect(answered.status).toBe(405)
    // The point of the arm: the shell's `GET /*` would have handed a person
    // reaching for `curl` a page of HTML and no explanation — and it is the
    // same shape as every other refusal, not a third thing to parse.
    expect((await refusal(answered)).error).toContain(IDENTITY_HEADER)
  }),
  BOUND_MS,
)
