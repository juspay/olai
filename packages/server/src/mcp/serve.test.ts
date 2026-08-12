/**
 * `olai mcp <dir>` against a real directory, as a real child process.
 *
 * The unit tests beside this one prove the halves: `tools.test.ts` the tool
 * contract and `face.test.ts` the resources, both through an in-memory MCP
 * client, and `@olai/ops`'s `ops.test.ts` the write gate under them. What is
 * only true end to end is what this file is for — that a client which knows
 * nothing about olai except how to launch a command can mark a node, and that
 * the bytes it changed are on the disk of a process it does not share.
 *
 * It is a child process rather than `serveTools` called in this one because
 * the claims are about a PROCESS: that stdout carries the protocol and nothing
 * else, that the notice a person reads went somewhere a parser will not see,
 * and that closing the client's end of the pipe is what stops it. None of
 * those can be observed from inside — and the last one is the reason this file
 * is the ONLY place the stdio drain is proven, because a drain is a claim about
 * a process exiting rather than about a function returning.
 *
 * Every test is one CONVERSATION — write the messages, close stdin, read
 * everything back. That shape is available because stdin's close IS the
 * shutdown, and it is worth taking: the multi-message test below hands the
 * server several requests and closes the pipe under them, so a drain that lost
 * a reply fails it. Answers are matched BY ID rather than by position, which
 * matters more than it used to: the pump this replaced answered in order, and
 * the SDK's transport does not promise to.
 *
 * The interactive client, which has to leave the pipe open while a browser is
 * looked at, is the e2e suite's (`packages/tests/support/mcp.ts`).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { Pending } from "@olai/format"
import { gitIn, repoAt, subjectsIn, writerOf } from "@olai/ops/testlib"

import { stoppedWithin } from "../child.testlib.ts"

const MAIN = path.join(import.meta.dirname, "..", "main.ts")

/** How long a whole conversation may take before it is a hang. Generous: what
 *  is being told apart is "immediately" from "never". */
const BOUND_MS = 15_000

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
  "",
].join("\n")

/** A directory of outlines, thrown away with the test. */
const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-mcp-"))
  fs.writeFileSync(path.join(root, "house.jsonl"), HOUSE)
  return root
}

/** The same directory, as somebody's notes actually are: a work tree with an
 *  identity and the outlines already committed, so what the log says afterwards
 *  is exactly what this conversation did. `repoAt` is `@olai/ops`' own builder —
 *  the one that exists because three test files had each grown a copy and they
 *  had drifted over the branch name. The seed's subject is named so a test
 *  reading the log back can tell the fixture's commit from olai's. */
const servedRepo = (): string => {
  const root = fs.realpathSync(served())
  repoAt(root, { message: FIXTURE_COMMIT })
  return root
}

const FIXTURE_COMMIT = "the outlines, as somebody's notes"

/** The body of the newest commit — everything past the subject line. */
const bodyOf = (root: string): string => gitIn(root)("log", "-1", "--format=%b")

interface Frame {
  readonly id?: number
  readonly result?: Record<string, unknown>
  readonly error?: { readonly code: number; readonly message: string }
}

/** One request. `id` is left off for a notification, which is the whole of the
 *  difference between the two in JSON-RPC. */
const ask = (
  id: number | null,
  method: string,
  params?: unknown,
): Readonly<Record<string, unknown>> => ({
  jsonrpc: "2.0",
  ...(id === null ? {} : { id }),
  method,
  params,
})

interface Said {
  readonly frames: ReadonlyArray<Frame>
  readonly err: string
  /** Whether it stopped when the pipe closed. Asserted by the test about that,
   *  and load-bearing for every other one: a process still running would have
   *  been killed with its answers half-read. */
  readonly stopped: boolean
}

/**
 * Launch it, say all of that, close the pipe, and collect everything it said.
 *
 * `stoppedWithin` is what makes the collection complete: it waits for the
 * child's stdio to drain, not merely for the process to be gone, so a test
 * that read nine of ten frames cannot happen.
 */
