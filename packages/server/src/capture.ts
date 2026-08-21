/**
 * `POST /capture` — one line into the directory's inbox, from anywhere on the
 * tailnet.
 *
 * The whole feature is a door, and every client after it is somebody else's few
 * lines: a Raycast script that asks Mail.app what is selected, an Apple
 * Shortcut on the share sheet, a `curl` in a cron job (docs/running.md has the
 * recipes). None of them is olai's to build, and none of them needs anything of
 * olai's installed.
 *
 * ## What it is, and what it deliberately is not
 *
 * It is the SAME write as everything else: {@link captureInto} resolves the
 * inbox convention against the reading the write is judged on, the ops layer
 * plans it, the write gate validates the whole set and renames atomically, and
 * the commit rides `--commit` exactly as any other op's does. There is no
 * second writer here, no path this route can name, and nothing it can say that
 * an agent's `add_node` could not have said — which is the HACKING.md
 * consistency rule read forwards rather than a coincidence.
 *
 * It is NOT the MCP door with a friendlier shape. `/mcp` is a whole closed tool
 * table behind a bearer; this is one verb with no id, no file and no target,
 * because the thing it exists to make cheap is the five seconds between having
 * a thought somewhere else and it being in the vault. WHERE the capture then
 * belongs is a decision made in the app afterwards, which is what an inbox IS.
 *
 * ## Auth is the identity header, and that is the whole of it
 *
 * `Tailscale-User-Login` is REQUIRED (human, 2026-08-21). `tailscale serve`
 * injects it in front of the process, the transport is tailnet-gated, and so
 * there is no token to mint, nothing secret to paste into a share sheet, and no
 * client that has to be re-issued when a key rotates. A request without the
 * header is refused.
 *
 * TWO THINGS THAT BUYS, said out loud because neither is obvious:
 *
 *   - it is the ATTRIBUTION. The login is written onto the captured node as a
 *     property ({@link CAPTURED_BY}), so what arrived from a phone is a fact in
 *     the file rather than a line in a log — and it is queryable
 *     (`prop:captured-by=…`) beside whatever else the client sent. That is a
 *     different question from the `X-Olai-Writer` trailer, which records the
 *     DOOR: git already knows the repository's own user, and neither of the two
 *     can answer for the other.
 *   - it is the CSRF gate, for free. A page on some other origin cannot set a
 *     custom header on a `fetch` without a preflight this listener does not
 *     answer, and cannot set one on a form post at all — so requiring the
 *     header is what stops a page somebody is reading from writing into their
 *     vault, which is the one realistic attack on a port bound where a browser
 *     can reach it.
 *
 * WHAT IT DOES NOT BUY, equally out loud: the header is a claim the TRANSPORT
 * makes, so anything that can reach this port can make it too. That is the same
 * bargain the rest of this listener already takes — the surface is
 * unauthenticated and `olai web` says so at boot when it binds off loopback —
 * and it is why the ruling pairs "no token" with "no public exposure". Put this
 * behind `tailscale serve`, or leave it on loopback.
 *
 * ## Dated, because nobody is watching
 *
 * A capture arrives carrying today's date, so it lands on the day's journal
 * page as well as in the inbox. That is the difference between this door and
 * the palette's `⌘K` `+`, and it is a difference between two GESTURES rather
 * than between two faces: a person capturing in the app has the Inbox door in
 * front of them, and a line that arrived from somewhere else while nobody was
 * looking has a day page as the only place it will be noticed. Both are an ops
 * `add` and both are judged identically.
 *
 * A `date` with no mark is an OCCURRENCE (docs/format.md's Status): it is on
 * the day, it can never be overdue, and it is not a task somebody has to
 * finish. Which is what a capture is.
 *
 * WHOSE CLOCK, said because the honest answer is "not the sender's": the stamp
 * is `@olai/format`'s `stampOf` read HERE, so it is the local time where the
 * vault is served, with the offset written out — the value names one instant,
 * and the day it groups under is the server's. A phone eight zones away
 * capturing near midnight lands on the server's day rather than its own. That
 * is a wrinkle rather than a bug and it is left standing deliberately: the
 * alternative is a fourth field carrying the sender's clock, which is a field
 * every client can get wrong for a difference nobody has yet complained about.
 * The one thing that would be wrong is a `Z` instant, which would file
 * somebody's evening under tomorrow — and `stampOf` is the one place in this
 * codebase that decision is made.
 */