const converse = async (
  root: string,
  messages: ReadonlyArray<Readonly<Record<string, unknown>>>,
  /** How this serve was started, past the directory. `--no-commit` unless a
   *  test is ABOUT committing: a temp directory is not a repository, and the
   *  tests that do not care should not spawn git to find that out. */
  argv: ReadonlyArray<string> = ["--no-commit"],
): Promise<Said> => {
  const child = spawn(process.execPath, [MAIN, "mcp", root, ...argv], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      // Assertions on stderr read logfmt fields (`root=`); pin so a shell
      // with OLAI_LOG=pretty cannot reshape them.
      OLAI_LOG: "logfmt",
    },
  })

  let out = ""
  let err = ""
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => {
    out += chunk
  })
  child.stderr?.on("data", (chunk: string) => {
    err += chunk
  })

  child.stdin?.end(messages.map((message) => `${JSON.stringify(message)}\n`).join(""))

  const stopped = await stoppedWithin(child, BOUND_MS)
  if (!stopped) child.kill("SIGKILL")

  return { frames: framesOf(out), err, stopped }
}

/**
 * The same server, spoken to by a REAL MCP client that launched it.
 *
 * {@link converse} writes everything at once and closes stdin, which is the
 * right shape for the claims it is used for — drain, framing, shutdown — and the
 * wrong shape for anything ORDERED. The SDK's transport hands each message to
 * the handler without waiting for the last one to finish (the same fact
 * `stdio()` exists to drain around), so a batched `set_done` and `commit` race:
 * the commit can survey the repository before the write it was meant to record
 * has reached the disk. That is not a bug in the server — no agent emits its
 * next tool call before reading the last result — but it is a trap for a test.
 *
 * So the ordered claims use the SDK's OWN client over its own
 * `StdioClientTransport`, which spawns the command and takes turns. That is not
 * merely convenient: it is the exact arrangement `claude mcp add olai -- olai
 * mcp ~/outlines` produces, so these tests exercise the path a person actually
 * gets rather than a hand-rolled approximation of it — and the framing, the id
 * correlation and the timeouts are the SDK's problem rather than ours.
 */
const withServer = async <A>(
  root: string,
  use: (client: Client) => Promise<A>,
  /** How the serve was started, past the directory. Empty is the DEFAULT, which
   *  is what most of these assert; the flag tests below are the reason it is a
   *  parameter rather than a constant. */
  argv: ReadonlyArray<string> = [],
): Promise<A> => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MAIN, "mcp", root, ...argv],
    // The server's own stderr, inherited, so a failure to start is visible in
    // the test's output rather than swallowed by the transport.
    stderr: "inherit",
    env: { ...process.env, OLAI_LOG: "logfmt" } as Record<string, string>,
  })
  const client = new Client({ name: "somebody's agent", version: "0" })
  await client.connect(transport)
  // `finally`, not a closing line in each test: an assertion that throws would
  // otherwise skip the close and leave a server holding a watcher over a temp
  // directory for the rest of the run. The same reason `withFace` next door
  // takes a callback.
  try {
    return await use(client)
  } finally {
    await client.close()
  }
}

/** One tool call, answered — with the refusal raised here rather than three
 *  lines later as an undefined read. */
const called = async (
  client: Client,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
): Promise<Record<string, unknown>> =>
  (await client.callTool({ name, arguments: args })) as Record<string, unknown>

/** stdout, as the only thing it is allowed to be. A line that will not parse
 *  is a client's parser looking at prose, so it fails here with the line —
 *  which is what makes "stdout is the protocol" a property of every test in
 *  this file rather than of the one that says so. */
const framesOf = (out: string): ReadonlyArray<Frame> =>
  out
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      try {
        return JSON.parse(line) as Frame
      } catch {
        throw new Error(
          `this line on stdout is not a JSON-RPC frame:\n  ${line}\n` +
            `stdout is the protocol, so anything else there is a message the client cannot read`,
        )
      }
    })

const answerTo = (said: Said, id: number): Frame => {
  const found = said.frames.find((frame) => frame.id === id)
  if (found === undefined) {
    throw new Error(
      `nothing answered id ${id}. Frames: ${JSON.stringify(said.frames)}\n  stderr: ${
        said.err.trim() || "(empty)"
      }`,
    )
  }
  return found
}

const HANDSHAKE = { protocolVersion: "2025-06-18", capabilities: {} }

test("a client that launched it can mark a node, and the disk says so", async () => {
  const root = served()
  const said = await converse(root, [
    ask(1, "initialize", { ...HANDSHAKE, clientInfo: { name: "olai's own test", version: "0" } }),
    ask(null, "notifications/initialized"),
    ask(2, "tools/list"),
    ask(3, "tools/call", { name: "set_done", arguments: { id: "order" } }),
    ask(4, "tools/call", { name: "set_done", arguments: { id: "nowhere" } }),
  ])

  expect(answerTo(said, 1).result?.protocolVersion).toBe("2025-06-18")

  // The closed list is what an agent may do, and it arrives without olai
  // having told this client anything else about itself.
  const tools = (answerTo(said, 2).result?.tools ?? []) as ReadonlyArray<{ name: string }>
  expect(tools.map((tool) => tool.name)).toContain("set_done")

  expect(answerTo(said, 3).result?.isError).toBeUndefined()

  // The claim of the whole item: a process that is not olai's browser, and not
  // olai's own agent, changed the outline on disk — through the ops layer, so
  // the record is whole and the file still parses.
  const order = fs
    .readFileSync(path.join(root, "house.jsonl"), "utf8")
    .split("\n")
    .find((line) => line.includes(`"id":"order"`))
  expect(order).toInclude(`"done":`)
  expect(JSON.parse(order ?? "null")).toMatchObject({
    id: "order",
    parent: "kitchen",
    title: "order the cabinets",
  })

  // A refusal is an ANSWER, not a protocol error: nothing declares `nowhere`,
  // and what comes back says which kind of refusal that is.
  const refused = answerTo(said, 4)
  expect(refused.error).toBeUndefined()
  expect(refused.result?.isError).toBe(true)
  expect(refused.result?.structuredContent).toMatchObject({ kind: "not-found" })

  // Four requests, four frames: the notification in the middle was answered
  // with silence, which a client would otherwise have to match against nothing.
  expect(said.frames).toHaveLength(4)
}, BOUND_MS * 3)

test("the notice a person reads is not on the protocol's stream", async () => {
  // `framesOf` has already refused anything on stdout that is not a frame, so
  // what is left to say is where the other half went. The line names the
  // directory, because a person debugging a client's config has to be able to
  // see which one it opened.
  //
  // `path.resolve`, deliberately not `fs.realpathSync`: the server resolves the
  // argument it was given and does not chase symlinks, and on macOS `/tmp` IS
  // one (`/private/tmp`). Realpathing here would assert that olai prints a path
  // nobody typed.
  const root = served()
  const said = await converse(root, [ask(1, "initialize", HANDSHAKE)])

  expect(said.err).toInclude("serving the outline surface over stdio")
  expect(said.err).toInclude(`root=${path.resolve(root)}`)
})

test("closing the client's end of the pipe stops it", async () => {
  // An MCP client shuts a server down by closing stdin. A process that stayed
  // up would be one per agent session, left holding a watcher on somebody's
  // notes directory forever.
  const said = await converse(served(), [ask(1, "initialize", HANDSHAKE)])

  expect(said.stopped).toBe(true)
}, BOUND_MS * 3)