import {
  type Capturing,
  captureInto,
  type FailureKind,
  kindOf,
  type OpFailure,
  stampOf,
  UsageFailure,
  type Writer,
} from "@olai/format"
import type { Applied, Ops } from "@olai/ops"
import { Effect, Layer, Option, Result, Schema } from "effect"
import {
  Headers,
  HttpRouter,
  type HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"

/** Where the route lives. Named once: the docs, the clients and the tests all
 *  spell this one. */
export const CAPTURE_PATH = "/capture"

/** The header the identity is read off, spelled the way a client writes it —
 *  it is in the docs, in every recipe and in the refusal this door answers
 *  with. `Headers.get` lower-cases it on the way in, so there is one spelling. */
export const IDENTITY_HEADER = "Tailscale-User-Login"

/** The property the identity is recorded as. A key rather than a field,
 *  because the format gives it no meaning and olai reads nothing in it — it is
 *  there for the person who captured, and for `prop:captured-by=…`. Hyphenated
 *  like the two the Mail recipe writes (`message-id`), and deliberately not a
 *  word the format already has, which `set_prop`'s own rule would refuse. */
export const CAPTURED_BY = "captured-by"

/**
 * What a capture may say.
 *
 * THREE FIELDS AND A MAP, which is v1's ruling read literally: a title, the
 * text that becomes the note, the URL the capture points back at, and the
 * named facts a client already knows (`from` and `message-id` for the Mail
 * case, which is what makes de-duplicating by `prop:message-id` possible). No
 * `target`, no file, no parent, no mark — where a capture belongs is decided in
 * the app afterwards, and a door that could aim would be a door somebody has to
 * configure.
 *
 * `onExcessProperty: "error"` at the decode, so a client that sends `body` for
 * `text`, or `props` spelled `properties`, is told rather than silently having
 * half its capture dropped. That is the same trap `@olai/format`'s `writing.ts`
 * declares the bent `after` field for, met at a different door.
 */
const Posted = Schema.Struct({
  /** The row. Verbatim: a blank one is refused by the ops layer in its own
   *  words, which is the sentence an agent's `add_node` gets. */
  title: Schema.String,
  /** The note. Markdown, stored verbatim, exactly as a `desc` anywhere else. */
  text: Schema.optionalKey(Schema.String),
  /** Where this came from, as a link in the note. */
  url: Schema.optionalKey(Schema.String),
  /** The named facts this capture is born with — `add_node`'s `props`. */
  props: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
})
type Posted = typeof Posted.Type

const decode = Schema.decodeUnknownResult(Posted, {
  errors: "all",
  onExcessProperty: "error",
})

/**
 * The note a capture ends up with — the text, and the link under it.
 *
 * COMPOSED AT THIS DOOR and deliberately not below it, which is the one place a
 * capture is more than the fields it was posted with. It stays here because
 * there is no second caller for it and the shape it composes is this REQUEST's
 * — the palette's `⌘K` sends a line a person typed where it is going to live,
 * and an agent's `add_node` writes whatever `desc` it means. The rule the
 * inbox convention actually shares between doors went down to `@olai/format`
 * ({@link captureInto}); this did not, because nothing else asks it.
 *
 * THE LINK GOES LAST and on its own paragraph. A note is drawn clamped to one
 * line under a row and expanded on a click (docs/editing.md), so the half a
 * reader sees without asking should be what they wrote rather than sixty
 * characters of URL — and for the Mail case the text is a comment somebody
 * typed and the link is the pointer it is about, which is the order it reads in
 * anyway.
 *
 * A MARKDOWN AUTOLINK (`<…>`) rather than a bare URL, so the link is a link
 * whatever the address looks like: GFM's autolink literals cover `http(s)` and
 * not `message:`, which is exactly the scheme this feature exists for. That is
 * a claim about the READER as much as about this line, and the two ends are
 * held together by a test rather than by a shared constant, because this end
 * names no scheme at all: `@olai/web`'s `markdown/render.test.ts` renders the
 * exact spelling written here and asserts the anchor survives the sanitiser
 * (whose allowlist is `markdown/sanitise.ts`, the file that DOES name the
 * scheme). Nothing here escapes anything — a `desc` is stored as it is given
 * and rendered at view time through the one sanitised pipeline every other note
 * goes through.
 */
const noteOf = (posted: Posted): string | undefined => {
  const said = [
    posted.text,
    posted.url === undefined || posted.url === "" ? undefined : `<${posted.url}>`,
  ].filter((part): part is string => part !== undefined && part !== "")
  return said.length === 0 ? undefined : said.join("\n\n")
}

/**
 * The capture, as the ops layer takes one — or the refusal that it is not one.
 *
 * THE IDENTITY IS THE LAST WORD, and this function is where the rule that makes
 * that safe LIVES rather than being a check somewhere above it: a client that
 * sends {@link CAPTURED_BY} itself is refused HERE, one line from the merge
 * that would otherwise have overruled it. Split apart — a guard in the handler,
 * a spread down here — the two were held together by nothing but the order they
 * happened to be written in, and deleting the guard would have left a door that
 * answers `201` to a forged attribution it silently rewrote.
 *
 * A `UsageFailure`, which is what it is: the request itself is wrong, nothing
 * was read and nothing was written. That is also what puts it on the same
 * answer, in the same shape and with the same word, as every refusal the ops
 * layer makes — rather than in a sentence of this door's own.
 */
const captureOf = (
  posted: Posted,
  login: string,
  at: Date,
): Result.Result<Capturing, OpFailure> => {
  if (posted.props !== undefined && Object.hasOwn(posted.props, CAPTURED_BY)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${CAPTURED_BY}\` is written from the ${IDENTITY_HEADER} header and ` +
          "cannot be sent: it is who captured this, and a capture may not say that " +
          "about itself",
      }),
    )
  }
  const note = noteOf(posted)
  return Result.succeed({
    title: posted.title,
    ...(note === undefined ? {} : { desc: note }),
    // Dated so it lands on the day's journal page — see the header. The stamp
    // is `@olai/format`'s, the one place every date value olai writes is
    // minted.
    date: stampOf(at),
    props: { ...posted.props, [CAPTURED_BY]: login },
  })
}