/**
 * The no-argument tool, called down the real pipe.
 *
 * `tools.test.ts` proves both halves of this in memory — that `list_outlines`
 * is ADVERTISED as the empty object rather than wrapped under `value`, and that
 * calling it returns the outlines. This closes the gap between those two
 * proofs and a child process: the wrapping bug that made every no-argument call
 * fail was a property of the SCHEMA BRIDGE, which is transport-independent, but
 * "transport-independent" is a claim and this is the cheap way to hold it.
 *
 * It is also the first call an agent makes, so a regression here is not one
 * tool failing — it is the whole capture flow, before an agent has learned
 * which outlines exist.
 */
test("the no-argument tool works over the pipe, advertised and called", async () => {
  const said = await converse(served(), [
    ask(1, "initialize", HANDSHAKE),
    ask(null, "notifications/initialized"),
    ask(2, "tools/list"),
    ask(3, "tools/call", { name: "list_outlines", arguments: {} }),
  ])

  // Advertised as the empty object. `value` here is the wrapping that broke it.
  const listed = (answerTo(said, 2).result?.tools ?? []) as ReadonlyArray<
    { name: string; inputSchema: unknown }
  >
  const tool = listed.find((entry) => entry.name === "list_outlines")
  expect(tool?.inputSchema).toMatchObject({ type: "object", properties: {} })
  expect(JSON.stringify(tool?.inputSchema)).not.toContain(`"value"`)

  // And answered, with the fixture's outline in it.
  const answer = answerTo(said, 3).result
  expect(answer?.isError).toBeUndefined()
  const outlines = (answer?.structuredContent as { outlines?: ReadonlyArray<{ file: string }> })
    ?.outlines ?? []
  expect(outlines.map((outline) => outline.file)).toContain("house.jsonl")
}, BOUND_MS * 3)


/**
 * The whole point of the item, over a real pipe: OPS ACCUMULATE, ONE COMMIT.
 *
 * This is the behaviour `olai mcp` did not have. Every write committed itself,
 * so an agent doing one unit of work put one commit per op into somebody's log
 * — four inside fifteen seconds, in the case that got this filed. Now the
 * writes land and wait, and the agent says when its work is finished and what
 * it was.
 *
 * Everything here is the real thing: a spawned binary, JSON-RPC down its stdin,
 * and the assertions read out of `git log` afterwards. Nothing is stubbed,
 * because every part of the claim — that the default is `manual`, that four ops
 * make no commits at all, that `commit` then makes exactly one, that the message
 * is the agent's own and the trailer says which face asked — is a property of
 * the whole path rather than of any one layer in it.
 */
test("ops accumulate and one commit records them, with the agent's message and trailer", async () => {
  const root = servedRepo()
  // No `--commit` flag at all: `manual` is the DEFAULT on this face, and a test
  // that passed the flag would not be asserting that.
  await withServer(root, async (client) => {
  await called(client, "set_done", { id: "order" })
  await called(client, "set_doing", { id: "install" })
  await called(client, "add_node", { parent: "kitchen", title: "measure the alcove" })
  await called(client, "set_desc", { id: "install", desc: "the fitter comes Tuesday" })

  // Four ops in, and the log has not moved. Under the old behaviour it had
  // grown four commits by this line.
  expect(subjectsIn(root)).toEqual([FIXTURE_COMMIT])

  const answer = await called(client, "commit", { message: "plan the cabinet fitting" })
  expect(answer["isError"]).toBeUndefined()
  // THREE, for four ops, and the difference is the point: `changes` counts
  // NODES as they differ from HEAD, not calls that were made. `install` was
  // marked and then noted, so it is one node with two fields changed — which is
  // what a person reading the panel sees, and what the commit body lists. A
  // count of ops would be a tally of our own beside a truth git already holds.
  expect(answer["structuredContent"]).toMatchObject({ _tag: "Committed", changes: 3 })


  // ONE commit for the four ops, on top of the one the fixture made.
  const log = subjectsIn(root)
  expect(log).toHaveLength(2)
  // The agent's own sentence, prefixed — `git log --grep '^olai'` is the audit
  // view, and `--invert-grep` gives a person back their real history.
  expect(log[0]).toBe("olai: plan the cabinet fitting")

  // WHO, permanently. Git records the repository's own name and email whoever
  // asked, so without the trailer this commit is indistinguishable from one the
  // human typed — which would defeat the point of an audit trail of what the
  // TOOL wrote. `mcp`, not `chat-agent`: this client is somebody's own agent in
  // a terminal, and that difference is recorded nowhere else.
  expect(writerOf(root)).toBe("mcp")

  // A message the agent SUPPLIED is used verbatim: the trailer is added and
  // nothing else. What the agent said is why the work was done, which is the
  // half git cannot derive — appending our own list under it would be arguing
  // with the sentence it just wrote.
  expect(bodyOf(root)).toBe("X-Olai-Writer: mcp\n\n")

  // And the tree is clean: everything waiting went in, so the next thing this
  // agent does starts from nothing pending.
  expect(gitIn(root)("status", "--porcelain").trim()).toBe("")
  })
}, BOUND_MS * 3)