/**
 * What each refusal is over HTTP.
 *
 * A closed table over `FailureKind` rather than a switch with a fallback, so a
 * fifth kind is a compile error here — the same shape `@olai/format`'s own
 * `KINDS` keeps, one layer up. `validation` is 422 and not 400 because the
 * request was well-formed and the SET it would produce is not, which is a
 * different thing to tell a client than "you sent the wrong shape"; `busy` is
 * 503 because retrying is the whole advice.
 */
const STATUS: Readonly<Record<FailureKind, number>> = {
  usage: 400,
  "not-found": 404,
  validation: 422,
  busy: 503,
}

/**
 * EVERY refusal this door makes, in ONE shape.
 *
 * A client parsing an answer should not have to work out which check produced
 * it: a missing header, a body that is not JSON, a field this door does not
 * declare and a title the ops layer would not take are all "this request did
 * not become a node", and they were three sentences in `text/plain` and one
 * JSON object until they were read side by side. `error` is the sentence and
 * `kind` is `@olai/format`'s own word for it, which is the same pair the MCP
 * face already answers with (`../mcp/tools.ts`).
 *
 * The STATUS is passed rather than derived, because the three this door raises
 * itself are not all `usage`'s 400 — a missing identity is a 401 and means
 * something a client acts on differently. The kind still says what it is.
 */
const refusing = (status: number, error: string, kind: FailureKind) =>
  HttpServerResponse.jsonUnsafe({ error, kind }, { status })

/** A refusal that came back from the write, in the ops layer's own words and
 *  under its own kind — never re-worded here, so a capture refused for a blank
 *  title says what an agent's `add_node` says. */
const refused = (failure: OpFailure) => {
  const kind = kindOf(failure)
  return refusing(STATUS[kind], failure.message, kind)
}

/** A capture that landed. The id is what a client keeps — to link back at
 *  `/#<id>`, or to notice it has captured this message before — and `committed`
 *  / `why` are the same pair every other write's answer carries, so a caller
 *  learns its line is on disk and waiting rather than having to assume. */