/**
 * The other door: a commit with NO message.
 *
 * An agent that has nothing better to say leaves `message` out, and then the
 * message is COMPOSED from what actually changed — a subject naming the biggest
 * change by the fixed order, and a body listing the rest per node. That is the
 * fallback that keeps the audit trail readable when nobody wrote a sentence,
 * and it is the one place the per-node detail reaches git.
 */
test("a commit with no message composes one from what changed, per node", async () => {
  const root = servedRepo()
  await withServer(root, async (client) => {
  await called(client, "set_done", { id: "order" })
  await called(client, "add_node", { parent: "kitchen", title: "measure the alcove" })
  const answer = await called(client, "commit")
  expect(answer["structuredContent"]).toMatchObject({ _tag: "Committed" })

  // Prefixed and composed: `created` outranks `done` in the fixed order, so the
  // subject names the capture and the body carries both.
  const subject = subjectsIn(root)[0] ?? ""
  expect(subject).toStartWith("olai: ")
  expect(subject).toContain("measure the alcove")

  // Never a text diff. The unit is the node and what changed about it, in the
  // same words the per-op summaries use.
  const body = bodyOf(root)
  expect(body).toContain("done: order the cabinets")
  expect(body).toContain("capture: measure the alcove")
  expect(body).toContain("X-Olai-Writer: mcp")
  })
}, BOUND_MS * 3)

/**
 * The refusal that decided manual over automatic, over the same pipe.
 *
 * A repository mid-merge, mid-rebase or on a detached HEAD cannot take a commit,
 * and nothing used to check — so an agent marking a node done in the middle of a
 * conflict could sweep somebody's half-finished resolution into a commit nobody
 * asked for. The WRITE still lands, because the bytes are on disk before git is
 * consulted and refusing the write would be the wrong lie; what refuses is the
 * commit, and it says which state it is in so the agent can tell a person what
 * to finish.
 */
test("a busy repository refuses the commit and says which state it is in", async () => {
  const root = servedRepo()
  // Detached, the way an agent finds it when somebody is mid-bisect.
  gitIn(root)("checkout", "--quiet", "--detach", "HEAD")

  await withServer(root, async (client) => {
  const wrote = await called(client, "set_done", { id: "order" })
  const refused = await called(client, "commit", { message: "will not land" })

  // The WRITE happened. That is the guarantee, and it is not negotiable: git
  // never fails a write.
  expect(wrote["isError"]).toBeUndefined()
  expect(fs.readFileSync(path.join(root, "house.jsonl"), "utf8")).toContain(`"done":`)

  // And the write's OWN reply already said the repository is the problem —
  // before the agent called `commit` and got refused. Telling it "waiting…
  // until the `commit` tool asks for one" would have sent it to a tool that
  // cannot help, which is #108's lesson in manual mode's clothes.
  const wroteDetail = wrote["structuredContent"] as { why?: string }
  expect(wroteDetail.why).toContain("detached HEAD")
  expect(wroteDetail.why).not.toContain("waiting to be committed")

  // The COMMIT did not, and the answer says so as DATA rather than as prose the
  // agent would have to parse — including which state, by name.
  expect(refused["structuredContent"]).toMatchObject({
    _tag: "Blocked",
    repo: { _tag: "Blocked", reason: "detached" },
  })

  // Nothing was recorded: still the fixture's own commit and no other.
  expect(subjectsIn(root)).toEqual([FIXTURE_COMMIT])
  })
}, BOUND_MS * 3)

/**
 * What is WAITING, and what was LAST RECORDED, read over the same pipe.
 *
 * This is the other half of the `commit` tool. The tool is how an agent records
 * its work; `surface://cells/pending` is how it knows there is work to record,
 * what the record will say, and whether this directory has ever been recorded
 * in at all. Without it an agent under the default mode is writing into a state
 * it cannot observe — it would have to commit blind, or shell out to `git
 * status`, which is exactly the file access this surface exists not to have.
 *
 * `last` is asserted in both of its states because the `null` is load-bearing:
 * an empty change list cannot tell "nothing is waiting because I just
 * committed" from "nothing is waiting because olai has never written here", and
 * those are different facts about the same directory.
 */
test("what is waiting, and what was last recorded, are readable over the pipe", async () => {
  const root = servedRepo()
  await withServer(root, async (client) => {
  const readOnce = async (): Promise<Pending> => {
    const answer = await client.readResource({ uri: "surface://cells/pending" })
    const contents = answer.contents as ReadonlyArray<{ text: string }>
    return JSON.parse(contents[0]?.text ?? "null") as Pending
  }

  /**
   * Read until it says what the last write made true.
   *
   * This cell is PUSHED, not computed per read: the server republishes it on
   * the revision a write produces, which lands on the next turn of its loop —
   * so a read issued in the same breath as the write's reply can legitimately
   * still hold the value from before it. A subscribed client is TOLD (the face
   * sends `notifications/resources/updated`); this test asks again instead,
   * which is the same wait without the subscription bookkeeping.
   *
   * It is a view, and nothing depends on it being instantaneous: `commit`
   * re-surveys git itself and never reads this cache, so a stale read can make
   * an agent look again — never make a commit wrong.
   */
  const read = async (until: (pending: Pending) => boolean): Promise<Pending> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const pending = await readOnce()
      if (until(pending)) return pending
      await new Promise((resume) => setTimeout(resume, 20))
    }
    throw new Error(`the pending cell never said what was expected (50 tries)`)
  }

  // Nothing written yet: a work tree, on a branch, with nothing waiting — and
  // `last` is null, which says olai has never recorded anything here.
  const before = await read(() => true)
  expect(before.repo).toEqual({ _tag: "Ready", branch: "main" })
  expect(before.changes).toEqual([])
  expect(before.last).toBeNull()

  await called(client, "set_done", { id: "order" })

  // Now it is waiting, and it says WHAT is waiting — per node, classified, with
  // the message a commit would get if the agent has nothing better to say.
  const waiting = await read((pending) => pending.changes.length > 0)
  expect(waiting.changes).toHaveLength(1)
  expect(waiting.changes[0]).toMatchObject({
    file: "house.jsonl",
    id: "order",
    title: "order the cabinets",
    sort: "done",
  })
  expect(waiting.message).toContain("done")
  // And WHO wrote it — intent, which git cannot answer and this decorates the
  // git-derived truth with. `mcp`, because that is the face this process is.
  expect(waiting.wrote).toEqual([{ writer: "mcp", ops: 1 }])
  expect(waiting.last).toBeNull()

  await called(client, "commit", { message: "the cabinets are ordered" })

  // Committed: nothing waiting, the writer tally cleared, and `last` is now
  // olai's own commit rather than the repository's HEAD.
  const after = await read((pending) => pending.last !== null)
  expect(after.changes).toEqual([])
  expect(after.wrote).toEqual([])
  expect(after.last).toMatchObject({
    message: "olai: the cabinets are ordered",
    writer: "mcp",
  })
  expect(after.last?.sha).toMatch(/^[0-9a-f]{40}$/)

  })
}, BOUND_MS * 3)