const landed = (done: Applied) =>
  HttpServerResponse.jsonUnsafe({
    id: done.id,
    title: done.title,
    file: done.file,
    committed: done.committed,
    ...(done.why === undefined ? {} : { why: done.why }),
  }, { status: 201 })

export interface Options {
  /** The one writer — the same `Pick` the surface's own binder takes. */
  readonly ops: Pick<Ops, "read" | "run">
  /**
   * WHICH FACE this door is, decided where the face is COMPOSED.
   *
   * `capture`, and it is an argument rather than a word this file says, which
   * is the shape `runtime.ts`'s `bind` already has for the browser and the
   * agent: a transport that named its own writer would be a transport that
   * could name another one's, and the `X-Olai-Writer` trailer is only worth
   * anything because nothing about the request can influence it.
   */
  readonly writer: Writer
}

/**
 * The three refusals whose text depends on NOTHING, built once.
 *
 * A response value is safe to share — `./media.ts` already keeps a single
 * `missing` for every 404 it answers, and its `PREFIX` note is the same
 * argument about bytes — and these three are the ones a port scanner and a
 * mistyped `curl` reach, so they are exactly the ones not to re-encode per
 * request. Named rather than inline as well: the 401's sentence is what
 * docs/running.md promises and what `./capture.test.ts` asserts, and a
 * constant is something both can point at.
 */
const NO_IDENTITY = refusing(
  401,
  `${IDENTITY_HEADER} is required: this door is authenticated by the tailnet in ` +
    "front of it, and a request that carries no identity has nothing to attribute " +
    "the capture to",
  "usage",
)
const NOT_JSON = refusing(400, "the body is not JSON", "usage")
/** What a method this door does not answer is told, rather than falling through
 *  to the shell's `GET /*` and being handed the app: a person reaching for
 *  `curl` and forgetting `-X POST` deserves a sentence and not a page of HTML. */
const WRONG_METHOD = refusing(
  405,
  `POST a capture here, with a ${IDENTITY_HEADER} header — see docs/running.md`,
  "usage",
)

/**
 * The route, as two `HttpRouter` layers merged — the shape `./mcp/route.ts`
 * already has for a path that answers one method and refuses the others.
 * `HttpRouter` ranks by specificity, so both beat the shell's `GET /*`
 * catch-all whichever order the layers go in.
 */
export const captureRoute = (
  options: Options,
): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  Layer.merge(
    HttpRouter.add(
      "POST",
      CAPTURE_PATH,
      (request: HttpServerRequest.HttpServerRequest) =>
        Effect.gen(function*() {
          // `Headers.get` rather than an index: it lower-cases the name itself,
          // so the spelling a client writes is the spelling this file reads and
          // there is no second constant to keep in step with the first.
          const login = Option.getOrElse(
            Headers.get(request.headers, IDENTITY_HEADER),
            () => "",
          ).trim()
          if (login === "") return NO_IDENTITY

          const body = yield* Effect.result(request.json)
          if (Result.isFailure(body)) return NOT_JSON

          const posted = decode(body.success)
          // The schema's own words. It names the field and what was wrong with
          // it, which is more than any sentence written here could, and a
          // client debugging a share sheet is exactly who needs it.
          if (Result.isFailure(posted)) return refusing(400, String(posted.failure), "usage")

          const what = captureOf(posted.success, login, new Date())
          if (Result.isFailure(what)) return refused(what.failure)

          const done = yield* Effect.result(capture(options, what.success))
          return Result.isFailure(done) ? refused(done.failure) : landed(done.success)
        }),
    ),
    HttpRouter.add("GET", CAPTURE_PATH, WRONG_METHOD),
  )

/** Read the set, resolve where a capture lands against THAT reading, write it
 *  under the writer this door was composed as. The three lines the door is for,
 *  and the only place this file touches the ops layer. */
const capture = (
  options: Options,
  what: Capturing,
): Effect.Effect<Applied, OpFailure> =>
  Effect.flatMap(
    options.ops.read,
    (at) => options.ops.run(captureInto(at, what), options.writer),
  )