/**
 * Committing twice: the second one has nothing to do, and says so.
 *
 * The other half of the pair the brief asks for over stdio — the busy-repo
 * refusal is above, and this is the ordinary "there was nothing waiting". It
 * matters because an agent that commits on a timer, or that finishes two units
 * of work with no writes between them, hits it constantly: it is not a fault
 * and must not arrive looking like one, so it is its OWN arm rather than a
 * `Failed` carrying "nothing to commit" out of git.
 */
test("a second commit with nothing waiting answers NothingToCommit, not a failure", async () => {
  const root = servedRepo()
  await withServer(root, async (client) => {
    await called(client, "set_done", { id: "order" })
    expect(await called(client, "commit", { message: "the cabinets are ordered" }))
      .toMatchObject({ structuredContent: { _tag: "Committed" } })

    const again = await called(client, "commit", { message: "nothing changed since" })
    expect(again["isError"]).toBeUndefined()
    expect(again["structuredContent"]).toMatchObject({ _tag: "NothingToCommit" })
  })

  // And the second call left no empty commit behind, which is the thing the
  // arm exists to prevent.
  expect(subjectsIn(root)).toEqual(["olai: the cabinets are ordered", FIXTURE_COMMIT])
}, BOUND_MS * 3)

/**
 * The tri-state, through the SPAWNED binary rather than through the parser.
 *
 * `commits.test.ts` holds the truth table as values, which is the right level
 * for what the flags MEAN. What it cannot hold is that the flag a subcommand
 * declares is actually wired to the mode the ops layer runs in — that is argv,
 * a `Command.make` spread and a composition root, and it is only true end to
 * end. `olai mcp` shipped once with no flag at all, so "the flag reaches the
 * behaviour" is exactly the claim worth spending two spawns on.
 */
test("--commit=auto commits every write on its own, through the real binary", async () => {
  const root = servedRepo()
  await withServer(root, async (client) => {
    await called(client, "set_done", { id: "order" })
    await called(client, "set_doing", { id: "install" })
  }, ["--commit=auto"])

  // One commit per op, which is what `auto` IS — and what `manual` above
  // replaced. The subjects are the per-op summaries rather than a composed one.
  expect(subjectsIn(root)).toEqual([
    "olai: doing: install them",
    "olai: done: order the cabinets",
    FIXTURE_COMMIT,
  ])
}, BOUND_MS * 3)

/**
 * Both flags at once, through the same path: `--no-commit` wins.
 *
 * The one case in the truth table with a decision in it, and the one a person
 * can actually type by accident — a script with `--no-commit` baked in, plus a
 * `--commit=auto` somebody added later. Honouring the opt-out is the reading
 * that cannot surprise them by writing to a history they asked olai to stay out
 * of, and that has to hold through argv rather than only through the function.
 */
test("--commit=auto --no-commit is off, through the real binary", async () => {
  const root = servedRepo()
  await withServer(root, async (client) => {
    const applied = await called(client, "set_done", { id: "order" })
    // The write landed, and the reply says the OPT-OUT is why it is not in the
    // history — not that it is waiting for anybody.
    const detail = applied["structuredContent"] as { committed?: boolean; why?: string }
    expect(detail.committed).toBe(false)
    expect(detail.why).toContain("--commit=off")
  }, ["--commit=auto", "--no-commit"])

  // Nothing recorded, and the write is on disk.
  expect(subjectsIn(root)).toEqual([FIXTURE_COMMIT])
  expect(gitIn(root)("status", "--porcelain")).toContain("house.jsonl")
}, BOUND_MS * 3)
